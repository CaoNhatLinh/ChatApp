# Final documentation and flow self-review (2026-08-28)

This review compares the current implementation, contracts, schema, tests and
browser evidence after the integrated global-admin increment.

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Feature completeness | Partial | `docs/FEATURE_INVENTORY.md`, `docs/ADMIN_PLAN.md` | Long-range analytics/SLO, export, language moderation/appeals and provider-backed delivery are not complete | Keep remaining modules explicitly planned; do not expose fake controls |
| Flow completeness | Partial | `docs/USER_FLOWS.md`, `docs/TRACEABILITY_MATRIX.md` | Authenticated two-account realtime/admin flows need live dependencies | Keep public/deep-link smoke as verified evidence and mark clean-stack proof pending |
| Code-doc consistency | Pass for implemented slices | `docs/api/openapi.yaml`, `docs/contracts/canonical-api.yaml`, controllers and frontend admin API | Remaining endpoint slices still need live integration proof | Canonical contract files are the only supported API surface |
| Runtime consistency | Partial | Next build and Playwright smoke pass; Maven 87 tests pass | Cassandra/Redis/Kafka/Elasticsearch are unavailable on this host | Report infrastructure as externally blocked, never as mock success |
| Permission coverage | Pass at implemented admin boundary | `AppAuthorizationService`, `Admin*Service`, `/api/admin/overview`, `docs/SECURITY.md` | Full analyst/support privacy matrix remains | Server remains authoritative; UI only hides controls from capability snapshot |
| Failure and recovery | Partial | forbidden/unavailable/empty states in `AdminPage.tsx`; bounded limits in services | Provider outage, replay, backup/restore and authenticated browser recovery remain | Track under plan Phase 4–7 and keep bounded queries |
| Test traceability | Pass for current increment | `CanonicalAuthControllerTest`, `AdminConversationServiceTest`, `AdminAuditServiceTest`, `ReportServiceTest`, `AdminModerationServiceTest`, `AppRoleAdminServiceTest`, `AdminAnalyticsServiceTest`, `SanctionExpirySchedulerTest`, `RefreshTokenServiceTest`, `ChatPolicyServiceTest`, `CanonicalBackendServiceMessageTest`, `CanonicalBackendServiceConversationTest`, `ConversationAuthorizationServiceTest`, `JwtAuthenticationFilterTest`, `CanonicalContractManifestTest`, `InfrastructureManifestTest`, `NotificationSettingsPolicyTest`, `NotificationPolicyEvaluatorTest` | Integration and multi-account E2E remain | Maven = 87 tests; OpenAPI/AsyncAPI uniqueness = 95 REST paths / 20 STOMP destinations; browser smoke = zero console/request failures |

## Corrections made during this review

- The global operator console is integrated into the existing Spring + Next
  projects; conversation-local roles do not grant global access.
- Audit events now have a bounded monthly projection with immutable before/after
  state and a protected `/api/admin/audit` timeline.
- Reports can be submitted from message and user-profile surfaces, reviewed
  through bounded daily partitions, and tracked by the reporter through the
  Settings history tab; APP and CONVERSATION sanctions can be imposed/revoked
  with reason and audit.
- A dedicated `/403` recovery route and Next global error boundary now provide
  actionable permission/error recovery instead of falling through to 404.
- Archived conversations now reject new message writes before the idempotency
  claim, so global archive is enforced at the canonical command boundary.
- The default `docker-compose.yml` now contains the same Cassandra/Redis/Kafka/
  Elasticsearch/schema-init capabilities as the explicit full manifest; the
  infrastructure guard checks both files.
- Stale test counts and the poll “mocked” label were corrected in the current
  documentation set.
- Historical room coverage remains explicitly dependent on a bounded backfill;
  the request path never scans Cassandra.
- Existing deployments must apply the additive reporter-projection migration;
  fresh installs include the columns in `chat_app_complete.cql`.
- Existing deployments must also apply the additive sanction-expiry projection
  migration; fresh installs include the UTC-day table in `chat_app_complete.cql`.
- Timed sanction expiry now has a bounded UTC-day scheduler, conditional claim,
  and expiry-qualified ban/mute cleanup; live multi-instance behavior remains
  unverified until Cassandra/Redis are available.
- Refresh rotation now checks the authoritative account status before consuming
  a token, and HTTP CORS origins are no longer hard-coded in the security chain.
- Message UI mapping now consumes the canonical message/event payload directly;
  sender profiles, delivery state, reactions, attachments and reply previews are
  not fabricated when the canonical endpoint does not provide them. Invalid
  attachment metadata and missing admin policy fields fail at the boundary.
- Non-health actuator endpoints now use the canonical `SYSTEM_OPERATE`,
  `APP_ADMIN`, or `SUPER_ADMIN` authorities; the JWT filter no longer skips the
  protected actuator path, closing the obsolete `ROLE_ADMIN` mismatch.
- Global admin user controls now include bounded session/device inventory and
  reasoned revoke actions. `SESSION_REVOKE` is seeded for `APP_ADMIN`, and both
  token-owner and user/device projections are updated with bounded operations.
- Analytics now writes only stable product metric names, uses the event's UTC
  `createdAt` day, and reads every Cassandra event shard explicitly; the source
  contract guard prevents the partition-key query from regressing.
- Friendship responses now expose one canonical `username`/`userId` summary;
  the frontend no longer accepts Spring-page/array/single-item variants or
  fabricates friend IDs, timestamps, avatars, or request containers.
- Presence snapshots now accept only the backend's exact fields and correlation
  values; the previous alias parser and client-side rate-limit retry branch were
  removed because no canonical publisher exists for that event.
- Typing commands now send only `conversationId` and `isTyping`; emitted typing
  users use the canonical `username`/`displayName` summary and the client no
  longer accepts the old `userName` event alias or an unnamed-user fallback.
- Access JWTs are no longer persisted in browser storage. The frontend restores
  only a hinted session through the HttpOnly refresh cookie, and the hint itself
  has no authorization value. Notification read/delete events now have one
  client store and explicit AsyncAPI channels instead of duplicate sidebar
  subscriptions.
- Unwired conversation-info controls and the message-action placeholder path
  were removed rather than leaving clickable dead UI or compatibility copy.
- The complete page surface now shares the signal-orange/cool-ink design system;
  duplicate `/home`, `/messages`, `/activity`, and `/404` pages were removed,
  and public, auth, product, recovery, invite, and operator pages were rebuilt
  with explicit responsive loading, empty, error, focus, and reduced-motion states.
- The final source cleanup removed unused route re-exports, modal/hooks/types/UI
  primitives and stale Vite environment keys. The remaining route surface is the
  canonical 16-route Next App Router surface; no deleted module has an active
  consumer according to the source reference audit.
- Direct calls are explicitly 1–1: the backend requires a DM peer and
  `maxParticipants = 2`, while the frontend owns native `RTCPeerConnection`
  offer/answer/ICE plus incoming accept/decline, mute/camera and hang-up states.
  Group/SFU is not presented as an incomplete or fake feature.
- Final verification after cleanup: `npm run validate`, `npm run build`, public
  Playwright smoke, admin route smoke and notification-settings payload smoke pass;
  JDK 20 `mvnw test` passes 87 tests.
  Docker/Cassandra/Redis/Kafka/Elasticsearch and authenticated multi-account
  browser/media proof remain externally blocked on this host.

# Follow-up self-review (2026-08-29)

The post-checkpoint review re-scanned active source for removed routing APIs and
visible hard-coded feature copy. Remaining route references are documentation or
canonical API paths; no `react-router-dom`, BrowserRouter hook, Vite env key, or
removed page consumer remains in active source. Feature/admin/error copy now
uses the root bilingual provider and the canonical `localizeText`/copy maps;
the app mark is used for product surfaces and is separate from the supplied
personal-brand logo.

The same follow-up increment added a bounded global message inspection route
(`GET /api/admin/messages/{conversationId}/{messageId}`). It requires
`AUDIT_READ`, the exact Cassandra bucket and a reason, returns the canonical
message plus revision history, and records the access in the immutable audit
timeline. The frontend admin panel uses this contract without fabricating
message or revision data. JDK 20 Maven tests now cover 87 tests; live
Cassandra-backed persistence remains externally blocked.

The search audit also removed two UI filters that had no canonical backend
field: recipient-user and reply-message-id. Reply search now exposes only the
supported `replyToSenderId` field, and the client contract test guards against
reintroducing the old mapping.

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Bilingual UI coverage | Partial | `src/shared/i18n`, root `app/layout.tsx`, feature/admin/error source scan, Playwright VI→EN and 404 check | Authenticated live data, provider delivery copy and some protocol/status values are intentionally not translated | Keep canonical enums/user content unchanged; add every new UI string to the map |
| Route/source consistency | Pass | `rg` audit for legacy router/Vite/removed routes; `npm run build` lists 16 canonical routes | Live deployment verification remains unavailable | Keep Next App Router as the only runtime |
| Runtime verification | Partial | `npm run validate`, `npm run build`, `test:e2e:smoke`, `test:e2e:admin`; zero console/request failures | Cassandra/Redis/Kafka/Elasticsearch and authenticated multi-account/media E2E remain blocked | Do not claim clean-stack completion |
| Documentation consistency | Pass for this increment | `DESIGN_SYSTEM.md`, `CONTENT_GUIDELINES.md`, `INFORMATION_ARCHITECTURE.md`, `AGENT_WORK_PLAN.md`, `tasks/function-audit.md` | Long-range admin analytics/export and provider-backed delivery remain planned | Updated stale BrowserRouter and lint claims; preserve explicit external blockers |

The i18n barrel, runtime, provider and hooks are split so the current frontend
lint completes with no warnings or errors.

The notification settings slice now validates the canonical level/time-zone
contract at the backend boundary and exposes a bilingual settings tab with an
explicit payload smoke test; live Cassandra persistence and delivery providers
remain externally blocked.

# Follow-up self-review (2026-08-29, bilingual copy increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Feature completeness | Partial | `UI_COPY`, `MESSENGER_COPY`, `CHAT_THEME_COPY`, and `resources.ts` source scan | Authenticated live content and provider-generated copy are outside this source registry | Added explicit EN keys for every static registry string; keep domain/status codes untranslated |
| Flow completeness | Partial | `test:i18n:copy`, `test:e2e:locale`, `test:e2e:admin` | Authenticated two-account chat and live realtime flow remain blocked by missing stack | Preserve canonical runtime copy and verify public/operator locale journeys in browser |
| Code-doc consistency | Pass | `docs/TESTING.md`, `docs/AGENT_WORK_PLAN.md`, `tasks/function-audit.md`, package script | No gap found in affected command references | Documented the source-contract check and current evidence |
| Runtime consistency | Partial | Next build plus locale/admin smoke after latest build restart | Cassandra/Redis/Kafka/Elasticsearch unavailable locally | No runtime fallback added; external services remain explicitly blocked |
| Permission coverage | Pass for affected UI | No permission code changed; admin strict labels remain server-gated | Full operator permission matrix still needs live integration | Keep labels presentation-only; server remains authority |
| Failure and recovery | Partial | Copy check fails on missing key; browser smoke fails on console/request errors | Provider/reconnect recovery needs live dependencies | Use deterministic source check and retain explicit browser failure gates |
| Test traceability | Pass for affected increment | `npm run test:i18n:copy`, `npm run validate`, `npm run build`, locale/admin smoke | Multi-account E2E remains pending | Added a regression guard for static bilingual copy |

Corrections in this increment:

- Added English translations for previously untranslated messenger status,
  typing, poll, notification-policy, search, profile, and room-theme copy.
- Fixed the requests counter to avoid a duplicate space when composing its
  localized suffix.
- Added a repository-owned `test:i18n:copy` check so future copy registries
  cannot silently fall back to Vietnamese in English mode.

# Follow-up self-review (2026-08-29, error-surface hardening increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for audited surfaces | `getUserFacingErrorMessage`, localized WebRTC errors, sanitized report/presence errors, `npm run test:errors:copy` | Other authenticated provider failures still need live-stack browser proof | Never render native exception or server response text; keep raw detail in operator logs only |
| Bilingual UI coverage | Pass for new error copy | `resources.ts`, all static `localizeText(...)` calls, locale copy smoke (687 static keys) | Live server/provider-generated content remains domain data rather than UI copy | Add each new product message to the explicit VI→EN map |
| Code-doc consistency | Pass | `TESTING.md`, package script, affected feature sources | None in this increment | Keep the guard scoped to user-facing error surfaces |
| Runtime verification | Partial | `npm run validate`, `npm run build`, `npm run test:errors:copy` | Authenticated backend and media errors need clean-stack/browser proof | Preserve the deterministic failure path and do not add fallback success behavior |

Corrections in this increment:

- Replaced raw Axios/native exception rendering in messenger, friendship, user
  report, message report, and WebRTC paths with status-aware product copy.
- Sanitized presence status-sync toasts so server `errorType`/`message` never
  leak protocol or implementation text into the UI.
- Added `test:errors:copy` as a regression check for the audited error surfaces.
- Expanded the locale guard to every static `localizeText(...)` call under
  `src/`; 687 keys currently have explicit English translations.

# Follow-up self-review (2026-08-29, create-room modal increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Modal semantics | Pass for Create Room | `CreateRoomModal`, explicit dialog name/labels, Escape and Tab containment | Profile/report custom modals still rely on their existing focus behavior | Keep modal boundaries semantic and block dismissal while creating |
| Failure safety | Pass for create action | `getUserFacingErrorMessage` plus localized create-room fallback | Live create-room API failure statuses need authenticated browser proof | Preserve server status mapping; never show raw exception text |
| Bilingual UI coverage | Pass for new copy | `resources.ts`, `test:i18n:copy` (685 static keys) | Dynamic user content remains untranslated by design | Translate product copy, not usernames or message content |
| Runtime verification | Partial | `npm run validate`, copy/error guards, Next build route surface | Authenticated modal create flow needs live service/browser proof | Keep the action wired to the canonical create-conversation API |

Corrections in this increment:

- Added semantic dialog metadata, explicit room-name/description labels, Escape
  handling, and keyboard focus containment to Create Room.
- Prevented closing while a room request is in flight and routed create errors
  through status-aware bilingual copy.

# Follow-up self-review (2026-08-29, report-modal focus increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Modal keyboard behavior | Pass for report dialogs | Shared `useFocusTrap`, Escape handling, Tab containment, focus restoration | Profile modal has nested report/confirm layers and needs a dedicated nested-dialog browser journey | Keep one active focus boundary per modal layer; Radix owns confirm-dialog focus |
| Runtime/contract safety | Pass | Only UI event handling changed; report API payloads and status-aware error mapping unchanged | Authenticated report submission still needs live backend proof | Do not alter moderation API semantics |
| Traceability | Pass | `ACCESSIBILITY.md`, shared hook, report modal sources | Full axe/screen-reader review remains pending | Keep keyboard assertions in the release checklist |

The profile dialog now disables its own focus boundary while a nested report or
Radix confirm dialog is open, preventing two modal layers from competing for
Tab/Escape events.

# Follow-up self-review (2026-08-29, message-action failure increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for ChatWindow actions | `getUserFacingErrorMessage`, guarded async action boundary, sanitized profile-load failure | Authenticated provider failure still needs clean-stack browser proof | Keep diagnostics in operator logs; show only stable localized copy |
| Bilingual UI coverage | Pass | `MESSENGER_COPY`, `resources.ts`, `test:i18n:copy` (687 keys) | Domain content remains untranslated by design | Translate every product status/error and keep message content verbatim |
| Promise lifecycle | Pass for audited actions | Delete, pin, history, clipboard and reply-jump failures are caught before event handlers return | Other feature-specific action handlers still need the same audit | No unhandled UI action rejection is acceptable |
| Traceability | Pass | `ChatWindow.tsx`, `messengerCopy.ts`, `resources.ts`, `TESTING.md` checks | Full authenticated browser journey remains pending | Preserve this guard when adding new message actions |

Corrections in this increment:

- Wrapped all ChatWindow message actions in a single status-aware error boundary;
  reply jumps are awaited so pagination failures reach the same user-facing path.
- Added localized feedback for profile-load failures and report submission, and
  cleared stale profile data before opening a new profile.

# Follow-up self-review (2026-08-29, reaction and block-state increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for reaction and DM block actions | Stable error mapping, visible reaction failure toast, guarded block-status/unblock promises | Clean-stack authenticated browser proof remains pending | Never leave an action as log-only when the user needs a result |
| State integrity | Pass for block controls | Block status loading state clears stale state and prevents premature block/unblock actions | Multi-tab status reconciliation remains a realtime integration gap | Render only server-confirmed block controls |
| Bilingual UI coverage | Pass | Call error messages, reaction/block copy and `test:i18n:copy` (693 keys) | Domain content remains untranslated by design | Keep all product feedback in the explicit VI→EN map |
| Traceability | Pass | `ConversationInfo`, `ReactionPicker`, `ReactionDisplay`, `useWebRtcCall`, `resources.ts` | Full authenticated browser journey remains pending | Preserve visible failure feedback for future message actions |

Corrections in this increment:

- Added localized failure toasts for reaction add/remove operations.
- Added loading/cleanup/error handling for DM block-status checks and unblock,
  including a success notification and disabled controls while the request runs.
- Localized realtime/media call failure messages before they reach the call panel.

# Follow-up self-review (2026-08-29, invite-manager action increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for invite actions | Invite create/copy/revoke/approve/decline handlers map failures to stable localized copy | Authenticated invite journey still needs clean-stack browser proof | No clipboard or mutation promise is allowed to reject silently |
| Concurrency/state | Pass for local controls | A single pending-action key disables conflicting invite mutations; selected revoked link is cleared | Cross-tab invite invalidation remains a realtime gap | Keep server refresh after each mutation |
| Bilingual UI coverage | Pass | `InviteManager`, `resources.ts`, locale copy smoke (698 keys) | Invite display names and user IDs remain domain data | Translate product feedback only |
| Traceability | Pass | `InviteManager.tsx`, invite API contract, self-review and function inventory | Invite expiry/concurrency integration proof remains | Preserve explicit active/expired/revoked states from the API |

Corrections in this increment:

- Added safe copy feedback and localized errors for all invite-manager mutations.
- Added type-safe buttons and serialized pending-action state so revoke and join
  request decisions cannot race each other in the same panel.
- Removed a revoked selected link from the preview immediately after the server
  confirms the revoke.

# Follow-up self-review (2026-08-29, poll-action increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for poll vote/remove/close | Poll mutations now map transport failures to stable error copy and expose success/failure feedback | Authenticated realtime poll reconciliation still needs clean-stack proof | Keep raw details in logs only |
| Mutation integrity | Pass for local vote controls | Existing ref double-submit guard retained; server response updates local and central state before success notice | Cross-tab conflict and policy enforcement need integration evidence | Server response remains authoritative |
| Bilingual UI coverage | Pass | `PollCard`, `resources.ts`, locale copy smoke (705 keys) | Poll option text is user-authored domain content | Translate labels/statuses, never user content |
| Traceability | Pass | Poll API calls, action handlers, tests and self-review entry | Poll deadline/anonymous-policy matrix remains partial in inventory | Keep explicit mutation feedback for every new poll action |

Corrections in this increment:

- Added localized success/failure feedback for vote, remove-vote and close-poll
  actions, with safe error mapping and operator-only diagnostics.
- Added explicit `type="button"` semantics to poll controls.

# Follow-up self-review (2026-08-29, room-appearance persistence increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for appearance persistence | Remote theme/default/reset writes now map failures to localized notifications while retaining operator logs | Server preference retry/rollback needs authenticated provider evidence | Never imply a remote save succeeded when the request failed |
| Bilingual UI coverage | Pass | `useRoomThemeState`, `resources.ts`, locale copy smoke (705 keys) | Custom background URLs and room names remain domain input | Translate only product feedback |
| State model | Partial | Local state remains optimistic and persisted per user; remote writes are explicit | A failed write currently keeps the local optimistic value until reload; transactional rollback is a future bounded improvement | Keep the failure visible and avoid fake server success |
| Traceability | Pass | Theme API adapters, hook, room panel, self-review entry | Clean-stack authenticated theme journey remains pending | Keep local and server preference boundaries explicit |

Correction in this increment:

- Appearance default, room-theme, background and reset persistence failures now
  produce stable user-facing error notifications instead of operator-only logs.

# Follow-up self-review (2026-08-29, message-input block/retry increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Safety boundary | Pass for DM composer | Block status is checked before rendering the composer; failed checks fail closed with an inline retry state | Multi-tab block changes still need realtime integration proof | Do not enable sending while the relationship policy is unknown |
| Promise lifecycle | Pass | Unblock, send and poll-create handlers catch failures and map stable copy | Attachment upload/provider failure matrix needs authenticated browser proof | No event-handler promise is intentionally left unobserved |
| State integrity | Pass for retry/unblock | Retry re-runs the canonical block endpoint; unblock re-reads server state before reopening composer | Transactional rollback of partially uploaded attachments remains a provider gap | Keep server response authoritative |
| Traceability | Pass | `MessageInput.tsx`, `MessageInputBlockedState.tsx`, shared error mapper and locale guard | Full composer journey remains pending without a clean authenticated stack | Preserve explicit loading/error/blocked states |

Corrections in this increment:

- Added fail-closed loading and retry states for DM block-status checks.
- Added guarded unblock handling with loading state and localized success/error
  feedback.
- Routed send-message and create-poll failures through the shared safe error
  mapper while retaining operator diagnostics.

# Follow-up self-review (2026-08-29, relationship mutation contract increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Mutation result correctness | Pass for active contact flows | Friend-store mutations now rethrow after recording safe state errors; ContactListView maps the real status to user copy | Legacy duplicate FriendItem remains outside the active route surface | Never report success when a canonical mutation rejected |
| Failure safety | Pass | Status-aware mapper used by profile/open-chat/send/accept/reject/unfriend handlers | Clean-stack two-account browser proof remains pending | Keep raw transport detail out of UI |
| Promise lifecycle | Pass for audited callers | Caller `try/catch` paths now receive mutation failures instead of swallowed resolutions | Background fetch actions intentionally keep state-based error handling | Distinguish user-triggered mutations from background reads |
| Traceability | Pass | `friend.store.ts`, `ContactListView.tsx`, API contract and function inventory | Cross-tab relationship reconciliation remains an integration gap | Preserve rethrow contract for future active callers |

Correction in this increment:

- Relationship mutations now have an explicit reject-on-failure contract. This
  prevents false success notifications and lets each active caller apply the
  correct localized status message.

# Follow-up self-review (2026-08-29, notification-action increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for notification actions | Shared `runAction` catches synchronous and asynchronous mark/open failures and maps stable copy | Authenticated notification provider failure still needs clean-stack browser proof | Never let a dropdown action reject silently |
| Bilingual UI coverage | Pass | `NotificationList.tsx`, `resources.ts`, locale copy smoke (705 keys) | Server-generated notification title/body remain domain data | Translate action/status copy only |
| Accessibility semantics | Pass for audited controls | Explicit button types and existing named notification controls | Full axe/screen-reader review remains pending | Keep notification controls keyboard-safe |
| Traceability | Pass | Notification callbacks, API owner components, self-review and locale guard | Cross-tab read-state reconciliation remains a realtime gap | Preserve callback ownership and error boundaries |

Correction in this increment:

- Added one guarded runner for mark-read, mark-all-read and notification-open
  callbacks, with localized failure feedback and no unhandled UI promise.
- Added an explicit catch for conversation-level notification read updates during
  conversation selection so background sync cannot create unhandled rejections.

# Follow-up self-review (2026-08-29, DM creation boundary increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contract correctness | Pass for active contacts flow | `ContactListView.handleOpenChat` creates a DM only for canonical 404/not-found; network, auth and server errors propagate | Duplicate-create race still needs backend idempotency/integration evidence | Never turn an arbitrary lookup failure into a create request |
| Failure safety | Pass | Caller maps propagated failure through `getUserFacingErrorMessage` | Clean-stack two-account browser proof remains pending | Keep status-aware error copy |
| Legacy/fallback discipline | Pass for touched route | Removed broad catch-as-create behavior from the active route; no compatibility fallback added | Unused duplicate FriendItem retains old code and is intentionally outside scope | Do not expand work into dead/legacy modules |
| Traceability | Pass | `findDmConversation` API, ContactListView and function inventory | Cross-instance idempotency proof remains | Keep lookup/create boundary explicit |

Correction in this increment:

- DM creation now falls back only on an explicit 404 from the canonical lookup;
  authorization, network, rate-limit and server errors are no longer masked by a
  second mutation request.

# Follow-up self-review (2026-08-29, responsive/accessibility smoke increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Responsive layout | Pass for public/auth/recovery pages | `npm run test:e2e:ui-quality` at 320px and 1440px; no horizontal overflow | Authenticated workspace and admin responsive proof still need a seeded session | Keep the same check as a release gate for every canonical public route |
| Semantic structure | Pass for audited pages | One visible `h1` per page; all visible links/buttons named; visible fields labeled | Full axe/screen-reader tree review remains pending | Treat violations as test failures, not visual-only warnings |
| Runtime cleanliness | Pass for audited pages | UI quality smoke reports zero console errors/request failures | Clean-stack authenticated browser flow remains blocked | Keep browser smoke independent of runtime mocks |
| Traceability | Pass | `TESTING.md`, `ACCESSIBILITY.md`, package script, route list | No gap in affected public routes | Record viewport and assertions with each future UI increment |

Corrections in this increment:

- Added a real-browser quality smoke for all public/auth/recovery routes at
  mobile and desktop widths.
- Verified no visible unnamed controls, unlabeled fields, horizontal overflow,
  or duplicate/missing primary headings in the audited surface.

# Follow-up self-review (2026-08-29, offline recovery increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Feature completeness | Partial | `NetworkStatusBanner`, `NativeRouteShell`, `test:e2e:network` | WebSocket reconnect and authenticated offline command reconciliation need live services | Added an explicit browser network-loss/recovery state without claiming message queueing |
| Flow completeness | Partial | Real-browser offline→online run reports `offlineVisible: true`, `recovered: true` | Realtime reconnect/resynchronization still needs Redis/STOMP integration | Keep durable commands on HTTP and expose only accurate network guidance |
| Code-doc consistency | Pass | `PAGE_COVERAGE_MATRIX.md`, `UI_SCREEN_INVENTORY.md`, `FEATURE_INVENTORY.md`, `TESTING.md` | None in affected docs | Added offline/recovery state to the canonical page and feature records |
| Runtime consistency | Partial | Production build and `test:e2e:network` show banner lifecycle with no console/request failures | Clean-stack connectivity remains unavailable | Browser `online/offline` events own this UI state; server remains authoritative |
| Permission coverage | Pass | Banner is non-privileged and mounted inside existing route shells | Authenticated reconnect authorization remains pending | No permission decision is made in the client banner |
| Failure and recovery | Pass for browser network state | Offline event shows warning; online event removes it; test covers both | Dependency outage/retry policy needs live stack | Avoided false claim that unsent messages are queued |
| Test traceability | Pass for affected increment | `npm run test:e2e:network`, `npm run validate`, `npm run build` | Multi-account realtime recovery remains pending | Added deterministic regression coverage |
