-- ============================================================
-- Secondary Index Migration for Production
-- Run this CQL script on your Cassandra cluster BEFORE deploying
-- the updated backend code.
-- ============================================================

USE chat_app;

-- Notifications: Index for filtering by is_read status
CREATE INDEX IF NOT EXISTS idx_notifications_is_read 
ON notifications (is_read);

-- Notifications: Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications (type);

-- Polls: Index for lookup by message_id
CREATE INDEX IF NOT EXISTS idx_polls_message_id 
ON polls (message_id);

-- User Conversations: Index for filtering by conversation_id
CREATE INDEX IF NOT EXISTS idx_user_conversations_conversation_id 
ON user_conversations (conversation_id);

-- Invitation Links: Index for lookup by link_token 
CREATE INDEX IF NOT EXISTS idx_invitation_links_link_token 
ON invitation_links (link_token);

-- Invitation Links: Index for filtering by conversation_id
CREATE INDEX IF NOT EXISTS idx_invitation_links_conversation_id 
ON invitation_links (conversation_id);

-- Invitation Links: Index for filtering by is_active
CREATE INDEX IF NOT EXISTS idx_invitation_links_is_active 
ON invitation_links (is_active);

-- Invitation Links: Index for filtering by created_by
CREATE INDEX IF NOT EXISTS idx_invitation_links_created_by 
ON invitation_links (created_by);

-- Invitation Links: Index for filtering by expires_at
CREATE INDEX IF NOT EXISTS idx_invitation_links_expires_at 
ON invitation_links (expires_at);
