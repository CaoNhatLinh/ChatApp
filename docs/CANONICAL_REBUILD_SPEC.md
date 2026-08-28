# Canonical rebuild specification

## Objective

Replace every legacy Cassandra schema and its incompatible persistence contract
with `chat_app_complete.cql`. The backend and React frontend must use one
canonical set of names, types and authorization rules. No production-data
migration is required.

## Assumptions

1. Cassandra 4.1 is the authoritative transactional store.
2. Elasticsearch is used only for authorized full-text search projections.
3. Redis is ephemeral state only: typing, presence, rate-limit and caches.
4. Kafka is used through an outbox worker; it is not the source of truth.
5. Dashboard/BI events are published through the outbox; Cassandra retains a
   sharded operational event projection and an OLAP warehouse may consume it.
6. The existing user-facing REST base remains `/api`; contract fields are
   camelCase and enum values are UPPER_SNAKE.
7. Mobile clients are future consumers; device and notification contracts are
   included even though this repository currently contains only a web client.

## Canonical data contract

`chat_app_complete.cql` is the only executable database schema. The following
conceptual aggregates own persistence:

| Aggregate | Canonical tables | Invariants |
| --- | --- | --- |
| Identity | `users_by_*`, `user_id_by_external_identity`, `app_roles_by_user`, `user_devices_by_user` | App roles are separate from room roles; local and external identities have direct lookups. |
| Social | friendship/block/presence projections | Friendship, personal blocks and transient online state are separate from moderation bans. |
| Room | `conversations_by_id`, `conversation_members_*`, `conversations_by_user`, `pinned_conversation_slots_by_user` | A user sees only their rooms; three LWT-claimed slots enforce max 3 personal pinned rooms. |
| Message | `messages_by_conversation_bucket`, reactions, mentions, revisions, attachments, `pinned_message_slots_by_conversation` | Sender/client id makes send retry idempotent; time-and-shard buckets prevent hot/unbounded partitions; five LWT-claimed slots enforce max 5 pinned messages per room. |
| Assets | media, thumbnails, themes and stickers | User UI preferences store source-controlled theme/sticker IDs; attachment rows retain an immutable storage/preview snapshot. |
| Moderation | sanctions, bans, reports, moderation results | Ban/mute/slow-mode/chat-mode are checked before a write. |
| Invite | `invitation_links_*`, `invitation_joins_by_link`, `invite_join_by_link_user`, `join_requests_*` | Invite use count and user/link idempotency are LWT commands; approval flow and every attempt are recorded. |
| Audit | `room_events_*`, `audit_events_*` | Every mutation records actor, outcome, reason and correlation ID. |
| Notification | preferences, devices, notifications, delivery records | User override wins over room default; owner can only reduce the room default. |

## API contract rules

- Authentication principal exposes `userId`, app roles and permissions.
- DM has no room-role management endpoints. Other conversations have protected
  system roles plus custom roles with a colour, ordering and bounded explicit
  permission set; a member's permission is the union of its role IDs.
- Every mutating endpoint returns one consistent response envelope and emits
  an outbox/audit event.
- List queries use cursor pagination, never offset pagination. High-volume streams are partitioned by documented time and stable-hash buckets.
- Search filters support text, sender, reply sender, mentioned user,
  attachment presence, message type and inclusive date range.
- Every WebSocket event includes `eventId`, `occurredAt`, `conversationId`,
  `actorId` and a typed payload.

## Feature acceptance criteria

1. A new message atomically produces an idempotent message record, updates
   last-message/activity projections, reorders the receiver's room list and
   emits realtime/notification events according to preferences.
2. Pinning a fourth room and a sixth message returns `409 LIMIT_EXCEEDED`; a room pin claims one of exactly three LWT-protected slots.
3. App roles and room permissions are independently enforced for all admin,
   moderation, ownership transfer, kick and role actions.
4. Ban, timed mute, slow mode and `ADMINS_ONLY`/`LOCKED` room modes reject
   message writes but do not prevent permitted actions such as leave or vote.
5. Every edit, delete, role change, moderation action, poll mutation and
   invite action adds a room event plus an audit event; user-visible actions
   additionally create a `SYSTEM` message.
6. An invite link/QR displays valid, expired, revoked and limit-reached states,
   records accepted/declined attempts and can be revoked permanently.
7. Browser and mobile notification policy honors global preference, room
   override, room default, quiet hours and device delivery state.
8. Voice/video signaling is authorization-aware and call metadata is recorded;
   media itself is never stored in Cassandra.
9. Read state has a per-member watermark (`lastReadMessageId`) and an optional
   per-message receipt projection for seen-by UI/audit requirements.

## Commands

```powershell
# Backend
$env:JAVA_HOME='C:\Program Files\Java\jdk-20'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\mvnw.cmd test

# Frontend
cd chatapp_frontend
npm run type-check
npm run lint
npm run build

# Infrastructure after Docker is available
docker compose -f chat-service/docker-compose-full.yml up -d
docker exec -i chat-cassandra cqlsh -f /schema/chat_app_complete.cql
```

## Project boundaries

- Always: validate external input at REST/WebSocket boundaries, use prepared
  repository operations, add contract/integration tests and write audit events.
- Ask first: add a new external SaaS provider, change user-visible retention,
  add a new dependency, or expand supported native-mobile scope.
- Never: retain legacy schema/code paths, expose a user’s custom chat appearance
  to another user, store notification tokens in logs, or run unbounded
  Cassandra scans/`ALLOW FILTERING` queries.

## Implementation slices

1. Replace schema/bootstrap and establish typed canonical backend contracts.
2. Identity, app RBAC, room membership/listing and pin limits.
3. Message/realtime/reply/reaction/attachment/search projections.
4. Polls, moderation, room controls, audit and system messages.
5. Invitations/QR, notification preferences/device delivery and call metadata.
6. Frontend API/types/UI adaptation, integration tests and E2E verification.

## Completion criteria

- Legacy CQL/migration files and legacy entity/repository paths are removed.
- Docker starts Cassandra and loads only the canonical schema.
- Backend compiles and integration tests run against Cassandra/Redis/Kafka.
- Frontend type-check, lint and production build pass.
- Two-user E2E validates messaging, ordering, all limits, permissions,
  moderation, invitations and notification precedence.
