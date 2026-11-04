# ADR 0018 — Cyclic call work and recoverable state publication

Status: accepted for implementation; live Cassandra/broker/crash/load gates open.
Date: 2026-10-20. Supersedes only ADR 0017's hour-bucket discovery strategy.

Implementation checkpoint: the canonical fresh schema, authority prewrites,
scheduled worker, publication receipts and STATE client/server contract are now
connected. Repository/worker tests use mocked drivers and controlled authority;
they do not establish live CQL execution, crash recovery or production throughput.
Docker-dependent acceptance is deferred by the user, not a completed gate.

## Problem

An hour lookback cannot recover arbitrarily old work after downtime. Deleting an
empty bucket directory can race a paused producer that has not inserted its work
yet. A publication can also fail after authority commits, even on a terminal
transition that no longer has an active expiry. A missing snapshot is not proof
that its prewrite can be deleted while the producer's slot CAS can still win.

## Decision

Retain the conversation slot/snapshot authority. Replace the not-yet-live hourly
expiry table in the canonical fresh schema with a pending-only work queue across
16 fixed shards. Work keys contain due time, conversation, call, revision and kind.
Queries always name a shard, full tuple continuation, due bound and row limit;
there is no ALLOW FILTERING or full-table scan. A separate per-shard CAS checkpoint
wraps to the beginning after exhaustion. Inserts behind the checkpoint, old work,
and failed rows remain eligible on the next cycle. There is no temporal lookback
or TTL that silently discards recovery work.

Before any authority mutation, prewrite publication work and (if nonterminal)
expiry work. Failure before this registration completes cannot commit authority.
Publication work is immediately due; expiry uses the authoritative deadline.
Prewrites retain expected slot revision and a 30-second producer write deadline.
If the candidate is still missing after that deadline and its expected slot can
still win, the worker CAS-bumps that slot revision without changing its active
call. Only that successful fence, or proof it already changed, permits deletion.
A paused producer then cannot commit after its pointer was removed.
Snapshot/slot reads may straddle a commit: if the slot now equals the candidate
revision, retain the work and reread on the next cycle instead of treating the
changed expected slot as proof of an orphan. Newer authority has its own prewrite.

Each call authority row keeps published_version, initially zero. State changes
preserve this receipt and increase snapshot version. Publication reads authority,
hands the typed STATE snapshot to the room topic and both participant user
destinations, then conditionally advances the
receipt only for that same revision. The queue remains after publish/receipt
failure. Duplicate publication is permitted; clients order states by version.
This is recoverable broker handoff of the latest state, not exactly-once delivery
to a subscriber and not an immutable log of every intermediate transition.

Each destination receives fresh server-owned SIMP scope metadata. Outbound
delivery rechecks exact current participants, DM access, both block directions
and deadline. STATE requires the current revision. SIGNAL remains on the room
topic only and requires the current call to remain ACCEPTED; a heartbeat revision
alone must not invalidate already-authorized in-flight SDP/ICE. The private
queue cannot carry SIGNAL and raw/other-user subscriptions are denied.

The current simple broker is node-local and user destinations only target sessions
known to that node. Successful handoff with no connected recipient is not durable
offline notification. Global pending-call lookup/reconnect discovery and any
multi-node broker/user-registry strategy are separate gates, not implicit here.

Control events use STATE without a fabricated actor. Ephemeral SIGNAL events
retain the authenticated actor/target. Timeout/repair therefore does not pretend
a participant ended or accepted the call. Both server and browser switch to this
single discriminated contract; no legacy control-event fallback is retained.

Workers may run on multiple nodes. Authority, publication receipts and checkpoint
CAS fence changes; no process-local claim or worker lease can strand work. A failed
row does not block later rows: retain it, advance the bounded page cursor, and
revisit after wrap. A crash before checkpointing may repeat work, safely. Expiry
prewrites terminal publication before clearing the slot, so a crash after expiry
does not lose its final state handoff.

## Trade-offs and limits

Fixed shards avoid the bucket-retirement race, but are long-lived delete-heavy
partitions. LIMIT bounds returned rows, not tombstones scanned. Production scale,
backlog latency, partition size, compaction/repair and failure recovery must be
measured; this is not a claim of unlimited throughput or a hard timeout SLA. No
unsafe gc_grace/TTL tuning is introduced without live evidence. A future queue
replacement must preserve authority fencing and late-producer recovery, not just
add a bounded lookback. No new broker/provider dependency is introduced.

The schema targets fresh installations, as the user requested. On integration,
the old hourly definition/consumer will be removed from the canonical initializer; no live database,
data or volume is modified and no upgrade compatibility path is added. History,
global incoming/reload discovery and real media remain separate work.

Sources: [Cassandra DML: conditions, batch isolation and tuple queries](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html),
[Spring 6.2 scheduling](https://docs.spring.io/spring-framework/reference/6.2/integration/scheduling.html).
