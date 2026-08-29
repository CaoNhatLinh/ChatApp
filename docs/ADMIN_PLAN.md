# Global admin console plan

## Scope

The admin console is a whole-application operator surface, not a
conversation-local role screen. It is integrated into the existing projects:

- `chatapp_frontend`: protected `/admin` route and operator UI.
- `chat-service`: server-authoritative `/api/admin/**` API, app permissions,
  audit/outbox records and Cassandra projections.

Conversation roles (`conversation_roles_by_conversation`) only affect a room.
They can never grant access to this console or to another room.

## Navigation and function inventory

| Area | Required functions | Status |
|---|---|---|
| Overview | capability snapshot, effective permissions, dependency health, operator session | Implemented; live stack proof pending |
| Users | bounded search, profile/status, suspend/ban/restore, app-role grant/revoke, session/device revoke | Search, status, app-role and bounded session/device revoke implemented; live persistence proof pending |
| Rooms | browse all indexed rooms by month, room detail/members, global chat policy, archive/restore, ownership/moderation actions | Monthly directory, detail, policy and archive/restore implemented; historical backfill and deeper moderation pending |
| Reports & moderation | report queue, assign/review/resolve, room ban/mute, language moderation, appeals | Report submission, bounded queue, resolution, APP/CONVERSATION sanctions and timed-expiry worker implemented; language moderation and appeals pending |
| Messages & audit | authorized message lookup, deletion/tombstone review, immutable audit timeline, bounded export | Monthly audit timeline, reasoned message inspection/revision review and bounded UTF-8 CSV export implemented |
| Notifications | inbox health, policy inspection, delivery attempts, device/token lifecycle | Inbox/settings API exists; provider delivery and operator views pending |
| Media | asset lookup, quarantine/delete, webhook/lifecycle failures, reference-safe cleanup | Upload metadata path exists; operator lifecycle UI pending Cloudinary integration |
| Search & index | index health, lag, rebuild/reindex, zero-downtime alias switch | Search projector exists; operator controls pending |
| Analytics | DAU/WAU/MAU, retention, message/room activity, delivery/search/moderation/call SLOs | Bounded daily event aggregate panel implemented; metric dictionary, long-range aggregates and SLO dashboards pending |
| Operations | health/readiness, Kafka lag/DLQ, Redis/ES/Cassandra status, backup/restore/replay/runbooks | Health endpoint exists; operational drills pending |

## Permission model

Every route checks a server-side `AppPermission`. The UI only uses the
`GET /api/admin/overview` response to decide which controls to render. A JWT
decoded in the browser is never an authorization decision. Dangerous mutations
require a reason, are retry-safe, record before/after state and emit an outbox
event. `SUPER_ADMIN` self-lockout protections remain enforced in the service.
The built-in `APP_ADMIN` role receives the global room/report/audit/analytics
permissions; it also receives `SESSION_REVOKE` for bounded user session/device invalidation;
existing keyspaces must apply the additive permission migration.

## Room coverage rule

The room directory is partitioned by UTC `YYYY-MM` in
`admin_conversations_by_month`; requests never scan `conversations_by_id`. New
canonical room creation writes the projection. A clean deployment must run a
bounded backfill for rooms created before the projection existed before claiming
historical completeness.

## End-to-end acceptance

1. An operator without an app permission receives `403` and sees the forbidden
   state; a room-local admin role alone is insufficient.
2. A permitted operator can browse a month, open a room, change policy, archive
   and restore it, then observe the updated state after reload.
3. User status and app-role changes require reason, update authoritative
   Cassandra state, invalidate sessions where applicable, and appear in audit.
4. Reports, sanctions, analytics and exports are only marked complete after
   backend integration, browser multi-account and recovery evidence exists.
