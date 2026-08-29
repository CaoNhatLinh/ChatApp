CREATE TABLE IF NOT EXISTS community_directory_by_filter (
  discovery_filter text,
  discovery_shard tinyint,
  name_normalized text,
  conversation_id uuid,
  last_activity_at timestamp,
  PRIMARY KEY ((discovery_filter, discovery_shard), name_normalized, conversation_id)
) WITH CLUSTERING ORDER BY (name_normalized ASC, conversation_id ASC);

CREATE TABLE IF NOT EXISTS community_join_request_by_user (
  conversation_id uuid,
  user_id uuid,
  request_id uuid,
  status text,
  requested_at timeuuid,
  reason text,
  resolution_decision text,
  resolved_by uuid,
  resolved_at timestamp,
  updated_at timestamp,
  PRIMARY KEY ((conversation_id), user_id)
);

CREATE TABLE IF NOT EXISTS community_join_requests_by_conversation (
  conversation_id uuid,
  requested_at timeuuid,
  request_id uuid,
  user_id uuid,
  status text,
  reason text,
  resolution_decision text,
  resolved_by uuid,
  resolved_at timestamp,
  updated_at timestamp,
  PRIMARY KEY ((conversation_id), requested_at, request_id)
) WITH CLUSTERING ORDER BY (requested_at DESC, request_id ASC);
