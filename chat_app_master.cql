-- ==================================================================================
-- CHATAPP MASTER CASSANDRA SCHEMA (GOLDEN VERSION)
-- Dựa trên bản Backup đầy đủ thuộc tính (Caching, GC grace, Materialized Views)
-- Đã tinh chỉnh: TWCS cho Logs, LCS cho Tables thường xuyên Update, TTL 90 ngày cho Notifs
-- ==================================================================================

CREATE KEYSPACE chat_app WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'}  AND durable_writes = true;

CREATE TYPE chat_app.message_summary (
    message_id uuid,
    sender_id uuid,
    content text,
    created_at timestamp
);

CREATE TABLE chat_app.audit_logs (
    conversation_id uuid,
    action_id timeuuid,
    action_type text,
    actor_id uuid,
    created_at timestamp,
    metadata text,
    target_id uuid,
    PRIMARY KEY (conversation_id, action_id)
) WITH CLUSTERING ORDER BY (action_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.TimeWindowCompactionStrategy', 'compaction_window_size': '1', 'compaction_window_unit': 'DAYS'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.invitation_links (
    link_id uuid PRIMARY KEY,
    conversation_id uuid,
    link_token text,
    created_by uuid,
    created_at timestamp,
    expires_at timestamp,
    is_active boolean,
    max_uses int,
    used_count int
) WITH additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.conversation_members (
    conversation_id uuid,
    user_id uuid,
    joined_at timestamp,
    role text,
    PRIMARY KEY (conversation_id, user_id)
) WITH CLUSTERING ORDER BY (user_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.conversations (
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
) WITH additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.friendships (
    user_id uuid,
    friend_id uuid,
    created_at timestamp,
    status text,
    updated_at timestamp,
    PRIMARY KEY (user_id, friend_id)
) WITH CLUSTERING ORDER BY (friend_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE MATERIALIZED VIEW chat_app.accepted_friendships AS
    SELECT user_id, friend_id, created_at, status
    FROM chat_app.friendships
    WHERE user_id IS NOT NULL AND friend_id IS NOT NULL AND status IS NOT NULL
    PRIMARY KEY (user_id, friend_id)
 WITH CLUSTERING ORDER BY (friend_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE MATERIALIZED VIEW chat_app.blocked_relationships AS
    SELECT user_id, friend_id, status, updated_at
    FROM chat_app.friendships
    WHERE user_id IS NOT NULL AND friend_id IS NOT NULL AND status IS NOT NULL
    PRIMARY KEY (user_id, friend_id)
 WITH CLUSTERING ORDER BY (friend_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE MATERIALIZED VIEW chat_app.pending_friend_requests AS
    SELECT friend_id, user_id, created_at, status
    FROM chat_app.friendships
    WHERE user_id IS NOT NULL AND friend_id IS NOT NULL AND status IS NOT NULL
    PRIMARY KEY (friend_id, user_id)
 WITH CLUSTERING ORDER BY (user_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.message_attachments (
    conversation_id uuid,
    message_id timeuuid,
    attachment_id uuid,
    attachment_type text,
    file_name text,
    url text,
    file_size bigint,
    mime_type text,
    PRIMARY KEY ((conversation_id, message_id), attachment_id)
) WITH CLUSTERING ORDER BY (message_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.message_mentions (
    conversation_id uuid,
    message_id timeuuid,
    mentioned_user_id uuid,
    PRIMARY KEY ((conversation_id, message_id), mentioned_user_id)
) WITH CLUSTERING ORDER BY (mentioned_user_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.message_reactions (
    conversation_id uuid,
    message_id timeuuid,
    emoji text,
    user_id uuid,
    reacted_at timestamp,
    PRIMARY KEY ((conversation_id, message_id), emoji, user_id)
) WITH CLUSTERING ORDER BY (emoji ASC, user_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.message_read_receipts (
    conversation_id uuid,
    message_id timeuuid,
    reader_id uuid,
    read_at timestamp,
    PRIMARY KEY ((conversation_id, message_id), reader_id)
) WITH CLUSTERING ORDER BY (reader_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.messages_by_conversation (
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
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.TimeWindowCompactionStrategy', 'compaction_window_size': '1', 'compaction_window_unit': 'DAYS'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.notifications (
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
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.TimeWindowCompactionStrategy', 'compaction_window_size': '1', 'compaction_window_unit': 'DAYS'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 7776000
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.pinned_messages (
    conversation_id uuid,
    message_id timeuuid,
    pinned_at timestamp,
    pinned_by uuid,
    PRIMARY KEY (conversation_id, message_id)
) WITH CLUSTERING ORDER BY (message_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.poll_votes (
    poll_id uuid,
    user_id uuid,
    selected_options list<text>,
    voted_at timestamp,
    PRIMARY KEY (poll_id, user_id)
) WITH CLUSTERING ORDER BY (user_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.polls (
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
) WITH additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy', 'max_threshold': '32', 'min_threshold': '4'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE MATERIALIZED VIEW chat_app.user_conversation_members AS
    SELECT conversation_id, user_id, joined_at, role
    FROM chat_app.conversation_members
    WHERE user_id IS NOT NULL AND conversation_id IS NOT NULL
    PRIMARY KEY (user_id, conversation_id)
WITH CLUSTERING ORDER BY (conversation_id ASC)
    AND additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND crc_check_chance = 1.0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

CREATE TABLE chat_app.users (
    user_id uuid PRIMARY KEY,
    avatar_url text,
    created_at timestamp,
    display_name text,
    nickname text,
    password text,
    username text,
    status_preference text,
    status_updated_at timestamp
) WITH additional_write_policy = '99p'
    AND allow_auto_snapshot = true
    AND bloom_filter_fp_chance = 0.01
    AND caching = {'keys': 'ALL', 'rows_per_partition': 'NONE'}
    AND cdc = false
    AND comment = ''
    AND compaction = {'class': 'org.apache.cassandra.db.compaction.LeveledCompactionStrategy'}  
    AND compression = {'chunk_length_in_kb': '16', 'class': 'org.apache.cassandra.io.compress.LZ4Compressor'}
    AND memtable = 'default'
    AND crc_check_chance = 1.0
    AND default_time_to_live = 0
    AND extensions = {}
    AND gc_grace_seconds = 864000
    AND incremental_backups = true
    AND max_index_interval = 2048
    AND memtable_flush_period_in_ms = 0
    AND min_index_interval = 128
    AND read_repair = 'BLOCKING'
    AND speculative_retry = '99p';

-- ==================================================================================
-- SECONDARY INDEXES (Thay thế ALLOW FILTERING)
-- ==================================================================================

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON chat_app.notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON chat_app.notifications (type);

-- Polls
CREATE INDEX IF NOT EXISTS idx_polls_message_id ON chat_app.polls (message_id);

-- User Conversations
CREATE INDEX IF NOT EXISTS idx_user_conversations_conversation_id ON chat_app.user_conversations (conversation_id);

-- Invitation Links
CREATE INDEX IF NOT EXISTS idx_invitation_links_link_token ON chat_app.invitation_links (link_token);
CREATE INDEX IF NOT EXISTS idx_invitation_links_conversation_id ON chat_app.invitation_links (conversation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_links_is_active ON chat_app.invitation_links (is_active);
CREATE INDEX IF NOT EXISTS idx_invitation_links_created_by ON chat_app.invitation_links (created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_links_expires_at ON chat_app.invitation_links (expires_at);


-- ==================================================================================
-- MUC DU LIEU HAT GIONG (SEED DATA)
-- ==================================================================================

INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (73ca135e-e426-4f7e-aa0f-9e098624910d, 'christopher06', 'Daniel Buckley', 'Molly', 'https://cdn.app/avatar/christopher06.png', 'QgkRc+bA)7(W', '2024-05-19T03:54:24');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (6a2bc035-52ba-4c7e-a494-d9a7fb7a7f29, 'hbrewer', 'Lisa Mcgrath', 'Jon', 'https://cdn.app/avatar/hbrewer.png', 'm2iIlGfw+x9H', '2024-08-08T09:54:13');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (7d45bbc6-85f9-42e0-ad15-b48bfe6fbc81, 'john54', 'Anthony Brooks', 'Gregory', 'https://cdn.app/avatar/john54.png', '_kWTyhqey6PN', '2024-08-22T18:31:37');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (7bc2d4a8-9ee5-4e6a-b051-a50b8f80882a, 'davidwalsh', 'Henry Ramsey', 'Susan', 'https://cdn.app/avatar/davidwalsh.png', 'J82Shr&E@+5@', '2024-01-31T06:28:05');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (23a75e51-799d-475d-a86f-3469be028098, 'dakotajoseph', 'Joseph Meyers', 'Jose', 'https://cdn.app/avatar/dakotajoseph.png', 'R!8FrGms!Xry', '2023-07-20T19:58:32');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (342a3fda-8e78-45be-914d-934d214aacb8, 'reginazamora', 'Natalie Harris', 'Luis', 'https://cdn.app/avatar/reginazamora.png', 'proZxliZ+39N', '2024-12-27T01:08:32');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (543fe3d4-bee7-46a2-abf7-b8e74763418d, 'nfrench', 'Dana Singleton', 'Samantha', 'https://cdn.app/avatar/nfrench.png', '*o0V^Y1kD%53', '2024-03-04T04:00:13');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (0d90e561-6141-4f32-9ffb-b9b01dc2316e, 'mrodriguez', 'Regina Collins', 'James', 'https://cdn.app/avatar/mrodriguez.png', '4H!wjgT&%NBN', '2024-12-22T19:55:00');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (d93f403b-741f-45ea-bb04-e72c3d953133, 'turnersusan', 'Jeremy Preston', 'Jacob', 'https://cdn.app/avatar/turnersusan.png', 'yI6CoiY3g%)N', '2024-09-16T22:13:01');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (1625ea4b-7b92-4ac8-891e-07ae71ac18a1, 'jesse45', 'Sara Barnett', 'Chloe', 'https://cdn.app/avatar/jesse45.png', '*9R_R0j+WELk', '2023-07-24T08:28:44');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (3b488d90-6a2a-4e8b-b782-9f1b7da5cc73, 'stonekim', 'Steven Morris', 'Michelle', 'https://cdn.app/avatar/stonekim.png', '(CQu3)ff91Ez', '2025-03-21T08:40:42');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (1cc7a4d5-1e7e-43e3-b992-e8db02d18d8b, 'edwin18', 'Rodney Watson', 'Cynthia', 'https://cdn.app/avatar/edwin18.png', 'b@8IN#hH@KAI', '2025-03-09T14:08:45');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (a1bd5cdf-5c3b-45e5-be2e-9a516c92527a, 'davidpratt', 'Mark Harding', 'Jeremy', 'https://cdn.app/avatar/davidpratt.png', '8#58EM&mtf8V', '2024-08-14T08:28:37');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (b8830c34-776f-4966-bb69-efdee50263b7, 'matthewgrant', 'Dr. Mary Rocha', 'Richard', 'https://cdn.app/avatar/matthewgrant.png', '_1GAA7zK%#VW', '2025-03-08T16:21:05');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (2a405b77-ed78-4fd0-bebe-e7c21c8fea56, 'perezlarry', 'Danielle Lloyd', 'Matthew', 'https://cdn.app/avatar/perezlarry.png', '9k2TPOmbu&8U', '2025-01-26T12:55:17');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (7aa9be91-581e-43f8-80d6-87b8f3ab2b4b, 'moorebrandy', 'Jasmine Skinner', 'Richard', 'https://cdn.app/avatar/moorebrandy.png', '#GqYbJuMBw)4', '2024-05-17T02:54:57');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (1ea3dd2d-0b0f-4e4a-acee-0865fe23383e, 'waltergarcia', 'Sean Hawkins', 'Jennifer', 'https://cdn.app/avatar/waltergarcia.png', 'k3LhM^NA#z#2', '2025-02-22T17:18:19');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (6de13abe-16a4-44d9-abbd-0ea50dfa2cbc, 'monicakramer', 'Rebecca Lucas', 'Courtney', 'https://cdn.app/avatar/monicakramer.png', '&6RT!j0l8jRU', '2025-02-06T01:50:01');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (690473f2-7505-4027-a006-bb459fc24feb, 'vegaemily', 'Abigail Jackson', 'Amy', 'https://cdn.app/avatar/vegaemily.png', 'S09mi#Uo)4TE', '2024-10-26T20:49:17');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (3d8bdfac-28bd-45a8-84f7-0c70b4bac59b, 'mcintyremichelle', 'Robin James', 'Lori', 'https://cdn.app/avatar/mcintyremichelle.png', 'sS0WcWtlr)#R', '2024-10-05T14:37:40');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (ac53154a-218f-4c24-86a0-63e2f9d857ef, 'richardsonkristin', 'Dawn Burch', 'Jennifer', 'https://cdn.app/avatar/richardsonkristin.png', '%fPGzW+(k3Pp', '2025-01-30T03:22:59');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (9afe30f7-03ee-4f83-9c5a-6caa380c8175, 'elizabethlee', 'Laura Taylor', 'Elizabeth', 'https://cdn.app/avatar/elizabethlee.png', ')I1MR6nj+4No', '2025-01-18T11:17:00');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (dd23c64a-a81a-4331-a900-e3e3b8ef16af, 'davidhardin', 'David Baxter', 'Kelly', 'https://cdn.app/avatar/davidhardin.png', '$WN8*ao5h&2Y', '2025-03-09T16:32:08');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (e2cdc61b-1000-417d-929b-148f03dc40e6, 'vorozco', 'Kevin Woods', 'Angelica', 'https://cdn.app/avatar/vorozco.png', '&3Qe*Ji^sGhr', '2025-02-14T20:19:29');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (5e9903df-2e15-4ef8-87c3-f71f1d76a88a, 'joshuamills', 'Anthony Howard', 'James', 'https://cdn.app/avatar/joshuamills.png', '!G3EfOo4iNeb', '2024-09-04T09:02:11');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (ef525a45-b0d1-447b-a3fb-f4554e9529be, 'boylejeffrey', 'Michael Barr', 'Jennifer', 'https://cdn.app/avatar/boylejeffrey.png', 'vqzV8Fac5$9Q', '2024-12-09T03:25:05');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (6a2561af-2750-4bc4-83b2-2f5657c60099, 'jordansabrina', 'Logan Huynh', 'Sabrina', 'https://cdn.app/avatar/jordansabrina.png', 'ri49cLsNL%FV', '2023-11-11T13:39:14');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (2b157b54-61d2-4905-8c8e-63a140a82ff3, 'andreamaldonado', 'Morgan Schwartz', 'David', 'https://cdn.app/avatar/andreamaldonado.png', 'p5&@pKUo#5T+', '2024-07-08T05:15:23');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (4d4e1041-a954-444b-ac40-eb11eb096936, 'brad26', 'Megan Dunn', 'Samantha', 'https://cdn.app/avatar/brad26.png', '8@0UMYXnjqho', '2024-06-12T23:37:09');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (fc30cd62-cb6c-4207-988f-bb1d0ff7beaa, 'shannonhudson', 'Marcus Greene', 'Jason', 'https://cdn.app/avatar/shannonhudson.png', 'K62KCb&wza#7', '2024-12-27T00:21:31');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (09eef8f9-7466-4419-89d9-e3200a31eb37, 'lopezpamela', 'Jimmy Strickland', 'Stuart', 'https://cdn.app/avatar/lopezpamela.png', '4+$^XM+y)S4L', '2024-01-15T11:58:59');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (8b7f8e2b-a12a-4b23-91cf-8d4b4e51ef2e, 'ggutierrez', 'Cassandra Morris', 'Tanya', 'https://cdn.app/avatar/ggutierrez.png', '0*1NMsntgH5W', '2024-11-28T10:21:04');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (806f89a6-0166-4a9d-bffb-f78615fe1be1, 'billy85', 'Tanya Stuart', 'Laura', 'https://cdn.app/avatar/billy85.png', '@uaHClj3j62F', '2024-08-29T01:04:44');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (b1ce4d20-03a4-4166-9f72-19f8e04c28f2, 'fscott', 'Kenneth Brooks', 'Sean', 'https://cdn.app/avatar/fscott.png', '#JPU_CBtqr4f', '2024-01-06T23:58:36');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (7c6bd51c-e745-4fd3-8a10-7e97ed52ca55, 'joseph36', 'Jimmy Dominguez', 'Jasmine', 'https://cdn.app/avatar/joseph36.png', ')wjxjP8@@1So', '2025-03-26T09:37:03');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (2b53ae96-64ba-4fe3-9c20-8de1c66740d5, 'rdavis', 'Diane Hill', 'Lorraine', 'https://cdn.app/avatar/rdavis.png', '0s71H6Smd%((', '2023-11-30T06:33:46');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (d5059878-a903-48f1-9642-53dc231d726a, 'thomasbryan', 'Elizabeth Mills', 'Leslie', 'https://cdn.app/avatar/thomasbryan.png', '4@aqYUTO_@TQ', '2024-10-14T09:55:06');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (8f8bca64-dc89-4fd2-8fb8-9f50b4b46d35, 'brownchristopher', 'John Wilkins', 'Samantha', 'https://cdn.app/avatar/brownchristopher.png', '8L*p1xtK@YG#', '2023-09-13T05:10:34');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (3243e9a8-b4c2-405a-af15-1287fc5ab617, 'williammorris', 'Matthew Grimes', 'Daniel', 'https://cdn.app/avatar/williammorris.png', '90LXUeP&@cli', '2023-08-03T11:40:24');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (bbd8d1ef-e850-4383-9db3-9e5fd3b0cd1c, 'jeremyedwards', 'Bethany Dunn', 'Jessica', 'https://cdn.app/avatar/jeremyedwards.png', 'gf4edq7Z+dLG', '2024-09-01T00:53:50');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (b525d287-1da9-444f-b13d-17f3c37294ed, 'palmermadison', 'Emily Scott', 'Rebecca', 'https://cdn.app/avatar/palmermadison.png', '_2GabZcE%uGW', '2024-06-25T13:12:14');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (a8a418fe-df55-4d39-a832-b954b405f018, 'jean73', 'Stephanie House', 'Steven', 'https://cdn.app/avatar/jean73.png', '9WRfCwKb!zxe', '2024-11-19T08:35:37');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (d2000b38-3b30-46aa-ab2b-cd36cda1aec0, 'imorton', 'Amy Macias', 'Stephanie', 'https://cdn.app/avatar/imorton.png', '%$r53EhB@Z3v', '2023-11-15T20:47:03');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (89a4387f-de0f-442e-bb07-369808288979, 'yalvarado', 'Sierra Suarez', 'Elizabeth', 'https://cdn.app/avatar/yalvarado.png', '2ruUWg3R+YD*', '2024-08-12T00:45:27');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (4ae4a7eb-3afb-4d5b-8fc9-e92d7c0167fa, 'piercemichael', 'Christopher Wong', 'Lisa', 'https://cdn.app/avatar/piercemichael.png', '3hJ*b6(exb#n', '2024-04-11T22:38:10');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (03c97271-c37b-424d-9d72-994b474abf7d, 'amyross', 'Paul Reynolds', 'Chad', 'https://cdn.app/avatar/amyross.png', 'k2Bz2r_)k%o^', '2024-08-23T09:02:35');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (8b780c6d-7411-4905-892a-0a7916acb962, 'phamstacy', 'Carolyn Nunez', 'Melvin', 'https://cdn.app/avatar/phamstacy.png', '4h)3DsQ7o^jE', '2025-05-14T22:42:24');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (aab9a591-014d-4c93-8613-7c5d63a816f0, 'wendymoore', 'John Whitehead', 'Laura', 'https://cdn.app/avatar/wendymoore.png', 's#8%MA8js((j', '2023-08-13T01:09:38');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (a4e5a18d-e8cf-47f7-9f5b-d0a209ed61b2, 'otaylor', 'Michael Moore', 'Lisa', 'https://cdn.app/avatar/otaylor.png', ')UEEyvV79%4F', '2025-05-16T02:35:48');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (2ddb9666-938c-4dff-bb90-0c383e1220d2, 'dianakhan', 'Chelsea Hubbard', 'Kim', 'https://cdn.app/avatar/dianakhan.png', '2BQh05Va&p65', '2024-09-27T11:35:19');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (9e6c2ae1-05e4-45dc-a669-dbb3b9810b09, 'lauriebrown', 'Megan Wagner', 'Jennifer', 'https://cdn.app/avatar/lauriebrown.png', '$n$%ADkKOX0p', '2024-10-02T17:36:38');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (0d422922-83e7-4960-93c0-df1af6f15888, 'william55', 'Henry Gonzalez', 'Angel', 'https://cdn.app/avatar/william55.png', 'Ui%5GHnsv&3C', '2024-07-30T19:17:59');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (17ee1ab0-8484-4f95-be11-139ac8032a47, 'cabreraann', 'Pamela Lewis', 'Robert', 'https://cdn.app/avatar/cabreraann.png', 'h5kIemP&%1DA', '2025-04-26T23:48:50');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (01f0b744-f8ef-4307-aaa4-e1fa83ecac2c, 'whitephyllis', 'Doris Hodge', 'Joseph', 'https://cdn.app/avatar/whitephyllis.png', '%_5K%kA%3ihN', '2024-07-03T08:14:00');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (655558e9-15b0-4a42-ae0c-fdbb99b769be, 'gharris', 'Natalie Guerrero', 'Amanda', 'https://cdn.app/avatar/gharris.png', '&r$TVzyr054z', '2024-04-20T07:26:03');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (30132ed2-3cf0-4960-8604-69a79bf0aa69, 'ibrooks', 'Wendy Berry', 'Zoe', 'https://cdn.app/avatar/ibrooks.png', '@1ASUtZ6dj)P', '2023-08-02T14:37:59');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (06362434-a15e-453b-b42d-e8f8984fd501, 'ruizrebecca', 'Carlos Scott', 'Christopher', 'https://cdn.app/avatar/ruizrebecca.png', 'dySwikhf*2G9', '2025-04-03T23:33:26');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (b0e1645b-dd13-453f-8bba-18e19c8aebdd, 'gainesjoshua', 'Molly Medina', 'Jordan', 'https://cdn.app/avatar/gainesjoshua.png', '+PRZmJ!lc4Y4', '2024-08-20T08:40:49');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (16fe07c5-23fb-4b6c-83eb-fbc3672fe1ce, 'traceymahoney', 'Desiree Estrada DVM', 'Cynthia', 'https://cdn.app/avatar/traceymahoney.png', 'nm2UIscI*F7Q', '2023-08-10T15:26:25');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (06cfc1d2-f8bc-466b-a032-b1c2d67d99f6, 'eric39', 'Robert Davis', 'Kimberly', 'https://cdn.app/avatar/eric39.png', '07!YvNt6+S2!', '2025-04-13T17:05:47');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (7faba245-202c-4674-b6c1-770dcd443098, 'carrjudy', 'Chad Davis', 'Rebecca', 'https://cdn.app/avatar/carrjudy.png', 'Wo7%Wr12R)OF', '2024-02-20T02:33:56');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (fb55d6d2-5638-4237-a2e6-f4927d134fb1, 'rodriguezbrittany', 'Benjamin Deleon', 'Paula', 'https://cdn.app/avatar/rodriguezbrittany.png', 'iI1_6oIdb@AH', '2025-06-10T00:03:30');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (1ceb828b-ce11-4a5b-aaa0-bc8fba680343, 'danielcarroll', 'Jill Sanders', 'Jason', 'https://cdn.app/avatar/danielcarroll.png', '%3S(mot#)wT6', '2024-01-04T02:15:57');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (5d0d7762-3f0e-4867-b5d8-c5d026927c15, 'jesse40', 'Tyler Wilson', 'Melissa', 'https://cdn.app/avatar/jesse40.png', '@71IQirfH!Vy', '2024-02-26T15:28:52');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (bd26fc1c-a38d-45e4-bceb-c54ee1d89ec4, 'gregoryhoover', 'Rebekah Callahan', 'Daniel', 'https://cdn.app/avatar/gregoryhoover.png', '&$56YXqq^Y+j', '2023-09-17T06:43:43');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (4ed3ffb9-5108-47b1-b10c-dcbbf492c680, 'ysanchez', 'Priscilla White', 'Michelle', 'https://cdn.app/avatar/ysanchez.png', '!FsFJ+8pK3C3', '2025-06-16T09:48:51');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (237355bb-ee53-4c45-87fc-dc1e4e5ee82d, 'michael55', 'Jeffrey Newman', 'Chad', 'https://cdn.app/avatar/michael55.png', '7%EdKJgZ#2TW', '2024-08-27T03:57:03');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (451df7c6-c9a6-4bb5-9b53-5584b98c7738, 'steven84', 'Zachary Jackson', 'Veronica', 'https://cdn.app/avatar/steven84.png', 'TI_sCwbx^3_q', '2023-12-06T08:06:24');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (a5046c81-9351-4fc2-ad0a-7ef0fb153c2f, 'jpearson', 'Amy Gray', 'Jenna', 'https://cdn.app/avatar/jpearson.png', '5!zGc4v36o8K', '2024-02-12T21:10:20');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (762c8bf5-139c-4020-bd36-d959dddc2d40, 'rclark', 'Maria Brock', 'Terri', 'https://cdn.app/avatar/rclark.png', 'r@2oh)xg7#Tg', '2023-10-19T06:05:18');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (81a62ca1-7c04-4abf-8f63-061b27ca4021, 'ujones', 'Shannon Wilson', 'Daniel', 'https://cdn.app/avatar/ujones.png', '7#029GwFYWE3', '2023-07-27T20:01:26');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (089e766b-d2a2-43d8-97a2-9d404e691527, 'cmartin', 'Morgan Chambers', 'Alan', 'https://cdn.app/avatar/cmartin.png', '#61RrthA&Z(I', '2023-12-10T17:59:39');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (401d3ead-4979-4700-ab6c-28c4f1cc7d7c, 'rbuckley', 'Micheal Ferguson', 'Kelsey', 'https://cdn.app/avatar/rbuckley.png', 'L6Q9(J#j!VEO', '2024-12-02T09:01:12');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (c14aa5b7-c0af-43cd-bbde-d480818e5759, 'lauriemoreno', 'Wendy Wade', 'Randy', 'https://cdn.app/avatar/lauriemoreno.png', 'Gz9H5BxOa&+U', '2023-11-18T11:10:27');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (a857f852-9f60-428c-93b2-1100d2cbddf0, 'kevin85', 'Jeff Barr', 'Anthony', 'https://cdn.app/avatar/kevin85.png', '#V7o#1Gm#gnq', '2024-07-08T04:18:20');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (b181492f-b704-4f78-8544-1f84a394ac09, 'scowan', 'Noah Palmer', 'Jason', 'https://cdn.app/avatar/scowan.png', 'Qs5HVZvYR*+s', '2025-05-27T05:04:04');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (78d8e28d-376b-43ca-a54f-2b80a8b034a2, 'jgentry', 'Samantha Dennis', 'Adam', 'https://cdn.app/avatar/jgentry.png', '_mRCYfJ$6alH', '2024-02-24T18:54:12');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (a2258bd2-4bde-40df-aac1-0b01af1fed8b, 'thomasnichols', 'Daniel Bernard', 'Patrick', 'https://cdn.app/avatar/thomasnichols.png', 'Ldx$Tgq(8@7R', '2023-12-21T18:20:22');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (bce1c8b1-0a4d-49c5-903a-b6aaa24809bb, 'brandonfaulkner', 'Wendy Barton', 'Ryan', 'https://cdn.app/avatar/brandonfaulkner.png', 's30StNdV@%kn', '2025-04-26T05:28:37');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (1d44df86-cf54-47f2-bb9c-857a3c8dd141, 'wpowers', 'Maria Hill', 'Janet', 'https://cdn.app/avatar/wpowers.png', '!AR9iMuFuL^P', '2023-08-11T19:51:59');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (15978578-69b0-4350-bc7b-7ceb600c7673, 'harveysharon', 'Bryce Horne', 'Jill', 'https://cdn.app/avatar/harveysharon.png', '!iJ@viUf4&cK', '2023-08-10T09:00:29');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (47e0adb4-7178-49ee-9651-0f57b1f15c0f, 'hardygloria', 'Carla Harris', 'Bianca', 'https://cdn.app/avatar/hardygloria.png', 'jG8_bdn!78HB', '2024-06-19T07:43:27');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (3a89c8d7-31dd-4af2-925b-a4b61fef0d5f, 'gsimon', 'Kyle Webb', 'Charles', 'https://cdn.app/avatar/gsimon.png', '$w0G(^%7t*Lh', '2024-12-29T08:50:16');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (fa01e938-e7cd-48c1-b314-7cdabb88d367, 'cindyjohnson', 'Amy Wong', 'Alexander', 'https://cdn.app/avatar/cindyjohnson.png', '@@Oct@A$A9cc', '2024-11-27T13:57:41');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (763b444c-1499-4ff9-8452-4d8ca605db11, 'darlene39', 'Jeremy Fischer', 'Christopher', 'https://cdn.app/avatar/darlene39.png', '^5L7Nqi^@5Sk', '2024-01-08T05:26:01');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (67066d59-35a1-4bb4-a8a7-bf1488a03a05, 'perezbrian', 'Randy Cox', 'Alicia', 'https://cdn.app/avatar/perezbrian.png', '_oR(CTp21N3L', '2023-12-16T08:23:18');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (db1cf920-ba51-4df0-a699-08e656c0dc6d, 'pamelastewart', 'Steven Dorsey', 'Holly', 'https://cdn.app/avatar/pamelastewart.png', '(TcgvGqk+1ii', '2024-11-13T09:44:27');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (fd5cd324-2542-4b98-ae77-78a24c7ec068, 'swright', 'Jason Russell', 'Kimberly', 'https://cdn.app/avatar/swright.png', '8)*XfbAFUX3q', '2024-12-19T22:37:21');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (cb77eeb3-86bf-4845-b87c-24713cc1b69d, 'awright', 'Eric Walls', 'Noah', 'https://cdn.app/avatar/awright.png', '%CxEe!2Z9QDW', '2024-09-24T16:44:25');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (a03321a2-0c50-4c4b-a1e5-5c478e8aae21, 'kevinvega', 'Dana Morrow', 'Joseph', 'https://cdn.app/avatar/kevinvega.png', 'PqX@NJbsX@T9', '2023-12-02T23:11:41');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (52309205-3600-4b98-8dd8-7650411f2ec7, 'jeffrey51', 'Christopher Harper', 'Brian', 'https://cdn.app/avatar/jeffrey51.png', 'KE7En&&yt#RP', '2024-03-29T01:36:04');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (f002045b-0e5e-4402-bdfe-b754f67d7a97, 'frankthompson', 'Mr. Russell Massey', 'Kim', 'https://cdn.app/avatar/frankthompson.png', 't*9UlMmd@we4', '2024-02-08T09:15:41');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (8380a7ee-e20d-440e-807f-834f01f285ff, 'haynesjennifer', 'Lance Bell', 'Michael', 'https://cdn.app/avatar/haynesjennifer.png', 'Hw6LyxmE(9(o', '2023-11-29T16:37:35');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (3fbe80cf-286f-496e-857d-0ec273453af0, 'bethwilson', 'Marcia Parker', 'Kayla', 'https://cdn.app/avatar/bethwilson.png', '(1oC&nkIh@+0', '2025-01-05T09:13:21');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (40beea36-143c-4c5a-a967-2e3aa08c874f, 'steven67', 'Jerry Guerra', 'Rachel', 'https://cdn.app/avatar/steven67.png', '0Ugo7$OeP%as', '2025-05-25T06:47:44');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (47dcb0d7-6aee-416b-9e4b-9bd08c36202f, 'gbauer', 'Tracey Nelson', 'Vanessa', 'https://cdn.app/avatar/gbauer.png', '!q3Vrdbvb^Yd', '2025-02-12T23:54:03');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (0f69d9ca-fa58-4c83-be66-e0e65c99660e, 'coltonzuniga', 'Barbara Sullivan', 'Amy', 'https://cdn.app/avatar/coltonzuniga.png', 'dCV6DNiq(VaK', '2024-11-03T10:15:24');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (4f7c7cd9-93f7-4513-b8e4-8c498c18ba6e, 'mgutierrez', 'Valerie Villegas', 'Tammy', 'https://cdn.app/avatar/mgutierrez.png', 'hm_a4#Kdm7_@', '2024-08-07T18:49:46');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (74c4da88-2b34-48ae-a298-009530271742, 'gvaldez', 'Daniel Carroll', 'Julia', 'https://cdn.app/avatar/gvaldez.png', '#6PLSc7zP3Cx', '2024-09-16T11:40:29');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (8e40fa41-7960-4867-89dc-87a92c76672a, 'william03', 'Tara Campbell', 'Gail', 'https://cdn.app/avatar/william03.png', '+dAyh!OE%7iU', '2024-12-15T21:17:23');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (b6b697ea-10ca-4a93-abb9-b655e9805cad, 'cmason', 'Michele Stewart', 'Charles', 'https://cdn.app/avatar/cmason.png', '&7H&%pEtScO)', '2025-06-19T19:30:26');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (f9dbe3e4-eb08-485a-b052-06dc68bdcda4, 'stephaniewalters', 'Carolyn Bird', 'Miguel', 'https://cdn.app/avatar/stephaniewalters.png', 'LO90zeI2*&PQ', '2023-08-02T20:41:54');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (5234052e-fc77-40ee-84ca-c0830616a4ea, 'janet19', 'Mary Bennett', 'Seth', 'https://cdn.app/avatar/janet19.png', 'y*VJqVfYU*7J', '2023-08-01T12:22:13');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (47620c45-6518-4242-8018-609156dd1b15, 'danielle05', 'Kelly Green', 'Rachel', 'https://cdn.app/avatar/danielle05.png', '%rHBqeK*54Qo', '2025-03-12T04:51:06');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (d9aff1f8-1535-43b8-b9cd-793bb8c5198c, 'fitzpatricklinda', 'Debbie Powers', 'James', 'https://cdn.app/avatar/fitzpatricklinda.png', 'gYSwqlu5(9K4', '2023-10-15T03:49:50');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (db85fa2f-dbf7-489d-996b-1fc13e1d79d2, 'edwardconrad', 'Mark Arias', 'Michael', 'https://cdn.app/avatar/edwardconrad.png', '6YWP)Q)9dPu_', '2023-07-19T19:34:30');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (3b463fc3-e6f6-469f-b524-d96995da7489, 'zcarter', 'Samuel Mclaughlin', 'Harold', 'https://cdn.app/avatar/zcarter.png', 'Hp%mQtbIFq^4', '2024-05-07T07:48:18');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (1c90b441-e10a-42fc-a2e4-bfc1ff2bb6b5, 'christophermoore', 'Jack Meyer', 'Matthew', 'https://cdn.app/avatar/christophermoore.png', 'r!*5KlwZFJk6', '2024-07-10T05:24:32');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (f530a03a-6422-414e-a466-283cb3ad1f08, 'richard71', 'Kara Gillespie', 'Sarah', 'https://cdn.app/avatar/richard71.png', 'b!44AT&P@m6C', '2025-02-11T17:21:56');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (966eb28d-d8fc-4ff2-9fd5-65582a45bcb7, 'kenneth87', 'Charles Gonzalez', 'John', 'https://cdn.app/avatar/kenneth87.png', 'U0Ejb$^qHh7$', '2024-11-06T12:16:43');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (1dc8748b-f600-4b6b-b5a5-623636af9853, 'michaelaustin', 'Sharon Manning', 'Stephanie', 'https://cdn.app/avatar/michaelaustin.png', 'rb0R2DV$L$&M', '2025-02-15T20:39:30');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (b4d5a0c3-ec95-4d65-b87a-e972f510eda7, 'michael00', 'Shelby Ortiz', 'Jacob', 'https://cdn.app/avatar/michael00.png', '@4$MX(nT%apW', '2025-01-15T15:47:25');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (0a6accd1-4af0-4a27-91e2-1982824fce25, 'diane64', 'Scott Palmer', 'Taylor', 'https://cdn.app/avatar/diane64.png', 'J%(2UlDhk3ho', '2024-12-29T21:17:16');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (eae2624c-e35f-448e-a2b2-9f274a7283c4, 'andersondonna', 'Natalie Wong', 'Carla', 'https://cdn.app/avatar/andersondonna.png', '*3K(a&o&1qMR', '2023-11-01T16:04:24');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (567eee98-b58b-417a-bb1a-e160441f6706, 'angelavelasquez', 'Anthony Roy', 'Rose', 'https://cdn.app/avatar/angelavelasquez.png', 'EE^KAp0nI&(3', '2024-03-16T12:04:12');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (fc203ed8-7345-45a7-a901-76b091cdcd04, 'csanders', 'Rhonda Powers', 'Michael', 'https://cdn.app/avatar/csanders.png', 'Rd0mVcfPd)_t', '2023-10-08T03:15:17');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (34e5765e-2452-472d-8cbc-42c055491219, 'jane82', 'Virginia Duncan', 'Amy', 'https://cdn.app/avatar/jane82.png', 't@8ZkqMPidaE', '2025-01-21T11:15:57');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (df85dad7-3920-4978-b1e7-0d0e769fe31f, 'anne99', 'Theresa Cruz', 'Rebecca', 'https://cdn.app/avatar/anne99.png', 'tQiz4joa@5Sk', '2025-03-02T06:25:05');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (2086a599-3c78-4835-9f2e-1e1e7b9e7cd0, 'thompsonbrian', 'Jamie Lara', 'Timothy', 'https://cdn.app/avatar/thompsonbrian.png', 'f6)%XgHz8!r8', '2024-10-01T10:48:05');
INSERT INTO users (user_id, username, display_name, nickname, avatar_url, password, created_at)
VALUES (ac3044dc-04af-465d-ab1c-30dbd372fc55, 'johnjones', 'Jesus Sherman', 'Anna', 'https://cdn.app/avatar/johnjones.png', 'V)01F2qv41w#', '2025-01-24T20:23:47');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, 'group', 'Multi-layered asynchronous circuit', 'Investment third fill feeling.', false, f6fe92ac-7156-403e-a6a5-909db5e47793, 'https://cdn.app/background/bc5aa06a-f5aa-467f-8977-50809e69f890.jpg', '2024-09-25T10:28:47', '2024-09-25T10:28:47');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, 'group', 'Cloned discrete forecast', 'Leave yard less send.', false, 2d3e57be-ab65-4116-a5be-b6a0dfae942c, 'https://cdn.app/background/c08c992f-434d-44bc-88e5-b80e8e3eb34a.jpg', '2025-04-03T06:09:48', '2025-04-03T06:09:48');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, 'group', 'Triple-buffered attitude-oriented challenge', 'Part but seven budget operation fall.', false, 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'https://cdn.app/background/b910cbe4-84f8-4b81-ac33-cb934a7fd380.jpg', '2024-11-11T12:33:39', '2024-11-11T12:33:39');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, 'group', 'Compatible 3rdgeneration open architecture', 'Song every may past loss keep.', false, 90032e4d-e6d2-457a-8bca-971acbbf7d14, 'https://cdn.app/background/9f417131-b168-4d1e-b475-93e4198b9e1b.jpg', '2024-09-07T14:16:16', '2024-09-07T14:16:16');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, 'group', 'Persevering bandwidth-monitored task-force', 'All control lawyer late speak kid no.', false, ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'https://cdn.app/background/12030818-a4fe-4101-afc0-91bf2af81251.jpg', '2024-11-17T21:48:33', '2024-11-17T21:48:33');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, 'group', 'Self-enabling human-resource frame', 'Relationship fear ever onto.', false, f85cdd50-8102-46cc-b65d-a3055c42cf06, 'https://cdn.app/background/ba4f9ded-891a-47cd-8bc2-8333d61ff88c.jpg', '2024-07-15T17:33:38', '2024-07-15T17:33:38');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, 'group', 'Cross-platform high-level leverage', 'Sometimes culture hit whom.', false, bff92fd1-9205-42d7-be40-021f32f6aeb7, 'https://cdn.app/background/502278d3-d7ac-4e0b-9792-218128dbe57f.jpg', '2025-03-01T11:54:48', '2025-03-01T11:54:48');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, 'group', 'Grass-roots bottom-line instruction set', 'Scene while attack.', false, 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'https://cdn.app/background/69f5cf76-057a-4534-a3a4-e8434f509398.jpg', '2025-04-23T03:32:52', '2025-04-23T03:32:52');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, 'group', 'Customizable secondary leverage', 'Issue make wear beautiful day.', false, 15fa6665-4598-44e9-adc9-3aec797ae72e, 'https://cdn.app/background/70aad085-4a71-4abe-8fb1-f0b176953f05.jpg', '2025-06-19T03:36:11', '2025-06-19T03:36:11');
INSERT INTO conversations (conversation_id, type, name, description, is_deleted, created_by, background_url, created_at, updated_at)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, 'group', 'Horizontal system-worthy budgetary management', 'Year necessary by skin learn public authority.', false, 5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 'https://cdn.app/background/1a9fc679-950d-4059-8c0c-1eea922725b1.jpg', '2024-09-20T20:04:16', '2024-09-20T20:04:16');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, 90f492a6-c214-4958-b048-35cfafb4981b, 'moderator', '2025-02-12T10:23:23');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, fca223a8-dedd-4df6-ba79-4ca557c4046d, 'owner', '2024-11-28T17:04:20');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, 2bca799d-866d-4827-9ed2-339cbac9e173, 'member', '2024-10-23T06:24:21');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, 876562d9-3e00-46a2-993e-a24774bac570, 'owner', '2025-01-16T23:08:35');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'owner', '2025-04-24T16:28:03');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, 4aac9dde-3592-41cb-a800-0cc03c477b3e, 'moderator', '2025-04-02T01:52:32');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, 2beda7e9-9e57-4395-bc5e-1729d81048ff, 'moderator', '2025-02-20T15:50:45');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, 2b769ff9-0152-490d-8f5e-d4fe526ed28c, 'owner', '2025-04-04T13:38:33');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'owner', '2025-03-15T05:29:48');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, 841c2212-3a8c-464e-ba4f-bd09171acc15, 'member', '2025-02-22T20:15:34');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'member', '2025-03-06T18:06:50');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'member', '2025-02-13T18:55:21');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, 2bca799d-866d-4827-9ed2-339cbac9e173, 'owner', '2025-02-05T07:11:15');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, 8faa73c2-594d-495e-9abd-366d3b696306, 'moderator', '2025-05-14T16:14:44');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, 876562d9-3e00-46a2-993e-a24774bac570, 'owner', '2024-12-10T06:11:12');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'member', '2025-02-14T05:08:50');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, 2454122f-8646-4ef8-93e8-7f09b4e5b969, 'moderator', '2024-07-07T21:27:49');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, 9c33f384-9c68-47bc-b705-ea6117fa7e51, 'member', '2024-11-30T15:30:19');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, 841c2212-3a8c-464e-ba4f-bd09171acc15, 'moderator', '2024-08-02T07:33:06');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, ccdba86c-1e2f-4453-bd77-4fddce2236c7, 'member', '2025-04-27T05:59:37');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, f6fe92ac-7156-403e-a6a5-909db5e47793, 'owner', '2025-05-25T13:43:43');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'moderator', '2024-09-13T06:57:26');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, 15fa6665-4598-44e9-adc9-3aec797ae72e, 'owner', '2024-09-17T07:21:55');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'member', '2024-11-02T15:05:17');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, bff92fd1-9205-42d7-be40-021f32f6aeb7, 'owner', '2025-05-22T05:14:19');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, 3bed9540-ad92-4735-b87c-aed90bf17bbd, 'moderator', '2024-07-19T16:41:02');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, 3bed9540-ad92-4735-b87c-aed90bf17bbd, 'member', '2024-07-14T20:23:52');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, 2bca799d-866d-4827-9ed2-339cbac9e173, 'member', '2024-09-04T07:10:05');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, 2d3e57be-ab65-4116-a5be-b6a0dfae942c, 'owner', '2025-04-07T16:53:39');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'member', '2024-09-01T05:07:45');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, ca5e656f-84d9-47cc-b30d-7ed265f6c749, 'owner', '2025-05-07T21:40:04');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, fca223a8-dedd-4df6-ba79-4ca557c4046d, 'owner', '2025-06-23T03:49:50');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'member', '2024-11-10T18:11:52');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'member', '2025-06-18T02:26:31');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, ca5e656f-84d9-47cc-b30d-7ed265f6c749, 'member', '2025-04-16T11:20:08');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'member', '2024-12-12T23:55:39');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'member', '2024-09-29T10:01:39');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, 9c33f384-9c68-47bc-b705-ea6117fa7e51, 'member', '2025-01-06T18:50:53');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, 841c2212-3a8c-464e-ba4f-bd09171acc15, 'owner', '2024-07-24T16:50:29');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, 5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 'owner', '2025-01-27T03:51:37');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, bff92fd1-9205-42d7-be40-021f32f6aeb7, 'moderator', '2024-11-25T07:13:12');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, 876562d9-3e00-46a2-993e-a24774bac570, 'moderator', '2025-01-11T09:12:45');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, 90f492a6-c214-4958-b048-35cfafb4981b, 'owner', '2024-12-23T07:43:23');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, bff92fd1-9205-42d7-be40-021f32f6aeb7, 'member', '2025-06-06T07:05:27');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, 876562d9-3e00-46a2-993e-a24774bac570, 'moderator', '2025-03-08T08:08:20');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, 03a2b0b4-0446-4f42-9632-4d13fd4b3c93, 'member', '2024-11-07T03:13:35');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, 2bca799d-866d-4827-9ed2-339cbac9e173, 'member', '2025-02-09T01:39:36');
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, ccdba86c-1e2f-4453-bd77-4fddce2236c7, 'member', '2025-03-08T04:52:23');
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), 90f492a6-c214-4958-b048-35cfafb4981b, 'Over that entire their include.', '2024-12-26T14:49:54', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), 90f492a6-c214-4958-b048-35cfafb4981b, 'Reality note letter unit north specific.', '2024-08-02T08:56:25', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), fca223a8-dedd-4df6-ba79-4ca557c4046d, 'Practice son large later.', '2024-12-31T22:17:36', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), fca223a8-dedd-4df6-ba79-4ca557c4046d, 'Watch significant couple arrive raise join people.', '2024-11-30T14:57:06', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), fca223a8-dedd-4df6-ba79-4ca557c4046d, 'Black easy campaign center agree inside.', '2024-07-13T08:22:21', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), 2bca799d-866d-4827-9ed2-339cbac9e173, 'Whose degree north community follow lay lead guy.', '2024-12-08T22:13:27', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), 876562d9-3e00-46a2-993e-a24774bac570, 'Report mission north economy word per.', '2025-02-06T04:39:56', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'Mouth entire together operation not your.', '2024-11-25T02:05:02', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), 4aac9dde-3592-41cb-a800-0cc03c477b3e, 'Quickly draw maybe contain call factor increase.', '2025-01-24T17:10:51', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), 4aac9dde-3592-41cb-a800-0cc03c477b3e, 'Yet step impact maintain range.', '2025-05-11T04:29:27', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (1f2df2c0-2ce9-463e-9160-a96625da7bd0, now(), 4aac9dde-3592-41cb-a800-0cc03c477b3e, 'Operation rule suffer put.', '2025-04-27T21:16:02', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 2beda7e9-9e57-4395-bc5e-1729d81048ff, 'Relationship east always really something scientist available.', '2025-01-31T05:21:23', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 2beda7e9-9e57-4395-bc5e-1729d81048ff, 'Describe enjoy wrong cold billion pressure care.', '2025-02-02T13:45:53', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 2beda7e9-9e57-4395-bc5e-1729d81048ff, 'Voice beyond first.', '2025-03-17T16:39:08', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 2b769ff9-0152-490d-8f5e-d4fe526ed28c, 'Yeah finally generation movement.', '2024-08-29T23:23:38', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 2b769ff9-0152-490d-8f5e-d4fe526ed28c, 'Teacher theory front eat thank.', '2025-06-23T11:27:08', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 2b769ff9-0152-490d-8f5e-d4fe526ed28c, 'Camera effort rise seat trade listen.', '2024-07-10T16:39:42', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'Window current Mr participant also any rise behind.', '2024-10-30T03:37:25', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'Agent could approach common.', '2025-04-25T10:02:04', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'Find reflect democratic record know.', '2024-09-02T11:12:26', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 841c2212-3a8c-464e-ba4f-bd09171acc15, 'Coach organization as.', '2025-02-12T18:00:56', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 841c2212-3a8c-464e-ba4f-bd09171acc15, 'Identify commercial price discussion many what small.', '2025-03-20T23:35:54', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'Gas hair seek agreement among perhaps while.', '2025-03-21T07:19:03', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4fa9ef20-9cf2-4a7c-97f9-98abd1fbdb1e, now(), 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'Number firm order walk no foreign worker.', '2025-06-19T14:24:50', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, now(), ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'This cover near glass memory church although.', '2025-03-15T07:23:32', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, now(), 2bca799d-866d-4827-9ed2-339cbac9e173, 'More watch wall.', '2024-07-27T08:09:27', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, now(), 8faa73c2-594d-495e-9abd-366d3b696306, 'Memory court improve democratic show Mr spend.', '2025-04-22T17:21:39', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, now(), 8faa73c2-594d-495e-9abd-366d3b696306, 'Old dog last glass thought mind treatment.', '2025-05-12T09:12:11', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, now(), 8faa73c2-594d-495e-9abd-366d3b696306, 'Speech method state point save western use foot.', '2025-06-17T23:24:56', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (809765a6-5e63-4d9f-9d1d-412485693a76, now(), 876562d9-3e00-46a2-993e-a24774bac570, 'Chance entire role step note.', '2024-09-18T15:21:32', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'Short himself board.', '2025-03-11T10:46:13', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'Various give book month.', '2025-04-06T13:34:50', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'Try stop economic ok able prove letter.', '2024-11-30T04:10:18', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), 2454122f-8646-4ef8-93e8-7f09b4e5b969, 'Community hour whether situation be defense likely long.', '2025-03-02T20:27:56', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), 2454122f-8646-4ef8-93e8-7f09b4e5b969, 'Century leave leg ever method.', '2024-08-23T13:26:30', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), 2454122f-8646-4ef8-93e8-7f09b4e5b969, 'Sometimes artist professor consider debate fire.', '2024-07-22T07:20:07', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), 9c33f384-9c68-47bc-b705-ea6117fa7e51, 'Early from you level.', '2025-01-04T11:41:58', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), 9c33f384-9c68-47bc-b705-ea6117fa7e51, 'Indeed recognize describe fear prepare rich.', '2025-03-29T03:41:21', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), 841c2212-3a8c-464e-ba4f-bd09171acc15, 'Exist world source car apply.', '2024-10-22T02:09:40', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (42741280-1595-43ac-a20f-a2dbd302987a, now(), ccdba86c-1e2f-4453-bd77-4fddce2236c7, 'Group fill still realize.', '2025-05-22T20:45:18', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), f6fe92ac-7156-403e-a6a5-909db5e47793, 'Visit during pull.', '2024-11-18T04:35:14', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'Our industry statement likely product eight space indeed.', '2024-09-11T00:13:56', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), 15fa6665-4598-44e9-adc9-3aec797ae72e, 'Try there these health wrong.', '2025-05-16T08:51:30', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), 15fa6665-4598-44e9-adc9-3aec797ae72e, 'Food establish down mind pass six.', '2025-02-07T22:57:59', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), 15fa6665-4598-44e9-adc9-3aec797ae72e, 'Establish anything feeling.', '2025-04-28T08:48:05', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'Inside and lose whose work experience.', '2024-11-17T18:40:28', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'Out lay control collection leader actually.', '2025-03-26T13:52:58', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'Enough case report way pass.', '2025-01-10T15:43:14', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), bff92fd1-9205-42d7-be40-021f32f6aeb7, 'Big suggest through assume project age.', '2024-10-04T17:35:35', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), bff92fd1-9205-42d7-be40-021f32f6aeb7, 'Thus first former human nature after card.', '2024-07-28T10:05:43', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (4a913246-9747-48a8-93f9-dbfbacdc6bac, now(), 3bed9540-ad92-4735-b87c-aed90bf17bbd, 'Environment home strategy item tend behind.', '2025-05-05T20:33:22', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, now(), 3bed9540-ad92-4735-b87c-aed90bf17bbd, 'Weight school air just.', '2025-03-13T09:21:42', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, now(), 2bca799d-866d-4827-9ed2-339cbac9e173, 'Serious perform across need the unit people argue.', '2024-09-27T18:17:58', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, now(), 2bca799d-866d-4827-9ed2-339cbac9e173, 'Huge reveal ground law son stand newspaper its.', '2025-02-01T20:39:25', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, now(), 2d3e57be-ab65-4116-a5be-b6a0dfae942c, 'Stage see writer never least pay.', '2024-07-07T15:04:02', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, now(), 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'Not fear kitchen.', '2024-09-06T09:03:10', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, now(), ca5e656f-84d9-47cc-b30d-7ed265f6c749, 'Several true wife off industry your.', '2024-09-23T15:07:09', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (835e30fc-6ee0-4e2e-a61c-a24a29c80299, now(), ca5e656f-84d9-47cc-b30d-7ed265f6c749, 'Mind almost follow floor write.', '2025-06-13T06:36:13', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, now(), fca223a8-dedd-4df6-ba79-4ca557c4046d, 'Money possible second whether per.', '2024-10-13T22:35:15', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, now(), fca223a8-dedd-4df6-ba79-4ca557c4046d, 'Well system pattern allow might president country.', '2024-08-02T12:53:39', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, now(), 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'Usually feel guy probably single.', '2025-05-12T23:38:33', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, now(), 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'Model church can white despite can.', '2024-08-08T13:59:50', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, now(), 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'Event west stand require say theory.', '2025-05-24T20:13:11', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, now(), 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'Whatever perhaps your level citizen.', '2025-05-05T06:23:19', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, now(), ca5e656f-84d9-47cc-b30d-7ed265f6c749, 'Staff above writer member example instead American city.', '2025-02-17T07:23:46', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, now(), ca5e656f-84d9-47cc-b30d-7ed265f6c749, 'Medical these eight stage during we mother.', '2025-03-19T15:31:53', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (cd5ab3cc-b2f4-4add-88eb-45bdc3621c0b, now(), ca5e656f-84d9-47cc-b30d-7ed265f6c749, 'White hear short scene every.', '2024-11-10T15:51:59', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, now(), 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'Particular under wall improve game site.', '2025-03-12T06:33:20', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, now(), 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'Room improve first west meeting blood expert.', '2025-06-04T05:38:58', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, now(), 9c33f384-9c68-47bc-b705-ea6117fa7e51, 'Gas raise next.', '2024-08-27T11:25:12', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, now(), 9c33f384-9c68-47bc-b705-ea6117fa7e51, 'That provide some hear.', '2024-10-11T02:19:30', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, now(), 9c33f384-9c68-47bc-b705-ea6117fa7e51, 'Town today time home top.', '2025-06-15T13:34:54', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (0d155672-db5a-4cc5-abdd-5b1c6f5c052f, now(), 841c2212-3a8c-464e-ba4f-bd09171acc15, 'Research summer clearly.', '2024-09-24T20:12:15', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, now(), 5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 'Measure plan job camera.', '2024-07-18T06:56:54', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, now(), 5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 'House ability police despite down south energy government.', '2024-11-06T05:08:58', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, now(), 5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 'Should race option quality son suggest generation.', '2024-07-12T02:26:10', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, now(), bff92fd1-9205-42d7-be40-021f32f6aeb7, 'Walk heavy imagine box several body.', '2024-07-17T15:54:46', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, now(), 876562d9-3e00-46a2-993e-a24774bac570, 'Way here see marriage rise many join add.', '2025-01-01T09:46:51', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, now(), 876562d9-3e00-46a2-993e-a24774bac570, 'Half free believe soldier including main down.', '2025-02-13T11:46:02', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, now(), 876562d9-3e00-46a2-993e-a24774bac570, 'Never job center Mrs.', '2025-06-05T04:38:45', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (85f6f53e-c84d-4118-8e2f-925454c1b350, now(), 90f492a6-c214-4958-b048-35cfafb4981b, 'Card development scientist scene probably about measure.', '2025-04-26T00:04:48', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), bff92fd1-9205-42d7-be40-021f32f6aeb7, 'Song manager shake investment space.', '2025-05-05T22:45:51', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), bff92fd1-9205-42d7-be40-021f32f6aeb7, 'Institution difference mother.', '2024-12-07T07:54:36', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), bff92fd1-9205-42d7-be40-021f32f6aeb7, 'Kind professional garden result meet open state.', '2025-02-27T07:51:19', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), 876562d9-3e00-46a2-993e-a24774bac570, 'Describe challenge owner.', '2024-12-06T03:47:37', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), 876562d9-3e00-46a2-993e-a24774bac570, 'How so perhaps able simple.', '2024-12-01T15:30:39', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), 03a2b0b4-0446-4f42-9632-4d13fd4b3c93, 'Table somebody charge drive method sometimes.', '2024-12-16T10:51:00', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), 03a2b0b4-0446-4f42-9632-4d13fd4b3c93, 'Agency family never your garden.', '2025-04-28T23:19:27', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), 2bca799d-866d-4827-9ed2-339cbac9e173, 'Into wind himself close.', '2025-03-19T14:37:17', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), 2bca799d-866d-4827-9ed2-339cbac9e173, 'Movement article tough operation.', '2024-12-13T21:59:07', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), 2bca799d-866d-4827-9ed2-339cbac9e173, 'Teacher approach interview happen.', '2024-11-07T16:43:32', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), ccdba86c-1e2f-4453-bd77-4fddce2236c7, 'Girl half million policy pressure discussion.', '2024-12-28T14:18:16', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), ccdba86c-1e2f-4453-bd77-4fddce2236c7, 'Everybody training increase contain worker just activity.', '2024-08-11T13:19:32', false);
INSERT INTO messages_by_conversation (conversation_id, message_id, sender_id, content, created_at, is_deleted)
VALUES (ac8e051c-caff-4c65-9a7b-3e72ba49fdd5, now(), ccdba86c-1e2f-4453-bd77-4fddce2236c7, 'By direction into case carry city very this.', '2025-03-20T10:57:19', false);
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (fd6d70d6-1856-4993-914e-a37ea37b3027, fbfc33e3-2d4d-4a91-adc5-18995a3c8edb, 'pending', '2025-07-03T01:59:02.562120', '2025-07-03T01:59:02.562120');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (2beda7e9-9e57-4395-bc5e-1729d81048ff, fd6d70d6-1856-4993-914e-a37ea37b3027, 'blocked', '2025-07-03T01:59:02.562144', '2025-07-03T01:59:02.562144');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (841c2212-3a8c-464e-ba4f-bd09171acc15, 8faa73c2-594d-495e-9abd-366d3b696306, 'accepted', '2025-07-03T01:59:02.562160', '2025-07-03T01:59:02.562160');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (90032e4d-e6d2-457a-8bca-971acbbf7d14, 5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 'blocked', '2025-07-03T01:59:02.562175', '2025-07-03T01:59:02.562175');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (90f492a6-c214-4958-b048-35cfafb4981b, 5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 'pending', '2025-07-03T01:59:02.562189', '2025-07-03T01:59:02.562189');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (f85cdd50-8102-46cc-b65d-a3055c42cf06, 2bca799d-866d-4827-9ed2-339cbac9e173, 'accepted', '2025-07-03T01:59:02.562203', '2025-07-03T01:59:02.562203');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (fca223a8-dedd-4df6-ba79-4ca557c4046d, 841c2212-3a8c-464e-ba4f-bd09171acc15, 'pending', '2025-07-03T01:59:02.562216', '2025-07-03T01:59:02.562216');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (2b769ff9-0152-490d-8f5e-d4fe526ed28c, fca223a8-dedd-4df6-ba79-4ca557c4046d, 'accepted', '2025-07-03T01:59:02.562233', '2025-07-03T01:59:02.562233');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (4aac9dde-3592-41cb-a800-0cc03c477b3e, 2d3e57be-ab65-4116-a5be-b6a0dfae942c, 'accepted', '2025-07-03T01:59:02.562248', '2025-07-03T01:59:02.562248');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (841c2212-3a8c-464e-ba4f-bd09171acc15, 876562d9-3e00-46a2-993e-a24774bac570, 'pending', '2025-07-03T01:59:02.562262', '2025-07-03T01:59:02.562262');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (ccdba86c-1e2f-4453-bd77-4fddce2236c7, 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'pending', '2025-07-03T01:59:02.562276', '2025-07-03T01:59:02.562276');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (4aac9dde-3592-41cb-a800-0cc03c477b3e, e12886ec-cd3d-4fec-b844-58ad87de6649, 'pending', '2025-07-03T01:59:02.562290', '2025-07-03T01:59:02.562290');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 4aac9dde-3592-41cb-a800-0cc03c477b3e, 'blocked', '2025-07-03T01:59:02.562304', '2025-07-03T01:59:02.562304');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (03a2b0b4-0446-4f42-9632-4d13fd4b3c93, 2beda7e9-9e57-4395-bc5e-1729d81048ff, 'pending', '2025-07-03T01:59:02.562317', '2025-07-03T01:59:02.562317');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (3bed9540-ad92-4735-b87c-aed90bf17bbd, ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'pending', '2025-07-03T01:59:02.562329', '2025-07-03T01:59:02.562329');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (2d3e57be-ab65-4116-a5be-b6a0dfae942c, 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'accepted', '2025-07-03T01:59:02.562341', '2025-07-03T01:59:02.562341');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (90032e4d-e6d2-457a-8bca-971acbbf7d14, 3bed9540-ad92-4735-b87c-aed90bf17bbd, 'pending', '2025-07-03T01:59:02.562353', '2025-07-03T01:59:02.562353');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (2d3e57be-ab65-4116-a5be-b6a0dfae942c, ccdba86c-1e2f-4453-bd77-4fddce2236c7, 'blocked', '2025-07-03T01:59:02.562365', '2025-07-03T01:59:02.562365');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (cbe51815-190f-4341-a674-9bbea3c3600d, fbfc33e3-2d4d-4a91-adc5-18995a3c8edb, 'blocked', '2025-07-03T01:59:02.562378', '2025-07-03T01:59:02.562378');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (e12886ec-cd3d-4fec-b844-58ad87de6649, fd6d70d6-1856-4993-914e-a37ea37b3027, 'blocked', '2025-07-03T01:59:02.562390', '2025-07-03T01:59:02.562390');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (15fa6665-4598-44e9-adc9-3aec797ae72e, fd6d70d6-1856-4993-914e-a37ea37b3027, 'accepted', '2025-07-03T01:59:02.562402', '2025-07-03T01:59:02.562402');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (876562d9-3e00-46a2-993e-a24774bac570, ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'accepted', '2025-07-03T01:59:02.562414', '2025-07-03T01:59:02.562414');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 261080f3-0cf8-4e0b-8c77-22fa0c6bda8d, 'blocked', '2025-07-03T01:59:02.562427', '2025-07-03T01:59:02.562427');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 2b769ff9-0152-490d-8f5e-d4fe526ed28c, 'accepted', '2025-07-03T01:59:02.562439', '2025-07-03T01:59:02.562439');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (3bed9540-ad92-4735-b87c-aed90bf17bbd, ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'blocked', '2025-07-03T01:59:02.562452', '2025-07-03T01:59:02.562452');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (ca5e656f-84d9-47cc-b30d-7ed265f6c749, 03a2b0b4-0446-4f42-9632-4d13fd4b3c93, 'pending', '2025-07-03T01:59:02.562460', '2025-07-03T01:59:02.562460');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (ccdba86c-1e2f-4453-bd77-4fddce2236c7, 2f67ba06-3887-41ed-a00f-e6b90197ff9a, 'blocked', '2025-07-03T01:59:02.562474', '2025-07-03T01:59:02.562474');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (4aac9dde-3592-41cb-a800-0cc03c477b3e, 90f492a6-c214-4958-b048-35cfafb4981b, 'accepted', '2025-07-03T01:59:02.562486', '2025-07-03T01:59:02.562486');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (2d3e57be-ab65-4116-a5be-b6a0dfae942c, 90f492a6-c214-4958-b048-35cfafb4981b, 'pending', '2025-07-03T01:59:02.562500', '2025-07-03T01:59:02.562500');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (15fa6665-4598-44e9-adc9-3aec797ae72e, 8faa73c2-594d-495e-9abd-366d3b696306, 'blocked', '2025-07-03T01:59:02.562511', '2025-07-03T01:59:02.562511');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (876562d9-3e00-46a2-993e-a24774bac570, 2beda7e9-9e57-4395-bc5e-1729d81048ff, 'blocked', '2025-07-03T01:59:02.562522', '2025-07-03T01:59:02.562522');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (f6fe92ac-7156-403e-a6a5-909db5e47793, 90032e4d-e6d2-457a-8bca-971acbbf7d14, 'pending', '2025-07-03T01:59:02.562535', '2025-07-03T01:59:02.562535');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (bff92fd1-9205-42d7-be40-021f32f6aeb7, 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'pending', '2025-07-03T01:59:02.562548', '2025-07-03T01:59:02.562548');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (2d3e57be-ab65-4116-a5be-b6a0dfae942c, 90032e4d-e6d2-457a-8bca-971acbbf7d14, 'pending', '2025-07-03T01:59:02.562556', '2025-07-03T01:59:02.562556');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (fca223a8-dedd-4df6-ba79-4ca557c4046d, bff92fd1-9205-42d7-be40-021f32f6aeb7, 'pending', '2025-07-03T01:59:02.562566', '2025-07-03T01:59:02.562566');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (8faa73c2-594d-495e-9abd-366d3b696306, cbe51815-190f-4341-a674-9bbea3c3600d, 'pending', '2025-07-03T01:59:02.562578', '2025-07-03T01:59:02.562578');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (9de7b78c-f3b3-4919-ad98-a10c2e7cf099, fbfc33e3-2d4d-4a91-adc5-18995a3c8edb, 'blocked', '2025-07-03T01:59:02.562590', '2025-07-03T01:59:02.562590');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (8faa73c2-594d-495e-9abd-366d3b696306, 9c33f384-9c68-47bc-b705-ea6117fa7e51, 'accepted', '2025-07-03T01:59:02.562602', '2025-07-03T01:59:02.562602');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (cbe51815-190f-4341-a674-9bbea3c3600d, 841c2212-3a8c-464e-ba4f-bd09171acc15, 'blocked', '2025-07-03T01:59:02.562612', '2025-07-03T01:59:02.562612');
INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
VALUES (bff92fd1-9205-42d7-be40-021f32f6aeb7, 8faa73c2-594d-495e-9abd-366d3b696306, 'pending', '2025-07-03T01:59:02.562620', '2025-07-03T01:59:02.562620');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (b8aef42a-18bb-496f-a29e-a145498fc19b, ca5e656f-84d9-47cc-b30d-7ed265f6c749, 2d3e57be-ab65-4116-a5be-b6a0dfae942c, 'Create stop might opportunity entire.', 'declined', '2025-07-03T01:58:05', '2025-07-03T01:58:36');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (147e3e44-ecc6-46a7-b791-65c792d8a4cd, fca223a8-dedd-4df6-ba79-4ca557c4046d, f6fe92ac-7156-403e-a6a5-909db5e47793, 'Page subject hit professor together several national.', 'declined', '2025-07-03T01:57:38', '2025-07-03T01:58:32');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (ec535251-c587-40c6-a973-2259aa3e59b5, 2beda7e9-9e57-4395-bc5e-1729d81048ff, ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 'Including rest site rich throughout current news.', 'declined', '2025-07-03T01:58:18', '2025-07-03T01:58:59');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (757ff6ca-ee5b-4cbd-9942-7d71a4653549, bff92fd1-9205-42d7-be40-021f32f6aeb7, 2bca799d-866d-4827-9ed2-339cbac9e173, 'Sound nation easy trade better scene customer.', 'declined', '2025-07-03T01:55:23', '2025-07-03T01:58:15');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (88f5f1a8-8aa5-4010-94c2-87345b9289f6, 90032e4d-e6d2-457a-8bca-971acbbf7d14, 9c33f384-9c68-47bc-b705-ea6117fa7e51, 'Share bill team through center.', 'declined', '2025-07-03T01:58:28', '2025-07-03T01:58:39');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (97d99bc7-2474-4bd1-b44e-c9782dae9ab8, cbe51815-190f-4341-a674-9bbea3c3600d, bff92fd1-9205-42d7-be40-021f32f6aeb7, 'Both appear material forward art.', 'declined', '2025-07-03T01:53:11', '2025-07-03T01:59:04');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (f6dd838b-cbfa-4988-b9e7-10a5a5bd65c0, 90f492a6-c214-4958-b048-35cfafb4981b, 2beda7e9-9e57-4395-bc5e-1729d81048ff, 'Especially into significant live central reach policy.', 'pending', '2025-07-03T01:54:32', '2025-07-03T01:54:33');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (99e2f3c5-9a93-40f3-b196-41e3991a89f6, 8faa73c2-594d-495e-9abd-366d3b696306, cbe51815-190f-4341-a674-9bbea3c3600d, 'Note media heavy evidence exactly laugh.', 'declined', '2025-07-03T01:53:40', '2025-07-03T01:55:07');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (c0102760-4f7f-4bae-8fb5-4b0a3cb00559, ca5e656f-84d9-47cc-b30d-7ed265f6c749, 03a2b0b4-0446-4f42-9632-4d13fd4b3c93, 'Western section health building thus model.', 'pending', '2025-07-03T01:58:00', '2025-07-03T01:58:12');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (87af5089-0758-46d6-b0dd-5e270260b1b7, 2454122f-8646-4ef8-93e8-7f09b4e5b969, e12886ec-cd3d-4fec-b844-58ad87de6649, 'Race technology center four.', 'declined', '2025-07-03T01:59:05', '2025-07-03T01:59:05');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (b78b1f6f-401b-4998-aeb6-99dc3db0d927, 9c33f384-9c68-47bc-b705-ea6117fa7e51, 2d3e57be-ab65-4116-a5be-b6a0dfae942c, 'Mr sea he.', 'pending', '2025-07-03T01:53:25', '2025-07-03T01:57:22');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (29d089fa-649e-44a3-a90a-3a517b1d8b68, ca5e656f-84d9-47cc-b30d-7ed265f6c749, fbfc33e3-2d4d-4a91-adc5-18995a3c8edb, 'Off street energy heart could security.', 'declined', '2025-07-03T01:54:57', '2025-07-03T01:58:57');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (a89e5042-4248-4a59-92d4-0f77f0097fce, 90032e4d-e6d2-457a-8bca-971acbbf7d14, 2d3e57be-ab65-4116-a5be-b6a0dfae942c, 'Environment senior serve institution bring way.', 'pending', '2025-07-03T01:58:24', '2025-07-03T01:58:33');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (c17b3449-c006-4329-a985-91ed307fe93f, f6fe92ac-7156-403e-a6a5-909db5e47793, 5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 'Give drive somebody worker already civil.', 'pending', '2025-07-03T01:53:40', '2025-07-03T01:57:15');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (0d0b8d83-3b99-4fe1-9187-5da722c27de2, e12886ec-cd3d-4fec-b844-58ad87de6649, 90032e4d-e6d2-457a-8bca-971acbbf7d14, 'Change edge partner reveal.', 'pending', '2025-07-03T01:57:53', '2025-07-03T01:58:21');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (d845ce84-4936-4041-a17b-5ad58ee4adc4, ccf1786d-c208-4d93-bb8a-81d81d2f0cc5, 8faa73c2-594d-495e-9abd-366d3b696306, 'Special say car matter money father.', 'declined', '2025-07-03T01:58:07', '2025-07-03T01:58:53');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (42b47acf-443a-48db-989e-ca7ce2eace2e, 5ff184b9-7464-4ded-a708-5bcd6b6e05b6, 9de7b78c-f3b3-4919-ad98-a10c2e7cf099, 'Fish force past political.', 'pending', '2025-07-03T01:55:37', '2025-07-03T01:56:42');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (a9b005dd-1750-426e-85d5-9ae7d563a2f6, ccdba86c-1e2f-4453-bd77-4fddce2236c7, 2beda7e9-9e57-4395-bc5e-1729d81048ff, 'Control room again store even.', 'pending', '2025-07-03T01:58:26', '2025-07-03T01:58:44');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (c8cdf2d5-19d5-4976-937b-e9a6c4c7dec8, 876562d9-3e00-46a2-993e-a24774bac570, ccdba86c-1e2f-4453-bd77-4fddce2236c7, 'So produce gas TV in.', 'declined', '2025-07-03T01:53:08', '2025-07-03T01:57:31');
INSERT INTO friend_requests (request_id, from_user_id, to_user_id, message, status, created_at, responded_at)
VALUES (59f5908b-de56-4588-bb83-1ab70c500b1f, 03a2b0b4-0446-4f42-9632-4d13fd4b3c93, bff92fd1-9205-42d7-be40-021f32f6aeb7, 'Road agreement environmental will.', 'pending', '2025-07-03T01:55:08', '2025-07-03T01:55:49');