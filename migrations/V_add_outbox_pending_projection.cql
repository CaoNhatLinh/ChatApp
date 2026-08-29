-- Pending-only outbox index for bounded publisher reads.
CREATE TABLE IF NOT EXISTS chat_app.outbox_pending_events_by_partition (
  outbox_partition text,
  event_id timeuuid,
  aggregate_type text,
  aggregate_id text,
  event_type text,
  payload_json text,
  created_at timestamp,
  publish_attempts int,
  PRIMARY KEY ((outbox_partition), event_id)
) WITH CLUSTERING ORDER BY (event_id ASC);
