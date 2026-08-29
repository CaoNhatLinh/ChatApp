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
