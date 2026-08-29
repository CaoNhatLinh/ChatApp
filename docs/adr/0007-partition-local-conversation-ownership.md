# ADR 0007: Partition-local conversation ownership

- Status: Accepted
- Date: 2026-08-29

## Context

The room metadata row stored `owner_id`, while the protected OWNER role lived
on member rows in another Cassandra partition. Ownership transfer updated the
two members and metadata independently, so a partial failure could leave two
owners, no owner, or an owner ID that disagreed with effective permissions.
Concurrent kick, leave, or role assignment could also overwrite the transfer.

## Decision

`conversation_members_by_conversation` owns static `owner_id` and
`owner_updated_at` beside its existing membership count and capacity. Fresh room
creation initializes all four static values. `conversations_by_id` no longer
stores an owner copy; canonical room hydration reads ownership from the
membership partition and uses the later metadata/ownership timestamp.

Transfer uses one same-partition conditional logged batch: the previous owner
role set, next owner role set and static owner values change only when the
expected owner and both expected role sets still match. Member removal includes
an owner condition, and ordinary role assignment uses compare-and-set so neither
operation can overwrite a concurrent transfer. A repeated transfer repairs
derived per-user/admin projections without appending another audit event.

## Consequences

- Ownership and OWNER permission change atomically at one Cassandra boundary.
- Role, remove and transfer commands may return a conflict after concurrent
  state changes; the caller must refresh and retry.
- Existing keyspaces must apply
  `migrations/V_add_conversation_owner_state.cql` before this runtime starts.
  Missing owner state is an integrity error; runtime code does not infer it from
  old metadata.
- Projection repair remains idempotent and does not change ownership authority.
