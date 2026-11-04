# 0027 — Versioned full-pin snapshots and explicit stale intent

Date: 2026-10-23. Status: connected canonical API/client/search protocol with
controlled checks; real datastore/broker/engine and durable recovery pending.

## Decision

Expose the conversation pin aggregate through authenticated member-scoped,
no-store GET `/api/conversations/{conversationId}/messages/pins`. It returns the
whole bounded pin set, not a partial action. `revision` is a canonical nonnegative
int64 **decimal string**; JavaScript Number must not truncate it.

POST/DELETE `/messages/{messageId}/pin` require `expectedRevision` in JSON and
return `{message,pinState}`. If the desired value already holds, return the
current snapshot without increment/audit/publication. Otherwise a stale expected
version conflicts before applying the intent. A retry of an old PIN after an
intervening UNPIN therefore cannot repin implicitly. These are idempotent
absolute-value semantics, not a durable per-command receipt/exactly-once claim.

The client sends the snapshot revision it currently displays. It does not fetch
a newer version immediately before writing or automatically replay a conflict
with that newer version. Missing state fails with a localized, actionable message.
Mutation acknowledgements and room `/pins` realtime carry the complete snapshot.
Clients compare decimal revisions as BigInt and ignore equal/older snapshots.
History/new messages derive pin flags from the accepted room snapshot; content
revision cannot overwrite it. Room entry/reconnect refreshes pin state, with
abort protection on leave/session cleanup. Room snapshots are not hidden because
the actor of a room-wide state change is blocked by one member.

Search pin events carry an independent string pinRevision from this aggregate.
The atomic search script compares that version separately from content revision.
Content writes do not reset pin state, and pin writes do not roll back content.
Legacy partial-action subscribers, the old boolean repository mutation and the
unused frontend unpin shortcut were removed rather than retained as aliases.
OpenAPI/AsyncAPI and controlled fixtures describe only the canonical protocol.

## Limits

The message is_pinned column is still a separately written projection, not an
atomic part of the slot partition. Search/publication can still be lost after a
commit. Point/history/bucket/thread/shared/forward reads now hydrate flags from
the pin aggregate; search filters bounded candidates using that same authority
instead of a stale index pin prefilter. Empty filtered pages may retain a cursor.
Stored projection repair and durable publication remain necessary. ADR0028 adds
tombstone-aware command cleanup and bounded snapshot read repair; background
crash/publication recovery remains open. The new protocol
orders delivered snapshots; it does not prove every snapshot is delivered.

Real CQL concurrency, broker reconnect/two clients, Painless and restart/crash
acceptance have not run while Docker is deferred. This adds no schema beyond
ADR0026, does not migrate/delete data or indexes and does not complete the overall
roadmap. Evidence:
`tasks/message-pin-protocol-verification-2026-10-23.md`.
