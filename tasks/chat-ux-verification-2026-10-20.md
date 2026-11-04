# Chat UX upgrade: current U1–U5 verification, 2026-10-20

## Current follow-up outcome (supersedes the earlier checkpoint below)

### Directory continuation follow-up

The repository now spells out mixed-order continuation as bounded, contiguous
queries: same activity timestamp with ascending conversation ID, then older
timestamps, then the unpinned head only if the pinned group is exhausted. Each
query receives the remaining row capacity, including one lookahead. Cursor/API
shape and schema are unchanged; no full-partition sort or `ALLOW FILTERING`.

`ConversationProjectionPagingTest` adds three query-binding regressions for ties,
raw-row cursor placement despite missing canonical rooms, remaining capacity,
pin-group transition and terminal unpinned pages. The initial test invocation
failed because the old query path did not bind these new statements (mock result
was null); that is not evidence of a live Cassandra failure. After implementation,
the focused paging/browse/read-projection run and full JDK20
`./mvnw.cmd -q test` exited0:378 tests/76 suites, zero failures/errors/skips.
This supersedes the375-test checkpoint below. Frontend is unchanged since its
successful build and39-case browser run; those commands were not repeated.

The opt-in `ChatReadCassandraIT` now contains a fourth scenario:14 persisted rooms,
same-time ID ties, pinned/unpinned transition and older activity, paged two at a
time with exact expected IDs. It compiles in the default run but remains unrun
without Docker. Query-binding tests do not prove CQL runtime behavior; final live
acceptance stays open. Changes: `CanonicalCqlStore.java`,
`ConversationProjectionPagingTest.java`, `ChatReadCassandraIT.java`,
`docs/flows/conversation-directory.md`, `docs/testing/chat-cassandra-acceptance.md`
and this evidence report. `git diff --check` passes, existing CRLF warnings only.

U3–U5 are implemented and pass controlled acceptance. U6's local checks and
responsive/theme matrix pass; its live datastore/storage/concurrency gate is
still open. This is not a claim that the entire feature-expansion roadmap is done.

### Delivered

- Authorized image/file/link library, bounded canonical history/attachment
  continuation, safe URLs, actual image previews, localized dates/file sizes,
  loading/empty/error/retry. Source-message view uses a fresh authorized point
  lookup, not a misleading twenty-page jump. Spoiler images are not previewed.
- Canonical entry read-state API and stable unread divider. Unloaded earlier
  boundaries are identified explicitly. Selecting/receiving alone no longer
  marks messages read. Hidden pages and users reading old history do not ack.
  New content arriving during a slow ack is checked again; failures stay inline.
- Read pointers can advance through own messages without false self-seen receipts.
  Read projection repair is conditional on the exact covered summary, with two
  exact clustering-key reads instead of scanning a user's rooms. New-message
  counts restart from the canonical read pointer; sending alone doesn't clear
  unseen content. Directory filters suppress fully read stale projections.
- Persisted follow-app default, explicit room themes preserved, readable room
  surfaces in both shell themes. Custom-background overlays retain readable
  metadata after preference reload. Theme/background share one room write;
  failures preserve the draft and don't close the dialog or emit success toast.
- Fixed mobile information pane stacking above the sidebar. No new dependency,
  table or migration was needed for this chat UX slice.

### Final executed checks

- `npm run validate && npm run build`: exit0, full TypeScript/lint and17 routes.
- JDK20 default unit reports: Surefire375 tests/75 suites,
  zero failures/errors/skips. Includes shared-content visibility/scope/shards/
  large-attachment continuation/deleted assets, read projection policy/query
  bindings, own-message read behavior and appearance default preservation.
  Eight additional HTTP tests exercise actual production JWT/security filters,
  MVC mappings, JSON serialization and membership authorization with mocked
  persistence/account boundaries. Report timestamps span07:55:14–07:55:27;
  the final process handle was unavailable on resume, so these totals are from
  the XML reports, not a newly observed process exit. The separate failed
  `ChatReadCassandraIT` report is intentionally excluded and retained.
- `node scripts/chat-workspace-ux-smoke.mjs` with `CAPTURE_CHAT_UX=1`: exit0,
  39 grouped Chromium behavior checks plus eight responsive/theme matrix entries.
  Controlled canonical HTTP and real SockJS/STOMP browser handling, not live DB.
  Includes slow read acknowledgment, hidden-page visibility, library tab/source/
  filtered-empty continuation, authorization failure/retry, theme-save failure/
  same-draft retry, focus/Escape and explicit opposite-mode room presets.
  The added source-error regression failed against the previous production build:
  Retry incorrectly reloaded the library. The fix retains the selected source,
  retries its authorized lookup and reloads the library on Back if failure cleared
  the retained items. Both retry and Back now pass against a fresh production build.
- Widths320/768/1024/1440 in light and dark: no document horizontal overflow;
  library fits viewport. Measured dialog body foreground/background contrast is
  17.19:1 in light and17.56:1 in dark. This is not a measurement of every UI color.
- `node scripts/chat-unread-theme-smoke.mjs`:22 production-model checks.
- Scroll policy10, conversation-directory adapter8, send-attempt14,
  notification-copy8 checks pass. No browser pageerror emitted in the final run.
- `node scripts/api-session-smoke.mjs`:19 production interceptor checks pass
  against an Axios test transport, not live cookie/session refresh.
- OpenAPI parses with existing js-yaml,125 paths. `git diff --check` passes;
  pre-existing CRLF warnings remain. No provider call, secret output, commit/push.

Failures found and repaired: missing test VM URL global; a now-invalid own-message
receipt test fixture separated into own/peer cases; TypeScript message edit-field
name; mobile overlay stacking; slow-ack rescheduling. Successful final runs above
were executed after relevant production fixes, not inferred from earlier builds.

### Current screenshots (controlled fixture data, not real user content)

- `chatapp_frontend/artifacts/ui-audit/current/chat-library-light-1440.png`
- `chatapp_frontend/artifacts/ui-audit/current/chat-library-light-320.png`
- `chatapp_frontend/artifacts/ui-audit/current/chat-library-dark-1440.png`
- `chatapp_frontend/artifacts/ui-audit/current/chat-library-dark-320.png`
- `chatapp_frontend/artifacts/ui-audit/current/chat-unread-light-1440.png`
- `chatapp_frontend/artifacts/ui-audit/current/chat-unread-light-320.png`
- `chatapp_frontend/artifacts/ui-audit/current/chat-unread-dark-1440.png`
- `chatapp_frontend/artifacts/ui-audit/current/chat-unread-dark-320.png`

Inspected desktop light/mobile dark library and unread views directly. Reused
shared dialog/buttons/type tokens; distinguished shell and room colors instead
of overriding the whole application. The implementation/API and final review
were guided by incremental delivery, interface contracts and five-axis review.

### Remaining live gates and limits

- No working Docker engine is available. The user will install it later; do not
  repeatedly ask or install it. The opt-in `chat-cassandra-it` profile compiles,
  copies the exact canonical CQL schema and attempts isolated Cassandra4.1 tests,
  but actually failed before startup because Testcontainers found no Docker.
  No live CQL scenario passed. Production security-filter HTTP behavior is now
  covered in controlled MVC tests, not a running Boot/session-refresh acceptance.
  Live CQL, provider storage lifecycle and two full clients remain unverified.
  See `docs/testing/chat-cassandra-acceptance.md` for commands and precise scope.
- Exact badge counts across concurrent Cassandra projection moves/crashes are
  derived/eventually consistent, not a proved linearizable transaction. Entry
  divider correctness is based on canonical read pointer, not these counts.
- Archive traversal is bounded but not a materialized media index. Sparse history
  may need more continuation actions; production latency is unprofiled. Actual
  images lazy-load because trusted persisted thumbnails aren't in the asset
  model. Existing public provider URLs cannot be undisclosed/revoked by this API.
- Full-app accessibility certification and testing every unrelated feature are
  not claimed by this specific chat UX matrix. Missing old art-direction task
  filenames were not recreated; current matrix is `tasks/chat-ux-upgrade.md`.

### Follow-up files and reasons

- Backend read API/queries: `canonical/controller/SharedContentController.java`,
  `CanonicalConversationController.java`; `canonical/message/SharedContentService.java`,
  `MessageRepository.java`, `CassandraMessageRepository.java`, `MessageService.java`,
  `MessageOrder.java`; `canonical/conversation/ConversationUnreadPolicy.java`,
  `ConversationBrowseService.java`; `canonical/repository/CanonicalCqlStore.java`.
  Authorize library/source reads, preserve all continuations, expose entry marker
  and repair covered unread projections without false self-read events.
- Appearance: `canonical/appearance/AppearanceService.java`,
  `ChatAppearanceRequest.java`, `RoomAppearanceRequest.java`; frontend
  `features/settings/constants/chat-theme.constants.ts`, `api/chat-appearance.api.ts`,
  `model/useRoomThemeState.ts`; `widgets/chat-window/components/RoomThemePanel.tsx`.
  Persist follow-app choice and await actual writes while preserving failed drafts.
- Chat UI/model: frontend `features/messenger/api/shared-content.api.ts`,
  `model/useMessenger.ts`, `model/conversation.slice.ts`,
  `components/chat/ConversationInfo.tsx`; `widgets/chat-window/ChatWindow.tsx`,
  `components/SharedContentDialog.tsx`, `components/MessageHistory.tsx`,
  `model/unread-boundary.ts`, `model/useReadTracking.ts`; `src/index.css`.
  Shared-content interaction, correct viewport-based reading, scope-safe themes.
- Tests/copy: `canonical/message/SharedContentServiceTest.java`,
  `MessageServiceTest.java`; `canonical/conversation/ConversationUnreadPolicyTest.java`,
  `ConversationReadProjectionTest.java`; `canonical/appearance/AppearanceServiceTest.java`;
  frontend `scripts/chat-workspace-ux-smoke.mjs`, `scripts/chat-unread-theme-smoke.mjs`,
  `src/shared/i18n/resources.ts`, `package.json`. Regression and bilingual coverage.
- Contracts/evidence: `docs/api/openapi.yaml`,
  `docs/flows/chat-shared-content-and-reading.md`, `tasks/chat-ux-upgrade.md`,
  this report and `tasks/todo.md`. Record real behavior, tradeoffs and live gates.
- HTTP correctness: `common/exception/GlobalExceptionHandler.java` returns400
  for missing required request parameters instead of generic500;
  `security/config/SecurityConfig.java` wires the existing authentication entry
  point so unauthenticated requests return401 and can enter the client's refresh
  path. Authenticated membership denial stays403. Regression coverage lives in
  `canonical/conversation/ChatReadHttpSecurityTest.java`.
- Live gate harness: `chat-service/pom.xml`,
  `canonical/conversation/ChatReadCassandraIT.java` and
  `docs/testing/chat-cassandra-acceptance.md`. Reuse existing Testcontainers;
  no installed service, production database mutation or new dependency.

## Earlier U1/U2 checkpoint (historical; pending statements below are superseded)

## Scope implemented

- Scroll policy and hook: initial/room load, typing stability, incoming while
  reading vs following, own append, prepend anchoring, explicit jump to latest.
- Desktop information pane genuinely collapses. Closing/Escape restores focus;
  mobile Tab wraps within the information overlay. Search stays accessible at320.
  Mobile voice/video actions move to the existing Radix menu, rather than crowding
  out the title/search. Message timestamps/status use12px and inherited text color;
  day dividers use localized real message dates. Unread boundary is not implemented.
- Native conversation selection and sibling44px pin controls. Pending guards and
  inline pin failures replace the duplicate pin toast path.
- Backend ConversationBrowseService replaces the old directory methods in
  ConversationService. Query/filter use bounded member projection scans, raw-row
  continuation, current membership checks, scoped cursors and public-only DM peer
  fields. Controller and OpenAPI updated. No schema or provider setup changed.
- Sidebar All/Unread/Pinned plus remote query; Ctrl/Cmd+K quick opener with
  explicit continuation on filtered-empty pages and keyboard opening of remote
  rooms not present in the initial client cache. Vietnamese/English copy added.

## Commands and evidence

- npm run validate: exit0 (type-check and full lint) after U2 integration.
- npm run build: exit0,17 routes, after U2 integration.
- Subsequent filtered-empty copy/error suppression: type-check and scoped lint
  exit0; final production build and21-case browser smoke also exit0.
- npm run test:chat:scroll-policy:10 checks pass against production policy.
- npm run test:chat:directory-api:8 checks pass against production adapter.
- npm run test:e2e:chat-ux:21 grouped behavior checks pass in real Chromium with
  controlled canonical HTTP and SockJS/STOMP frames. This covers incoming/typing,
  follow/own append/prepend, pane width and focus, keyboard pin isolation, mobile
  search/focus/Escape, remote unread/pinned filters, filtered-empty continuation,
  quick-open Enter for an uncached room, reopening and Escape. No pageerror emitted.
- Send-attempt storage14 checks and notification-copy8 checks passed before U2.
- JDK20 ./mvnw.cmd -q test: exit0. Surefire totals351 tests,71 suites,
  zero failures/errors/skips. Six new browse-service tests cover actor/input
  validation, scope rejection, continuation after filtered-empty scans,
  query/filter intersection, lost membership and public-only DM peer search.
- git diff --check: exit0; pre-existing line-ending warnings only.
- OpenAPI parsed successfully with the existing js-yaml dependency; directory
  query/filter parameters and peer schema present. The separate yaml package is
  not installed; no dependency was added for this check.

The API adapter test first failed because q was not sent. The browse-service test
first failed to compile because the new capability did not exist. Initial fixture
test defects (pin method, heading selector, missing canonical empty-message fields)
were corrected against actual contracts, not bypassed with swallowed timeouts.

## Captures

- chatapp_frontend/artifacts/ui-audit/current/chat-ux-u1-desktop-1440.png
- chatapp_frontend/artifacts/ui-audit/current/chat-ux-u1-mobile-320.png

Both inspected after settling entrance motion. These contain named synthetic
verification conversations and a deliberately configured Studio room preset;
they are not live user content or full light/dark acceptance. Header/mobile
spacing corrected in one batched visual follow-up. Full matrix belongs to U6.

## Not complete / not claimed

- U3 shared image/file/link library: canonical attachment read, authorization,
  deletion/asset readiness rules, pagination and source navigation still needed.
  Existing message attachments are persisted but not exposed through a usable
  history read path. The current information row is still unavailable, not fake.
- U4 authoritative unread boundary/read-position semantics. Existing setup marks
  cached/received messages read automatically; this must be reconciled with
  viewport-aware reading before the divider is trustworthy.
- U5 follow-app appearance default and custom-theme contrast matrix.
- Live Cassandra/CQL behavior, provider integration, endpoint security through
  full HTTP runtime and performance under large memberships not verified here.
  Directory lookups remain bounded but use per-row canonical room/membership and
  DM peer reads; latency has not been profiled. No performance claim is made.
- Additional slow/stale search, error-retry, revoked-membership browser cases,
  all320/768/1024/1440 light/dark variants, accessibility measurements and final
  design finish review/documentation remain U6.
- No commit/push, public tunnel, provider call or unrelated cleanup.

Existing localhost3116 server was not stopped. Temporary test server3117 has a
recorded exec handle and was stopped after final verification; no permanent service
or automation was installed.

## Files in this change (excluding earlier unrelated work)

- Backend: canonical/conversation/ConversationBrowseService.java; canonical/controller/CanonicalConversationController.java;
  canonical/dto/CanonicalApiContracts.java; canonical/repository/CanonicalCqlStore.java;
  canonical/service/ConversationService.java. Own the browse capability, preserve
  raw continuation, expose public peer metadata and remove superseded directory code.
- Backend tests: canonical/conversation/ConversationBrowseServiceTest.java.
- Frontend model/API: features/messenger/api/messenger.api.ts;
  features/messenger/model/useConversationDirectory.ts; features/messenger/model/useMessenger.ts;
  widgets/chat-window/model/chat-scroll-policy.ts; widgets/chat-window/model/useChatScroll.ts.
  Transport query/cancellation, row error propagation, pagination and reading position.
- Sidebar: ChatSidebar.tsx, ConversationItem.tsx, SidebarConversationList.tsx,
  SidebarSearchBar.tsx and components/ConversationQuickOpen.tsx. Filters, accessible
  row controls, truthful empty states and keyboard quick opening.
- Chat: widgets/chat-window/ChatWindow.tsx, components/ConversationHeader.tsx,
  components/MessageHistory.tsx; features/messenger/components/chat/ConversationInfo.tsx
  and MessageItem.tsx. Panel behavior/focus, mobile actions, dates, status readability.
- Copy/scripts: shared/i18n/resources.ts; package.json; scripts/chat-scroll-policy-smoke.mjs,
  conversation-directory-api-smoke.mjs, chat-workspace-ux-smoke.mjs.
- Contract/decisions/evidence: docs/api/openapi.yaml,
  docs/flows/conversation-directory.md, tasks/chat-ux-upgrade.md,
  tasks/chat-ux-verification-2026-10-20.md and tasks/todo.md.
