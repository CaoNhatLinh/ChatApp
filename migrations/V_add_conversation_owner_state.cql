ALTER TABLE conversation_members_by_conversation ADD owner_id uuid static;
ALTER TABLE conversation_members_by_conversation ADD owner_updated_at timestamp static;

ALTER TABLE conversations_by_id DROP owner_id;
