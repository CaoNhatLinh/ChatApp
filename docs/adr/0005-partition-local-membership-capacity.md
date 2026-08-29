# ADR 0005: Partition-local room membership capacity

- Status: Accepted
- Date: 2026-08-29

## Context

Room membership rows and room metadata previously stored separate copies of
`member_count`. Adding, removing, leaving, and joining by invite changed member
rows without changing the metadata count. Capacity checks could therefore admit
too many members, and the global room directory could show a stale total.

Capacity is a concurrency boundary. It must decide whether a member row exists
and whether the room has space as one Cassandra operation; a read followed by
independent writes is not sufficient.

## Decision

`conversation_members_by_conversation` owns two static partition values:
`member_count` and `max_members`. A conditional logged batch in that one
conversation partition combines the member-row condition (`IF NOT EXISTS` or
`IF EXISTS`) with a compare-and-set update of `member_count`.

The room metadata row no longer stores or reads either value. Every canonical
room read requires the membership partition state; missing state is a hard data
integrity error, not a legacy fallback. The per-user room list and bounded
monthly admin directory remain derived projections. Successful mutations update
them, and an idempotent retry repairs those projections without duplicating the
audit event.

Initial creation writes at most 201 membership rows (owner plus 200 invited
members) in one partition-local logged batch. Larger rooms are populated through
the normal conditional member command after creation.

Invite consumption distinguishes a newly consumed use from an already accepted
concurrent request. Only a use owned by the current command may be compensated
when the membership capacity claim loses a race.

## Alternatives rejected

- Keep the count on `conversations_by_id`: member and metadata rows are in
  different partitions, so this cannot enforce capacity atomically.
- Use a Cassandra counter column: counters cannot participate in the required
  conditional batch and do not solve member-row idempotency.
- Count member rows for each request: this is unbounded, expensive, and still
  races with a concurrent mutation.
- Accept eventual capacity: this violates the hard `maxMembers` contract.

## Consequences

- Membership mutations pay the cost of lightweight transactions only at the
  capacity/idempotency boundary.
- Conditional statements in the batch must always target the same conversation
  partition.
- Existing keyspaces must apply
  `migrations/V_add_conversation_membership_state.cql` before running this code.
  Runtime code does not infer or backfill old counts.
- Clean-stack Cassandra application and contention/load proof remain release
  gates.

## References

- [Apache Cassandra CQL DML](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/dml.html)
- [Apache Cassandra CQL reference](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/cql_singlefile.html)
- [DataStax CQL BATCH reference](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_reference/cqlBatch.html)
