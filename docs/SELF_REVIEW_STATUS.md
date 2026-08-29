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

# Follow-up self-review (2026-08-29, invite-preview/action increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure semantics | Pass for invite page | Preview network/auth errors render an explicit retryable error; invalid status is reserved for the canonical API result | Authenticated invite lifecycle still needs clean-stack browser proof | Never convert transport failure into an invalid-domain state |
| Mutation lifecycle | Pass | Accept/decline handlers catch failures, preserve submitting state and render stable copy | Provider concurrency/expiry matrix remains partial | Keep server result authoritative |
| Bilingual UI coverage | Pass | `JoinInvitePage`, `resources.ts`, locale copy smoke (708 keys) | Conversation names and invite display names remain domain content | Translate product labels and errors only |
| Traceability | Pass | Invite API contract, route page, retry control and inventory | Full invite state/browser journey remains pending | Keep active/invalid/revoked/expired/limit states explicit |

Corrections in this increment:

- Added retryable preview-error UI instead of treating every fetch failure as an
  invalid token.
- Added safe localized errors for invite accept/decline and explicit button
  semantics.

Direct browser check reached `/join/invalid-token` with HTTP 200, one visible
heading and a retryable alert. The canonical API was unavailable on this host
(`ERR_CONNECTION_REFUSED`), so backend-dependent invite status/mutation evidence
remains blocked rather than being replaced with mock data.

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

# Follow-up self-review (2026-08-29, client transport-log increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Data exposure | Pass for API rejection logging | Development interceptor logs status/method/path only; response payload is no longer serialized to the browser console | Server-side structured audit/log redaction remains an operations task | Never emit response bodies from the client transport logger |
| User-facing errors | Pass | Callers own localized status mapping through `getUserFacingErrorMessage` | Full endpoint-by-endpoint authenticated failure proof remains pending | Keep transport diagnostics separate from UI copy |
| Traceability | Pass | `apiClient.ts`, error mapper and self-review entries | No clean-stack provider run on this host | Treat provider unavailability as blocked evidence, not a success |

Correction in this increment:

- Removed development-console serialization of arbitrary API response payloads;
  only status, method and endpoint metadata remain in operator diagnostics.

# Follow-up self-review (2026-08-29, Create Room user-search increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Async consistency | Pass for Create Room search | `useUserSearch` ignores late responses and cleanup-time errors; only current query may update state | Abort signal support depends on the canonical search API contract | Do not let stale requests overwrite a newer query |
| Failure safety | Pass | Search failures map to stable localized copy and clear current results | Authenticated provider proof remains pending | Keep search errors visible without exposing transport data |
| Traceability | Pass | `useUserSearch.ts`, Create Room modal and locale/error guards | Search ranking/index behavior remains a backend concern | Preserve active-request boundary |

Correction in this increment:

- Added an active lifecycle guard to Create Room user search so stale responses
  and post-unmount errors cannot corrupt the modal state.

# Follow-up self-review (2026-08-29, conversation-pin action increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for sidebar pin actions | Pin and unpin API failures now map to stable localized notifications; the local store changes only after the request succeeds | Authenticated concurrent pin-limit proof remains pending | Never leave a visible pin control with a log-only failure path |
| State integrity | Pass for request boundary | Pin state is updated only after the canonical API resolves; failed requests do not mutate local state | Cross-tab pin ordering still needs realtime/integration evidence | Keep the server result authoritative |
| Bilingual UI coverage | Pass | `useMessenger`, `resources.ts`, locale copy smoke (710 keys) | Conversation names remain domain data | Translate action failures only |
| Traceability | Pass | Sidebar callbacks, messenger API adapters and this entry | Clean-stack authenticated browser proof remains blocked | Preserve the notification boundary for future sidebar mutations |

Correction in this increment:

- Replaced silent pin/unpin catches with operator diagnostics plus user-facing,
  status-aware Vietnamese/English error notifications.

# Follow-up self-review (2026-08-29, message-search error increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Data exposure | Pass | Message-search failures now use the shared logger and never serialize native/server error text into the UI | Full authenticated filter/provider matrix remains pending | Keep transport details in diagnostics only |
| Cancellation | Pass | Existing request-id and abort checks still suppress stale/canceled responses | Backend search index/rebuild evidence remains partial | Preserve the current request boundary |
| Bilingual UI coverage | Pass | Search failure copy is registered in `resources.ts`; locale smoke (710 keys) | Domain message content remains verbatim | Translate product copy, not user content |
| Traceability | Pass | `SearchPage.tsx`, shared error mapper and this self-review entry | Clean-stack authenticated browser proof remains blocked | Reuse the same status-aware mapper for future search actions |

Correction in this increment:

- Replaced the raw `console.error` search path with sanitized operator logging
  and status-aware localized failure copy.

# Follow-up self-review (2026-08-29, mention-menu recovery increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure recovery | Pass for member lookup UI | Mention lookup failures render a retryable alert; an empty list is reserved for a successful query with no matches | Authenticated member-policy/browser proof remains pending | Do not turn a transport failure into an empty success state |
| Async lifecycle | Pass | Existing cancellation guard remains; retry is an explicit new request | Abort signal support depends on the canonical member API contract | Keep late responses from changing a closed menu |
| Bilingual UI coverage | Pass | Retry label and member-load error are registered; locale smoke (711 keys) | Member display names remain domain data | Translate controls and failure copy only |
| Traceability | Pass | `MentionMenu.tsx`, messenger member adapter and this entry | Clean-stack authenticated browser proof remains blocked | Preserve explicit loading/error/empty states |

Correction in this increment:

- Added a retryable, localized error state to the mention member menu so a
  failed member lookup is not presented as a valid empty result.

# Follow-up self-review (2026-08-29, notification-inbox recovery increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure recovery | Pass for notification inbox initialization | Store exposes loading/error state; panel renders a retry action instead of treating a failed load as an empty inbox | Provider delivery and authenticated inbox proof remain pending | Keep empty state reserved for a successful zero-result response |
| State integrity | Pass | Initialization clears stale error before a new request and reset clears it; realtime updates remain independent | Cross-tab reconnect/resync still needs integration evidence | Do not discard existing notification records on a transient read failure |
| Bilingual UI coverage | Pass | Loading/error/retry copy is registered; locale smoke (713 keys) | Server-generated title/body remain domain data | Translate product controls and failure copy only |
| Traceability | Pass | Notification store, sidebar panel, list component and this entry | Clean-stack authenticated browser proof remains blocked | Preserve explicit loading/error/empty states |

Correction in this increment:

- Added explicit notification inbox loading and retryable error states across the
  store and sidebar panel; failed initialization no longer appears as success.

# Follow-up self-review (2026-08-29, profile relationship action increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for profile block/unblock | Profile relationship fetch and block mutations use status-aware localized errors; diagnostics are sanitized to operator logs | Authenticated two-account relationship proof remains pending | Keep transport detail out of the profile dialog |
| Concurrency/state | Pass for local controls | Block and unblock share an explicit pending state; unblock cannot be double-submitted and local state updates after success | Cross-tab relationship reconciliation remains an integration gap | Do not imply completion before the mutation resolves |
| Bilingual UI coverage | Pass | Existing profile action copy plus loading text remain registered; locale smoke (713 keys) | User display data remains domain content | Translate product feedback, not profile data |
| Traceability | Pass | `UserProfileModal.tsx`, friend-store mutation contract and this entry | Clean-stack authenticated browser proof remains blocked | Preserve the caller-visible reject contract |

Correction in this increment:

- Hardened profile relationship actions with status-aware failure copy and a
  shared loading lock for block/unblock, preventing duplicate unblock requests.

# Follow-up self-review (2026-08-29, create-room navigation increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Promise lifecycle | Pass for room creation handoff | Newly created room selection is explicitly observed and reports failures; room creation failures remain inline in the modal | Authenticated create/open browser proof remains pending | No fire-and-forget navigation promise may reject unobserved |
| State integrity | Pass | The canonical room is hoisted only after create succeeds; opening it is a separate, observable step | Cross-tab projection/realtime proof remains pending | Distinguish persisted creation from selected-view loading |
| Bilingual UI coverage | Pass | Create/open failure copy is localized; locale smoke (714 keys) | Room names/descriptions remain user-authored data | Translate product feedback only |
| Traceability | Pass | `CreateRoomModal.tsx`, messenger selection API and this entry | Clean-stack authenticated browser proof remains blocked | Preserve explicit post-create navigation failure handling |

Correction in this increment:

- Added an observed rejection boundary around opening a newly created room and
  replaced raw create-room console output with sanitized diagnostics.

# Follow-up self-review (2026-08-29, send-message result increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Mutation result correctness | Pass for composer and retry | `useMessenger.sendMessage` marks the optimistic message failed and rethrows; composer and retry callers now surface the real failure | Authenticated Cassandra/idempotency browser proof remains pending | Never show “sent” after the HTTP mutation rejects |
| Promise lifecycle | Pass | Message input awaits and catches the rejection; failed-message retry observes its own rejection | Realtime delivery reconciliation still needs clean-stack evidence | Every send entry point owns an explicit catch |
| State integrity | Pass | Failed optimistic rows remain visibly failed and are not silently converted to success | Attachment cleanup after partial provider failure remains a provider gap | Keep the optimistic failure marker until a later explicit retry |
| Traceability | Pass | `useMessenger.ts`, `MessageInput.tsx`, `ChatWindow.tsx` and this entry | Clean-stack authenticated browser proof remains blocked | Preserve the reject-on-failure contract |

Correction in this increment:

- Removed the swallowed send-message rejection that caused a false success toast;
  retry and composer paths now receive and display the canonical failure.

# Follow-up self-review (2026-08-29, pagination feedback increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure feedback | Pass for explicit pagination actions | Loading-more room/message failures now emit status-aware localized notifications and preserve the already loaded data | Cursor retry and authenticated pagination proof remain pending | Never make a failed load appear as a completed page turn |
| Data integrity | Pass | Append/prepend only runs after the canonical request resolves; failed requests do not alter pagination buckets | Cross-device concurrent history updates remain an integration gap | Keep existing history authoritative until the next successful page |
| Promise lifecycle | Pass | Both user-triggered pagination callbacks catch and observe failures | Infinite-scroll provider recovery still needs live-stack proof | Keep every explicit pagination action observable |
| Traceability | Pass | `useMessenger.ts`, `MessageHistory.tsx` and this entry | Clean-stack authenticated browser proof remains blocked | Reuse shared error mapping for future pagination controls |

Correction in this increment:

- Added user-visible failure feedback for loading older conversations/messages and
  sanitized the associated operator diagnostics.

# Follow-up self-review (2026-08-29, account-settings error increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure safety | Pass for profile save/logout | Account settings now use status-aware localized errors and keep local logout cleanup in the `finally` path | Authenticated refresh/session integration proof remains pending | Preserve local session cleanup even when server logout fails |
| Data exposure | Pass | Console logging was replaced with logger calls containing only native error messages | Server-side structured redaction remains an operations task | Never render or serialize response payloads in settings diagnostics |
| State integrity | Pass | Profile updates only update the store after the API resolves; logout always disconnects realtime and clears local auth | Cross-device session revocation remains infrastructure-dependent | Keep server mutation and local cleanup as separate outcomes |
| Traceability | Pass | `UserSettingsModal.tsx`, auth APIs and this entry | Clean-stack authenticated browser proof remains blocked | Preserve explicit settings action ownership |

Correction in this increment:

- Hardened profile-save and logout failure paths with sanitized diagnostics and
  status-aware user copy without changing the safe local logout fallback.

# Follow-up self-review (2026-08-29, client diagnostic redaction increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Data exposure | Pass for active client action logs | Active auth, search, invite, poll, profile, relationship, notification, conversation and message handlers now log only bounded error text rather than arbitrary error objects | Server-side structured logging/redaction still requires operations verification | Keep user content and server payloads out of browser diagnostics |
| User-facing behavior | Pass | Existing localized action errors and retry states are unchanged | Full authenticated failure matrix remains pending | Logging changes must not replace visible product feedback |
| Traceability | Pass | Affected feature owners plus this self-review entry | Legacy duplicate FriendItem remains outside active route scope | Do not expand the redaction change into dead/legacy modules |

Correction in this increment:

- Redacted arbitrary error-object logging across active browser flows while
  retaining the status-aware notifications already exposed to users.

# Follow-up self-review (2026-08-29, boundary diagnostic increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Data exposure | Pass for error boundary/theme/policy diagnostics | Error boundary, theme bootstrap and room notification policy handlers now keep only bounded diagnostic text | Server-side telemetry redaction remains an operations task | Keep arbitrary exception objects out of browser logs |
| User-facing behavior | Pass | Policy load/save continues to render retry/error copy; theme bootstrap remains non-blocking | Full authenticated policy matrix remains pending | Diagnostic hardening must not remove recovery UI |
| Traceability | Pass | `app/error.tsx`, `ThemeProvider.tsx`, `ConversationInfo.tsx` and this entry | Legacy duplicate modules remain outside active scope | Apply the same boundary to future active handlers |

Correction in this increment:

- Replaced remaining raw boundary/policy/theme console logging in active runtime
  paths with the shared logger and bounded error details.

# Follow-up self-review (2026-08-29, notification session race increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Session isolation | Pass for inbox initialization | Generation guard ignores stale notification responses after a newer init or reset; logout reset invalidates all in-flight reads | Multi-tab identity switching still needs live browser proof | Never allow a previous session's read to commit into the current store |
| Async consistency | Pass | Both success and failure paths check the captured generation before committing state | Provider latency/retry behavior remains externally unverified | Keep the newest request authoritative |
| State integrity | Pass | Reset invalidates pending work before clearing realtime/store state | Realtime event ordering across reconnect remains an integration gap | Separate request lifecycle from socket lifecycle |
| Traceability | Pass | `notification.store.ts`, sidebar inbox recovery UI and this entry | Clean-stack authenticated browser proof remains blocked | Preserve the generation boundary in future store reads |

Correction in this increment:

- Added session/request generation isolation to notification initialization so
  stale responses cannot repopulate a newer or logged-out session.

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

# Follow-up self-review (2026-08-29, notification-pagination increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Feature completeness | Pass for inbox pagination UI | `loadMoreNotifications` consumes the canonical page contract; the sidebar exposes an explicit load-more/retry action when `hasNext` is true | Live Cassandra page ordering and provider delivery remain unverified | Do not limit the inbox to the first 50 records when the server advertises another page |
| State integrity | Pass | Page state, deduplication by notification ID, and `loadingMore` lock prevent duplicate or overlapping append requests | Cross-device ordering after realtime inserts still needs integration evidence | Keep the server page result authoritative and preserve realtime records without duplicates |
| Session isolation | Pass | Pagination captures the same generation guard as initialization; reset or a newer init invalidates stale page responses | Identity switching still needs live browser proof | Never append a previous session’s page into the current inbox |
| Failure recovery | Pass | Pagination failures retain loaded notifications and expose localized retry copy instead of an empty/success state | Authenticated provider failure remains unverified | Keep page-load errors separate from initial inbox errors |
| Bilingual and accessibility coverage | Pass | New loading, retry and action labels are registered in `resources.ts`; the control has explicit type, disabled and `aria-busy` states; locale smoke checks 714 static call keys and the pagination resource entries | Full screen-reader audit remains pending | Translate product copy while leaving notification title/body domain data unchanged |
| Traceability | Pass | `notification.store.ts`, `NotificationList.tsx`, `SidebarNotificationPanel.tsx`, `ChatSidebar.tsx`, `FEATURE_INVENTORY.md` | Clean-stack authenticated browser evidence remains pending | Keep the API page contract, store state and UI action wired as one documented path |

Correction in this increment:

- Added guarded inbox pagination with request locking, generation isolation,
  notification-ID deduplication, localized retry feedback and the global unread
  count in the panel header.

# Follow-up self-review (2026-08-29, global-admin request-isolation increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| State integrity | Pass for active admin panels | Room, audit, analytics and report effects ignore late responses after their filter changes; selected user/room detail requests use generation refs and clear prior detail before loading | Authenticated multi-operator concurrency remains unverified | The newest operator selection owns visible state |
| Session and permission safety | Pass for request boundaries | Overview refreshes cannot overwrite a newer request; status-aware error mapping remains server/permission driven | Live permission matrix and session revocation proof remain pending | Do not infer access or keep stale privileged detail visible |
| Failure recovery | Pass for active admin requests | Load and mutation failures use shared status-aware copy; existing loading/empty/error surfaces remain intact | Clean-stack backend outage/retry behavior remains pending | Preserve the last authoritative state until a newer request succeeds |
| Data exposure | Pass | Admin diagnostics log only bounded native error text; response bodies and identifiers are not serialized into browser logs | Server-side structured log redaction remains an operations task | Keep investigation content in the authorized panel, not diagnostics |
| Bilingual coverage | Pass | Existing feedback keys flow through `localizeText`; locale-copy smoke reports 714 static call keys with no missing translations | Full authenticated operator locale walkthrough remains pending | Translate operator feedback, not room/user/message domain data |
| Traceability | Pass | `AdminPage.tsx`, `FEATURE_INVENTORY.md` and this entry; admin route smoke and production build pass | Live Cassandra/Redis/Kafka authorization proof remains blocked | Keep request lifecycle, permission gate and UI state connected |

Correction in this increment:

- Added cleanup and generation guards for global-admin overview, room, audit,
  analytics, report, user, session/device and room-detail requests; replaced
  log-only admin catches with bounded diagnostics and localized status-aware copy.

# Follow-up self-review (2026-08-29, notification-settings-retry increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure recovery | Pass for settings load | `NotificationSettingsPanel` keeps the explicit error state and now exposes a retry action that starts a fresh request | Live provider/authentication failure remains unverified | Never leave a settings panel in a dead-end error state |
| Async lifecycle | Pass | Existing active guard plus `retryToken` prevents late responses from updating an unmounted panel | Cross-tab settings conflict still needs integration evidence | A retry is a new request; stale responses cannot win |
| Data exposure | Pass | Load failures use bounded logger text and shared status-aware user copy; server payloads are not rendered | Server-side structured redaction remains an operations task | Keep transport details out of the settings UI |
| Bilingual and accessibility coverage | Pass | Retry copy is routed through `localizeText`; the retry control has an explicit button type, visible label and alert container | Full screen-reader audit remains pending | Keep recovery control keyboard reachable and localized |
| Traceability | Pass | `NotificationSettingsPanel.tsx`, existing settings smoke and this entry | Authenticated persistence remains pending | Preserve canonical `/notifications/settings` request ownership |

Correction in this increment:

- Added localized, status-aware retry recovery to notification settings loading
  without introducing default or fallback settings data.

# Follow-up self-review (2026-08-29, report-history-retry increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure recovery | Pass for report history | `ReportHistoryPanel` retains the explicit error state and exposes a localized retry action | Live report persistence and moderation queue proof remain pending | Do not show an empty report history after a failed read |
| Async lifecycle | Pass | Existing active guard plus `retryToken` ignores late results after unmount and starts a fresh request on retry | Full authenticated browser proof remains pending | Keep the request owner inside the panel |
| Data exposure | Pass | Shared status-aware mapper and bounded logger keep transport details out of the panel | Server-side structured redaction remains an operations task | Render only stable product copy |
| Bilingual and accessibility coverage | Pass | Retry copy is localized; alert and explicit button type are present | Full screen-reader audit remains pending | Keep the recovery action keyboard reachable |
| Traceability | Pass | `ReportHistoryPanel.tsx`, settings/report screen inventory and this entry | Authenticated service evidence remains pending | Preserve canonical `/reports/mine` ownership |

Correction in this increment:

- Added localized retry recovery and bounded diagnostics to the user report
  history panel, preserving the distinction between empty and failed reads.

# Follow-up self-review (2026-08-29, invite-manager-recovery increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure recovery | Pass for invite data load | `InviteManager` now has an explicit loading state and retryable error state when both invite/request lists are unavailable | Invite concurrency/expiry and live permission proof remain pending | Never present a failed initial invite read as an empty manager |
| Async lifecycle | Pass for manager mount | Per-manager identity token prevents late list responses and retry errors from updating an unmounted or replaced conversation manager | Multi-room navigation browser proof remains pending | Keep the conversation ID as the manager boundary |
| Action state integrity | Pass | Existing busy/pending locks remain; revoke diagnostics no longer serialize the error object | Provider expiry and concurrent revoke proof remain pending | Preserve server-confirmed mutation updates |
| Data exposure | Pass | Initial/retry/revoke logs contain only bounded native error text; user copy uses the shared status mapper | Server-side structured redaction remains an operations task | Keep invite tokens/URLs out of diagnostics |
| Bilingual and accessibility coverage | Pass | Loading, retry and error controls use localized copy with explicit button type and alert/status semantics | Full screen-reader audit remains pending | Keep recovery keyboard reachable |
| Traceability | Pass | `InviteManager.tsx`, `resources.ts`, invite/join screen inventory and this entry | Authenticated invite lifecycle remains pending | Preserve canonical invite API ownership |

Correction in this increment:

- Added loading/retry recovery and per-conversation identity protection to invite
  management, while hardening the remaining revoke diagnostic log.

# Follow-up self-review (2026-08-29, realtime-diagnostic-redaction increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Data exposure | Pass for active realtime/auth diagnostics | WebSocket parse/send/listener paths no longer log message bodies or arbitrary error objects; presence omits server message text; auth logs expose only booleans | Server-side structured redaction and legacy duplicate modules remain outside this increment | Keep user content, tokens, profile data and server payloads out of browser diagnostics |
| Runtime behavior | Pass | Logging-only changes preserve STOMP subscription, publish, reconnect and auth state transitions | Clean-stack realtime authorization remains pending | Diagnostics must not become a control-flow fallback |
| Bilingual/user-facing behavior | Pass | No user-facing copy or API contract changed; existing presence failure notification remains localized | Authenticated realtime failure matrix remains pending | Keep operator diagnostics separate from product copy |
| Traceability | Pass | `websocketService.ts`, `realtime-service.ts`, `PresenceManager.tsx`, `auth.store.ts` and this entry | Live multi-account websocket evidence remains blocked | Apply the same redaction boundary to future transport logs |

Correction in this increment:

- Removed websocket payload/error-object logging from active transport paths and
  replaced presence/auth diagnostic fields with bounded metadata.

# Follow-up self-review (2026-08-29, messenger-diagnostic-redaction increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Data exposure | Pass for active messenger diagnostics | `useMessenger` no longer passes raw errors or message data into logger calls; only bounded native error text is retained | Legacy duplicate `FriendItem` remains outside active canonical route scope | Keep conversation/message payloads out of browser diagnostics |
| Runtime behavior | Pass | Logging-only changes preserve init, selection, pagination, send, pin and realtime subscription control flow | Authenticated realtime/pagination evidence remains pending | Do not use diagnostics as a success/fallback path |
| User-facing behavior | Pass | Existing status-aware errors/toasts and optimistic failure markers are unchanged | Full authenticated failure matrix remains pending | Preserve visible recovery copy for every action |
| Traceability | Pass | `useMessenger.ts` and this entry; frontend validation remains green | Clean-stack Cassandra/Redis/Kafka proof remains blocked | Apply the same boundary to future messenger handlers |

Correction in this increment:

- Replaced remaining raw error-object logging in the active messenger store and
  setup lifecycle with bounded diagnostic strings.

# Follow-up self-review (2026-08-29, contacts-load-recovery increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure recovery | Pass for Contacts loading | Store errors are now surfaced by `ContactListView` with a localized retry action for the active tab | Live multi-user relationship failures remain unverified | A failed friends/request/search read is not presented as a successful empty state |
| State integrity | Pass | Retry delegates to the canonical store action; previously loaded data is not replaced by client fallback data | Cross-tab reconciliation still needs integration evidence | Keep server state authoritative |
| Async lifecycle | Pass | Existing store abort/active guards remain; retry uses a fresh action and does not add parallel client caches | Full unmount/browser proof remains pending | Reuse the existing request boundary |
| Bilingual and accessibility coverage | Pass | Store error mapping and retry label use shared localized copy; alert semantics and explicit button type are present | Full screen-reader audit remains pending | Keep recovery visible and keyboard reachable |
| Traceability | Pass | `useFriendTabsState.ts`, `ContactListView.tsx`, `UI_SCREEN_INVENTORY.md` and this entry | Authenticated service persistence remains pending | Keep tab selection, store request and recovery UI connected |

Correction in this increment:

- Surfaced relationship read failures in the canonical Contacts page and added
  an active-tab retry action, avoiding a false empty-list success state.

# Follow-up self-review (2026-08-29, relationship-search-race increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| State integrity | Pass for search and mutual-friends reads | Store generation counters allow only the newest keyword/target request to commit results or loading/error state | Live network latency and multi-account proof remain pending | Do not let an older response replace the current search/profile context |
| Cancellation semantics | Pass for the actual client contract | Removed local abort controllers that were never passed to the HTTP adapter; stale responses are now rejected at the store boundary | Transport-level cancellation can be added only when the canonical client accepts an AbortSignal | Avoid claiming cancellation when the request cannot be canceled |
| Failure recovery | Pass | Current request errors still use shared status-aware copy; stale failures are ignored | Authenticated relationship failure matrix remains pending | Preserve a real error only for the active request |
| Bilingual/data exposure | Pass | Existing localized error copy remains; no user content or server payload is logged | Full locale/browser relationship walkthrough remains pending | Translate product feedback, not search result data |
| Traceability | Pass | `friend.store.ts`, Contacts retry path and this entry | Clean-stack friendship persistence remains pending | Keep read request ownership in the store |

Correction in this increment:

- Replaced ineffective local abort-controller bookkeeping with explicit
  search/mutual request-generation guards at the canonical relationship store.

# Follow-up self-review (2026-08-29, WebRTC session-boundary increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Session integrity | Pass for client lifecycle boundaries | `useWebRtcCall` rejects late media, SDP, ICE and peer callbacks when the call ID or peer connection is no longer current | Two-browser media and reconnect behavior still need live approved STUN/TURN evidence | A closed call or changed room must not be resurrected by a late async result |
| Resource cleanup | Pass for late media acquisition | Streams acquired after hang-up or room change are stopped immediately instead of being attached to a new session | Browser permission cancellation and device-loss matrix remains unverified | Keep media tracks owned by the session that requested them |
| Signalling safety | Pass for stale callback suppression | ICE/SDP publishes and connection-state updates require both the active call ID and active `RTCPeerConnection` | Authenticated STOMP authorization and cross-device signaling remain pending | Do not publish signaling from a closed or replaced peer |
| Failure recovery | Pass for active session | `failSession` ignores errors from replaced calls while preserving the existing localized error state for the active call | Live media failure/retry proof remains pending | Keep failure state authoritative only for the session that encountered it |
| Traceability | Pass | `features/calls/hooks/useWebRtcCall.ts` and this entry; frontend validate/build/browser gates pass | Clean-stack two-browser call evidence remains blocked | Preserve the session identity boundary in future call changes |

Correction in this increment:

- Added call-ID and peer-identity guards around media acquisition, WebRTC
  callbacks and asynchronous SDP/ICE handling so late results cannot revive a
  closed call or leak signaling into a replacement room session.

# Follow-up self-review (2026-08-29, profile-relationship recovery increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Session integrity | Pass for profile relationship reads | `UserProfileModal` uses a request identity and ignores late success, failure and finalization from replaced user profiles | Authenticated multi-account relationship proof remains pending | A previous profile must not change the current profile's block or friend state |
| Failure recovery | Pass for relationship status | Failed relationship reads keep actions hidden and show localized inline retry instead of assuming an unblocked user | Live API failure/status matrix remains pending | Unknown relationship state is not treated as permission to mutate |
| Data freshness | Pass for mutual-friend display | Mutual results are scoped by target user and cleared when a fresh request starts; stale target data is not displayed | Cross-tab store reconciliation remains pending | Do not show another user's mutual-friend list during profile navigation |
| Bilingual and accessibility coverage | Pass for new recovery UI | Existing `localizeText` retry copy, alert semantics and keyboard-reachable button are used | Full screen-reader walkthrough remains pending | Keep recovery feedback short, localized and actionable |
| Traceability | Pass | `UserProfileModal.tsx`, `friend.store.ts` and this entry; validate/build/browser gates pass | Authenticated profile browser evidence remains blocked | Preserve the request boundary for future profile actions |

Correction in this increment:

- Added stale-request protection and explicit localized recovery for profile
  relationship reads, and scoped/cleared mutual-friend data so navigation cannot
  display or act on a previous profile's relationship state.

# Follow-up self-review (2026-08-29, message-search invalidation increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Search state integrity | Pass for filter transitions | `SearchPage` advances its request generation before every eligibility/validation branch, not only before a network call | Live Elasticsearch latency and index consistency remain unverified | Any filter or scope change invalidates the prior response immediately |
| Cancellation semantics | Pass for current client contract | Abort remains best-effort while generation checks own result commits even when a transport ignores abort | Transport adapter cancellation coverage remains limited to its current `AbortSignal` contract | Do not claim cancellation; reject stale results at the page boundary |
| Validation recovery | Pass | Invalid UUID/date/scope states cannot be overwritten by a previous successful search response | Full authenticated filter matrix remains pending | Keep validation state authoritative until the user supplies a valid filter |
| Bilingual and accessibility coverage | Pass | Existing localized validation/error copy and labeled controls are unchanged; no fallback result is introduced | Full screen-reader search walkthrough remains pending | Preserve explicit validation feedback and canonical filter labels |
| Traceability | Pass | `SearchPage.tsx` and this entry; validate/build/browser gates pass | Live authorized Elasticsearch search evidence remains blocked | Keep search result ownership with the newest page generation |

Correction in this increment:

- Advanced message-search request generation at the start of every filter
  effect, preventing late network responses from repopulating results after a
  scope change or validation failure.

# Follow-up self-review (2026-08-29, conversation-info recovery increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Room state integrity | Pass for policy reads | `ConversationInfo` request generation scopes notification policy responses to the current conversation | Live multi-room navigation and Cassandra policy persistence remain pending | A previous room cannot overwrite the current room's policy controls |
| Permission safety | Pass for block actions | Block/unblock actions render only after a confirmed block-status response; failed checks show retry instead of a default mutation action | Live authorization matrix remains pending | Unknown relationship state is not treated as unblocked |
| Mutation lifecycle | Pass for policy save UI | Policy save checks mutation identity and conversation ID before applying local state or error feedback | Cross-device concurrent policy edits remain unverified | Keep visible state owned by the room and mutation that initiated it |
| Failure recovery | Pass | Block and notification policy reads expose localized retry controls and clear stale state on room changes | Dependency outage/retry behavior needs clean-stack evidence | Preserve an explicit error rather than silently falling back to defaults |
| Bilingual and accessibility coverage | Pass for affected controls | Existing localized labels, alert semantics, button type and keyboard-reachable retry controls remain in place | Full screen-reader and authenticated browser walkthrough remains pending | Keep room controls concise and actionable in both locales |
| Traceability | Pass | `ConversationInfo.tsx` and this entry; validate/build/browser gates pass | Live room-policy/block persistence remains blocked | Preserve request and mutation boundaries in future panel actions |

Correction in this increment:

- Added room-scoped request/mutation guards, explicit block-status recovery and
  stale-state clearing to conversation info, preventing incorrect room policy
  or block actions during navigation and failed reads.

# Follow-up self-review (2026-08-29, device-identity isolation increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Account isolation | Pass for browser device identity | `DeviceLifecycleManager` derives storage and lifecycle ownership from the authenticated `userId`, not a global browser key or boolean auth flag | Live multi-account device registration/revocation remains pending | An account cannot heartbeat a device ID persisted for another account |
| Session lifecycle | Pass | Identity changes restart registration/heartbeat and cleanup the previous interval | Refresh-token/device linkage needs clean-stack evidence | Keep device lifecycle tied to the current authenticated principal |
| Data exposure | Pass | Only validated UUID device IDs are read/written; no token or payload is persisted | Server-side device audit remains an operations gate | Use account-namespaced storage without a legacy-key fallback |
| Failure recovery | Pass | Registration/heartbeat failures remain bounded diagnostics and do not fabricate device state | Provider/network retry matrix remains unverified | Do not mark a device active until the canonical API succeeds |
| Traceability | Pass | `DeviceLifecycleManager.tsx`, `API_CONTRACTS.md`, `TRACEABILITY_MATRIX.md` and this entry; validate/build/browser gates pass | Authenticated device browser proof remains blocked | Preserve user-scoped storage when adding mobile clients |

Correction in this increment:

- Replaced the shared browser device key with an account-namespaced canonical
  key and keyed the lifecycle effect by authenticated user identity, removing
  cross-account heartbeat risk without retaining a legacy fallback.

# Follow-up self-review (2026-08-29, notification-save lifecycle increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Component lifecycle | Pass | `NotificationSettingsPanel` invalidates save requests on unmount and ignores late success/error state | Full tab-switch browser proof remains pending | A save cannot update or notify a panel that is no longer mounted |
| Mutation integrity | Pass | A request identity prevents an older save from winning a later save | Cross-device concurrent edits remain unverified | Keep the newest local mutation authoritative |
| Data exposure | Pass | Save diagnostics contain only bounded native error text; server payloads are not rendered | Server-side structured redaction remains an operations task | Keep transport details out of user-facing settings |
| Failure recovery | Pass | Active save failures keep the existing draft and show localized retry guidance | Provider retry behavior remains pending | Do not replace a failed draft with guessed/default settings |
| Bilingual and accessibility coverage | Pass | Existing localized success/error copy and disabled/loading button semantics remain unchanged | Full screen-reader settings walkthrough remains pending | Preserve keyboard-reachable save feedback |
| Traceability | Pass | `NotificationSettingsPanel.tsx` and this entry; validate/build/browser gates pass | Authenticated persistence remains blocked | Keep save ownership inside the mounted panel |

Correction in this increment:

- Added mounted/request identity guards to notification settings saves and
  bounded diagnostics, preventing late saves from mutating or notifying an
  unmounted settings panel.

# Follow-up self-review (2026-08-29, report-submit lifecycle increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Target integrity | Pass for user/message report submits | Report modals bind submit completion and error state to the submitted target identity | Authenticated moderation persistence remains pending | A late response cannot close or update a different selected target |
| Component lifecycle | Pass | Mounted refs invalidate pending submits on unmount; target-change effects invalidate the previous request | Full modal navigation browser proof remains pending | Do not update an unmounted modal or surface a stale toast |
| Failure recovery | Pass | Active failures retain localized inline error copy and leave the form available for retry | Provider retry/status matrix remains unverified | Keep the report draft intact after a failed POST |
| Data exposure | Pass | Only user-facing status copy is rendered; report payload details remain out of diagnostics | Server-side moderation audit redaction remains an operations task | Preserve the existing privacy boundary |
| Bilingual and accessibility coverage | Pass | Existing localized labels, alert semantics, disabled states and focus trap remain unchanged | Full screen-reader modal walkthrough remains pending | Keep report recovery keyboard reachable and concise |
| Traceability | Pass | `ReportUserModal.tsx`, `ReportMessageModal.tsx` and this entry; validate/build/browser gates pass | Live moderation queue/appeal evidence remains blocked | Preserve target identity when extending report workflows |

Correction in this increment:

- Added target-identity and mounted-state guards to report submissions so late
  responses cannot mutate or close a replaced user/message report modal.

# Follow-up self-review (2026-08-29, pending-outbox-projection increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Delivery correctness | Pass for pending selection | `outbox_pending_events_by_partition` is queried directly; published rows are not filtered after a Cassandra `LIMIT` | Kafka outage/retry, DLQ and consumer integration remain unverified | Keep a pending-only query projection instead of scanning/filtering the immutable table |
| Write consistency | Pass for projection lifecycle | Main and pending rows are inserted in one logged batch; acknowledgement updates the main row and removes pending atomically | Cassandra clean-stack consistency and repair drill remain pending | Do not expose an event as fully published before Kafka acknowledgement |
| Retry semantics | Pass for publisher bookkeeping | Failed attempts update both projections; successful attempts increment metadata and delete only the pending index row | Maximum retry/DLQ policy and operational metrics remain incomplete | Preserve retryable pending state without duplicating authoritative event storage |
| Schema/contract consistency | Pass | `chat_app_complete.cql`, additive migration, `CanonicalCqlStore`, infrastructure manifest test and docs all name the pending projection | Migration application on an existing cluster remains unverified | Require the additive migration before enabling the publisher |
| Traceability | Pass | `CassandraOutboxPublisher`, `CanonicalCqlStore`, `InfrastructureManifestTest`, `DATA_MODEL.md`, backend architecture docs and this entry | Kafka consumer/replay trace remains partial | Keep event durability and downstream projection ownership explicit |

Correction in this increment:

- Replaced Java-side post-`LIMIT` unpublished filtering with a canonical pending
  Cassandra projection and atomic lifecycle batches, eliminating outbox event
  starvation while preserving the immutable event record.

# Follow-up self-review (2026-08-29, outbox contract-test baseline increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Test traceability | Pass for current backend suite | `InfrastructureManifestTest` now asserts pending projection wiring; JDK 20 Maven run reports 96 tests, 0 failures, 0 errors | Clean Cassandra/Kafka integration remains unavailable | Keep the current test count synchronized with the verified report |
| Schema consistency | Pass | Canonical schema count is 79 tables and includes the additive pending-outbox migration | Applying the migration on an existing cluster remains unverified | Require the migration before enabling the publisher against an existing keyspace |
| Documentation consistency | Pass | `tasks/plan.md`, `tasks/todo.md`, `tasks/function-audit.md`, `AGENT_WORK_PLAN.md` and `TESTING.md` record the current 96-test evidence; historical entries remain unchanged | None for this increment | Separate historical self-review measurements from current baseline evidence |

Correction in this increment:

- Added a regression contract assertion for the pending-outbox projection and
  synchronized current test-count documentation to the verified 96-test run.

# Follow-up self-review (2026-08-29, canonical message-search filters increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| API contract | Pass for the implemented filter path | `MessageSearchFilters` and `searchMessages` map attachment and pin predicates to the backend `MessageSearchRequest`; message-type options keep stable API enum values even when their labels are translated; the page requires a valid conversation UUID because the service authorizes one conversation at a time | Live Elasticsearch query and authorization proof remain pending | Do not send unsupported global message-search requests or invent a client fallback |
| Filter completeness | Pass for the current backend matrix | `/search` now exposes sender, reply sender, mention, message type, date range, attachment presence, and pin status | Room search and index rebuild workflow remain unimplemented | Keep the UI limited to fields represented by the canonical backend contract |
| State and recovery | Pass | Missing conversation context is shown as a disabled-search state; invalid UUID/date input remains localized and stale requests are invalidated before every branch | Authenticated browser coverage with real conversation data remains blocked | Preserve local navigation results while preventing unauthorized message requests |
| Bilingual and accessibility coverage | Pass | New labels/options are in the localized copy registry; native labeled selects use keyboard-reachable controls and `test:e2e:search` verifies EN labels/options; locale smoke covers the new keys | Full authenticated screen-reader walkthrough remains pending | Translate product copy only; keep enum/API values stable |
| Traceability | Pass | `SearchPage.tsx`, messenger API/copy registries, `resources.ts`, feature/function/UI inventories and this entry are synchronized | Live provider/index evidence remains partial | Keep the conversation requirement explicit in UI and documentation |

Correction in this increment:

- Added attachment-presence and pin-status controls to the canonical message
  search UI and request mapper, while making the backend's required conversation
  authorization boundary explicit for every message-search scope. Normalized
  message-type options to stable value/label pairs so locale changes cannot
  alter the request enum.
- Added `search-filter-smoke.mjs` to keep those payload, locale, and missing-
  conversation guarantees executable in the browser gate.

# Follow-up self-review (2026-08-29, contacts locale and realtime startup increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Startup availability | Pass for REST-backed Contacts | `useMessenger` no longer awaits an unbounded realtime connection before releasing the initial loading state; `contacts-locale-smoke.mjs` renders the Contacts screen with the realtime transport unavailable | A real STOMP reconnect/resync journey still needs the integration stack | Keep realtime optional for first paint while retaining queued subscriptions and server authority |
| Bilingual UI coverage | Pass for Contacts labels | `FRIEND_COPY` and `PROFILE_COPY` now use dynamic localized proxies; Contacts tab labels are created during render; the browser smoke verifies VI and EN tabs/empty-state copy | Full authenticated Contacts mutation journey remains pending | Do not capture locale-dependent labels in module-level constants |
| Failure/recovery | Pass for the affected boundary | REST initialization can complete when SockJS is unavailable; realtime failures are reported separately in the smoke rather than converted into fake data | Reconnect notification UX and cross-instance delivery remain pending | Never block the screen or fabricate conversation/friend data for an optional transport |
| Traceability | Pass | `useMessenger.ts`, relationship/profile copy registries, `ContactListHeader.tsx`, `contacts-locale-smoke.mjs`, package scripts and this entry are synchronized | Clean-stack browser proof remains external | Keep the realtime startup rule documented with the test boundary |

Correction in this increment:

- Made Contacts/Profile copy locale-reactive and moved Contacts tabs into the
  render path; changed initial Messenger startup so a missing realtime server
  cannot leave REST-backed screens in an infinite loading state.

# Follow-up self-review (2026-08-29, shared shell and profile locale increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Bilingual navigation | Pass for authenticated shell | `AppShellHeader` localizes each nav label at render time; Contacts smoke asserts all five shell destinations in VI and EN | Full authenticated screen-reader walkthrough remains pending | Never capture locale-dependent navigation labels in module scope |
| Bilingual profile actions | Pass for profile quick links | `ProfileQuickLinks`, `ProfileIdentityCard`, and `ProfileAccessNote` use canonical `localizeText` keys; `profile-locale-smoke.mjs` verifies title and four destinations in both locales | Live profile persistence remains pending with the integration stack | Keep link targets canonical and copy translation explicit |
| Copy quality | Pass for affected copy | Replaced the misleading profile kicker with `Tùy chỉnh hồ sơ` / `Profile customization`; added exact resource keys; copy gate now checks 768 keys | Broader authenticated copy still needs a real-user walkthrough | Prefer concise labels that describe the action or setting accurately |
| Failure recovery | Pass | Profile smoke reports zero console errors and request failures with bounded HTTP fixtures | Real auth/device persistence remains blocked | Test locale behavior independently from unavailable provider infrastructure |
| Traceability | Pass | `AppShellHeader.tsx`, profile components, `resources.ts`, `contacts-locale-smoke.mjs`, `profile-locale-smoke.mjs`, package scripts and this entry are synchronized | Clean-stack browser proof remains external | Keep every new locale assertion executable in CI |

Correction in this increment:

- Removed the remaining locale-frozen shell/profile labels from rendered UI,
  localized the profile access note, corrected its wording, and added browser
  evidence for both shared navigation and profile quick links.

# Follow-up self-review (2026-08-29, admin feedback and public shell locale increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Admin feedback copy | Pass for current controls | Admin validation, success, and error fallbacks now pass through canonical localization; copy smoke covers the admin route and reports 768 keys with no missing translations | Full operator mutation journey still needs live authorization and persistence | Never render a Vietnamese feedback literal directly from an admin action |
| Public navigation | Pass | Public header nav and sign-in/register actions localize at render time; locale smoke asserts Home/About/Help plus both auth actions in EN | Authenticated public-to-app journey remains pending | Keep navigation destinations fixed while translating only presentation copy |
| Message preview copy | Pass for covered media states | Empty previews are read at call time and audio/video/sticker summaries use explicit localized keys | Live multi-message preview/realtime evidence remains blocked | Do not cache locale-dependent preview text at module load |
| Failure and security boundary | Pass | Admin error fallbacks still use `getUserFacingErrorMessage`; no raw server/native error is rendered | Clean-stack audit/moderation evidence remains external | Keep transport diagnostics operator-only and feedback bounded |
| Traceability | Pass | `AdminPage.tsx`, `PublicShellHeader.tsx`, `ChatWindow` call reason, `conversation-preview.ts`, `resources.ts`, locale smoke and this entry are synchronized | Full authenticated accessibility walkthrough remains pending | Keep locale regressions executable in the browser gate |

Correction in this increment:

- Localized every global-admin feedback path and extended the copy contract to
  include AdminPage; fixed public shell actions/nav and locale-dependent media
  previews, including the previously cached empty preview.

# Follow-up self-review (2026-08-29, responsive public navigation increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Mobile navigation reachability | Pass | Public header exposes an explicit open/close menu at mobile widths with Home, About, Help, Sign in, and Create account links | Authenticated mobile shell still needs a seeded realtime browser walkthrough | Keep every public destination reachable without relying on hidden desktop navigation |
| Accessibility | Pass | Menu control has native button semantics, `aria-expanded`, `aria-controls`, localized accessible names, and keyboard-reachable links | Full automated screen-reader tree remains pending | Treat the menu state as an explicit interactive state, not a CSS-only reveal |
| Locale behavior | Pass | Locale smoke opens the menu at 390px and asserts all five English labels after VI→EN persistence | Vietnamese mobile mutation journey remains bounded to the same route fixture | Resolve labels at render time so locale changes never freeze menu copy |
| Responsive quality | Pass | UI-quality smoke remains clean at 320px and 1440px; mobile menu does not introduce overflow | Authenticated responsive workspace evidence remains pending | Preserve compact header actions while keeping the full public route set available |
| Traceability | Pass | `PublicShellHeader.tsx`, `locale-smoke.mjs`, `resources.ts`, `TESTING.md`, function audit and this entry are synchronized | Clean-stack integration remains blocked by unavailable providers | Keep the responsive navigation contract executable in CI |

Correction in this increment:

- Added the missing mobile public navigation state and verified its localized
  links and accessibility attributes at a real 390px browser viewport.

# Follow-up self-review (2026-08-29, presence status control increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Online feature reachability | Pass for the current own-status control | `StatusSelector` is now rendered in `SidebarFooter`, exposing Online, Do not disturb, and Invisible choices through the existing presence service | Redis/STOMP two-instance and multi-device presence proof remains pending | Keep status writes on the canonical presence WebSocket command; do not simulate success in the UI |
| Locale behavior | Pass | Status trigger, loading state, menu title, option labels, and descriptions resolve through `localizeText`; presence smoke verifies VI and EN menus | Full authenticated locale walkthrough with live presence remains pending | Consume locale context in the control so labels cannot freeze between renders |
| Accessibility | Pass | Native Radix dropdown trigger/menu semantics, keyboard-reachable options, disabled state during mutation, and localized names are retained | Screen-reader tree and focus-return audit remain pending | Preserve the existing dropdown primitive and explicit status descriptions |
| Failure recovery | Pass for client boundary | Optimistic state remains governed by the existing request timeout/rollback path; smoke records unavailable realtime separately and never stubs a successful status write | Live rollback/error event from the server remains external | Keep transport failure visible through the established bounded rollback path |
| Traceability | Pass | `StatusSelector.tsx`, `SidebarFooter.tsx`, `presence-status-smoke.mjs`, package scripts, testing docs, function audit and this entry are synchronized | Clean-stack presence integration remains blocked | Keep the online feature in the authenticated shell rather than a disconnected placeholder |

Correction in this increment:

- Connected the existing canonical presence status selector to the workspace
  footer and added executable bilingual browser coverage for all three status
  options without introducing mock runtime data.

# Follow-up self-review (2026-08-29, contacts presence tracking increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contact status accuracy | Pass for rendered contact lists | `ContactListView` now tracks the currently visible friend, request, or search-result IDs; `ContactRow` consumes the canonical presence store for its status dot and label | Live STOMP presence snapshots and reconnect behavior remain pending | Do not show an online indicator without subscribing to the user IDs currently on screen |
| Scope and cleanup | Pass | Tracking is derived from the active tab and filtered list, excludes the signed-in account, and is cleaned up by `useTrackPresence` when the view changes or unmounts | Large-directory pagination still needs provider-backed load testing | Keep subscriptions bounded to visible contact rows rather than the entire directory |
| Locale and accessibility | Pass | Existing `ContactRow` status labels and `StatusDot` accessible names remain canonical and locale-reactive through the app provider; Contacts smoke remains clean in VI and EN | Full screen-reader presence announcement audit remains pending | Preserve the visual dot plus text label and do not expose raw transport statuses |
| Traceability | Pass | `ContactListView.tsx`, `useTrackPresence`, `ContactRow.tsx`, Contacts browser smoke, and this entry are synchronized | Clean-stack presence proof remains external | Keep online status behavior shared with room and sidebar subscriptions |

Correction in this increment:

- Wired the Contacts view to track only the users rendered in the active tab,
  so friend/request/search rows receive real presence updates instead of
  defaulting to an offline state when no room conversation is open.

# Follow-up self-review (2026-08-29, unused relationship component cleanup)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Runtime reachability | Pass | Repository-wide import search found no active reference to `components/friend/FriendList`, `FriendItem`, or their barrel; canonical Contacts routes use `ContactListView` and `ContactRow` | No compatibility renderer is retained for the removed duplicate | Keep one canonical Contacts implementation and do not restore legacy aliases |
| Dead-code discipline | Pass | Removed exactly the three unreferenced duplicate files; no data, API, or runtime fallback was changed | Broader static dependency graph review remains part of release engineering | Delete only files proven unreferenced by the current source tree |
| Regression safety | Pass | Frontend type-check/lint and `test:e2e:contacts` pass after removal; active presence tracking remains in `ContactListView` | Full clean-stack Contacts mutation journey remains pending | Treat the canonical Contacts route as the sole supported UI surface |
| Traceability | Pass | `ContactListView.tsx`, Contacts smoke, function inventory and this entry describe the remaining path | Historical review notes mention the former duplicate as a prior gap | Preserve historical notes while recording the later cleanup explicitly |

Correction in this increment:

- Removed the unreferenced `FriendList`, `FriendItem`, and barrel files so the
  shipped source tree no longer carries a duplicate relationship UI or legacy
  compatibility surface.

# Follow-up self-review (2026-08-29, Kafka listener recovery increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Failure handling | Pass for configured Kafka listeners | `KafkaConsumerConfig` supplies a `DefaultErrorHandler` with three bounded retries and a `DeadLetterPublishingRecoverer` targeting the configured DLT while preserving the source partition | Clean Kafka broker proof and operational alerting remain unavailable on this host | Never acknowledge a failed record as successful; route only after bounded retry exhaustion |
| Scope | Pass | Configuration is conditional on the canonical Kafka integration flag and applies to the existing domain-event listener without changing event payloads or source contracts | Consumer idempotency ledger and replay command are still pending | Keep DLT recovery orthogonal to canonical event schema and Elasticsearch projection behavior |
| Regression safety | Pass | Java 20 Maven suite reports 97 tests, 0 failures, 0 errors; `KafkaTopicConfigTest` verifies the recovery bean type and existing topic sizing guards remain green | Testcontainers Kafka/Cassandra/Elasticsearch flow remains blocked by unavailable Docker | Treat the unit test as configuration evidence only, not broker delivery proof |
| Traceability | Pass | `KafkaConsumerConfig.java`, `KafkaTopicConfigTest.java`, outbox checklist/audit and this entry are synchronized | DLT replay and consumer metrics remain planned | Keep the remaining outbox items explicitly partial rather than claiming end-to-end completion |

Correction in this increment:

- Added bounded retry and DLT recovery for Kafka listener failures, with the
  original partition preserved for operator replay once that workflow is built.

# Follow-up self-review (2026-08-29, presence copy normalization increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Vietnamese copy accuracy | Pass | Presence status labels now use the single canonical `Ngoại tuyến` phrase across messenger copy, ContactRow, and StatusDot | Broader copy review still depends on the static registry gate | Prefer one exact Vietnamese phrase rather than preserving typo aliases |
| Translation hygiene | Pass | Removed the unused `Ngoài tuyến` English entry; `test:i18n:copy` reports 764 checked keys with no missing translations | Historical self-review counts intentionally remain unchanged | Do not retain translation keys solely for deleted or corrected literals |
| Regression safety | Pass | `test:i18n:copy`, `test:errors:copy`, and `npm run validate` pass after normalization | Browser locale smoke after the new build remains the release check | Keep enum/API values unchanged while correcting presentation copy |
| Traceability | Pass | `messengerCopy.ts`, `resources.ts`, locale gate, function audit and this entry are synchronized | None for this copy correction | Keep the copy count tied to the current source tree |

Correction in this increment:

- Replaced the typo-only `Ngoài tuyến` key with the canonical `Ngoại tuyến`
  wording and removed its now-unreferenced translation entry.

# Follow-up self-review (2026-08-29, unused canonical DTO contract cleanup)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contract truthfulness | Pass | Repository-wide search found `ConversationSearchRequest`, `ConversationUpdateRequest`, `FriendshipView`, and `CallRequest` only in their declarations; no controller, service, frontend client, OpenAPI path, or test consumed them | Authorized room/community discovery search, conversation updates, friendship views, and call initiation remain explicit gaps where no live endpoint exists | Do not publish request/view types for operations that do not exist |
| Legacy/dead-code discipline | Pass | Removed the four unreferenced records without changing any live route, schema, adapter, or compatibility path | No legacy room-search, friendship-view, conversation-update, or call behavior is restored | Keep the canonical API surface limited to implemented operations |
| Regression safety | Pass | Java 20 Maven suite remains green at 98 tests, 0 failures, 0 errors | Clean-stack route and search integration remain pending | Treat compilation and contract tests as the boundary for this cleanup |
| Traceability | Pass | `CanonicalApiContracts.java`, room-search audit row, and this entry now agree that discovery search is not implemented | Implementation requires a separately specified authorized index/projection | Record the missing feature instead of leaving a misleading dead DTO |

Correction in this increment:

- Removed the unused `ConversationSearchRequest`, `ConversationUpdateRequest`,
  `FriendshipView`, and `CallRequest` DTOs so the backend no longer advertises
  unimplemented operations or compatibility surfaces.

# Follow-up self-review (2026-08-29, notification pagination contract increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contract truthfulness | Pass | Notification list/type endpoints, frontend client, and OpenAPI now use the canonical `page` + `limit` query names | Other historical endpoints still require the broader parameter audit | Keep one documented query contract per endpoint; do not accept an undocumented alias |
| Pagination correctness | Pass | `CanonicalNotificationController.byType` filters the bounded notification set, applies the requested page offset, returns only the requested limit, and computes `hasNext` from the filtered result | Cassandra pagination across more than the latest 12 monthly partitions remains an infrastructure/query limitation | Apply pagination after filtering so page 1 cannot repeat page 0 |
| Regression safety | Pass | Java 20 Maven suite reports 98 tests, 0 failures, 0 errors; controller regression test proves type filtering precedes page slicing | Clean-stack notification persistence/provider delivery remains pending | Keep the controller test next to the canonical endpoint |
| Traceability | Pass | `CanonicalNotificationController`, `notifications.api.ts`, OpenAPI, function audit, and this entry agree on the contract | Full authenticated browser pagination journey remains pending | Keep client argument names aligned with the wire contract |

Correction in this increment:

- Replaced the undocumented notification `size` query with canonical `limit`
  in backend and frontend clients, documented `page` for type filtering, and
  fixed the endpoint to honor requested pagination and `hasNext`.

# Follow-up self-review (2026-08-29, friendship list contract cleanup)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contract truthfulness | Pass | Friends request/status/mutual controllers and frontend adapters now use the documented bounded `limit` query; ignored `page` parameters were removed | Friendship responses still intentionally return bounded lists without cursor metadata | Do not expose pagination controls that the service cannot honor |
| Legacy/compatibility discipline | Pass | No `size` alias or ignored page argument remains in the canonical Friends client/controller surface | Existing external callers must migrate to the canonical contract | Keep one exact query name and avoid compatibility shims |
| Regression safety | Pass | Frontend validation and the existing Contacts browser smoke remain green after the client query rename; backend source compiles in the 98-test suite | Live two-account request/accept/list proof remains blocked by infrastructure | Keep the bounded service limit authoritative |
| Traceability | Pass | `CanonicalFriendController`, `friends.api.ts`, OpenAPI, function audit, and this entry agree on supported list parameters | Full friendship cursor contract requires a separately specified response shape | Record unsupported pagination rather than faking `hasNext` |

Correction in this increment:

- Removed ignored Friends `page` parameters and undocumented `size` client
  queries; all canonical Friends list routes now use the bounded `limit` input.

# Follow-up self-review (2026-08-29, bounded query documentation increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| OpenAPI accuracy | Pass | `GET /conversations/{conversationId}/members` and `GET /admin/conversations/{conversationId}` now document the backend-supported bounded `limit` parameter | A complete generated-schema comparison remains part of release engineering | Keep the OpenAPI surface synchronized with implemented request parameters |
| Scope discipline | Pass | Documentation-only update; no new endpoint, alias, or runtime fallback was introduced | None for these two routes | Do not invent undocumented query behavior |
| Regression safety | Pass | Existing Java 20 suite (98 tests) and frontend validation remain the verification baseline | Clean-stack contract validation remains blocked by unavailable Docker | Preserve the canonical docs gate with each route change |

Correction in this increment:

- Added the missing `limit` parameter references for room-member and global
  admin room-detail reads in the canonical OpenAPI document.

# Follow-up self-review (2026-08-29, conversation list cursor pagination)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Runtime truthfulness | Pass | Backend `GET /conversations` returns an opaque-cursor `ConversationPage`; frontend consumes `content/nextCursor/hasNext` and exposes a bounded load-more action | Live Cassandra paging behavior remains pending | Keep cursor state server-owned and never synthesize offsets |
| Dead-code discipline | Pass | Conversation pagination now uses the canonical cursor contract and a single sidebar load-more action; no offset or fake page state is retained | No compatibility wrapper is kept for the old array response | Keep one authoritative cursor path |
| Failure safety | Pass | Initial room load still uses the existing HTTP error boundary and loading state; no empty-list fallback was introduced | Live Cassandra projection and large-room performance proof remain pending | Keep provider failures visible rather than presenting a false second page |
| Regression safety | Pass | Next production build, type-check, lint, public/deep-link smoke, Contacts locale smoke, and responsive UI smoke pass after cleanup | Authenticated multi-account room loading remains blocked by infrastructure | Preserve build/browser gates for the canonical shell |
| Traceability | Pass | `messenger.api.ts`, `useMessenger`, conversation slice/types, Sidebar components, OpenAPI, and this entry are synchronized with `ConversationPage` | Live Cassandra cursor ordering and large-room browser proof remain pending | Keep the cursor opaque and reject malformed values |

Correction in this increment:

- Replaced the bounded array-only conversation response with a canonical opaque
  cursor page and wired the sidebar load-more action to that contract.

# Follow-up self-review (2026-08-29, message-search cursor contract increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contract truthfulness | Pass | `MessageSearchService` now returns a dedicated `SearchResult` DTO and only `content` plus `nextCursor`; the frontend derives `hasNext` from the cursor instead of reading a non-existent response field | Live Elasticsearch serialization and index consistency remain pending | Keep transport documents out of the public HTTP contract and preserve opaque cursors |
| Pagination correctness | Pass | `SearchPage` resets cursor state on every filter/validation transition and sends the current cursor unchanged for the explicit load-more action; the search smoke verifies the second request | Authenticated multi-page search with real index data remains blocked | Do not add offset/page controls to a cursor-only endpoint |
| Bilingual and recovery coverage | Pass | Load-more/loading/error copy is registered in the shared Vietnamese/English map; failures preserve existing results and show a localized retryable error | Full screen-reader and provider-outage walkthrough remains pending | Keep user content verbatim while translating product feedback |
| Regression safety | Pass | Java 20 Maven suite, frontend validation/build, i18n/error-copy gates, and search browser smoke pass with zero console/request failures | Clean-stack Elasticsearch and authenticated browser proof remain pending | Treat mock browser coverage as contract evidence, not provider proof |
| Traceability | Pass | `MessageSearchService`, `messenger.api.ts`, `SearchPage.tsx`, OpenAPI, API contract notes, function audit, smoke script, and this entry are synchronized | Room discovery search and index rebuild workflow remain unimplemented | Record those capabilities as explicit gaps rather than exposing guessed controls |

Correction in this increment:

- Aligned search response typing and OpenAPI with the actual backend DTO,
  removed the unused sender-name compatibility fields, and added cursor-based
  result traversal with localized loading and error states.

# Follow-up self-review (2026-08-29, profile contract cleanup increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contract truthfulness | Pass | The canonical `UpdateProfileRequest` supports only `displayName` and `avatarUrl`; Settings no longer renders or stores an ignored nickname field | Live profile persistence remains blocked by unavailable Cassandra/auth stack | Do not expose a control for data the backend cannot persist |
| State integrity | Pass | Profile change detection and save payload now compare exactly the two writable fields returned by `/users/me` | Cross-account update and refresh verification remain pending | Keep client state shaped by the canonical user response |
| Bilingual copy | Pass | Profile description and panel copy now state only the supported fields and have exact English entries; i18n gate reports 766 checked keys with none missing | Full authenticated locale walkthrough remains pending | Remove obsolete nickname copy instead of retaining compatibility text |
| Regression safety | Pass | Frontend type-check/lint and profile locale smoke remain the release evidence for this UI slice | Clean-stack profile mutation proof remains external | Keep mutation behavior bounded to the documented PATCH contract |
| Traceability | Pass | `users.api.ts`, auth/user types, Settings modal/panel, UI copy, resources, and this entry are synchronized | A future nickname feature requires a separately specified backend field and migration | Record unsupported profile attributes as absent, not silently ignored |

Correction in this increment:

- Removed the non-persisted nickname field from profile types, Settings UI, and
  update payloads; corrected the bilingual profile descriptions to match the
  actual canonical backend contract.

# Follow-up self-review (2026-08-29, notification statistics contract increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Metric correctness | Pass | `CanonicalNotificationController.stats` now calculates `weeklyCount` from notifications created in the rolling seven days, independently of total unread/read counts; regression test covers an eight-day-old record | Cassandra month traversal and production clock/zone behavior remain unverified | Define the metric explicitly as a rolling UTC-time window and keep the 12-month source bound |
| API documentation | Pass | Notification page/view/count/stats schemas and response references are now present in OpenAPI and match the controller records | Generated client/schema comparison remains a release-gate task | Document the actual wire shape rather than leaving generic response descriptions |
| Bilingual/UI impact | Pass | This correction is backend and contract-only; existing notification UI copy is unchanged and the current copy gate remains green | Provider delivery and full notification settings browser journey remain pending | Avoid adding UI labels for metrics that no screen consumes |
| Regression safety | Pass | Java 20 Maven suite reports 99 tests, 0 failures, 0 errors; frontend validation and existing notification smoke remain the baseline | Clean Cassandra notification query proof remains blocked | Treat the unit test as metric logic evidence, not persistence evidence |
| Traceability | Pass | Controller, regression test, OpenAPI, API contract notes, function audit, and this entry are synchronized | Push/mobile delivery, dedupe, and retry workers remain incomplete | Keep delivery gaps explicit instead of claiming a complete notification pipeline |

Correction in this increment:

- Corrected `weeklyCount` to a rolling seven-day value and documented all
  notification response shapes, including the `hasNext`/`hasContent` page flags
  and unread count response.

# Follow-up self-review (2026-08-29, poll deadline and dialog semantics increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contract truthfulness | Pass | `CreatePollModal` now requires an explicit `deadlineDate` whenever the deadline toggle is enabled; `expiresAt` is never silently omitted in that state | Live backend deadline validation and timezone behavior remain unverified | Keep the UI state and request payload aligned; do not rely on a backend default when the user selected a deadline |
| Accessibility | Pass for audited controls | Create-poll modal has dialog naming, modal semantics, labeled question/options/date/time fields, pressed toggle states, and localized missing-date alert; `PollCard` option/voter/close controls expose state and names | Full keyboard focus trap, Escape handling, and screen-reader walkthrough remain pending | Treat modal and poll controls as interactive stateful controls, not decorative buttons |
| Bilingual copy | Pass | Four new deadline/dialog strings are registered in `resources.ts`; `npm run test:i18n:copy` reports 770 checked keys with none missing | Full authenticated locale walkthrough remains pending | Keep validation and accessibility feedback short and translated in the shared registry |
| Regression safety | Pass | Frontend type-check/lint, production build, i18n-copy and error-copy gates pass after the poll changes | Authenticated realtime poll and concurrency browser proof remain blocked | Preserve the explicit poll gaps in the function inventory rather than claiming E2E completion |
| Traceability | Pass | Poll modal/card, shared resources, function audit, and this entry describe the same deadline and accessibility behavior | Policy/concurrency/realtime/audit evidence still requires a clean backend stack | Record the UI correction without inventing provider or legacy compatibility behavior |

Correction in this increment:

- Prevented a deadline-enabled poll from submitting without a selected end
  date, added bilingual feedback, and completed dialog/control semantics for
  poll creation, voting, voter details, and poll-close actions.

# Follow-up self-review (2026-08-29, workspace action semantics increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Form safety | Pass for audited actions | Mention selection, invite creation, message retry and message overflow controls now declare `type="button"`, so they cannot submit an enclosing form accidentally | Full authenticated form interaction walkthrough remains pending | Keep action buttons explicit even when they currently render outside a form |
| Accessible naming | Pass for audited icon controls | Failed-message retry and message overflow controls expose localized `aria-label` values; existing contact/invite icon actions retain localized titles | Full axe/screen-reader tree review remains pending | Do not rely on icon shape alone to communicate an action |
| Scope discipline | Pass | Only active workspace components with concrete missing semantics were changed; no legacy/data/fallback compatibility code was added | Broader authenticated workspace audit remains | Continue with small, evidence-backed UI increments |
| Regression safety | Pass for available gates | Frontend type-check/lint, production build, i18n-copy (771 checked keys), error-copy, and Contacts browser smoke pass after the isolated changes | Full authenticated workspace and screen-reader proof remain pending | Keep the increment complete only for the verified scope; preserve the broader accessibility gap |

Correction in this increment:

- Added explicit non-submit button semantics to active workspace actions and
  localized accessible names for icon-only message actions.

# Follow-up self-review (2026-08-29, shared shell locale controls increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Translation architecture | Pass | `ThemeToggle` and `LanguageToggle` now use the reactive `useAppTranslation` hook and the canonical Vietnamese-key registry; the local two-language branch was removed | Authenticated shell copy still requires the broader browser walkthrough | Keep one translation source instead of duplicating English literals inside shared controls |
| Accessible naming | Pass | The locale browser smoke asserts language-switch names and titles plus the theme-control name before and after VI→EN switching | Full screen-reader behavior for every authenticated menu remains pending | Treat icon-only shell controls as translated named controls in every locale |
| Dead-code discipline | Pass | Repository search proved the old `English` resource key had no consumer after canonicalizing `Tiếng Anh`; the unused key was removed | No legacy copy alias is retained | Delete proven orphaned translations rather than preserving compatibility text |
| Motion and interaction scope | Pass | Existing fast theme/menu interactions are unchanged; no decorative animation was added to frequently used controls | Broader motion audit remains pending | Preserve immediate control feedback and avoid motion that adds latency without meaning |
| Regression safety | Pass for available gates | Type-check/lint, production build, i18n/error-copy gates, locale browser smoke, and the two-viewport UI-quality smoke pass with zero unexpected console/request failures | Authenticated multi-account browser and clean backend stack remain pending | Keep the increment bounded to verified shell behavior and retain the larger E2E gap |

Correction in this increment:

- Centralized language/theme control copy through the reactive i18n hook,
  removed the orphaned English alias, and added browser assertions for the
  translated accessible control contract.

# Follow-up self-review (2026-08-29, Contacts control semantics increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Stateful control semantics | Pass | The Contacts mode selector is a named control group and each option exposes `aria-pressed`; the browser smoke verifies Friends is selected in VI/EN and Requests becomes selected after interaction | Arrow-key tab semantics are intentionally not claimed because this is a native button group, not an ARIA tab widget | Model the implemented segmented control exactly instead of assigning unsupported tab behavior |
| Icon action naming | Pass for audited actions | Friend message/remove icon buttons have matching localized `title` and `aria-label` values, with decorative icons hidden from the accessibility tree | Populated multi-user screen-reader testing remains pending | Do not make icon recognition the only way to understand an action |
| Scope and contract discipline | Pass | No friend API, store, presence, modal, or navigation behavior changed; no mock/fallback/legacy branch was added | Live two-account friendship journey remains blocked by the integration stack | Keep accessibility correction independent from friendship data contracts |
| Regression safety | Pass for available gates | Type-check/lint, production build, i18n-copy gate, and mock-authenticated Contacts browser smoke pass with zero console/request failures | Clean Cassandra and realtime multi-account proof remains pending | Treat HTTP-boundary browser coverage as UI-contract evidence only |

Correction in this increment:

- Exposed the selected state of the Contacts segmented control, named its
  icon-only row actions, and added browser regression assertions for VI/EN
  selection behavior.

# Follow-up self-review (2026-08-29, profile relationship action cleanup)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Runtime truthfulness | Pass | Repository-wide call-site review proved `UserProfileModal` never received `onAddFriend` or `onRemoveFriend`; both rendered controls were inert | A dedicated per-user relationship-status contract does not exist, so exact profile-level add/remove behavior remains unspecified | Remove controls that cannot execute rather than presenting fake actions |
| State correctness | Pass | Removed the modal's `isFriend` state derived from a bounded store list, along with the unused props, callbacks and icons | Exact incoming/outgoing/accepted relationship state still requires a separately designed backend query | Do not infer one user's relationship from whether they appear in the current bounded page |
| Preserved capability | Pass | Canonical add-friend and remove-friend actions remain in the Find people and Friends list surfaces; the profile dialog retains wired Message, Block/Unblock and Report actions | Live two-account mutation proof remains pending | Keep real feature entry points while deleting only the dead duplicate surface |
| Bilingual and browser evidence | Pass | `test:e2e:contacts` opens a populated friend's dialog in English, confirms Message/Block/Report, rejects inert friend actions, and reports zero console/request failures; the copy gate now checks 770 active static keys | Full screen-reader and live-service profile journey remain pending | Let deleted UI copy leave the active-key count instead of preserving an unused alias |
| Regression safety | Pass for available gates | Type-check/lint, production build, i18n/error-copy guards, and the mock-authenticated Contacts journey pass | Clean Cassandra/realtime integration remains unavailable locally | Treat the fixture as UI behavior evidence, not persistence evidence |

Correction in this increment:

- Removed dead add/remove-friend props, state and buttons from the user-profile
  modal; retained the real friendship actions on their canonical Contacts
  surfaces and added browser proof for the remaining profile actions.

# Follow-up self-review (2026-08-29, outgoing friend-request cancellation increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contract correctness | Pass | Replaced the misleading verb route `POST /friends/{friendId}/cancel` with canonical `DELETE /friends/requests/{recipientId}` across Spring, OpenAPI, TypeScript client and browser assertions; no compatibility alias remains | External callers, if any, must use the canonical contract | A pending recipient is not yet a friend; model the request resource and delete it |
| User journey | Pass for HTTP-boundary browser evidence | Find people now renders Cancel request for an outgoing pending row; success removes the pending projection from client state and restores Invite without a refresh | Live Cassandra persistence across two accounts remains pending | Let users reverse a pending request where its state is visible |
| Failure handling | Pass at implementation boundary | Store preserves pending state when cancellation throws, records a safe localized error and rethrows for the existing notification path; three new active copy keys pass the registry gate | Browser provider-failure retry is not exercised in this increment | Do not optimistically clear an authoritative pending request before server success |
| Backend state transition | Pass at unit level | `FriendshipServiceTest` verifies a pending cancellation removes the outgoing projection and recipient inbox entry; Java 20 suite reports 100 tests, 0 failures, 0 errors | Clean Cassandra/LWT integration remains unavailable locally | Keep service cleanup behavior protected independently from the UI fixture |
| Accessibility and visual scope | Pass | Pending state uses a visible named native button with explicit type, disabled/loading feedback and existing design-system variants; no new animation or dependency was added | Full populated-row screen-reader walkthrough remains pending | Use the existing compact action hierarchy rather than adding a new modal for a reversible pending request |
| Traceability | Pass | Controller, OpenAPI, API client, store, Contacts UI, copy registry, browser smoke, feature inventory, traceability matrix, function audit and testing guide describe one contract | Full multi-account flow remains unverified | Update all authorities in the same increment |

Correction in this increment:

- Connected outgoing friend-request cancellation from the Contacts UI through
  the canonical DELETE contract to the existing service cleanup, with localized
  feedback, unit coverage and browser method/path/state regression evidence.

# Follow-up self-review (2026-08-29, room visibility and stable empty-room increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Contract truthfulness | Pass | `CreateConversationRequest`, the API adapter and browser assertion carry explicit `visibility` and `joinPolicy`; community creation sends `CHANNEL`, `COMMUNITY`, `REQUEST_APPROVAL` | Live Cassandra persistence remains pending | Do not label a channel public while silently accepting backend private defaults |
| UX and accessibility | Pass | Channel settings expose native named radio controls for private/community scope and direct/approval admission, with responsive two-column cards and bilingual hints | Community directory/discovery is not implemented in this increment | Reveal policy controls only for channels and approval controls only for communities |
| Runtime stability | Pass | The browser opens the newly created empty room with zero console/request failures; `TypingIndicator` now reuses the store's stable empty snapshot | Live STOMP typing events remain pending | Zustand selectors must not allocate a new fallback value on every snapshot |
| Localization | Pass | Copy registry validates 782 active Vietnamese keys with complete English mappings | Live screen-reader locale walkthrough remains pending | Keep concise policy labels and explain consequences in one-line hints |
| Scope and dependencies | Pass | Existing conversation contract, design tokens, motion primitives and Playwright dependency are reused | Community search and owner transfer remain separate features | No compatibility alias, mock runtime fallback, or new package was introduced |

Correction in this increment:

- Added explicit private/community channel creation and join-policy controls,
  verified the production request payload, and fixed the unstable empty typing
  snapshot exposed when opening the new room.

# Follow-up self-review (2026-08-29, atomic membership capacity increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Authoritative state | Pass at implementation boundary | `member_count` and `max_members` are static values in the membership partition; canonical room/admin detail reads require that state and the metadata table no longer stores a second copy | Migration has not been exercised against a clean Cassandra node on this host | Missing membership state is an integrity error; no legacy inference/backfill branch exists |
| Concurrency and idempotency | Pass at unit/manifest level | Add/remove use same-partition conditional logged batches; duplicate add repairs projections without duplicate audit; direct invite tests cover full-room preflight, lost capacity race compensation and concurrent accepted claims | Real Cassandra LWT contention/load proof remains pending | Reserve LWT for the hard membership/capacity boundary and keep all conditions in one partition |
| Projection consistency | Pass for retryable request path | Successful membership mutations refresh the per-user room projection and bounded admin directory; idempotent add/remove retries repair a partial projection write | An automatic outbox repair worker remains a broader projection-reconciliation task | A request retry is safe and does not invent or duplicate membership authority |
| Contract and documentation | Pass | Fresh CQL, additive migration, OpenAPI initial-member bound, ADR 0005, data model, feature inventory, traceability and task audit agree | Clean migration rehearsal remains blocked by unavailable Cassandra/Docker | Initial creation is bounded at 200 invited members; larger population uses the normal conditional command |
| Regression safety | Pass for available backend gates | Java 20 Maven suite reports 110 tests, 0 failures, 0 errors | Browser behavior is unchanged in this backend prerequisite increment | Continue to community discovery only after the existing membership invariant is correct |

Correction in this increment:

- Replaced stale room-level membership counts with partition-local atomic state,
  added capacity and invite-race handling, made projection retries repairable,
  and documented the hard consistency boundary without compatibility fallback.

# Follow-up self-review (2026-08-29, public community discovery increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Query boundedness | Pass at implementation boundary | One canonical filter projection uses 16 stable shards, ordered cursor merge and canonical hydration; manifest rejects `ALLOW FILTERING` and removed discovery tables | Clean Cassandra paging/load proof remains pending | Keep discovery lookup rows minimal and never scan room metadata |
| Admission consistency | Pass at unit level | Direct join uses the atomic membership claim; approval uses one room/user request, LWT operator-and-decision claim and matching retry after interruption | Live multi-operator contention remains pending | Expose only AVAILABLE/PENDING/JOINED while keeping recovery and completed-request states internal |
| UI and localization | Pass for production browser evidence | `/communities` covers search, category/topic filters, policy, count/capacity, pending/joined/full/error/empty states; language changes no longer remount and erase active UI state; 807 copy keys pass | Screen-reader and live service journeys remain pending | Locale changes must preserve user input, filters and open interaction state |
| Contract discipline | Pass | Controller, OpenAPI, compact manifest, TypeScript client, UI, migration, ADR and traceability use the same two community routes and join states | Clean migration rehearsal remains pending | No legacy endpoint, data fallback or fabricated room metadata was added |
| Regression safety | Pass for available gates | Java 20 suite reports 119 tests; frontend validate/build, copy/error gates, public smoke and community smoke pass with zero unexpected console/request failures | Full integration stack is not running locally | Treat HTTP-boundary browser coverage as UI-contract evidence, not persistence proof |

Correction in this increment:

- Added bounded canonical community discovery and admission, production bilingual
  UI, state-preserving language switching, concurrency recovery and matching
  contract/test/documentation evidence without retaining the obsolete designs.

# Follow-up self-review (2026-08-29, atomic room ownership increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Ownership authority | Pass at implementation boundary | `owner_id` and `owner_updated_at` are static membership-partition values; metadata no longer stores a duplicate owner | Clean Cassandra migration is not available locally | Missing ownership state is rejected, never inferred from removed metadata |
| Concurrency | Pass at unit/manifest level | Owner role swap and static owner use one conditional batch; kick checks owner in the decrement LWT; role assignment is CAS-protected | Live LWT contention/load proof remains pending | Conflicting commands fail visibly instead of overwriting newer authority |
| Retry and projections | Pass at service level | A repeated completed transfer repairs both user projections and bounded admin directory without another authority mutation or audit event | Automated outbox repair remains a broader projection task | Retrying an unknown outcome is safe and idempotent |
| API compatibility | Pass | Existing ownership resource endpoint and response semantics are retained; only persistence authority changed | Frontend management controls remain pending | Correct the implementation behind the canonical contract instead of adding an alternate endpoint |
| Dead-code discipline | Pass | The unconditional member writer and metadata-owner update path were removed after all consumers moved to conditional commands | Broader repository dead-code audit remains ongoing | Do not retain unsafe writers as compatibility helpers |
| Regression safety | Pass for available backend gates | Java 20 suite reports 130 tests, 0 failures and 0 errors | Clean Cassandra contention remains pending | Management controls consume explicit actor permissions rather than role-name inference |

Correction in this increment:

- Moved room ownership into the membership consistency boundary, protected role
  and removal races, added retryable projection repair, and documented the
  decision without a legacy inference path.

# Follow-up self-review (2026-08-29, room management UI increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Authorization boundary | Pass | UI fetches `/permissions`; backend remains authoritative for every mutation | Live multi-account authorization pending | Controls are hidden by effective permission, never inferred from role labels |
| Interaction and recovery | Pass | Loading, retry, mutation failure, confirmation and authoritative ownership refresh are implemented | Large-member pagination remains a later contract task | Failed writes retain prior UI state and expose localized errors |
| Responsive i18n | Pass | Production Playwright verifies live VI→EN rendering and 390px layout with zero overflow | Broader authenticated accessibility audit pending | Panel and messenger shell subscribe to locale context; entering mobile closes the desktop sidebar |
| Regression safety | Pass | Java 20: 130/130; frontend validate/build/copy/smoke pass | Clean Cassandra contention pending | Browser smoke asserts exact role and ownership request payloads |

# Follow-up self-review (2026-08-29, room role lifecycle increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Catalog invariants | Pass at CAS boundary | Role code is the clustering key; static count and insert/delete are conditional same-partition batches | Clean Cassandra contention pending | Concurrent creators cannot duplicate a code or exceed 50 custom roles |
| Delete/assignment ordering | Pass at unit/manifest boundary | `DELETING` lifecycle plus membership `role_revision`; assignment and transfer CAS the revision | Live multi-client contention pending | No cross-table batch is represented as a transaction |
| Legacy discipline | Pass | Migration recreates the role authority without inference or backfill | Intended roles must be recreated explicitly | Removed role schema has no compatibility read path |

# Follow-up self-review (2026-08-29, distributed presence and viewport increment)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Presence scope | Pass at code/contract boundary | `PresenceService` aggregates expiring per-session heartbeats, hides `INVISIBLE` as public `OFFLINE`, and publishes only public snapshots | Live Redis multi-node and multi-device expiry remain pending | Keep Redis as the only ephemeral presence authority; removed the unused Cassandra fallback table |
| Subscription scale | Pass at client boundary | `useTrackPresenceInViewport` observes rows with a bounded margin; sidebar/history/contacts/room members no longer subscribe every loaded row; server caps 200 targets per session | Virtualized directory load test remains pending | Presence cost follows the visible window, while cursor pages own member loading |
| Reconnect/expiry | Pass in unit boundary | Redis Pub/Sub listener, disconnect cleanup, bounded batch resync, expiry sweep, and `PresenceServiceTest` fan-out/expiry cases | Authenticated STOMP reconnect against Redis is externally blocked | Do not claim live presence until the clean dependency stack is available |
| UI density and accessibility | Pass for changed surfaces | Room member rows expose a status dot without a second explanatory line; labels remain supplied by `StatusDot`; frontend validate passes | Full screen-reader and long-directory browser audit remains pending | Use progressive disclosure: status detail stays in existing profile/tooltip surfaces |

# Follow-up self-review (2026-08-29, scoped presence and progressive mention lookup)

| Review dimension | Result | Evidence | Remaining gap | Correction / decision |
| --- | --- | --- | --- | --- |
| Presence privacy | Pass at service boundary | `PresenceSubscription` carries an optional conversation scope; `PresenceService` authorizes both watcher and targets against canonical membership or accepted-friend projection before subscribe/batch | Revocation events between a successful subscription and the next UI unwatch still depend on the normal session lifecycle | Reject arbitrary UUID probing; do not add an unscoped public presence endpoint |
| Directory network cost | Pass for mention interaction | `MentionMenu` requests 100-member pages and fetches another page only when a query cannot fill the eight-item compact result | A dedicated server-side prefix index is still a future optimization for very large rooms | Keep page size bounded and reveal only the compact result set |
| UI information density | Pass for changed presence surfaces | Rows show a dot/short status; device and last-active details remain in existing profile/tooltip surfaces | Full admin and long-directory density audit remains pending | Prefer progressive disclosure over repeated explanatory copy |
| Regression safety | Pass for available gates | Java suite 146 tests/0 failures; frontend type-check/lint pass after scoped protocol changes | Live Redis/STOMP multi-node proof remains external | Keep live-stack gaps explicitly documented |
