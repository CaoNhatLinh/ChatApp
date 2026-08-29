# API contracts

`docs/api/openapi.yaml` is the canonical HTTP contract. `docs/api/asyncapi.yaml`
is the canonical STOMP destination/message contract. Both are tested for
presence and representative routes by `CanonicalContractManifestTest`.

Rules: clients send opaque cursors back unchanged, every message mutation
includes the conversation bucket where required, all authenticated HTTP routes
use a memory-held bearer access token, refresh uses the HttpOnly cookie, and a
non-sensitive `novachat_session` cookie only signals whether startup should
attempt refresh. It grants no access and is never sent as a credential.
Realtime subscriptions are authorized by the STOMP inbound interceptor. Call
signalling uses `/app/call.*` commands and
`/topic/conversation/{conversationId}/calls`, with an explicit `targetUserId`
for the native 1–1 WebRTC flow. The chat service does not provide a media
provider or TURN service.

Authenticated browsers register one canonical `WEB` device with `POST /devices`
and refresh its `lastSeenAt` using `POST /devices/{deviceId}/heartbeat`. A revoked
device is not reactivated by heartbeat; registration is an explicit upsert.

Message search is bounded to a member's conversation and accepts only the
canonical `MessageSearchRequest` fields. There is no recipient-user filter
because messages are conversation-scoped; reply filtering uses
`replyToSenderId`.

Notification precedence is explicit: a conversation default accepts `ALL`,
`MENTIONS`, or `NONE`; each member may set `INHERIT`, `ALL`, `MENTIONS`, or
`NONE` for their own membership. The room default is writable only with
`ROOM_UPDATE`; a member override is writable only by that member. The effective
pair is read from `GET /conversations/{conversationId}/notification-policy`.

Private chat appearance uses the authenticated user's own preference partitions:
`GET|PUT /preferences/chat` stores the source-controlled default theme and bubble
style, while `PUT|DELETE /preferences/chat/rooms/{conversationId}` stores or clears
the member's private per-room theme/background override. Room writes require current
membership; preferences are never exposed to other users.

The global admin UI uses the same frontend/backend projects: `GET /admin/overview`
is the server-authoritative capability gate. Whole-app room operations use the
bounded monthly `/admin/conversations` directory and its policy/archive routes;
operator investigations use `/admin/audit` for a bounded monthly timeline;
message investigations use `/admin/messages/{conversationId}/{messageId}` with
the exact message bucket and a required reason; each inspection is appended to
the immutable audit timeline;
app-role changes use `/admin/users/{userId}/app-roles`. Moderation reports,
user status and bounded session/device controls use the corresponding
`/admin/users/{userId}/status|sessions|devices` routes. Moderation reports,
sanctions, analytics and bounded export are separated by capability: report
submission/queue/resolution, APP/CONVERSATION sanctions, bounded daily
analytics, message investigation and monthly UTF-8 CSV audit export are
implemented, while long-range analytics/SLO dashboards remain planned.
Conversation roles are room-local.
