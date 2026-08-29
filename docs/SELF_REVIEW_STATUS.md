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
| Code-doc consistency | Pass | `docs/TESTING.md`, `docs/AGENT_WORK_PLAN.md`, `tasks/function-audit.md`, package script | No gap found in affected command references | Documented the 342-key source-contract check and current evidence |
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
| Bilingual UI coverage | Pass for new error copy | `resources.ts`, all static `localizeText(...)` calls, locale copy smoke (683 static keys) | Live server/provider-generated content remains domain data rather than UI copy | Add each new product message to the explicit VI→EN map |
| Code-doc consistency | Pass | `TESTING.md`, package script, affected feature sources | None in this increment | Keep the guard scoped to user-facing error surfaces |
| Runtime verification | Partial | `npm run validate`, `npm run build`, `npm run test:errors:copy` | Authenticated backend and media errors need clean-stack/browser proof | Preserve the deterministic failure path and do not add fallback success behavior |

Corrections in this increment:

- Replaced raw Axios/native exception rendering in messenger, friendship, user
  report, message report, and WebRTC paths with status-aware product copy.
- Sanitized presence status-sync toasts so server `errorType`/`message` never
  leak protocol or implementation text into the UI.
- Added `test:errors:copy` as a regression check for the audited error surfaces.
- Expanded the locale guard to every static `localizeText(...)` call under
  `src/`; 683 keys currently have explicit English translations.

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
