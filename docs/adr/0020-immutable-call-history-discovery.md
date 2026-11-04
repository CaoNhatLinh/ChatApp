# ADR 0020 — Immutable month-scoped call history keys

Date: 2026-10-23. Status: producer/repository and authorized history API implemented;
member UI and live Cassandra acceptance remain open. Extends ADRs0017–0019,
fresh installations only.

## Context

The existing unused calls/participants tables describe provider rooms, media
attendance and ACTIVE status without any runtime writer for those facts. A
callId is unique only within a conversation, so a callId-only participant
partition could also mix identities. Signaling authority already stores the exact
caller, callee, original start order and latest lifecycle state. It does not prove
media attendance or measured duration.

Room enumeration cannot implement personal history. Post-claim projection writes
can lose discoverability when a process dies between authority and index writes.
Mutable copied statuses introduce stale-writer regression and repair complexity.

## Decision

Use two immutable discovery indexes. `calls_by_conversation` partitions by
conversation and UTC creation month, descending start order/callId.
`calls_by_user` partitions by actor and the same month, descending start order/
conversation/callId. Prewrite the room key and both actor keys before incoming
discovery, cyclic recovery work and authority CAS. Every write must succeed.
No TTL, copied status, profile, provider metadata or deletion participates.

Partial, losing and uncertain attempts may leave false-positive keys. The future
authorized history consumer must hydrate the exact room/call authority and check
the full original start tuple, month and actor participation before returning
anything. It must continue after filtered rows. No prewrite can manufacture a
successful call without authority; every successful claim has completed its
discovery writes. Heartbeat/terminal transitions never rewrite these keys.

The unused media-participant projection is removed from the fresh initializer.
For direct calls, exactly two participant roles and consent facts will derive from
authority, not a second mutable source. No existing volume/table/data was deleted
and no automatic migration/backfill is provided.

## Alternatives and consequences

- Post-commit-only indexes need repair-before-receipt to close a crash window.
  Prewrites avoid that additional state machine for immutable keys.
- Duplicated status snapshots need version fencing and can still expose stale
  outcomes. Hydration keeps one lifecycle authority.
- Unbucketed personal history repeats an indefinitely growing partition; explicit
  month selection bounds the query partition. It does not bound monthly load,
  false-positive storage growth or the existing authority partition.
- Full tuple continuation is required for same-millisecond calls and reused
  callIds across rooms. Uniform descending clustering supports a strict tuple `<`.
- History availability becomes a prerequisite for starting a call. A failure is
  retryable through the existing same-call identity flow, not swallowed to lose
  history silently. Three additional quorum writes add cost; capacity requires
  measurement, not an assumed latency guarantee.
- Storage deletion, TTL/backfill and retention must not be added casually: removing
  keys could lose history, and replayed old producers can recreate hints.

## Verification and remaining work

Controlled repository tests bind each key, UTC month, tuple, limit, consistency,
retry and failure. Authority tests check ordering and prevent CAS after history
failure; mutation tests assert no terminal/heartbeat rewrite. Static schema tests
assert both keys/order and removal of fictional participant metadata. An opt-in
two-driver test covers ties and reused call IDs; it compiles but is not run while
Docker is deferred. None of these proves live CQL/crash behavior.

## Historical read boundary

The authorized API follow-up implements own and room/month pages plus exact
room/call detail. Require current actor membership, existing DM and exact
authority participation, without requiring the peer to remain a member. Archive
or a block restricts new contact, not these authorized historical facts. There
is no admin-role bypass, profile/presence disclosure or callback-eligibility flag.
The actor cannot keep reading through the own index after losing room membership.

Hydrate authority and original start/month identity, not the current slot alone:
terminal calls remain readable after later calls replace the slot. Expire an
overdue nonterminal through the existing fenced transition and bounded reread;
do not invent MISSED in the DTO. Slot replacement races reread; storage failures
and sustained contention are errors. Filtered pages continue from scanned keys.

One explicit public view carries caller/callee, type, direction, actor-relative
outcome and lifecycle timestamps, plus exactly two role/consent facts. The caller
sees UNANSWERED for authority MISSED; only the callee sees MISSED. Consent does
not prove media attendance, joined/left times or measured talk duration. Cursors
are bound to version, actor, own/room scope, UTC month and every tie key; current
authorization is still required on every request.

Canonical contract: `tasks/call-history-contract.md`; current controlled API
evidence: `tasks/call-history-api-verification-2026-10-23.md`. No history UI or
live datastore/media completion follows from the API or earlier producer tests.

Controlled member-UI follow-up is separately implemented and recorded in
`tasks/call-history-ui-verification-2026-10-23.md`: own/DM UTC-month reading,
same-plane exact participant detail, explicit bounded continuation and inline
failure, session/request guards, VI/EN/theme/mobile evidence. It consumes the
history view without interpreting consent as media attendance or exposing a
callback permission. This does not establish live datastore/broker/two-client/
restart/crash/media acceptance or peer-account eligibility for new contact.

Design basis: [Cassandra4.1 tuple restrictions and LIMIT](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html)
and [Java driver4.19 immutable statement options](https://apache.github.io/cassandra-java-driver/4.19.0/core/statements/).
These sources support the chosen access pattern, not a live test result.
