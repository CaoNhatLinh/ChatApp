-- ==================================================================================
-- CHATAPP CASSANDRA SETUP SCRIPT (CLEAN)
-- Only schema - no seed data. Use API to create test accounts.
-- ==================================================================================

CREATE KEYSPACE IF NOT EXISTS chat_app
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'}
  AND durable_writes = true;

USE chat_app;

-- Custom Type
CREATE TYPE IF NOT EXISTS message_summary (
    message_id uuid,
    sender_id uuid,
    content text,
    created_at timestamp
);

-- ==================== TABLES ====================

CREATE TABLE IF NOT EXISTS audit_logs (
    conversation_id uuid,
    action_id timeuuid,
    action_type text,
    actor_id uuid,
    created_at timestamp,
    metadata text,
    target_id uuid,
    PRIMARY KEY (conversation_id, action_id)
) WITH CLUSTERING ORDER BY (action_id ASC)
    AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_size': '1', 'compaction_window_unit': 'DAYS'}
    AND gc_grace_seconds = 864000;

CREATE TABLE IF NOT EXISTS invitation_links (
    link_id uuid PRIMARY KEY,
    conversation_id uuid,
    link_token text,
    created_by uuid,
    created_at timestamp,
    expires_at timestamp,
    is_active boolean,
    max_uses int,
    used_count int
);

CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id uuid,
    user_id uuid,
    joined_at timestamp,
    role text,
    PRIMARY KEY (conversation_id, user_id)
) WITH CLUSTERING ORDER BY (user_id ASC)
    AND compaction = {'class': 'LeveledCompactionStrategy'};

CREATE TABLE IF NOT EXISTS conversations (
    conversation_id uuid PRIMARY KEY,
    background_url text,
    created_at timestamp,
    created_by uuid,
    description text,
    is_deleted boolean,
    last_message frozen<message_summary>,
    name text,
    type text,
    updated_at timestamp
) WITH compaction = {'class': 'LeveledCompactionStrategy'};

CREATE TABLE IF NOT EXISTS friendships (
    user_id uuid,
    friend_id uuid,
    created_at timestamp,
    status text,
    updated_at timestamp,
    PRIMARY KEY (user_id, friend_id)
) WITH CLUSTERING ORDER BY (friend_id ASC)
    AND compaction = {'class': 'LeveledCompactionStrategy'};

-- Table friend_requests (missing in original master schema)
CREATE TABLE IF NOT EXISTS friend_requests (
    request_id uuid,
    from_user_id uuid,
    to_user_id uuid,
    message text,
    status text,
    created_at timestamp,
    responded_at timestamp,
    PRIMARY KEY (request_id)
);

CREATE TABLE IF NOT EXISTS message_attachments (
    conversation_id uuid,
    message_id timeuuid,
    attachment_id uuid,
    attachment_type text,
    file_name text,
    url text,
    file_size bigint,
    mime_type text,
    PRIMARY KEY ((conversation_id, message_id), attachment_id)
);

CREATE TABLE IF NOT EXISTS message_mentions (
    conversation_id uuid,
    message_id timeuuid,
    mentioned_user_id uuid,
    PRIMARY KEY ((conversation_id, message_id), mentioned_user_id)
);

CREATE TABLE IF NOT EXISTS message_reactions (
    conversation_id uuid,
    message_id timeuuid,
    emoji text,
    user_id uuid,
    reacted_at timestamp,
    PRIMARY KEY ((conversation_id, message_id), emoji, user_id)
) WITH CLUSTERING ORDER BY (emoji ASC, user_id ASC);

CREATE TABLE IF NOT EXISTS message_read_receipts (
    conversation_id uuid,
    message_id timeuuid,
    reader_id uuid,
    read_at timestamp,
    PRIMARY KEY ((conversation_id, message_id), reader_id)
);

CREATE TABLE IF NOT EXISTS messages_by_conversation (
    conversation_id uuid,
    message_id timeuuid,
    content text,
    created_at timestamp,
    edited_at timestamp,
    is_deleted boolean,
    reply_to timeuuid,
    sender_id uuid,
    type text,
    mentioned_user_ids list<uuid>,
    PRIMARY KEY (conversation_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
    AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_size': '1', 'compaction_window_unit': 'DAYS'};

CREATE TABLE IF NOT EXISTS notifications (
    user_id uuid,
    notification_id timeuuid,
    body text,
    created_at timestamp,
    is_read boolean,
    metadata text,
    title text,
    type text,
    PRIMARY KEY (user_id, notification_id)
) WITH CLUSTERING ORDER BY (notification_id ASC)
    AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_size': '1', 'compaction_window_unit': 'DAYS'}
    AND default_time_to_live = 7776000;

CREATE TABLE IF NOT EXISTS pinned_messages (
    conversation_id uuid,
    message_id timeuuid,
    pinned_at timestamp,
    pinned_by uuid,
    PRIMARY KEY (conversation_id, message_id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id uuid,
    user_id uuid,
    selected_options list<text>,
    voted_at timestamp,
    PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS polls (
    poll_id uuid PRIMARY KEY,
    conversation_id uuid,
    message_id uuid,
    created_by uuid,
    created_at timestamp,
    question text,
    options list<text>,
    is_closed boolean,
    is_multiple_choice boolean,
    expires_at timestamp
);

CREATE TABLE IF NOT EXISTS users (
    user_id uuid PRIMARY KEY,
    avatar_url text,
    created_at timestamp,
    display_name text,
    nickname text,
    password text,
    username text,
    status_preference text,
    status_updated_at timestamp
) WITH compaction = {'class': 'LeveledCompactionStrategy'};

-- ==================== MATERIALIZED VIEWS ====================

CREATE MATERIALIZED VIEW IF NOT EXISTS accepted_friendships AS
    SELECT user_id, friend_id, created_at, status
    FROM friendships
    WHERE user_id IS NOT NULL AND friend_id IS NOT NULL AND status IS NOT NULL
    PRIMARY KEY (user_id, friend_id)
WITH CLUSTERING ORDER BY (friend_id ASC);

CREATE MATERIALIZED VIEW IF NOT EXISTS blocked_relationships AS
    SELECT user_id, friend_id, status, updated_at
    FROM friendships
    WHERE user_id IS NOT NULL AND friend_id IS NOT NULL AND status IS NOT NULL
    PRIMARY KEY (user_id, friend_id)
WITH CLUSTERING ORDER BY (friend_id ASC);

CREATE MATERIALIZED VIEW IF NOT EXISTS pending_friend_requests AS
    SELECT friend_id, user_id, created_at, status
    FROM friendships
    WHERE user_id IS NOT NULL AND friend_id IS NOT NULL AND status IS NOT NULL
    PRIMARY KEY (friend_id, user_id)
WITH CLUSTERING ORDER BY (user_id ASC);

CREATE TABLE IF NOT EXISTS user_conversations (
    user_id uuid,
    is_pinned boolean,
    last_activity_at timestamp,
    conversation_id uuid,
    joined_at timestamp,
    role text,
    PRIMARY KEY ((user_id), is_pinned, last_activity_at, conversation_id)
) WITH CLUSTERING ORDER BY (is_pinned DESC, last_activity_at DESC, conversation_id ASC)
  AND compaction = {'class': 'LeveledCompactionStrategy'};
