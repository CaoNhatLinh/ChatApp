# 0023 — Conditional message authority creation

Date: 2026-10-23. Status: accepted, controlled implementation verified; live gate open.

Partially supersedes ADR0015/0016: message and reply/forward projection creation
no longer share the former logged batch. Their authorization, complete keys and
read hydration decisions are unchanged.

## Context

The client-command claim fixes a message key and request fingerprint, but it does
not serialize every worker resuming that command. Two workers can observe the
message as missing. The former unconditional message INSERT could then reset
content, deletion flags and revision after another worker created and edited or
deleted the row. A pre-read cannot close that race.

## Decision

Replace the ambiguous `save` operation with `createIfAbsent`: one
`INSERT ... IF NOT EXISTS` of the message authority using LOCAL_QUORUM and
LOCAL_SERIAL. Return the driver's actual `wasApplied()` boolean. No unconditional
fallback, same-key replacement, in-process lock or cross-partition transaction is
used. This method has no projection side effects.

The service branches on authority creation, not ownership of the earlier client
claim. The actual creator writes bucket/source projections, attachments, mentions
and the current first-send effects. The loser reads the current authority at the
claimed key, runs existing repair (without rewriting the message) and returns its
public view. Missing authority after an unapplied create is a conflict requiring
the same command ID, not invented success. Ambiguous storage errors propagate.

Reply and forward projections are explicit, stable-key repairable writes after
authority creation. This avoids treating a projection batch as a creation fence.
It also means a process stopping between authority and projection needs retry or
future durable reconciliation; the old cross-row batch guarantee is not retained.

## Alternatives rejected

- Read-before-unconditional-insert: the reported interleaving remains possible.
- Local JVM synchronization: does not coordinate independent workers/processes.
- Treat the client-claim owner as the only publisher: another worker may actually
  create the authority after that owner stops, suppressing initial effects.
- Keep the old void `save` as a compatibility wrapper: hides whether a row was
  created and permits callers to assume overwrite semantics.
- Claim that LWT covers source indexes, provider IO and outbox: those are separate
  partitions/systems and still require explicit recovery work.

## Consequences

Initial message creation pays for an additional local-datacenter LWT. Load and
multi-datacenter behavior are not accepted by unit tests. Logical deletion retains
the authority row, so a later create cannot reset its fields; physical purge/TTL
and late replay require a future retention policy.

This protects the authority from a delayed creator. It does not make subsequent
edits/deletes/publication one snapshot and does not recover side effects lost
after an applied create. Durable command completion/outbox and real two-client /
crash/restart verification remain open.

## Sources and evidence

[Apache CQL DML](https://cassandra.apache.org/doc/4.0/cassandra/cql/dml.html)
documents the conditional INSERT behavior; the installed driver's
[ResultSet.wasApplied API](https://apache.github.io/cassandra-java-driver/4.19.0/api/com/datastax/oss/driver/api/core/cql/ResultSet.html)
reports its outcome. Project evidence:
`tasks/message-creation-verification-2026-10-23.md`.
