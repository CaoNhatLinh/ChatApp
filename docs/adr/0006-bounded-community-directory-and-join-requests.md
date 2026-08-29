# ADR 0006: Bounded community discovery and join requests

- Status: Accepted
- Date: 2026-08-29

## Context

Public-room discovery must support language, category, tag, name-prefix and
stable cursor pagination without scanning Cassandra. Approval admission also
needs one authoritative request that survives retries and concurrent operators.

## Decision

`community_directory_by_filter` stores only lookup keys in 16 deterministic
shards per canonical filter. Reads query every bounded shard, merge by
`(name_normalized, conversation_id)`, then hydrate current room and membership
state from their canonical partitions. Archived and non-community rooms are
excluded after hydration.

`community_join_request_by_user` stores one authoritative request per room and
user. `community_join_requests_by_conversation` keeps the ordered
operator/history projection.
An operator claims a pending row through LWT before declining or adding the
member with the partition-local membership operation from ADR 0005. The same
operator may resume an `APPROVING` row after an interrupted projection repair;
another operator receives a conflict. Internal recovery states are mapped to
the small public membership-state contract.

## Consequences

- Query cost is bounded by 16 shard reads plus the requested page hydration.
- Directory rows are projections; stale keys cannot make an archived room
  visible because canonical state is re-read.
- There is no runtime branch for the removed bucket/tag discovery designs.
- Existing keyspaces must apply `migrations/V_add_community_directory.cql`.
- Clean Cassandra migration, LWT contention and multi-user browser journeys
  remain release gates.
