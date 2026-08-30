# ADR 0009: Bounded message interaction hydration

- Status: Accepted
- Date: 2026-08-30

## Context

Message history persisted the canonical message row, but reactions and read
state reached the UI only through STOMP events. Refreshing a room therefore
lost reaction badges and seen state. Fetching reactions and receipts once per
message would turn a 50-message page into an N+1 query pattern. Returning all
room interactions would grow without the message cursor and disclose data the
current viewport does not need.

## Decision

`MessagePage` includes a required additive `interactions` collection keyed by
`messageId`. The service groups the bounded page by `messageBucket` and issues
one reaction query plus one read-summary query for each bucket represented in
that page. Every query also restricts its clustering rows to the page's message
IDs.

Reaction authority remains `message_reactions_by_message`, which provides the
per-user conditional insert/delete. The page projection stores one idempotent
row per user reaction in
`message_reactions_by_conversation_bucket`; the service aggregates these rows
and derives `reactedByCurrentUser` from the authenticated actor. A retry always
repairs the projection row even when the authority LWT reports that the source
row already exists or is already absent. Counter projections were rejected
because a failure between the LWT and counter update cannot be repaired safely
by replaying the same command.

Read progress, the exact receipt and the bucket summary are written in one
bounded logged batch. The page exposes only `latestReadAt`; the existing
message-specific receipt endpoint remains the explicit path when a detailed
receipt list is requested.

Pin state remains part of the canonical message row. Pin and unpin return the
updated message, so the initiating client renders the exact state immediately;
STOMP still distributes the same idempotent boolean to other sessions.

No compatibility fallback or legacy backfill is provided. The new projection
tables are the only page-hydration path after the migration is applied.

## Alternatives considered

- Per-message reaction/receipt requests: rejected because request and Cassandra
  query volume scale with the number of rendered messages.
- Room-wide interaction snapshot: rejected because its response and read cost
  are unbounded and unrelated to the message cursor.
- Counter-per-message projection: rejected because cross-partition counter
  writes cannot share the authority LWT and replay is not idempotent.
- Client-only STOMP state: rejected because reconnect and refresh cannot recover
  interactions deterministically.

## Consequences

- Refresh-safe interaction hydration adds no frontend request and performs two
  bounded projection reads per represented message bucket, never per message.
- Reaction writes add one idempotent projection mutation; read writes use one
  three-statement logged batch.
- Page response size grows only with interactions attached to that bounded page.
- Clean Cassandra migration and provider-backed load/recovery verification are
  still required before claiming distributed production proof.
