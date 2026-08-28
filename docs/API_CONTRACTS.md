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
submission/queue/resolution, APP/CONVERSATION sanctions and bounded daily
analytics and message investigation are implemented, while long-range
analytics/SLO dashboards and bounded export remain planned. Conversation roles
are room-local.
