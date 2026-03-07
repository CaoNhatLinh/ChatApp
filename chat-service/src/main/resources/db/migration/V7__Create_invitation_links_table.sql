-- Migration script: Create invitation_links table
-- Purpose: Store invitation links for group/channel conversations
-- Author: System
-- Date: 2025-10-29

-- Create invitation_links table
CREATE TABLE IF NOT EXISTS invitation_links (
    link_id UUID PRIMARY KEY,
    conversation_id UUID,
    link_token TEXT,
    created_by UUID,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN,
    max_uses INT,
    used_count INT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invitation_links_conversation_id ON invitation_links (conversation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_links_link_token ON invitation_links (link_token);
CREATE INDEX IF NOT EXISTS idx_invitation_links_created_by ON invitation_links (created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_links_is_active ON invitation_links (is_active);

-- Comments
COMMENT ON TABLE invitation_links IS 'Stores invitation links for conversations';
COMMENT ON COLUMN invitation_links.link_id IS 'Unique identifier for the invitation link';
COMMENT ON COLUMN invitation_links.conversation_id IS 'ID of the conversation this link is for';
COMMENT ON COLUMN invitation_links.link_token IS 'Unique token for the invitation link';
COMMENT ON COLUMN invitation_links.created_by IS 'User ID who created the link';
COMMENT ON COLUMN invitation_links.created_at IS 'Timestamp when the link was created';
COMMENT ON COLUMN invitation_links.expires_at IS 'Timestamp when the link expires';
COMMENT ON COLUMN invitation_links.is_active IS 'Whether the link is currently active';
COMMENT ON COLUMN invitation_links.max_uses IS 'Maximum number of times the link can be used (null = unlimited)';
COMMENT ON COLUMN invitation_links.used_count IS 'Number of times the link has been used';
