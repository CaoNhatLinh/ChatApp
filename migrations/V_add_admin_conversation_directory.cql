CREATE TABLE IF NOT EXISTS chat_app.admin_conversations_by_month (
  month text,
  created_at timestamp,
  conversation_id uuid,
  conversation_type text,
  visibility text,
  join_policy text,
  name text,
  description text,
  owner_id uuid,
  member_count int,
  chat_mode text,
  slow_mode_seconds int,
  is_deleted boolean,
  updated_at timestamp,
  PRIMARY KEY ((month), created_at, conversation_id)
) WITH CLUSTERING ORDER BY (created_at DESC, conversation_id ASC);

CREATE TABLE IF NOT EXISTS chat_app.audit_events_by_month (
  event_month text,
  event_id timeuuid,
  action text,
  resource_type text,
  resource_id text,
  actor_id uuid,
  conversation_id uuid,
  target_user_id uuid,
  outcome text,
  reason_code text,
  before_state map<text, text>,
  after_state map<text, text>,
  request_id uuid,
  created_at timestamp,
  PRIMARY KEY ((event_month), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);
