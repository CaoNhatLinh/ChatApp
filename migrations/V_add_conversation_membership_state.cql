ALTER TABLE conversation_members_by_conversation
ADD IF NOT EXISTS member_count int static;

ALTER TABLE conversation_members_by_conversation
ADD IF NOT EXISTS max_members int static;
