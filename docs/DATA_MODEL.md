# Data model and consistency

Identity, membership, messages, notifications, invites, polls, moderation, and
audit rows are query-shaped Cassandra projections. Writes that affect more than
one projection also append an outbox/audit event. Message sends are idempotent
through `message_id_by_client_id`; message history uses a bounded bucket directory
and an opaque cursor. Refresh tokens store SHA-256 hashes and a CAS revocation
marker; raw tokens never enter Cassandra.

Global operators use `admin_conversations_by_month`, a bounded monthly
projection keyed by `(month, created_at, conversation_id)`. It is written when a
canonical room is created and refreshed by membership, global policy, and archive mutations; a
clean deployment must run the documented backfill before claiming historical
room coverage.

Room capacity is authoritative in the static `member_count` and `max_members`
columns of `conversation_members_by_conversation`. Add/remove commands use a
single-partition conditional logged batch so the member row and count change
together. `conversations_by_id` does not carry a second count, and a missing
membership state is rejected instead of inferred. Existing keyspaces must apply
`migrations/V_add_conversation_membership_state.cql`; see
`docs/adr/0005-partition-local-membership-capacity.md`.

The same membership partition owns static `owner_id` and `owner_updated_at`.
Ownership transfer conditionally changes both affected role sets and the static
owner values in one logged batch. `conversations_by_id` has no owner copy;
canonical room hydration combines metadata time with the ownership timestamp.
Member removal and ordinary role assignment use conditional writes so neither
can overwrite a concurrent transfer. Apply
`migrations/V_add_conversation_owner_state.cql`; see ADR 0007.

Public community discovery uses `community_directory_by_filter`, a derived
16-shard projection keyed by one canonical language/category/tag filter and
ordered by normalized name plus conversation ID. Directory reads fan out only
across those bounded shards, merge a stable order, and hydrate each result from
the canonical room and membership partitions. Approval requests are
authoritative in `community_join_request_by_user`, one row per room and user;
`community_join_requests_by_conversation` is its newest-first operator/history
projection. Resolution uses a conditional `PENDING` → `APPROVING` claim; the claiming
operator can safely resume an interrupted approval before completing it. No
request path reads the removed bucket/tag discovery tables. Existing keyspaces
must apply `migrations/V_add_community_directory.cql`; see ADR 0006.

Moderation reports use `reports_by_status_day` for bounded operator queues and
`reports_by_reporter` for a caller's own history. The reporter projection keeps
target type, reason, and description so the user-facing history does not need an
unsafe cross-partition lookup. Rows that do not satisfy the canonical schema
are outside the runtime read path and must be repaired before use.

For an existing keyspace, apply `migrations/V_add_reporter_projection_details.cql`
with `cqlsh` before enabling the report-history tab. Fresh installs get the
columns from `chat_app_complete.cql` during schema initialization.

Timed APP/CONVERSATION sanctions are additionally projected into
`user_sanctions_by_expiry_day`, partitioned by UTC expiry date and clustered by
`expires_at`. `SanctionExpiryScheduler` reads only a bounded lookback window and
uses a conditional status claim; side effects use expiry-qualified CAS writes so
a delayed worker cannot clear a newer ban or mute. Existing keyspaces must
apply `migrations/V_add_sanction_expiry_projection.cql` before enabling the
scheduler.

Global investigations use `audit_events_by_month`, keyed by UTC `event_month`
and descending `event_id`. It stores the immutable action, actor/resource,
reason, outcome, and before/after snapshots required to explain operator
mutations without scanning actor or resource partitions.

Outbox durability uses two coordinated projections: `outbox_events_by_partition`
keeps the immutable event and publish metadata, while
`outbox_pending_events_by_partition` contains only events awaiting Kafka
acknowledgement. The writer inserts both rows in one logged batch; a successful
publish updates the immutable row and deletes the pending row in one logged
batch, while a failed attempt increments both counters. This avoids Cassandra
post-`LIMIT` filtering starvation without making Kafka authoritative. Existing
keyspaces must apply `migrations/V_add_outbox_pending_projection.cql` before
enabling the publisher.

Redis keys (`chat:typing:*`, `chat:presence:*`, rate-limit keys) are ephemeral and
must always have TTLs. Projection repair is a worker/replay concern, never a
reason to expose an unbounded scan to a request.
