/*
 * Canonical invite state machine.
 *
 * New writes use this table exclusively. Deploy this schema before the
 * application version that contains CassandraInviteRepository.
 */
CREATE TABLE IF NOT EXISTS invite_state_by_token (
  link_token text,
  recipient_id uuid,
  link_id uuid static,
  conversation_id uuid static,
  created_by uuid static,
  created_at timestamp static,
  invite_kind text static,
  join_policy text static,
  display_name text static,
  expires_at timestamp static,
  is_active boolean static,
  max_uses int static,
  used_count int static,
  revoked_by uuid static,
  revoked_at timestamp static,
  request_id uuid,
  requested_at timeuuid,
  status text,
  first_requested_at timestamp,
  updated_at timestamp,
  PRIMARY KEY ((link_token), recipient_id)
);

ALTER TABLE join_requests_by_conversation
  ADD resolution_lease_until timestamp;

ALTER TABLE community_join_request_by_user
  ADD resolution_lease_until timestamp;
