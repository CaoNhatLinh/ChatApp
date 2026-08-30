/*
 * Nối / ChatApp — Canonical Cassandra schema (Apache Cassandra 4.1+)
 *
 * Purpose
 * -------
 * This is the single source of truth for a NEW environment. It deliberately
 * does not alter or drop an existing keyspace. Existing installations must be
 * migrated with a separate, tested data migration.
 *
 * Design rules
 * ------------
 * - Cassandra tables are designed by query; duplicated projections are normal.
 * - No materialized views and no secondary indexes: write projections in the
 *   application/outbox consumer instead.
 * - Use timeuuid for ordered events/messages and cursor pagination.
 * - Enforce limits (3 pinned rooms, 5 pinned messages, invite max uses,
 *   rate/slow mode) in a service using LWT only where a compare-and-set is
 *   necessary. Never use SQL expressions such as CASE or `x = x + 1`.
 * - `metadata` fields are intentionally text maps. Validate their allowed keys
 *   at the API boundary; do not put unbounded user content into them.
 */

CREATE KEYSPACE IF NOT EXISTS chat_app
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'datacenter1': 1
}
AND durable_writes = true;

USE chat_app;

/* ============================== Shared UDTs ============================== */

CREATE TYPE IF NOT EXISTS message_summary (
  message_id timeuuid,
  sender_id uuid,
  sender_display_name text,
  content_preview text,
  message_type text,
  created_at timestamp,
  is_deleted boolean,
  has_attachments boolean
);

CREATE TYPE IF NOT EXISTS attachment_ref (
  attachment_id uuid,
  asset_id uuid,
  storage_provider text,
  storage_key text,
  file_name text,
  mime_type text,
  byte_size bigint,
  width int,
  height int,
  duration_ms bigint,
  thumbnail_url text,
  is_spoiler boolean
);

/* ========================= Identity and app RBAC ========================= */

CREATE TABLE IF NOT EXISTS users_by_id (
  user_id uuid PRIMARY KEY,
  username text,
  username_normalized text,
  email text,
  email_normalized text,
  password_hash text,                /* null only for a verified external-only identity */
  auth_provider text,                /* LOCAL, GOOGLE, GITHUB, ... */
  external_subject text,
  display_name text,
  nickname text,
  bio text,
  avatar_url text,
  avatar_asset_id uuid,
  account_status text,              /* ACTIVE, SUSPENDED, BANNED, DELETED */
  email_verified_at timestamp,
  locale text,
  timezone text,
  security_version int,             /* increment to revoke all JWT/refresh sessions */
  created_at timestamp,
  updated_at timestamp,
  last_login_at timestamp,
  deleted_at timestamp
);

/* Use INSERT ... IF NOT EXISTS to claim a normalized username. */
CREATE TABLE IF NOT EXISTS user_id_by_username (
  username_normalized text PRIMARY KEY,
  user_id uuid,
  created_at timestamp
);

CREATE TABLE IF NOT EXISTS user_id_by_email (
  email_normalized text PRIMARY KEY,
  user_id uuid,
  created_at timestamp
);

/* Required for a verified external login lookup; provider + subject is unique. */
CREATE TABLE IF NOT EXISTS user_id_by_external_identity (
  auth_provider text,
  external_subject text,
  user_id uuid,
  created_at timestamp,
  PRIMARY KEY ((auth_provider), external_subject)
);

/* Prefix projection for the member picker. Write prefixes of length 2..20 only. */
CREATE TABLE IF NOT EXISTS users_by_username_prefix (
  username_prefix text,
  username_normalized text,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_asset_id uuid,
  account_status text,
  PRIMARY KEY ((username_prefix), username_normalized, user_id)
) WITH CLUSTERING ORDER BY (username_normalized ASC, user_id ASC);

CREATE TABLE IF NOT EXISTS refresh_tokens_by_user (
  user_id uuid,
  issued_at timeuuid,
  token_id uuid,
  token_hash text,
  device_id uuid,
  expires_at timestamp,
  revoked_at timestamp,
  replaced_by_token_id uuid,
  PRIMARY KEY ((user_id), issued_at, token_id)
) WITH CLUSTERING ORDER BY (issued_at DESC, token_id ASC);

CREATE TABLE IF NOT EXISTS refresh_token_owner_by_id (
  token_id uuid PRIMARY KEY,
  user_id uuid,
  token_hash text,
  expires_at timestamp,
  revoked_at timestamp,
  replaced_by_token_id uuid
);

/* APP roles are independent from roles inside a conversation. */
CREATE TABLE IF NOT EXISTS app_roles_by_user (
  user_id uuid,
  role_code text,                   /* SUPER_ADMIN, APP_ADMIN, TRUST_SAFETY, SUPPORT, ANALYST, AUDITOR */
  grant_id timeuuid,
  granted_by uuid,
  granted_at timestamp,
  expires_at timestamp,
  PRIMARY KEY ((user_id), role_code)
);

CREATE TABLE IF NOT EXISTS app_role_members_by_role (
  role_code text,
  granted_at timeuuid,
  user_id uuid,
  grant_id timeuuid,
  granted_by uuid,
  expires_at timestamp,
  PRIMARY KEY ((role_code), granted_at, user_id)
) WITH CLUSTERING ORDER BY (granted_at DESC, user_id ASC);

CREATE TABLE IF NOT EXISTS app_permissions_by_role (
  role_code text,
  permission_code text,             /* e.g. USER_SUSPEND, ROOM_MODERATE, AUDIT_READ */
  granted_at timestamp,
  PRIMARY KEY ((role_code), permission_code)
);

/* Built-in app-role permission catalogue; user assignments remain data-driven. */
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'APP_ROLE_MANAGE', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'USER_READ', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'SESSION_REVOKE', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'ANALYTICS_READ', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'USER_SUSPEND', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'USER_RESTORE', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'ROOM_READ', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'ROOM_MODERATE', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'REPORT_MANAGE', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('APP_ADMIN', 'AUDIT_READ', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('TRUST_SAFETY', 'ROOM_MODERATE', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('TRUST_SAFETY', 'REPORT_MANAGE', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('TRUST_SAFETY', 'AUDIT_READ', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('SUPPORT', 'USER_READ', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('SUPPORT', 'ROOM_READ', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('ANALYST', 'ANALYTICS_READ', toTimestamp(now()));
INSERT INTO app_permissions_by_role (role_code, permission_code, granted_at) VALUES ('AUDITOR', 'AUDIT_READ', toTimestamp(now()));

CREATE TABLE IF NOT EXISTS user_devices_by_user (
  user_id uuid,
  device_id uuid,
  platform text,                    /* WEB, IOS, ANDROID */
  push_provider text,               /* FCM, APNS, WEB_PUSH */
  push_token text,
  device_name text,
  app_version text,
  is_active boolean,
  created_at timestamp,
  last_seen_at timestamp,
  PRIMARY KEY ((user_id), device_id)
);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id uuid PRIMARY KEY,
  global_level text,                /* ALL, MENTIONS, DIRECT_ONLY, NONE */
  push_enabled boolean,
  email_enabled boolean,
  desktop_enabled boolean,
  sound_enabled boolean,
  quiet_hours_start text,
  quiet_hours_end text,
  timezone text,
  updated_at timestamp
);

CREATE TABLE IF NOT EXISTS user_chat_preferences (
  user_id uuid PRIMARY KEY,
  default_theme_id text,
  default_bubble_style_id text,
  default_background_asset_id text,
  updated_at timestamp
);

/* Social blocking is distinct from an administrator ban/sanction. */
CREATE TABLE IF NOT EXISTS user_blocks_by_blocker (
  blocker_id uuid,
  blocked_user_id uuid,
  created_at timestamp,
  reason_text text,
  PRIMARY KEY ((blocker_id), blocked_user_id)
);

CREATE TABLE IF NOT EXISTS blocked_by_user (
  blocked_user_id uuid,
  blocker_id uuid,
  created_at timestamp,
  PRIMARY KEY ((blocked_user_id), blocker_id)
);

/* Friendship is an explicit relationship; it is never inferred from a DM. */
CREATE TABLE IF NOT EXISTS friendships_by_user (
  user_id uuid,
  relationship_status text,          /* PENDING_OUTGOING, ACCEPTED, DECLINED, REMOVED */
  updated_at timeuuid,
  other_user_id uuid,
  requested_at timestamp,
  accepted_at timestamp,
  PRIMARY KEY ((user_id), relationship_status, updated_at, other_user_id)
) WITH CLUSTERING ORDER BY (relationship_status ASC, updated_at DESC, other_user_id ASC);

CREATE TABLE IF NOT EXISTS friend_requests_by_recipient (
  recipient_id uuid,
  requested_at timeuuid,
  requester_id uuid,
  message text,
  PRIMARY KEY ((recipient_id), requested_at, requester_id)
) WITH CLUSTERING ORDER BY (requested_at DESC, requester_id ASC);

/* Source row for request/accept/reject by the two known users; avoids scanning recipient inbox. */
CREATE TABLE IF NOT EXISTS friend_request_by_pair (
  requester_id uuid,
  recipient_id uuid,
  requested_at timeuuid,
  message text,
  status text,                       /* PENDING, ACCEPTED, DECLINED, CANCELLED */
  resolved_at timestamp,
  PRIMARY KEY ((requester_id), recipient_id)
);

/* Source row for unfriend/block checks; friendships_by_user remains the paginated user projection. */
CREATE TABLE IF NOT EXISTS friendship_by_pair (
  user_low_id uuid,
  user_high_id uuid,
  status text,                       /* ACCEPTED, REMOVED */
  requested_by uuid,
  requested_at timestamp,
  accepted_at timestamp,
  updated_at timestamp,
  PRIMARY KEY ((user_low_id), user_high_id)
);

CREATE TABLE IF NOT EXISTS friendship_projection_key_by_pair_user (
  user_id uuid,
  other_user_id uuid,
  relationship_status text,
  updated_at timeuuid,
  PRIMARY KEY ((user_id, other_user_id))
);

/* ======================= Conversation and membership ===================== */

CREATE TABLE IF NOT EXISTS conversations_by_id (
  conversation_id uuid PRIMARY KEY,
  conversation_type text,           /* DM, GROUP, CHANNEL */
  visibility text,                  /* DM, PRIVATE_LINK, COMMUNITY */
  join_policy text,                 /* INVITE_ONLY, OPEN, REQUEST_APPROVAL */
  name text,
  name_normalized text,
  description text,
  avatar_url text,
  avatar_asset_id uuid,
  created_by uuid,
  created_at timestamp,
  updated_at timestamp,
  is_deleted boolean,
  deleted_at timestamp,
  chat_mode text,                   /* OPEN, ADMINS_ONLY, LOCKED */
  slow_mode_seconds int,
  message_retention_days int,       /* null = system default; service writes per-message TTL */
  default_notification_level text,  /* ALL, MENTIONS, NONE */
  category_id text,
  community_tags set<text>,
  language_code text,
  last_message frozen<message_summary>,
  last_activity_at timestamp
);

/* Prevent duplicate direct-message conversations with a canonical sorted pair key. */
CREATE TABLE IF NOT EXISTS dm_conversation_by_pair (
  participant_pair_key text PRIMARY KEY, /* smaller UUID + ':' + larger UUID */
  conversation_id uuid,
  created_at timestamp
);

/* Authoritative room membership; a member can carry multiple room-local roles. */
CREATE TABLE IF NOT EXISTS conversation_members_by_conversation (
  conversation_id uuid,
  member_count int static,
  max_members int static,
  owner_id uuid static,
  owner_updated_at timestamp static,
  role_revision bigint static,
  user_id uuid,
  role_ids set<uuid>,               /* bounded by service; permission is the union */
  joined_at timestamp,
  invited_by uuid,
  muted_until timestamp,
  message_interval_seconds int,      /* per-member override; null inherits room slow_mode_seconds */
  notification_override text,       /* INHERIT, ALL, MENTIONS, NONE */
  last_read_message_id timeuuid,
  last_read_at timestamp,
  PRIMARY KEY ((conversation_id), user_id)
);

/* Projection for "my rooms". Pinned rooms are sorted before normal rooms. */
CREATE TABLE IF NOT EXISTS conversations_by_user (
  user_id uuid,
  is_pinned boolean,
  last_activity_at timestamp,
  conversation_id uuid,
  conversation_type text,
  visibility text,
  role_ids set<uuid>,
  joined_at timestamp,
  last_message frozen<message_summary>,
  unread_count int,                 /* eventual badge cache; last_read_message_id is authoritative */
  notification_override text,
  PRIMARY KEY ((user_id), is_pinned, last_activity_at, conversation_id)
) WITH CLUSTERING ORDER BY (is_pinned DESC, last_activity_at DESC, conversation_id ASC);

/* Bounded global-operator directory. One monthly partition prevents an
 * unbounded Cassandra scan while allowing admins to page through every room.
 * Rows are written on room creation and refreshed by the admin projector. */
CREATE TABLE IF NOT EXISTS admin_conversations_by_month (
  month text,                         /* YYYY-MM in UTC */
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

/* Bounded global-operator audit timeline. Partitioning by UTC month keeps
 * investigations predictable; the full before/after snapshot is retained so
 * operators do not need to query an unbounded event stream. */
CREATE TABLE IF NOT EXISTS audit_events_by_month (
  event_month text,                   /* YYYY-MM in UTC */
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

/*
 * Exactly three assignable rows. Claim a free slot with INSERT ... IF NOT EXISTS;
 * this makes the max-three invariant safe under concurrent pin commands.
 */
CREATE TABLE IF NOT EXISTS pinned_conversation_slots_by_user (
  user_id uuid,
  pin_slot tinyint,                 /* 0, 1, 2 */
  conversation_id uuid,
  pinned_at timeuuid,
  PRIMARY KEY ((user_id), pin_slot)
);

/* COMMUNITY-only lookup keys. Canonical room metadata is hydrated by id. */
CREATE TABLE IF NOT EXISTS community_directory_by_filter (
  discovery_filter text,            /* language + all/category/tag */
  discovery_shard tinyint,           /* stable 00..15 shard from conversation id */
  name_normalized text,
  conversation_id uuid,
  last_activity_at timestamp,
  PRIMARY KEY ((discovery_filter, discovery_shard), name_normalized, conversation_id)
) WITH CLUSTERING ORDER BY (name_normalized ASC, conversation_id ASC);

/* Authoritative single active public-community request per user and room. */
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

/* Ordered operator/history projection; authority stays in the per-user row. */
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

/*
 * Per-conversation custom role catalogue. Built-in OWNER remains a protected
 * system role; custom roles can define a colour, order and permission set.
 */
CREATE TABLE IF NOT EXISTS conversation_roles_by_conversation (
  conversation_id uuid,
  custom_role_count int static,
  role_code text,                   /* unique inside one conversation */
  role_id uuid,
  role_position int,                /* higher number = higher privilege */
  display_name text,
  color_hex text,
  permission_codes set<text>,       /* bounded allow-list */
  is_default boolean,
  is_system boolean,                /* protected from delete/rename */
  lifecycle_state text,             /* ACTIVE or DELETING */
  created_by uuid,
  created_at timestamp,
  updated_at timestamp,
  PRIMARY KEY ((conversation_id), role_code)
) WITH CLUSTERING ORDER BY (role_code ASC);

CREATE TABLE IF NOT EXISTS conversation_bans_by_conversation (
  conversation_id uuid,
  user_id uuid,
  banned_by uuid,
  reason_code text,
  reason_text text,
  created_at timestamp,
  expires_at timestamp,
  PRIMARY KEY ((conversation_id), user_id)
);

CREATE TABLE IF NOT EXISTS conversation_bans_by_user (
  user_id uuid,
  conversation_id uuid,
  banned_by uuid,
  reason_code text,
  created_at timestamp,
  expires_at timestamp,
  PRIMARY KEY ((user_id), conversation_id)
);

CREATE TABLE IF NOT EXISTS conversation_preferences_by_user (
  user_id uuid,
  conversation_id uuid,
  theme_id text,
  bubble_style_id text,
  background_asset_id text,
  custom_background_url text,
  updated_at timestamp,
  PRIMARY KEY ((user_id), conversation_id)
);

/* ============================ Messages and media ========================= */

/* Bucket format is YYYY-MM-DD-HH:NN where NN is a stable 00..15 write shard. */
CREATE TABLE IF NOT EXISTS messages_by_conversation_bucket (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  sender_id uuid,
  message_type text,                /* TEXT, IMAGE, FILE, AUDIO, VIDEO, STICKER, POLL, SYSTEM */
  content text,
  content_format text,               /* PLAIN, MARKDOWN */
  reply_to_message_id timeuuid,
  reply_to_sender_id uuid,
  sticker_id uuid,
  poll_id uuid,
  system_event_id timeuuid,
  forwarded_from_conversation_id uuid,
  forwarded_from_message_bucket text,
  forwarded_from_message_id timeuuid,
  is_deleted boolean,
  deleted_by uuid,
  deleted_at timestamp,
  edited_at timestamp,
  revision_no int,                  /* Monotonic CAS version for lossless edit/delete history. */
  has_attachments boolean,
  has_mentions boolean,
  is_pinned boolean,
  created_at timestamp,
  client_message_id uuid,
  PRIMARY KEY ((conversation_id, message_bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

/* Bounded directory of active message shards used for cursor history traversal. */
CREATE TABLE IF NOT EXISTS message_buckets_by_conversation (
  conversation_id uuid,
  bucket_hour timestamp,
  message_bucket text,
  last_message_id timeuuid,
  last_message_at timestamp,
  PRIMARY KEY ((conversation_id), bucket_hour, message_bucket)
) WITH CLUSTERING ORDER BY (bucket_hour DESC, message_bucket ASC);

/* Idempotency projection: write with IF NOT EXISTS for retry-safe sends. */
CREATE TABLE IF NOT EXISTS message_id_by_client_id (
  sender_id uuid,
  client_message_id uuid,
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  request_fingerprint text,          /* SHA-256 of immutable send payload; rejects key reuse with different content */
  created_at timestamp,
  PRIMARY KEY ((sender_id), client_message_id)
);

CREATE TABLE IF NOT EXISTS message_attachments_by_message (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  attachment_id uuid,
  attachment frozen<attachment_ref>,
  PRIMARY KEY ((conversation_id, message_bucket, message_id), attachment_id)
);

CREATE TABLE IF NOT EXISTS message_reactions_by_message (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  emoji text,
  user_id uuid,
  reacted_at timeuuid,
  PRIMARY KEY ((conversation_id, message_bucket, message_id), emoji, user_id)
);

/* Page-hydration projections avoid one interaction query per message. */
CREATE TABLE IF NOT EXISTS message_reactions_by_conversation_bucket (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  emoji text,
  user_id uuid,
  reacted_at timeuuid,
  PRIMARY KEY ((conversation_id, message_bucket), message_id, emoji, user_id)
);

CREATE TABLE IF NOT EXISTS message_mentions_by_message (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  mentioned_user_id uuid,
  PRIMARY KEY ((conversation_id, message_bucket, message_id), mentioned_user_id)
);

CREATE TABLE IF NOT EXISTS mentioned_messages_by_user (
  mentioned_user_id uuid,
  created_at timeuuid,
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  sender_id uuid,
  PRIMARY KEY ((mentioned_user_id), created_at, conversation_id, message_id)
) WITH CLUSTERING ORDER BY (created_at DESC, conversation_id ASC, message_id ASC);

CREATE TABLE IF NOT EXISTS replies_by_parent_message (
  conversation_id uuid,
  parent_message_bucket text,
  parent_message_id timeuuid,
  created_at timeuuid,
  message_bucket text,
  message_id timeuuid,
  sender_id uuid,
  PRIMARY KEY ((conversation_id, parent_message_bucket, parent_message_id), created_at, message_id)
) WITH CLUSTERING ORDER BY (created_at ASC, message_id ASC);

CREATE TABLE IF NOT EXISTS message_revisions_by_message (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  revision_no int,
  content text,
  action text,                      /* EDIT, DELETE, RESTORE */
  edited_by uuid,
  edited_at timestamp,
  PRIMARY KEY ((conversation_id, message_bucket, message_id), revision_no)
) WITH CLUSTERING ORDER BY (revision_no DESC);

CREATE TABLE IF NOT EXISTS message_forwards_by_source_message (
  source_conversation_id uuid,
  source_message_bucket text,
  source_message_id timeuuid,
  forwarded_at timeuuid,
  target_conversation_id uuid,
  target_message_bucket text,
  target_message_id timeuuid,
  forwarded_by uuid,
  PRIMARY KEY ((source_conversation_id, source_message_bucket, source_message_id), forwarded_at, target_message_id)
) WITH CLUSTERING ORDER BY (forwarded_at DESC, target_message_id ASC);

/* Five LWT-claimable slots enforce the room's maximum pinned messages. */
CREATE TABLE IF NOT EXISTS pinned_message_slots_by_conversation (
  conversation_id uuid,
  pin_slot tinyint,                 /* 0, 1, 2, 3, 4 */
  message_bucket text,
  message_id timeuuid,
  pinned_by uuid,
  pinned_at timeuuid,
  PRIMARY KEY ((conversation_id), pin_slot)
);

CREATE TABLE IF NOT EXISTS message_read_receipts_by_message (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  reader_id uuid,
  read_at timestamp,
  PRIMARY KEY ((conversation_id, message_bucket, message_id), reader_id)
);

CREATE TABLE IF NOT EXISTS message_read_summary_by_conversation_bucket (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  latest_read_at timestamp,
  PRIMARY KEY ((conversation_id, message_bucket), message_id)
);

/* ================================ Polls ================================= */

CREATE TABLE IF NOT EXISTS polls_by_id (
  poll_id uuid PRIMARY KEY,
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  question text,
  options list<text>,
  is_multiple_choice boolean,
  is_anonymous boolean,
  is_closed boolean,
  created_by uuid,
  created_at timestamp,
  closes_at timestamp,
  closed_by uuid,
  closed_at timestamp
);

CREATE TABLE IF NOT EXISTS polls_by_conversation (
  conversation_id uuid,
  created_at timeuuid,
  poll_id uuid,
  message_bucket text,
  message_id timeuuid,
  is_closed boolean,
  PRIMARY KEY ((conversation_id), created_at, poll_id)
) WITH CLUSTERING ORDER BY (created_at DESC, poll_id ASC);

CREATE TABLE IF NOT EXISTS poll_state_by_poll (
  poll_id uuid,
  voter_id uuid,
  selected_option_indexes set<int>,
  voted_at timestamp,
  option_counts map<int, bigint> static,
  total_voters bigint static,
  aggregate_version bigint static,
  is_closed boolean static,
  PRIMARY KEY ((poll_id), voter_id)
);

/* =========================== Assets, themes, stickers ==================== */

CREATE TABLE IF NOT EXISTS media_assets_by_id (
  asset_id uuid PRIMARY KEY,
  owner_id uuid,
  storage_provider text,
  storage_key text,
  public_url text,
  file_name text,
  mime_type text,
  byte_size bigint,
  width int,
  height int,
  duration_ms bigint,
  checksum_sha256 text,
  upload_status text,                /* PENDING, READY, QUARANTINED, DELETED */
  malware_scan_status text,          /* PENDING, CLEAN, INFECTED, FAILED */
  moderation_status text,            /* PENDING, APPROVED, REJECTED */
  created_at timestamp,
  deleted_at timestamp
);

CREATE TABLE IF NOT EXISTS media_thumbnails_by_asset (
  asset_id uuid,
  variant text,                      /* SMALL, MEDIUM, LARGE */
  thumbnail_url text,
  width int,
  height int,
  created_at timestamp,
  PRIMARY KEY ((asset_id), variant)
);

/* IDs here reference source-controlled frontend theme/sticker assets. */
CREATE TABLE IF NOT EXISTS chat_themes_by_id (
  theme_id text PRIMARY KEY,
  display_name text,
  preview_asset_id uuid,
  is_active boolean,
  created_at timestamp,
  updated_at timestamp
);

CREATE TABLE IF NOT EXISTS sticker_packs_by_id (
  sticker_pack_id uuid PRIMARY KEY,
  name text,
  description text,
  cover_asset_id uuid,
  created_by uuid,
  is_official boolean,
  is_active boolean,
  created_at timestamp,
  updated_at timestamp
);

CREATE TABLE IF NOT EXISTS stickers_by_pack (
  sticker_pack_id uuid,
  sticker_id uuid,
  name text,
  asset_id uuid,
  sort_order int,
  is_active boolean,
  PRIMARY KEY ((sticker_pack_id), sort_order, sticker_id)
) WITH CLUSTERING ORDER BY (sort_order ASC, sticker_id ASC);

CREATE TABLE IF NOT EXISTS stickers_by_id (
  sticker_id uuid PRIMARY KEY,
  sticker_pack_id uuid,
  name text,
  asset_id uuid,
  is_active boolean
);

/* ======================= Notifications and invitations =================== */

CREATE TABLE IF NOT EXISTS notifications_by_user (
  user_id uuid,
  notification_month text,           /* YYYY-MM */
  notification_id timeuuid,
  notification_type text,           /* MESSAGE, MENTION, REPLY, INVITE, MODERATION, SYSTEM */
  priority text,                    /* LOW, NORMAL, HIGH, URGENT */
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  actor_id uuid,
  title text,
  body_preview text,
  deep_link text,
  action_payload map<text, text>,
  is_read boolean,
  read_at timestamp,
  created_at timestamp,
  PRIMARY KEY ((user_id, notification_month), notification_id)
) WITH CLUSTERING ORDER BY (notification_id DESC);

/* Lookup used by a push worker after a device-level delivery attempt. */
CREATE TABLE IF NOT EXISTS notification_deliveries_by_notification (
  user_id uuid,
  notification_month text,
  notification_id timeuuid,
  device_id uuid,
  channel text,                     /* WEBSOCKET, FCM, APNS, WEB_PUSH, EMAIL */
  delivery_status text,             /* PENDING, SENT, DELIVERED, FAILED, OPENED */
  provider_message_id text,
  attempted_at timestamp,
  delivered_at timestamp,
  opened_at timestamp,
  failure_code text,
  PRIMARY KEY ((user_id, notification_month, notification_id), device_id)
);

/* Link token is the lookup key; token must be random, unguessable and hashed if policy requires. */
CREATE TABLE IF NOT EXISTS invitation_links_by_token (
  link_token text PRIMARY KEY,
  link_id uuid,
  conversation_id uuid,
  created_by uuid,
  created_at timestamp,
  invite_kind text,                  /* LINK, QR */
  join_policy text,                  /* DIRECT_JOIN, REQUEST_APPROVAL */
  display_name text,
  expires_at timestamp,
  is_active boolean,
  max_uses int,
  used_count int,
  revoked_by uuid,
  revoked_at timestamp
);

CREATE TABLE IF NOT EXISTS invitation_links_by_conversation (
  conversation_id uuid,
  created_at timeuuid,
  link_id uuid,
  link_token text,
  created_by uuid,
  invite_kind text,
  join_policy text,
  display_name text,
  expires_at timestamp,
  is_active boolean,
  max_uses int,
  used_count int,
  PRIMARY KEY ((conversation_id), created_at, link_id)
) WITH CLUSTERING ORDER BY (created_at DESC, link_id ASC);

CREATE TABLE IF NOT EXISTS invitation_joins_by_link (
  link_id uuid,
  joined_at timeuuid,
  user_id uuid,
  outcome text,                     /* ACCEPTED, DECLINED, ALREADY_MEMBER, EXPIRED, REVOKED, LIMIT_REACHED */
  ip_hash text,
  PRIMARY KEY ((link_id), joined_at, user_id)
) WITH CLUSTERING ORDER BY (joined_at DESC, user_id ASC);

/* LWT on this row makes repeated click/retry of the same link idempotent. */
CREATE TABLE IF NOT EXISTS invite_join_by_link_user (
  link_id uuid,
  user_id uuid,
  request_id uuid,
  status text,                       /* PENDING, ACCEPTED, DECLINED, REJECTED, FAILED */
  first_requested_at timestamp,
  updated_at timestamp,
  PRIMARY KEY ((link_id), user_id)
);

CREATE TABLE IF NOT EXISTS join_requests_by_conversation (
  conversation_id uuid,
  requested_at timeuuid,
  request_id uuid,
  user_id uuid,
  link_id uuid,
  link_token text,                   /* Manager-only lookup needed to resolve the request. */
  status text,                       /* PENDING, APPROVING, APPROVED, DECLINED, CANCELLED, FAILED */
  resolution_decision text,          /* APPROVE or DECLINE while a manager owns the resolution */
  resolved_by uuid,
  resolved_at timestamp,
  PRIMARY KEY ((conversation_id), requested_at, request_id)
) WITH CLUSTERING ORDER BY (requested_at DESC, request_id ASC);

CREATE TABLE IF NOT EXISTS join_requests_by_user (
  user_id uuid,
  requested_at timeuuid,
  request_id uuid,
  conversation_id uuid,
  link_id uuid,
  status text,
  resolved_at timestamp,
  PRIMARY KEY ((user_id), requested_at, request_id)
) WITH CLUSTERING ORDER BY (requested_at DESC, request_id ASC);

/* ========================== Moderation and audit ========================= */

CREATE TABLE IF NOT EXISTS user_sanctions_by_user (
  user_id uuid,
  imposed_at timeuuid,
  sanction_id uuid,
  scope text,                       /* APP, CONVERSATION */
  conversation_id uuid,
  sanction_type text,               /* BAN, MUTE, SUSPEND, WARNING */
  starts_at timestamp,
  expires_at timestamp,
  imposed_by uuid,
  reason_code text,
  reason_text text,
  status text,                      /* ACTIVE, REVOKED, EXPIRED */
  revoked_by uuid,
  revoked_at timestamp,
  PRIMARY KEY ((user_id), imposed_at, sanction_id)
) WITH CLUSTERING ORDER BY (imposed_at DESC, sanction_id ASC);

/* Bounded scheduler projection for timed sanction expiry. */
CREATE TABLE IF NOT EXISTS user_sanctions_by_expiry_day (
  expiry_day date,
  expires_at timestamp,
  sanction_id uuid,
  user_id uuid,
  imposed_at timeuuid,
  scope text,
  conversation_id uuid,
  sanction_type text,
  starts_at timestamp,
  imposed_by uuid,
  reason_code text,
  reason_text text,
  status text,
  PRIMARY KEY ((expiry_day), expires_at, sanction_id)
) WITH CLUSTERING ORDER BY (expires_at ASC, sanction_id ASC);

CREATE TABLE IF NOT EXISTS reports_by_status_day (
  report_status text,               /* OPEN, IN_REVIEW, RESOLVED, DISMISSED */
  report_day date,
  created_at timeuuid,
  report_id uuid,
  reporter_id uuid,
  target_type text,                  /* USER, MESSAGE, CONVERSATION */
  target_user_id uuid,
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  reason_code text,
  description text,
  assigned_to uuid,
  resolved_at timestamp,
  resolution_code text,
  PRIMARY KEY ((report_status, report_day), created_at, report_id)
) WITH CLUSTERING ORDER BY (created_at DESC, report_id ASC);

CREATE TABLE IF NOT EXISTS reports_by_reporter (
  reporter_id uuid,
  created_at timeuuid,
  report_id uuid,
  report_status text,
  target_type text,
  target_user_id uuid,
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  reason_code text,
  description text,
  PRIMARY KEY ((reporter_id), created_at, report_id)
) WITH CLUSTERING ORDER BY (created_at DESC, report_id ASC);

CREATE TABLE IF NOT EXISTS moderation_results_by_message (
  conversation_id uuid,
  message_bucket text,
  message_id timeuuid,
  detector_version text,
  language_code text,
  toxicity_score decimal,
  severity text,                    /* NONE, LOW, MEDIUM, HIGH, CRITICAL */
  matched_categories set<text>,
  action_taken text,                /* ALLOW, WARN, HIDE, QUEUE_REVIEW, BLOCK */
  analyzed_at timestamp,
  PRIMARY KEY ((conversation_id, message_bucket, message_id), detector_version)
);

/* Immutable room event: also publish this as a SYSTEM message when user-visible. */
CREATE TABLE IF NOT EXISTS room_events_by_conversation (
  conversation_id uuid,
  event_month text,                  /* YYYY-MM */
  event_id timeuuid,
  event_type text,                  /* MEMBER_KICKED, ROLE_GRANTED, POLL_CREATED, ... */
  actor_id uuid,
  target_user_id uuid,
  message_bucket text,
  message_id timeuuid,
  reason_code text,
  metadata map<text, text>,
  created_at timestamp,
  PRIMARY KEY ((conversation_id, event_month), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);

CREATE TABLE IF NOT EXISTS audit_events_by_actor (
  actor_id uuid,
  event_month text,                  /* YYYY-MM */
  event_id timeuuid,
  action text,
  resource_type text,
  resource_id text,
  conversation_id uuid,
  target_user_id uuid,
  outcome text,                     /* SUCCESS, DENIED, FAILURE */
  reason_code text,
  before_state map<text, text>,
  after_state map<text, text>,
  request_id uuid,
  ip_hash text,
  user_agent_hash text,
  created_at timestamp,
  PRIMARY KEY ((actor_id, event_month), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);

CREATE TABLE IF NOT EXISTS audit_events_by_resource (
  resource_type text,
  resource_id text,
  event_month text,                  /* YYYY-MM */
  event_id timeuuid,
  actor_id uuid,
  action text,
  outcome text,
  created_at timestamp,
  PRIMARY KEY ((resource_type, resource_id, event_month), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);

/* ===================== WebRTC metadata and reliability =================== */

CREATE TABLE IF NOT EXISTS calls_by_conversation (
  conversation_id uuid,
  started_at timeuuid,
  call_id uuid,
  started_by uuid,
  ended_at timestamp,
  call_type text,                   /* VOICE, VIDEO */
  status text,                      /* ACTIVE, ENDED, FAILED */
  signaling_provider text,           /* LIVEKIT, MEDIASOUP, JANUS */
  provider_room_id text,
  media_region text,
  max_participants int,
  PRIMARY KEY ((conversation_id), started_at, call_id)
) WITH CLUSTERING ORDER BY (started_at DESC, call_id ASC);

CREATE TABLE IF NOT EXISTS call_participants_by_call (
  call_id uuid,
  user_id uuid,
  joined_at timestamp,
  left_at timestamp,
  disconnect_reason text,
  PRIMARY KEY ((call_id), user_id)
);

/* ========================= Outbox and analytics ========================== */

/*
 * Write this record with the source mutation, then a worker publishes it to
 * Kafka/Elasticsearch/FCM. Marking published is idempotent in the worker.
 */
CREATE TABLE IF NOT EXISTS outbox_events_by_partition (
  outbox_partition text,            /* e.g. YYYY-MM-DD-HH shard */
  event_id timeuuid,
  aggregate_type text,
  aggregate_id text,
  event_type text,
  payload_json text,
  created_at timestamp,
  published_at timestamp,
  publish_attempts int,
  PRIMARY KEY ((outbox_partition), event_id)
) WITH CLUSTERING ORDER BY (event_id ASC);

/*
 * Pending-only outbox index. Cassandra cannot filter on published_at without
 * scanning the partition, so the publisher reads this bounded projection and
 * removes a row only after Kafka acknowledges the event.
 */
CREATE TABLE IF NOT EXISTS outbox_pending_events_by_partition (
  outbox_partition text,
  event_id timeuuid,
  aggregate_type text,
  aggregate_id text,
  event_type text,
  payload_json text,
  created_at timestamp,
  publish_attempts int,
  PRIMARY KEY ((outbox_partition), event_id)
) WITH CLUSTERING ORDER BY (event_id ASC);

CREATE TABLE IF NOT EXISTS analytics_events_by_day_type (
  event_day date,
  event_type text,                  /* ROOM_CREATED, ROOM_JOINED, MESSAGE_SENT, POLLS_CREATED, POLL_VOTED, CALL_STARTED */
  event_shard tinyint,              /* stable 0..15 hash shard */
  occurred_at timeuuid,
  event_id uuid,
  actor_id uuid,
  conversation_id uuid,
  dimensions map<text, text>,
  PRIMARY KEY ((event_day, event_type, event_shard), occurred_at, event_id)
) WITH CLUSTERING ORDER BY (occurred_at DESC, event_id ASC);

CREATE TABLE IF NOT EXISTS system_settings_by_key (
  setting_key text PRIMARY KEY,
  setting_value text,
  updated_by uuid,
  updated_at timestamp
);

/* ============================== Operations =============================== */

/*
 * Required application invariants:
 *
 * 1. Create/update/delete both the authoritative and projection rows in one
 *    application workflow plus an outbox event. Repair projections by replay.
 * 2. To pin a room: claim one of the three rows in
 *    pinned_conversation_slots_by_user with INSERT ... IF NOT EXISTS, then
 *    update conversations_by_user. Delete that exact slot to unpin.
 * 3. To pin a message: claim one of the five rows in
 *    pinned_message_slots_by_conversation with INSERT ... IF NOT EXISTS and
 *    update the message's is_pinned projection. Delete the exact slot to unpin.
 * 4. To consume an invite: validate active/expiry/maxUses in the service, then
 *    execute `UPDATE invitation_links_by_token SET used_count = ? WHERE
 *    link_token = ? IF used_count = ? AND is_active = true`; mirror the result
 *    to invitation_links_by_conversation and append invitation_joins_by_link.
 * 5. Never paginate with OFFSET. Use the last clustering key/timeuuid as cursor.
 * 6. Elasticsearch is the only full-text search store. Index only records that
 *    the requesting user is authorized to read; Cassandra remains authoritative.
 * 7. Enforce app/room permission, ban/mute, chat_mode and slow_mode BEFORE
 *    writing a message or realtime event. Every decision writes an audit event.
 */
