# ADR 0017 — Single-partition direct-call authority

Status: accepted; C1 and controlled active-DM C2 transport are implemented. C2
worker/event recovery is now connected under ADR 0018; C3 history and live gates remain open.
Date: 2026-10-20.

The historical hourly-discovery paragraphs below are superseded by ADR 0018.

## Context

The current direct-call controller broadcasts authorized signaling without durable
lifecycle state. Existing call-history/participant tables cannot prevent two starts
or rebuild a trustworthy outcome after reconnect. The approved expansion requires
distinct cancel/decline/missed/failure outcomes and server-authoritative timestamps.
It does not approve a media provider or equate signaling acceptance with connection.

## Decision

Use a capability-owned `canonical/call` policy, service and typed repository. A
single conversation partition in `call_state_by_conversation` contains a reserved
zero-UUID slot and call rows. Call rows store a typed serialized snapshot and a
revision; slot rows store the active call ID and revision. Identity is immutable.
Conditional start changes the empty slot and inserts the call together. Every
transition checks slot and call revisions together; a terminal mutation clears
the slot. Only these conditional paths write authority. Slot revisions never reuse
an earlier token. No state is added to `CanonicalCqlStore`.

The typed JSON snapshot keeps participant timing and lifecycle changes atomic
without pretending separate participant/history rows form a transaction. It contains
only the declared record fields; no SDP, ICE, credentials or media payloads. Separate
history projections must hydrate this authority rather than become a second truth.

Prewrite bounded, 16-shard UTC-hour expiry pointers before nonterminal mutations.
Include the candidate and expected slot revisions. A candidate whose snapshot is
missing cannot simply be discarded: a paused writer might still commit. Only a
changed expected slot fence proves the pending write cannot win. Exact matching
due snapshots expire by CAS. No TTL silently removes overdue recovery work.
The C2 worker must durably revisit uncertain pointers and process historical
backlog; this ADR does not claim such a worker already exists.

Ringing lasts 45 seconds, not extendable by heartbeat. Acceptance means signaling
consent, not media connection. Its lease expires 90 seconds after the older peer
heartbeat; one responsive peer cannot keep an absent peer alive. Late actions
first apply expiry. Terminal calls never reopen; identical start retries return
the original identity and changed identity conflicts. Claiming is conversation
scoped, not a promise of a global single-call-per-user busy mechanism.

The service checks current direct membership, active room, CALL_START and both
directions of authoritative social blocks before start. Accept and heartbeat check active
room/block state. Existing participants may close a blocked/archived call while
still members. Server expiry requires no continuing user permission.

## Alternatives

- Separate claim-by-user/room and call-by-ID writes: rejected as the initial
  authority because crashes can leave a half-acquired cross-partition claim.
- Process-local map or lock: rejected; another node/restart loses authority.
- TTL-only expiry: rejected; it erases the record instead of recording the outcome.
- Read history/projection and then insert: rejected; not a competing-start fence.
- New SQL database or generic orchestration framework: unnecessary infrastructure.

## Consequences and evidence

Conversation partitions grow with call history; lifecycle reads are exact-key,
not scans. C3 still needs bounded history discovery/retention design and hydration.
An active call permits only one authority mutation at a time within a conversation;
CAS costs/clock skew/load must be measured on real infrastructure. No performance
or whole-system transaction guarantee is inferred from unit tests.

C1 was an internal prerequisite. The C2 follow-up now integrates durable results,
session-private acknowledgments and a typed client channel; AsyncAPI is updated.
Worker/event recovery remains open. There is no new public REST endpoint in C1
or that transport slice. See `tasks/call-transport-verification-2026-10-20.md`.

See `tasks/call-authority-verification-2026-10-20.md`,
`tasks/call-lifecycle-contract.md`, and opt-in `CallLifecycleCassandraIT`.
Docker is deferred by the user; real CQL/two-client/restart/crash evidence remains
unproven and must not be represented by the in-memory concurrency model.

Sources: [Cassandra 4.1 DML, including conditional updates and batch isolation](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html#batch),
[Apache Java Driver 4.19 idempotence](https://apache.github.io/cassandra-java-driver/4.19.0/core/idempotence/).
The implementation explicitly disables driver speculative/retry eligibility for
these bound operations; uncertain mutations are reconciled by authority, not
blindly treated as a new start.

## Contact-account eligibility follow-up — 2026-10-23

The lifecycle contact gate now uses canonical `UserRepository` account reads in
addition to room membership/archive/block checks. Both participants must exist
and be ACTIVE for new/continuing contact, active-call discovery and outbound
call delivery. Generic denial does not disclose which status or participant
failed; repository failure is not interpreted as missing/inactive. This adds no
copied account field to call authority and no compatibility constructor/fallback.

Peer ineligibility must not strand cleanup or rewrite history: explicit terminal
actions, server expiry and authorized historical facts retain their separate
policies. These account reads are point-in-time, not a cross-partition atomic
revocation fence or proof of stopping already-established media immediately.
Evidence: `tasks/call-contact-eligibility-verification-2026-10-23.md`.
