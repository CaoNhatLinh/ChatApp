# Data model and consistency

Identity, membership, messages, notifications, invites, polls, moderation, and
audit rows are query-shaped Cassandra projections. Writes that affect more than
one projection also append an outbox/audit event. Message sends are idempotent
through `message_id_by_client_id`; message history uses a bounded bucket directory
and an opaque cursor. Refresh tokens store SHA-256 hashes and a CAS revocation
marker; raw tokens never enter Cassandra.

Global operators use `admin_conversations_by_month`, a bounded monthly
projection keyed by `(month, created_at, conversation_id)`. It is written when a
canonical room is created and refreshed by global policy/archive mutations; a
clean deployment must run the documented backfill before claiming historical
room coverage.

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
