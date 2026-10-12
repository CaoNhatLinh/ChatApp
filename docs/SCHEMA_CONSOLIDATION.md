# Canonical schema consolidation — 2026-10-12

## Decision

This repository targets fresh Nối installations. `chat_app_complete.cql` is the
only initialization schema used by Compose and the Windows local launcher.
Historical upgrade scripts were checked against the current schema and runtime,
then removed. No database data, container or volume was deleted.

All retained additions below were already present in the canonical schema;
there was no missing current-runtime DDL to copy. Keeping them duplicated in
upgrade files would invite accidental ALTER/DROP execution on a fresh database.

## Disposition of the 17 removed scripts

| Former script | Current canonical representation |
| --- | --- |
| `V_add_admin_conversation_directory.cql` | `admin_conversations_by_month`, `audit_events_by_month` |
| `V_add_app_admin_global_permissions.cql` | All six APP_ADMIN permission seeds are in the initialization schema |
| `V_add_community_directory.cql` | Community directory and both join-request projections |
| `V_add_conversation_membership_state.cql` | Static `member_count`, `max_members` in membership authority |
| `V_add_conversation_owner_state.cql` | Static owner fields in membership; no owner copy in conversation metadata |
| `V_add_message_bucket_directory.cql` | `message_buckets_by_conversation` |
| `V_add_message_interaction_page_projections.cql` | Bucket-scoped reactions and read summary |
| `V_add_message_revisions.cql` | Legacy definition excluded. Current code uses `message_revisions_by_message`, with its current key/column contract |
| `V_add_outbox_pending_projection.cql` | Pending outbox projection |
| `V_add_refresh_token_replacement.cql` | `replaced_by_token_id` already defined |
| `V_add_reporter_projection_details.cql` | Reporter target/reason/description columns |
| `V_add_sanction_expiry_projection.cql` | Expiry-day sanction projection |
| `V_add_status_preference.cql` | Legacy `users` ALTER/DROP excluded; current runtime uses `users_by_id`, not this legacy table/contract |
| `V_add_user_directory_username.cql` | Prefix-directory `username` column |
| `V_firebase_google_identity.cql` | `external_identity_owner_by_key` |
| `V_invite_state_machine.cql` | `invite_state_by_token` and both resolution lease columns |
| `V_rebuild_conversation_role_authority.cql` | Current code-keyed role table and membership `role_revision`, defined without a destructive rebuild |

## Verification and limits

- The schema parser covers 78 tables / 676 columns and 2 UDTs / 20 fields.
- Runtime CqlSession query-table guard passes; current revisions and identity
  contracts are covered without importing legacy definitions.
- The standalone schema guard rejects upgrade DDL and legacy users/revisions
  table declarations, and ensures old executable migration files are absent.
- No upgrade fallback was added to the runtime or launcher.
- Cassandra 4.1 initialization and live prepare/read/write verification remain
  pending on this host because Docker is unavailable. Static/unit checks are
  not proof of live datastore correctness.

Removed scripts remain recoverable from Git history. Existing noncanonical
databases are not upgraded automatically; preserving/moving old data would
require a separate reviewed and tested migration plan.
