/*
 * Role definitions intentionally move to a code-keyed single-partition
 * authority. No legacy role rows are inferred or copied.
 */
ALTER TABLE conversation_members_by_conversation ADD role_revision bigint static;

DROP TABLE conversation_roles_by_conversation;

CREATE TABLE conversation_roles_by_conversation (
  conversation_id uuid,
  custom_role_count int static,
  role_code text,
  role_id uuid,
  role_position int,
  display_name text,
  color_hex text,
  permission_codes set<text>,
  is_default boolean,
  is_system boolean,
  lifecycle_state text,
  created_by uuid,
  created_at timestamp,
  updated_at timestamp,
  PRIMARY KEY ((conversation_id), role_code)
) WITH CLUSTERING ORDER BY (role_code ASC);
