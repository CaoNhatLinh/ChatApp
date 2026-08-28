/* Enables bounded cursor traversal across sharded message partitions. */
CREATE TABLE IF NOT EXISTS chat_app.message_buckets_by_conversation (
  conversation_id uuid,
  bucket_hour timestamp,
  message_bucket text,
  last_message_id timeuuid,
  last_message_at timestamp,
  PRIMARY KEY ((conversation_id), bucket_hour, message_bucket)
) WITH CLUSTERING ORDER BY (bucket_hour DESC, message_bucket ASC);
