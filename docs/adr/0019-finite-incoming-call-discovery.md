# ADR 0019 — Finite incoming-call discovery keys

Status: accepted for implementation; live Cassandra/broker/crash gates open.
Date: 2026-10-22. Extends ADRs0017/0018 without changing call authority.

## Context

Private STATE delivery only reaches currently connected sessions. The active-DM
point read cannot discover an incoming call in an unknown room after reload.
Scanning every conversation is unbounded. Updating a per-user projection only
after authority commits loses discovery on process failure. Deleting a shared
projection key can erase a competing or paused producer's newer write.

## Decision

Prewrite a callee-scoped, deadline-ordered key before new-call authority CAS.
Key is `(callee, fixed ring deadline, conversation, call)`, with no copied state
or candidate revision. Read current slot/snapshot and current access before
returning the existing public CallSnapshot. Failed/lost/paused claims can leave
false positives but cannot fabricate a returned call. Heartbeat revision changes
do not invalidate the immutable key, and no projection delete is needed.

The key has a 24-hour physical TTL, while RINGING is eligible for only 45 seconds
from its fixed server-created time. Thus even a producer resumed after TTL expiry
cannot commit a still-eligible call whose pointer has vanished. This proof relies
on fixed deadlines/server time, not on timely worker execution. The non-TTL
cyclic repair queue remains responsible for eventual expiry/publication.

Reads use one callee partition and complete tuple keyset pagination, bounded raw
rows with filtered-empty continuation, current deadline checks and no-store.
Only authorization/missing-room denials are filtered; transient authority failures
remain errors. Detailed endpoint/validation: `tasks/incoming-call-discovery-contract.md`.

## Alternatives and consequences

- Post-commit projection: rejected because a crash makes an eligible call invisible.
- Shared mutable key with eager deletion: rejected because cleanup requires
  additional fencing to avoid ABA/late-writer loss.
- Attempt-revision key plus worker cleanup: unnecessary identity/repair work for
  a fixed 45-second eligibility window; heartbeat also advances revision.
- Room enumeration: rejected because work scales with a member's room directory.

TTL keeps physical retention finite, not throughput free. Per-user partitions
remain tombstone-heavy under abuse/high traffic; LIMIT bounds returned/scanned
application rows, not SSTable tombstones or latency. No production capacity or
hard recovery SLA is claimed without live measurements. Pagination is a changing
feed, not a frozen snapshot; subscribe-before-read and canonical version merging
remain client responsibilities. No database/volume/provider is changed here.
The eligibility proof shares the lifecycle's server-time assumption: application
and database clocks must be synchronized and must not jump backwards by the
retention window. It is not a guarantee against arbitrary multi-day clock faults.

Basis: [Cassandra4.1 DML: tuple ranges and TTL](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html).
