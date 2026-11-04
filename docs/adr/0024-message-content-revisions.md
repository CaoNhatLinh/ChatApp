# 0024 — Expose the stored message content/deletion revision

Date: 2026-10-23. Status: backend contract and controlled frontend reconciliation implemented; distributed acceptance pending.

## Context

Creation is now conditional (ADR0023), but an initial publisher can be delayed
until after a subsequent edit/delete. Arrival time is not content order. Cassandra
already stores `revision_no` and uses it in edit/delete CAS, yet the canonical
message read model and realtime payload omitted it. Clients could not reliably
identify an older snapshot from that contract.

## Decision

Expose required integer `revision` in the canonical message, HTTP JSON and
MESSAGE_SEND/EDIT/DELETE payloads. It is the stored content/deletion revision,
starting at zero on creation and incrementing on edit/delete. Public tombstones
keep the same revision while redacting retained content. Projection event payloads
also retain this fact for future ordered consumers.

Missing/negative stored revisions are invariant errors, not silently replaced
with zero. Increment overflow fails before a mutation CAS. No client-provided
version, wall-clock synthesis, legacy constructor overload or new schema column
is introduced. Code/test constructor callers supply an explicit initial revision;
the repository hydrates actual stored values.

## Consequences and limits

This revision orders only content/deletion snapshots. It is not a shared version
for independent pin/reaction/read-receipt commands. Consumers must preserve those
boundaries rather than rolling unrelated state backward from a message snapshot.

The frontend now validates canonical revisions and reconciles live upsert, edit
responses, history windows/pages and known conversation previews. Independent
metadata is protected against content events; request baselines protect it from
racing history responses. Controlled evidence is recorded separately in
`tasks/message-revision-client-verification-2026-10-23.md`.

Directory/point summaries now resolve their exact persisted message bucket/ID
through authority and expose its revision. The fresh canonical UDT carries the
bucket, rather than guessing a key or scanning shards. This supersedes the earlier
unversioned-summary limit, with evidence in
`tasks/conversation-preview-authority-verification-2026-10-23.md`.

New message sends advance the canonical room preview with a bounded
LOCAL_QUORUM/LOCAL_SERIAL compare-and-set. The stored frozen summary is the
observed value, and Cassandra timeuuid order decides whether the candidate can
advance it. A candidate already superseded by another send skips the directory
move. The CAS updates room activity separately from the room metadata timestamp.
Repeated condition contention can leave the preview behind while delivery and
notification continue for the committed message.

An exact send retry can restore a missing room preview from the committed
message, including a redacted tombstone. The retry does not write per-member
unread counts or publish send events. If the creator later sees that same
message in the room preview, it uses the stored summary to advance the member
rows. The member row comparison still prevents an extra unread increment.

Directory and point reads use the room's frozen summary for the preview even
when the per-user row has a different or empty summary. The per-user row still
supplies cursor position and the eventual unread count. An exact point read that
finds both pin variants at the same activity picks the variant matching the
user's pin slot. Membership supplies role and notification values, so writes to
those fields no longer update the old directory keys.

Conversation pin release compares both the observed room and the pin timeuuid.
An unapplied release returns a conflict. The sidebar refreshes the relevant
read view without resending the write. A pin request at capacity can reclaim
slots whose room membership is absent, then retry allocation once. The reclaim
path releases only the observed slot and does not move directory rows. An
explicit re-pin renews the slot generation so an older reclaim cannot remove it.

Message-driven directory writes compare the observed join timestamp, previous
summary and unread count. A change of activity uses a conditional delete and
conditional insert in the same user partition. Messages in the same stored
millisecond update in place. On condition loss the writer can reread and retry
up to three attempts total. An older or equal message does not rewrite a known
newer directory preview. A candidate covered by the observed read pointer does
not increment unread.

Pin and unpin commands use the same conditional move for the directory row.
An already-committed slot remains authoritative if a move loses contention or
the directory write fails. Exact point reads take pin state from that slot even
when only the opposite directory row remains. Directory pages also use a single
slot snapshot for pin flags and filtering. They keep the raw continuation and
collapse duplicate rooms within each page. Repeating an already-applied unpin
can repair a stale pinned row without another audit entry. The directory can
also repair up to three observed pin mismatches per page. It verifies the exact
activity key, current member join timestamp and current slot before attempting
the conditional move. The client deduplicates repeated rooms across pages and
keeps newer previews. Rooms whose latest message row is missing stay in the
directory without a preview. Exact point reads still report a conflict for
missing message authority or a missing activity row.

Read-position updates and covered unread clearing carry the join timestamp
observed at authorization. A retry against a different join timestamp cannot
advance the replacement membership. A directory page can also move an observed
older activity row when the current member's read pointer covers the room's
latest message. It verifies room, source, membership and pin state again before
the conditional move. This shares the three-attempt page budget with pin repair.
Unread rows require separate reconciliation. Background discovery of missing or
older rows, duplicate cleanup, search recovery and live two-client acceptance
remain open.

Evidence: `tasks/message-revision-contract-verification-2026-10-23.md`.
