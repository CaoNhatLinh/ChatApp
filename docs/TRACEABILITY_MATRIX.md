# Traceability matrix

Capability identifiers are owned by `FEATURE_INVENTORY.md` (for example,
`ID-ADMIN-001`) and remain stable when implementation files or routes change.
Each row below links the capability to its flow, UI, contract, service, data,
permission and verification evidence.

| User outcome | UI entry | HTTP/STOMP contract | Backend owner | Verification |
|---|---|---|---|---|
| Authenticate | Login/Register pages | `POST /auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout` | `CanonicalAuthController`, `RefreshTokenService` | backend unit; browser pending |
| Find a person | Contacts/search | `GET /users/search`, `GET /users/{id}` | `CanonicalUserController` | user service tests |
| Establish friendship | Contacts actions | `/friends/**` | `CanonicalFriendController`, `FriendshipService` | friendship tests |
| Open a conversation | New conversation modal | `POST /conversations`, `GET /conversations`, `/dm/{id}` | `CanonicalConversationController` | conversation tests |
| Manage a room | Room info/settings/member actions and notification precedence | `/conversations/{id}/members`, `/roles`, `/chat-policy`, `/notification-policy`, `/leave` | `CanonicalConversationController`, `CanonicalBackendService`, `ConversationRoleService` | frontend type-check; backend policy tests; live authorization pending |
| Send/read history | Message composer/list | `/conversations/{id}/messages` | `CanonicalMessageController`, `CanonicalBackendService` | message tests |
| Edit or delete a message | Message actions | `PUT/DELETE /conversations/{id}/messages/{messageId}` + bucket | `CanonicalMessageController` | service tests; browser pending |
| React, pin, and inspect receipts/revisions | Message actions | `/reactions`, `/pin`, `/read`, `/read-receipts`, `/revisions` | `CanonicalMessageController` | service tests; broker/browser pending |
| Create and vote on a poll | Composer/poll card | `/polls`, `/polls/{pollId}/votes`, `/close` | `CanonicalPollController` | compile; live persistence pending |
| See live changes | Messenger subscriptions | `docs/api/asyncapi.yaml` | `PresenceController`, realtime publisher | compile/unit; broker pending |
| Start a direct call | Conversation header/composer (DM only) | `/app/call.start`, `/app/call.join`, `/app/call.leave`, `/app/call.signal`, `/app/call.end` with required `targetUserId` | `CallController`, `ConversationAuthorizationService`, `useWebRtcCall` | 73 backend tests; frontend build/type-check; live two-browser media/reconnect pending |
| Manage notifications | Notification panel/settings, channel, quiet-hour, room-default and personal override controls | `/notifications/**`, `/conversations/{id}/notification-policy`, `/conversations/{id}/members/{userId}/notification-policy`, `/user/queue/notifications` | `CanonicalNotificationController`, `CanonicalConversationController`, `NotificationSettingsPanel`, `ConversationInfo`, `NotificationPolicyEvaluator` | `test:e2e:notifications`, policy/evaluator unit tests and message integration tests; live Cassandra/provider delivery pending |
| Share a room | Invite manager/join page | `/invites/**`, `/public/invites/{token}` | `CanonicalInviteController` | service tests; browser pending |
| Upload and share media | Composer attachment picker | `POST /files/upload` | `MediaController`, `CloudinaryMediaService` | configuration-gated; provider pending |
| Search message history | Search page | `POST /search/messages` | `MessageSearchController`, Elasticsearch projector | index/integration pending |
| Operate global application | `/admin` dashboard, whole-room directory, user search/status/role/session/device/policy manager, monthly audit timeline | `GET /admin/overview`, `GET /admin/audit`, `GET /admin/conversations`, `GET/PUT/DELETE/POST /admin/conversations/**`, `GET/POST/DELETE /admin/users/{id}/app-roles`, `PUT /admin/users/{id}/status`, `GET/DELETE /admin/users/{id}/sessions/**`, `GET/DELETE /admin/users/{id}/devices/**`, `GET /health` | `AdminOverviewController`, `AdminAuditController`, `AdminConversationController`, `AdminConversationService`, `AdminUserController`, `AppRoleAdminService`, `CanonicalCqlStore` | frontend/backend unit evidence; live operator/audit persistence and directory backfill pending |
| Report and moderate abuse | Message overflow menu and user profile modal open report forms; settings report history shows the caller's bounded submissions; admin reports panel resolves queue items, applies sanctions and automatically expires timed locks | `POST /reports`, `GET /reports/mine`, `GET/PUT /admin/reports`, `POST/DELETE /admin/sanctions` | `ReportMessageModal`, `ReportUserModal`, `ReportHistoryPanel`, `UserProfileModal`, `ReportController`, `AdminModerationController`, `ReportService`, `ModerationRepository`, `SanctionExpiryScheduler` | backend validation/persistence/expiry unit tests; authenticated moderation E2E, live CAS and classifiers pending |
| Investigate messages and analytics | Admin message investigation and analytics panels; export remains planned | `GET /admin/messages/{conversationId}/{messageId}`, `GET /admin/analytics`, bounded export contracts | `AdminMessageController`, `AdminMessageService`, `AdminAnalyticsController`, `AdminAnalyticsService` | message inspection and analytics unit evidence; authenticated live persistence, metric dictionary and export remain pending |

Unmapped UI calls are defects. Every new route must be added to this table and
the OpenAPI/AsyncAPI documents in the same change.
