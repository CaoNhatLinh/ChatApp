# ADR 0008: Partition-local room role lifecycle

- Status: Accepted
- Date: 2026-08-29

## Context

Custom role creation checked the role list before an unconditional insert, so
concurrent requests could reuse a code or exceed the 50-role limit. Deletion
checked member assignments before deleting from a separate table, allowing an
assignment to race into a deleted role.

## Decision

`conversation_roles_by_conversation` is keyed by `(conversation_id, role_code)`
and stores a static `custom_role_count`. Creation conditionally increments the
count and inserts the unique code in one partition-local batch. Role rows have
an explicit `ACTIVE` or `DELETING` lifecycle.

The membership partition stores a static `role_revision`. Assignment and
ownership transfer condition their member mutation on the revision they used
to read active role definitions. Deletion first marks the role `DELETING`, then
advances the membership revision. Older assignments fail their CAS; newer
assignments cannot select the deleting role. After the barrier, deletion either
restores an assigned role or conditionally removes it and decrements the
catalog count.

## Consequences

- Role code uniqueness and the custom-role limit remain correct under
  concurrent creators.
- Assignment, ownership transfer and deletion cannot commit a reference to a
  role removed by the same race.
- The two authority partitions are not presented as a cross-table transaction;
  the revision barrier makes their ordering explicit.
- Existing role rows are not inferred or copied. Apply
  `migrations/V_rebuild_conversation_role_authority.cql` and recreate intended
  room roles explicitly before enabling the runtime.
