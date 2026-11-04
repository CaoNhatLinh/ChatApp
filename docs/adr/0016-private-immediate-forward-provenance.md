# ADR0016 — Verified snapshots and private immediate forward provenance

Status: accepted within the approved F1/F2 scope. Date:2026-10-20.
Creation/batch portion partially superseded by ADR0023 (2026-10-23): conditional
message authority and explicit source-index repair replace the logged create batch.

## Context

The canonical send contract already accepted three forward-source keys without
verifying them. Public messages and shared realtime also exposed those private
keys. An attributed copy must not be client-invented or disclose a room to a
destination member who cannot access that room. Source data and authorization
can change between an uncertain send and retry.

## Decision

Use the existing full-payload fingerprint and message claim. Before allocation,
require current source membership, live non-blocked source, and exact request
snapshot equality against source authority. Materialize copied content from that
verified source. Do not generate a new body from a changed mutable source under
the same command. A matching committed retry returns its existing destination
message first and repairs source indexes/forward attachments without rechecking
the mutable source. An uncommitted changed snapshot conflicts instead.

Store only the immediate source; no recursive original-source chain. The existing
`message_forwards_by_source_message` index is written with the message in a
LOCAL_QUORUM logged batch. Deterministic millisecond timeuuid plus target message
ID makes exact retry repair converge. This is Cassandra batchlog/retry semantics,
not transaction isolation across partitions or a background reconciliation claim.

Keep keys internal in the message record; Jackson public serialization and shared
STOMP expose only `forwarded`. Resolve navigation through a destination-keyed
point endpoint that reads the stored source key, rechecks both memberships and
block/deletion state, and returns identical unavailable shape for private/missing
sources. No target-room enumeration API is introduced. Source revocation removes
navigation; it does not retract an already shared destination copy.

Forward attachments must match bounded source authority and current ready/active
asset metadata. Normal upload sends remain owner-only. POLL/SYSTEM has no copy
runtime and is rejected. Forwarded text cannot be edited into false attribution.

## Alternatives rejected

- Trust client source keys/body: permits fabricated attribution and private leaks.
- Always recopy current server content on retry: one idempotency command could
  silently acquire a different payload after source edits.
- Broadcast source metadata and hide UI conditionally: the client already has
  the private data; frontend visibility is not authorization.
- Add a second forward command/claim authority now: duplicates existing durable
  command identity without solving an additional approved requirement.

## Remaining verification

UI send/source affordances are F2, not completed by this ADR. Live Cassandra
batchlog/restart/crash, two-client revocation and asset lifecycle safety remain
separate gates. Docker was deferred by the user. No data migration or provider
configuration is performed by this change.
