# Canonical API reference

The only supported runtime contract is [`docs/api/openapi.yaml`](../docs/api/openapi.yaml)
for HTTP and [`docs/api/asyncapi.yaml`](../docs/api/asyncapi.yaml) for STOMP.
The backend base path is `/api`; every endpoint below is relative to that base.

## HTTP surface

- **Identity:** `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`,
  `/auth/logout`
- **Users:** `/users/search`, `/users/{userId}`, `/users/me`
- **Friendships and blocking:** `/friends`, `/friends/request`,
  `/friends/requests/received`, `/friends/requests/sent`, `/friends/accept`,
  `/friends/reject`, `/friends/status/{status}`, `/friends/requests/{recipientId}`,
  `/friends/{friendId}`, `/friends/block/{friendId}`,
  `/friends/unblock/{friendId}`, `/friends/check-block/{friendId}`,
  `/friends/mutual/{userId}`
- **Conversations:** `/conversations`, `/conversations/{conversationId}`,
  `/conversations/dm/{otherUserId}`, member/role/chat-policy routes under
  `/conversations/{conversationId}`
- **Messages:** message list/create/update/delete, read receipts, revisions,
  pins and reactions under `/conversations/{conversationId}/messages`
- **Polls:** `/polls`, `/polls/{pollId}`, `/polls/{pollId}/votes`,
  `/polls/{pollId}/close`
- **Invites:** `/invites`, `/invites/conversation/{conversationId}`,
  `/invites/consume`, `/invites/{token}`, and invite-request resolution routes
- **Notifications:** `/notifications` plus unread, read, bulk-read, type, latest,
  stats and settings routes
- **Files:** `/files/upload`, `/files/upload/multiple`, `/files/{assetId}`
- **Search:** `/search/messages`
- **Reports:** `/reports`, `/reports/mine`
- **Global administration:** `/admin/overview`, `/admin/audit`,
  `/admin/analytics`, `/admin/conversations/**`, `/admin/reports/**`,
  `/admin/messages/{conversationId}/{messageId}` (requires the exact bucket and
  a reason; records the inspection in audit),
  `/admin/sanctions`, `/admin/users/{userId}/sanctions/**`,
  `/admin/users/{userId}/app-roles/**`, `/admin/users/{userId}/sessions/**`,
  `/admin/users/{userId}/devices/**`, `/admin/users/{userId}/status`

Global admin authorization is app-scoped. A conversation-local role never grants
access to `/api/admin/**`.

## STOMP surface

Connect to `ws://localhost:8084/ws`. The exact payloads and operations are in
`docs/api/asyncapi.yaml`.

- **Client commands:** `/app/typing`, `/app/online-status`,
  `/app/call.start`, `/app/call.join`, `/app/call.leave`, `/app/call.signal`,
  `/app/call.end`
- **Conversation streams:** `/topic/conversation/{conversationId}`,
  `/topic/conversation/{conversationId}/typing`, `/reactions`, `/read`,
  `/pins`, `/attachments`, `/calls`
- **User queues:** `/user/queue/notifications`, `/presence`,
  `/presence-sync`, `/presence-batch`

Typing commands contain only `conversationId` and `isTyping`; the server adds
the canonical sender summary to the emitted event. Presence events carry the
canonical `online`, `status`, timestamp and correlation fields defined by
AsyncAPI.

Call commands are direct-call only: every command includes `targetUserId`, the
conversation must be a DM containing both users, and `maxParticipants` is 2.
The frontend uses native browser WebRTC for SDP/ICE and sends those envelopes
through `/app/call.signal`; production NAT traversal still needs an explicit
STUN/TURN configuration.

## Contract rules

- Request and response fields are canonical and validated at the boundary.
- Bounded list endpoints require an explicit limit within the server cap.
- Cassandra is the durable authority; Redis, Kafka and Elasticsearch are
  projections or delivery infrastructure.
- Mutations that affect moderation or administration require server-side app
  permissions and an immutable audit event.
