# Traceability matrix

Capability identifiers are owned by `FEATURE_INVENTORY.md` (for example,
`ID-ADMIN-001`) and remain stable when implementation files or routes change.
Each row below links the capability to its flow, UI, contract, service, data,
permission and verification evidence.

| User outcome | UI entry | HTTP/STOMP contract | Backend owner | Verification |
|---|---|---|---|---|
| Authenticate | Login/Register pages and Settings → Cách đăng nhập | local `/auth/login|register`, Google `/auth/providers`, `/auth/google/exchange|register`, protected `/auth/identities/**`, shared `/auth/refresh|logout` | `CanonicalAuthController`, `GoogleAuthController`, `AuthService`, `GoogleAuthService`, `RefreshTokenService` | focused backend unit and frontend type/lint pass; live Firebase/Cassandra, crash recovery, rate limit and mobile browser evidence pending |
| Register the active browser device | Authenticated app/admin shell | `POST /devices`, `POST /devices/{deviceId}/heartbeat` | `CanonicalDeviceController`, `DeviceService`, `CanonicalCqlStore`, `DeviceLifecycleManager` | backend user/service test; frontend validate/build; clean Cassandra pending |
| Find a person | Contacts/search | `GET /users/search`, `GET /users/{id}` | `CanonicalUserController` | user service tests |
| Establish or cancel friendship requests | Contacts Find people/Requests/Friends actions | `POST /friends/request`, `DELETE /friends/requests/{recipientId}`, `PUT /friends/accept`, `PUT /friends/reject`, `DELETE /friends/{friendId}` | `ContactAddSection`, `friend.store`, `CanonicalFriendController`, `FriendshipService` | `FriendshipServiceTest`; `test:e2e:contacts` method/path/state assertions; live two-account persistence pending |
| Create and open a conversation | Create-room modal with group/private-channel/community visibility and join policy; [`FLOW-DIRECTORY-001`](flows/presence-and-large-directory.md) | `POST /conversations`, cursor-paginated `GET /conversations`, `/dm/{id}` | `CanonicalConversationController`, `ConversationService` | conversation tests; `test:e2e:room-create` payload/empty-room assertions; `test:e2e:room-management` scroll-triggered second-page cursor assertion; live persistence pending |
| Discover and join a public community | `/communities` search/topic directory and app-shell Community navigation | `GET /communities`, `POST /communities/{conversationId}/join`, join-request list/decision | `CanonicalCommunityController`, `CommunityService`, `JoinRequestService`, `CanonicalCqlStore` | community service/manifest tests; `test:e2e:communities` VI→EN state, request, navigation and 390px assertions; live Cassandra pending |
| Manage a room | Room info panel with permission-gated member, role, chat policy, ownership, audit and notification controls | `/conversations/{id}/members`, `/roles`, `/permissions`, `/audit`, `/ownership/{userId}`, `/chat-policy`, `/members/{userId}/chat-policy`, `/notification-policy`, `/leave` | `RoomManagementPanel`, `RoomMemberDirectory`, `RoomChatPolicyForm`, `RoomMemberPolicyForm`, `RoomAuditTimeline`, `CanonicalConversationController`, `ConversationService`, `CanonicalCqlStore`, `ConversationRoleService`, `RoomAuditService` | Current 165-test Java 20 suite covers catalog/lifecycle races, policy projection, owner protection, bounded UUID member pagination and timeuuid audit pagination; `test:e2e:room-management` verifies 50-row requests, virtual DOM bounds, member pagination, role create/update/assign, room/member policy, room audit, ownership transfer, VI→EN, 390px layout and zero console/request failures; clean Cassandra contention pending |
| Draft, send and read history | Conversation-scoped composer/list; [`FLOW-MESSAGE-001`](flows/message-drafts.md) | versioned device-local draft store; `POST/GET /conversations/{id}/messages` | `MessageInput`, `messageDraftStorage`, `ChatWindow`, `CanonicalMessageController`, `MessageService` | `test:e2e:message-drafts` covers separate room drafts, reload, failed/successful send, account isolation, invalid-schema removal, canonical length and 390px; backend message tests; live Cassandra/realtime pending |
| Edit or delete a message | Message actions with draft-preserving edit mode, revision history, destructive delete confirmation and content-free tombstone UI | `PUT/DELETE /conversations/{id}/messages/{messageId}` + bucket; `GET .../revisions` | `MessageInput`, `MessageItem`, `MessageRevisionPanel`, `ChatWindow`, `CanonicalMessageController` | service tests; `test:e2e:message-edit` exact PUT/cancel/draft restore/VI→EN/history assertions; `test:e2e:message-delete` exact DELETE/cancel/tombstone/VI→EN assertions |
| React, pin, inspect receipts/revisions, and mention | Compact reaction badges and picker, dynamic pin/unpin action, paged seen-by modal, revision dialog, and serialized mention picker; [`FLOW-MESSAGE-002`](flows/message-interactions.md) | required `MessagePage.interactions`; `/reactions`, `/pin`, `/read`, paged `/read-receipts`, `/revisions`, message send `mentionedUserIds`/`mentionEveryone`; `/reactions`, `/pins`, `/read` STOMP topics | `MessageItem`, `ReactionPicker`, `ReactionDisplay`, `MessageReadReceiptDialog`, `MessageInput`, `mention.utils`, `CanonicalMessageController`, `MessageService`, bucket interaction projections | Java 20 suite covers outsider rejection and `@all` expansion; `test:e2e:message-interactions` asserts exact reaction/pin commands, seen-by cursor/profile hydration, mention payloads and VI→EN; live Cassandra/STOMP pending |
| Create, restore, vote, change, remove and close a poll | Compact composer modal and poll card; [`FLOW-POLL-001`](flows/polls.md) | required `MessagePage.polls`; `/polls`, `/polls/{pollId}/votes`, `/close`; `/polls` aggregate STOMP topic | `CreatePollModal`, `PollCard`, `CanonicalPollController`, `PollService`, `MessageSender`, single-partition `poll_state_by_poll` LWT | Current 165-test Java 20 suite; `test:e2e:polls` covers refresh hydration, vote/remove/close, failed-create draft recovery, duplicate validation and VI→EN; clean Cassandra/STOMP pending |
| See live changes | Messenger subscriptions and viewport presence indicators; [`FLOW-REALTIME-001`](flows/presence-and-large-directory.md) | `/app/presence.subscribe`, `/app/presence.unsubscribe`, `/app/presence.batch`, `/app/heartbeat`, `/app/online-status`, `/user/queue/presence`, `/user/queue/presence-batch` | `PresenceController`, `PresenceService`, Redis Pub/Sub listener, `PresenceManager`, `useTrackPresenceInViewport`, `presenceCommandBatcher` | Java `PresenceServiceTest` covers scoped authorization/fan-out/expiry; `test:presence:tracker` and `test:presence:batcher` cover scope transfer plus command coalescing; frontend lint/type-check; live Redis/STOMP multi-node broker and distributed access-revocation invalidation pending |
| Start and control an active-DM call | Conversation header/composer and retained call panel | Eight `/app/call.*` commands with requestId/target; originating-session `/user/queue/call-results`; versioned STATE/SIGNAL `/topic/conversation/{id}/calls` | `CallController`, `CallSignalingService`, `CallCommandChannel`, `useWebRtcCall` | Channel20; browser27 controlled HTTP/STOMP/fake-media groups and light/dark/custom captures. `tasks/call-client-recovery-verification-2026-10-20.md`. Global incoming/history/live broker/media remain open |
| Durable direct-call authority and C2 recovery | Lifecycle service and scheduled cyclic worker | `CallState` / `CallRepository` slot + snapshot CAS, work prewrites/checkpoints and exact publication receipt | `canonical/call/CallLifecycleService`, `CassandraCallRepository`, `CallTimeoutWorker`, `CallStatePublisher`; ADRs 0017/0018 | `tasks/call-recovery-verification-2026-10-20.md`. Controlled worker/receipt/fencing evidence, not live CQL/crash/load or C3 history completion |
| Read own/DM signaling history and exact participant facts | Backend read contract; member UI not yet connected | `GET /calls/history?month&cursor&limit`, `GET /conversations/{id}/calls/history?month&cursor&limit`, `GET /conversations/{id}/calls/{callId}/history`; authenticated JSON/no-store | `CallHistoryController`, `CallHistoryService`, `CallHistoryCursor`, `CallHistoryView`; current membership + exact participant/start hydration, scoped raw-key continuation and fenced expiry; ADR0020 | `tasks/call-history-api-verification-2026-10-23.md`:35 new controlled history tests, full default606/106 suites; actual MVC/Jackson/OpenAPI/signed-JWT chain with controlled ports. No media attendance/duration, callback eligibility, live CQL/concurrency or member UI acceptance implied |
| Discover an active call on DM entry/reconnect | Inline lookup/retry, incoming prompt or detached call panel | `GET /conversations/{id}/calls/active`, no-store 200 public View / 204 absence | `CallQueryController`, `CallLifecycleService.active`, `getActiveCall`, `useActiveCallDiscovery` | Backend real security/MVC plus mocked authority: `tasks/call-active-query-verification-2026-10-20.md`; browser recovery: `tasks/call-client-recovery-verification-2026-10-20.md`. No automatic media restoration or global incoming discovery |
| Participant-private call-state backend | Authenticated subscriber's own queue; connected browser reminder is traced separately below | `/user/queue/calls`, STATE only; no raw/other-user subscription; room + both private handoffs precede receipt | `CallStatePublisher`, `CallDeliveryHeaders`, `CallLifecycleService.requireDelivery`, `StompAuthenticationInterceptor` | `tasks/call-private-state-verification-2026-10-20.md`: real Spring JSON conversion/user resolver/STOMP encoding with mocked authority and sessions. Live/offline/multi-node acceptance remains open |
| Notice an incoming call outside the active DM while connected | Protected-route reminder, verified name/generic guidance, explicit open and local hide | Canonical own `/user/queue/calls` STATE; existing summary + active-call reads on DM entry; no automatic media/answer | `IncomingCallNotice`, `useIncomingCallInbox`, bounded session-only `incoming-call-inbox`/store, `NativeRouteShell` protected opt-in | `tasks/incoming-call-ui-verification-2026-10-22.md`: model31, final controlled browser24, VI/EN/focus/public-route negative checks and eight theme/width captures. Offline/reload pending lookup, history and live broker/Cassandra/media remain open |
| Discover currently ringing incoming calls without enumerating rooms | Backend read foundation; connected consumer traced separately below | `GET /calls/incoming?cursor&limit`, actor from authentication, no-store JSON canonical snapshot page; filtered-empty full-tuple continuation | `IncomingCallController`, `IncomingCallService`, `IncomingCallRepository`/`CassandraIncomingCallRepository`, prewrite in `CassandraCallRepository.claim`; `incoming_calls_by_user`; ADR0019 | `tasks/incoming-call-discovery-verification-2026-10-22.md`: focused65, full default561/101 suites and schema84 tables/720 columns; real signed-JWT/security/MVC with mocked discovery and driver bindings. This backend increment did not establish frontend/live CQL/TTL/crash/broker acceptance |
| Recover currently ringing incoming calls on protected reload/reconnect | Same nonmodal notice, local checking/waiting/error retry/dismiss and incomplete continuation; retained known-call Open, no auto media/focus/mutation | Own private STATE subscription before `GET /calls/incoming?limit=50&cursor`; strict page validation,8-page batches, same versioned session inbox | `incoming-calls.api`, `IncomingCallDiscovery`, `useIncomingCallInbox`, shared inbox/store merge, `IncomingCallNotice`/`IncomingCallLookupFeedback` | `tasks/incoming-call-client-verification-2026-10-22.md`: API85/controller12/inbox38, final production browser49/36GETs,17captures; validate/build and call32/workspace39/thread19 regressions pass. Controlled transport only; finite memory/disconnect limits, real Cassandra/broker/two-client/media and C3 remain open |
| Open a DM outside the loaded directory page | Existing conversation route and call controls, not a new global incoming UI | `GET /conversations/{id}/summary`, same member-scoped directory DTO; no-store, bounded exact projection reads | `ConversationBrowseService`, `CanonicalConversationController`, messenger point adapter; queued `RealtimeService` subscriber restoration | `tasks/conversation-point-summary-verification-2026-10-20.md`: backend526, adapter17, realtime11, controlled call-browser28. Summary-entry recovery follow-up below; live/global acceptance remains open |
| Recover from an unknown-room summary failure | Local entry loading/error/retry; back to list and retained language changes | Same canonical summary read; no automatic device acquisition, message send or fake room | `conversation-entry`, conversation slice, `ConversationEntryState`, `MessengerLayout` | `tasks/conversation-entry-ux-verification-2026-10-20.md`: model24, browser call/entry32/workspace39/thread19. Known-room initial history failures and global/live gates remain open |
| Correlated call commands and safe ephemeral signals (C2 boundary) | Authenticated STOMP adapter and typed browser channel | Request scope + action, sanitized accepted/error result, typed versioned view; bounded role-checked SDP/ICE | `CallSignalingService`, `CallLifecycleService.authorizeSignal`, `CallState.version` | 43 controlled core-call tests, actual controller dispatch, heartbeat revocation and post-commit fan-out-loss model; default JUnit476. Foundation and connected evidence remain separate from live Cassandra/broker/media acceptance |
| Manage notifications | Notification panel/settings, channel, quiet-hour, room-default and personal override controls | `/notifications/**`, `/conversations/{id}/notification-policy`, `/conversations/{id}/members/{userId}/notification-policy`, `/user/queue/notifications` | `CanonicalNotificationController`, `CanonicalConversationController`, `NotificationSettingsPanel`, `ConversationInfo`, `NotificationPolicyEvaluator` | `test:e2e:notifications`, policy/evaluator unit tests and message integration tests; live Cassandra/provider delivery pending |
| Personalize chat appearance | Settings appearance and room theme panel | `GET|PUT /preferences/chat`, `PUT|DELETE /preferences/chat/rooms/{conversationId}` | `CanonicalChatAppearanceController`, `AppearanceService`, `useRoomThemeState`, `RoomThemePanel` | frontend validate/build; backend unit validation; clean Cassandra and cross-account browser proof pending |
| Share a room | Invite manager and `/join/:token`; [`FLOW-INVITE-001`](flows/invites-and-join-approval.md) | `/invites/**`, authenticated `/invites/{token}/status`, `/public/invites/{token}` | `InviteManager`, `JoinInvitePage`, `CanonicalInviteController`, `InviteService`, `JoinRequestService`, `CanonicalCqlStore` | Java capacity, compensation and interrupted-resolution tests; `test:e2e:room-management` create/revoke/approve/progressive-disclosure proof; `test:e2e:invites` public/auth separation, login return, reload restoration, VI→EN and 390px proof; clean Cassandra process-kill test pending |
| Upload and share media | Composer attachment picker | `POST /files/upload` | `MediaController`, `CloudinaryMediaService` | configuration-gated; provider pending |
| Search message history | Conversation header → message-search dialog | `POST /search/messages` | `MessageSearchController`, Elasticsearch projector | index/integration pending |
| Operate global application | `/admin` dashboard, whole-room directory, user search/status/role/session/device/policy manager, monthly audit timeline | `GET /admin/overview`, `GET /admin/audit`, `GET /admin/conversations`, `GET/PUT/DELETE/POST /admin/conversations/**`, `GET/POST/DELETE /admin/users/{id}/app-roles`, `PUT /admin/users/{id}/status`, `GET/DELETE /admin/users/{id}/sessions/**`, `GET/DELETE /admin/users/{id}/devices/**`, `GET /health` | `AdminOverviewController`, `AdminAuditController`, `AdminConversationController`, `AdminConversationService`, `AdminUserController`, `AppRoleAdminService`, `CanonicalCqlStore` | backend unit evidence; `test:e2e:admin` exact room policy/archive/restore, role/status/session/device and CSV contracts plus populated 390px accessibility/layout; live persistence and directory backfill pending |
| Report and moderate abuse | Message overflow menu and user profile modal open report forms; settings report history shows the caller's bounded submissions; admin reports panel resolves queue items, applies sanctions and automatically expires timed locks | `POST /reports`, `GET /reports/mine`, `GET/PUT /admin/reports`, `POST/DELETE /admin/sanctions` | `ReportMessageModal`, `ReportUserModal`, `ReportHistoryPanel`, `UserProfileModal`, `ReportController`, `AdminModerationController`, `ReportService`, `ModerationRepository`, `SanctionExpiryScheduler` | backend validation/persistence/expiry unit tests; `test:e2e:admin` report resolution and sanction impose/revoke contract assertions; live CAS and classifiers pending |
| Investigate messages and analytics | Admin message investigation, analytics panels and bounded monthly audit CSV export | `GET /admin/messages/{conversationId}/{messageId}`, `GET /admin/analytics`, `GET /admin/audit/export` | `AdminMessageController`, `AdminMessageService`, `AdminAnalyticsController`, `AdminAnalyticsService`, `AdminAuditController` | message inspection, analytics and CSV export unit evidence; authenticated live persistence and metric dictionary remain pending |

Unmapped UI calls are defects. Every new route must be added to this table and
the OpenAPI/AsyncAPI documents in the same change.

## Call-history producer foundation (2026-10-23)

Internal `CallHistoryRepository` writes room/UTC-month and both actor/UTC-month
immutable discovery keys before `CassandraCallRepository.claim` can CAS authority.
Bounded full-tuple reads do not themselves authorize or expose calls. ADR0020 and
`tasks/call-history-producer-verification-2026-10-23.md` record focused32/full571
controlled tests and static84-table/713-column schema checks. The new Cassandra
IT compiles but is unrun. This producer increment did not implement own/room/
detail HTTP or participant DTOs; the subsequent connected API is traced in the
main table above. Member UI was subsequently connected with controlled evidence
in `tasks/call-history-ui-verification-2026-10-23.md`; live acceptance remains open.

## Forward provenance backend (2026-10-20)

Forward provenance backend: canonical message POST verifies the full immediate
source snapshot before allocation; public message/STOMP data contains only the
`forwarded` marker. `GET /conversations/{id}/messages/{messageId}/forward-source`
rechecks current source/destination authorization and returns an indistinguishable
unavailable state without private keys. `MessageForwardPolicy`,
`MessageForwardSourceService`/controller and deterministic Cassandra source-index
repair own this path. Evidence: `tasks/forward-backend-verification-2026-10-20.md`.
F2 forward chooser/send/source UI is connected with controlled browser evidence
in `tasks/forward-ui-verification-2026-10-20.md`; live Cassandra/two-client gates
remain open.

## Direct reply panel (2026-10-20)

| User outcome | UI and contract | Implementation | Evidence |
| --- | --- | --- | --- |
| Read an original message outside cached history, page its actual direct replies and answer | Source quote/message action → protected-focus responsive thread dialog; `GET /conversations/{id}/messages/{messageId}/replies?bucket&cursor`; existing canonical message POST with full reply key | `thread.api`, `useMessageThread`, `MessageThreadDialog`, `ThreadMessage`, `ThreadReplyComposer`, `MessageItem`, `ChatWindow`, `useReadTracking`; T2 `MessageThreadController`/`MessageThreadService` | `test:threads:api`, `test:e2e:threads`; 19 controlled browser groups, light/dark four-width + custom captures, error/retry/revocation/stale-response/read-behind-panel checks. `tasks/thread-ui-verification-2026-10-20.md`; live Cassandra/two-client gate remains open |
## Direct-call account eligibility (2026-10-23)

The shared lifecycle contact gate reads canonical `UserRepository` accounts for
both participants before start/accept/heartbeat/signal, existing active-call
discovery and final outbound call delivery. Missing/non-ACTIVE peers cannot be
contacted just because a DM membership still exists. Explicit terminal cleanup,
server expiry and authorized historical reads retain separate policies; no
callback permission or account-status disclosure was added to history.

Controlled evidence: 22 new `CallContactEligibilityTest` cases and real MVC/JWT
peer-denial coverage; default 629 tests/107 fresh suites pass. Point-in-time reads
do not prove atomic status revocation, database performance or real media stop
timing. Evidence: `tasks/call-contact-eligibility-verification-2026-10-23.md`.

## Media upload admission (2026-10-23)

Existing `/files/upload` and `/files/upload/multiple` use bounded actual-byte
reading and JPEG/PNG/GIF/WebP header/canvas checks before provider IO/persistence.
29 new controlled tests and the default 658-test backend run passed. This is not
durable thumbnail generation, malware/moderation scanning or full decoding.
Commands, scope and remaining M1/M2/M3 gates:
`tasks/media-upload-preflight-verification-2026-10-23.md`.

## Confirmed media derivatives (2026-10-23)

Image upload now requests synchronous eager static PNG SMALL/MEDIUM/LARGE outcomes
and writes confirmed/failed/unavailable metadata with the asset in a logged batch.
The upload thumbnailUrl is only a confirmed SMALL result, not a constructed URL.
Owner-only `/files/{assetId}/thumbnails` reads persisted facts without generation;
this is not historical recipient authorization. SDK encoding/service/repository/
standalone MVC/OpenAPI: 39 tests; full backend 697/113 suites, schema 84/714/2 pass.
Live provider output, batchlog/crash/recovery and connected media UI remain open.
ADR0021 and `tasks/media-thumbnail-verification-2026-10-23.md` record the boundaries.

## Attachment upload/send/retry boundary (2026-10-23)

Upload metadata dimensions/duration now reach the canonical send and local
optimistic message. The backend accepts a supplied thumbnail only from this
asset's persisted READY variants, after source authorization/metadata checks.
Bubble retry consumes the in-memory original command and ID, not reconstructed
display state that loses mentions. Unsupported retries without a snapshot are
not offered; confirmation clears local retry state.

Evidence: adapter7, controlled Chromium attachment4/eight theme-width captures,
backend703/113, validate/build, chat39/thread19/draft and GIF/sticker/forward
regressions. Full commands and limitations:
`tasks/attachment-metadata-verification-2026-10-23.md`. Live provider/datastore,
composer-upload reuse, recipient/history rendering and durable recovery remain open.

## Scoped composer upload recovery (2026-10-23)

Repeat Send now reuses confirmed uploads rather than allocating a new asset for
the same selected File. Partial upload retry retains earlier successes; no message
is sent with an incomplete subset. Preparation associates the local composer with
the canonical command ID, not another private persistent outbox. Confirmation
selectively removes old files and revision-protects new text/reply. Scope disposal
aborts client HTTP and does not send from the departed room.

Evidence: cache7, adapter7, five Chromium modes/23 grouped checks and32 captures,
validate/build/lint and draft/edit/workspace39 regressions. Provider crash/rollback,
durable upload recovery and incoming/history hydration remain separate. See
`tasks/composer-upload-recovery-verification-2026-10-23.md`.

## Message-scoped attachment reads (2026-10-23)

Canonical hasAttachments is retained for lazy read hydration across received
MESSAGE_SEND and history. Membership/message visibility precede bounded reference
and asset resolution; unavailable rows have no URL. The raw pre-message attachment
event was removed, not translated through a second legacy adapter. UI has inline
retry/load-more, spoiler no-preload and image failure feedback. Evidence: backend
reader/controller13, source full715 plus new bounds regression, HTTP adapter7,
production Chromium18 and sender/thread/workspace regressions. ADR0022 and
`tasks/message-attachment-read-verification-2026-10-23.md`. Durable media lifecycle
and live provider/datastore/two-client acceptance remain open.

## Ordinary media replay repair (2026-10-23)

Exact-fingerprint normal and forward retries now repair frozen attachment
references before acknowledgement; deleted messages skip reference/source repair.
Attachment reads/writes explicitly LOCAL_QUORUM. Service/repository fault and
binding checks, focused64 and full724/116 pass. Evidence and unclosed creation /
side-effect recovery races: `tasks/message-attachment-repair-verification-2026-10-23.md`.

## Conditional message authority (2026-10-23)

Replace unconditional initial save with applied-result IF NOT EXISTS. Losers read
the current authority; only the actual creator runs first-send effects. Stable
reply/forward projection repair is explicit and the former cross-row logged-create
decision is partially superseded by ADR0023. Dedicated7/focused56/full731/118 pass;
the new real two-client IT is compile-only until Docker is available. Durable
completion and stale-publication/revision ordering remain open. Evidence:
`tasks/message-creation-verification-2026-10-23.md`.

## Backend content/deletion revision contract (2026-10-23)

Expose stored revision_no in canonical messages and public realtime/projection
events; retain it during deletion redaction. Missing/negative storage and overflow
do not produce fabricated revision0. Contract6/mutation3/full740/120 pass; no
frontend/browser or live CQL ordering acceptance is implied. ADR0024 and
`tasks/message-revision-contract-verification-2026-10-23.md`. Consumer ordering and
durable completion remain open.

## Controlled frontend content revision reconciliation (2026-10-23)

Strict canonical revision adapter and shared live/edit/history ordering protect
loaded content/tombstones and known previews. Independent metadata uses a separate
history-race baseline, not content revision. Actual-source14, validate/build and
production Chromium edit/delete/interactions, attachment18/workspace39 pass.
Eight-width/theme combinations and custom overrides are covered in controlled UI.
`tasks/message-revision-client-verification-2026-10-23.md`. Unversioned summary
freshness, search/durable publication and real two-client/crash gates remain open.

## Versioned preview authority (2026-10-23)

The earlier unversioned-summary limitation is superseded for the referenced
message: exact canonical bucket/ID hydration now returns current edit/deletion and
revision in list/point reads. Service, MVC, repository and strict client-adapter
coverage plus default747/120, schema guard, validate/build and controlled browser
edit reload/workspace39 pass. Evidence:
`tasks/conversation-preview-authority-verification-2026-10-23.md`. Last-message
pointer ordering/repair, search/durable completion and real runtime gates remain
open. Fresh bootstrap only; no existing database was migrated.

## Controlled atomic search snapshot writer (2026-10-23)

Required canonical revision and one Elasticsearch scripted-upsert command replace
Java read/replace. Tombstones redact retained search data; content does not reset
independent pin/mention metadata. Focused8/default752/122 pass. Real script,
mapping, transport and concurrency IT compiles but remains unexecuted; independent
pin event ordering and durable recovery are still open. ADR0025 and
`tasks/message-search-ordering-verification-2026-10-23.md`. No existing index was
rebuilt/deleted and no deferred Docker check was attempted.

## Exact unpin ownership (2026-10-23)

An observed message pin slot is released only if its key and pinned_at timeuuid
generation still match; lost CAS returns409 before projection/audit/realtime
success. Controlled repository4/service regression and default757/123 pass.
Two-client reused-slot/ABA IT compiles, not executed. No schema change; existing
timeuuid is not represented as a monotonic global pin version. Full pin authority
and recovery remain open. Evidence:
`tasks/message-unpin-ownership-verification-2026-10-23.md`.

## Version-fenced pin capacity (2026-10-23)

The active pin repository now delegates to a bounded per-conversation aggregate
helper; a static version CAS and its slot mutation share one conditional batch.
Controlled repository9/default762/123 and fresh-bootstrap schema715 pass. Old
independent slot claiming was removed, not retained behind a compatibility path.
Real CQL/static initialization/concurrent pin IT has not run. Public versioned
snapshots/stale intent and distributed projection/publication repair remain open.
ADR0026; `tasks/message-pin-capacity-verification-2026-10-23.md`.

## Canonical full-pin protocol (2026-10-23)

Observed-revision HTTP commands and full HTTP/realtime snapshots are connected;
the client compares int64 strings via BigInt and preserves accepted pin state
across history/live content. Search has a separate pin version guard. Default770/
124, frontend validate/build, adapter6/model18 and production interaction/workspace42
checks pass. One earlier combined-run read-ack timeout is documented, not counted
as success. Source pin-flag projection/cleanup, durable publication and all real
engine/broker/two-client/crash gates remain open. ADR0027 and
`tasks/message-pin-protocol-verification-2026-10-23.md`.

## Authoritative pin read paths (2026-10-23)

Point/bucket/history/thread/shared/forward source reads derive flags from the
conversation pin aggregate after authorization, at most once per page. Search
filters bounded candidates against authority rather than stale index pin flags;
the frontend retains cursor continuation even when visible content is empty.
Full774/124, frontend validate/build, production interaction regression and
search continuation across eight width/theme cases pass. Evidence:
`tasks/message-pin-read-verification-2026-10-23.md`. Stored projection repair,
deleted-slot cleanup, durable replay and real runtime gates are not complete.

## Pin lookup recovery UX (2026-10-23)

Member snapshot lookup failure now has localized inline Retry, pending-state
deduplication and user/room-keyed cancellation instead of reopen-only guidance.
Actual React lifecycle4, strict adapter6/store18, production retry interaction
with eight width/theme captures, workspace42 and validate/build pass. No new
backend capability claimed. `tasks/message-pin-retry-verification-2026-10-23.md`.

## Deleted pin cleanup (2026-10-23)

Deletion/retry, post-pin deletion compensation and member snapshot read repair
use irreversible tombstone proof and the existing revision/generation CAS.
Storage errors propagate; contention is bounded and missing rows do not authorize
removal. Full789/126, actual store ordering20, production ordinary/pinned delete
and pinned reload across eight width/theme cases pass. Controlled two-thread
service interleavings are tested; real Cassandra/two-client/crash acceptance and
durable publication/background recovery are not complete. ADR0028;
`tasks/deleted-message-pin-verification-2026-10-23.md`.

## A1 typed settings backend (2026-10-23)

Finite boolean/integer community settings → SYSTEM_OPERATE no-store GET/PUT →
same-partition revision/command/audit-intent CAS → bounded immutable audit export.
New public-community creation consumes both settings; existing/private/DM behavior
is unchanged. Full817/131 and schema84/720 checks pass. No timestamp revision,
arbitrary config/secret editor or false audit on stale save. A2 form, clear client
policy feedback and real Cassandra/two-client/crash acceptance remain open.
ADR0029; `tasks/system-settings-backend-verification-2026-10-23.md`.

## A2 settings and compact admin UI (2026-10-23)

Application-owned exit → per-editor typed risk → shared protected-focus
confirmation → existing Back-to-app callback. Stay/Escape preserves memory;
Leave never submits/retries; unknown outcomes warn of possible server commit.
Actual aggregation6/browser30 (eight themes/widths), API7, admin/sticker
regressions and validate/build pass. English admin permission reload hydration
is guarded by the same production suite. `tasks/system-settings-exit-verification-2026-10-23.md`.
Universal browser Back/Forward and reload/crash recovery remain open.

Typed catalog → retained per-setting command/draft → on-demand protected dialog
→ confirmed current authority → compact row and saved-policy diagram. Revoked
permission clears all forms; unknown acknowledgements replay the frozen command;
409 never overwrites silently. Stable COMMUNITY_CREATION_DISABLED403 connects
actual creation policy to localized guidance. Controlled819/132 backend, API7,
copy8, production-browser20/eight width-theme editor+list cases, admin/sticker/
pinned-deletion/poll regressions and frontend validate/build pass. The independent
review scored its three refresh/mobile-name/close-target fixes resolved; this is
not whole-app approval. Native unload warning is not an app-wide SPA leave guard.
Real Cassandra/crash/two-client/retention acceptance remains open.
`tasks/system-settings-ui-verification-2026-10-23.md`.
