/* Bounded interaction hydration for a cursor message page. */
CREATE TABLE IF NOT EXISTS message_reactions_by_conversation_bucket (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  emoji text,
  user_id uuid,
  reacted_at timeuuid,
  PRIMARY KEY ((conversation_id, message_bucket), message_id, emoji, user_id)
);

CREATE TABLE IF NOT EXISTS message_read_summary_by_conversation_bucket (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  latest_read_at timestamp,
  PRIMARY KEY ((conversation_id, message_bucket), message_id)
);
