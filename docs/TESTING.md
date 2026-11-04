# Testing strategy

## Run the release checks locally

Use [the Windows setup guide](LOCAL_WINDOWS_SETUP.md) to select JDK 20 or newer
and install frontend dependencies with `npm ci`. From the repository root:

```powershell
.\scripts\test-local-schema.ps1
Push-Location .\chat-service
try { .\mvnw.cmd test } finally { Pop-Location }
npm run validate
npm run build
```

For the Chromium chat and admin checks, open two terminals at the repository
root. In the first, start the production frontend after building it:

```powershell
Set-Location .\chatapp_frontend
npx playwright install chromium
npm run start -- --port 3118
```

In the second terminal, use the same frontend port:

```powershell
Set-Location .\chatapp_frontend
$env:SMOKE_BASE_URL='http://localhost:3118'
npm run test:e2e:chat-ux
npm run test:e2e:message-interactions
npm run test:e2e:admin-reports
npm run test:e2e:system-settings
```

These browser fixtures control HTTP and realtime responses. Use the
[Cassandra acceptance guide](testing/chat-cassandra-acceptance.md) for the
opt-in Testcontainers scenarios. The [implementation checklist](../tasks/todo.md)
records which live database, broker, multi-client and provider checks are still open.
Screenshots and raw fixture reports referenced by verification notes are local
outputs. Run the corresponding fixture to regenerate them.

## Coverage and boundaries

Backend: Maven unit/service tests cover auth, refresh rotation, directory,
friendship, conversations, message idempotency/cursor merge, policies, roles,
contracts, report moderation, sanction expiry, actuator authority, session/device admin controls, direct-call peer authorization, notification settings policy, room notification precedence/evaluator, notification pagination, outgoing friend-request cancellation, atomic room membership/capacity/ownership, role catalog/deletion/assignment concurrency, community discovery/approval recovery, invite compensation, distributed presence scope/fan-out/expiry, conversation cursor pagination, bounded message interaction hydration, poll concurrency, invite viewer-state recovery, and infrastructure manifests.
Frontend: `npm run type-check`,
`npm run build` (Next), `npm run lint`
(zero errors), and `npm run test:e2e:smoke` with `next start` running.
`npm run test:e2e:room-management` verifies permission-backed room role
creation and assignment, ownership transfer, live VI→EN rendering and the
390px responsive layout against a strict HTTP fixture.

The public/deep-link Playwright smoke currently passes (`/`, `/login`, `/about`,
`/403`, `/settings?tab=reports`, and `/admin` with unauthenticated redirect) with zero
console errors or request failures. The global admin page is therefore covered
for deep-link protection. A mock-authenticated Playwright check also loads the
operator overview and executes stateful HTTP-boundary mutations for global room
policy/archive/restore, report resolution, sanction impose/revoke, user search,
role grant, account suspension, refresh-session revoke, device revoke and audit
CSV export via `npm run test:e2e:admin`. It asserts the exact request payloads
and reasons, then audits the populated 390px UI for overflow, unnamed controls,
unlabelled fields and console/request failures. This does not replace an
authenticated Cassandra-backed operator journey, which remains pending.
Pending layers: Testcontainers/compose integration for
Cassandra + Redis + Kafka + Elasticsearch, Playwright authenticated journeys
with seeded users, STOMP reconnect/read/reaction assertions, accessibility tree
checks, and performance trace budgets.

`npm run test:e2e:locale` verifies the persisted VI→EN switch, English landing
copy, desktop navigation, the 390px mobile navigation menu, English `html[lang]`,
localized language/theme-control names and language-switch titles in both
locales, and 404 recovery links. The expected document 404 response is recorded
separately; unexpected console errors and request failures still fail the script.

`npm run test:e2e:notifications` loads the authenticated notification-settings
page with an explicit HTTP-boundary fixture, verifies unavailable delivery
channels stay disabled, changes the operational global inbox level, verifies the
canonical `PUT /notifications/settings` payload, and fails on console or request
errors. Set `SMOKE_THEME=dark` or `SMOKE_THEME=light` to capture either theme.

`npm run test:e2e:search` opens the conversation-scoped message-search dialog
with an explicit HTTP-boundary fixture, verifies message type/attachment/pin
filter payloads and English labels, and confirms that search is never requested
without the required conversation context. There is no duplicate `/search`
route; people search remains in `/friends`.

`npm run test:e2e:contacts` loads the authenticated Contacts route with an
explicit HTTP-boundary fixture, verifies the VI→EN tab and empty-state copy, and
confirms the shared app-shell navigation stays translated in both locales. It
also verifies that the Friends/Requests segmented control exposes its selected
state before and after a tab change. The populated-friend fixture opens the
profile dialog and verifies its Message, Block and Report actions while
rejecting the former inert add/remove-friend controls. It also cancels a pending
outgoing request, verifies the canonical `DELETE /friends/requests/{recipientId}`
wire contract, and waits for the row to return to the Invite action. An unavailable realtime
transport does not block the REST-backed screen. Realtime transport failures
are reported separately because the local integration stack is intentionally
absent.

`npm run test:e2e:room-create` loads the authenticated workspace, creates a
community channel with approval-required membership, and asserts the canonical
`CHANNEL` + `COMMUNITY` + `REQUEST_APPROVAL` request payload. It then opens the
new empty room and fails on unstable store snapshots, console errors, or request
failures.

`npm run test:e2e:communities` loads the production `/communities` route with an
explicit HTTP-boundary fixture, verifies approval-request submission, debounced
name search, retained filter state during VI→EN switching, translated app-shell
navigation and a 390px no-overflow layout. Unexpected console and request
failures fail the script; live Cassandra persistence remains a separate gate.

`npm run test:e2e:profile` loads the authenticated profile route with an explicit
HTTP-boundary fixture and verifies the profile quick-link title and all link
labels after switching from Vietnamese to English.

`npm run test:e2e:presence` loads the authenticated workspace with an explicit
HTTP-boundary fixture, verifies the Online/Do not disturb/Invisible status menu
in Vietnamese and English, verifies the status control keeps an accessible name
at 390px, and keeps unavailable realtime transport separate from UI assertions.
The Contacts view, conversation sidebar, message history, and mention menu track
only rows inside a small viewport margin through the same presence subscription
path; live STOMP snapshots, Redis fan-out, and two-device expiry remain an
integration concern.

`npm run test:presence:tracker` transpiles and executes the production
`presenceTrackingState.ts` state machine with a deterministic transport spy. It
verifies duplicate-ID de-duplication, one active scope per target, reconnect
resync, ordered room-to-friend scope transfer, snapshot clearing, final unwatch
and logout cleanup without replacing STOMP/Redis integration evidence.

`npm run test:presence:batcher` executes the production viewport-command
batcher with a deterministic scheduler. It proves same-scope coalescing,
duplicate removal, enter/leave cancellation, unsubscribe/resubscribe
cancellation, and subscribe-before-resync ordering.

The conversation sidebar consumes cursor-paginated `ConversationPage` data and
requests the next page when its bounded-scroll sentinel enters the lower margin;
the explicit load-more action remains a recovery path. Mention lookup starts
with a 100-member page and requests additional pages only when a typed query
still has fewer than eight matches.

`npm run test:e2e:room-management` renders a full 30-row first conversation
page, scrolls within the bounded sidebar and asserts the next HTTP request uses
the server-provided opaque cursor before the second-page row appears. The same
journey also proves scroll-triggered room-member pagination without draining all
remaining pages on mount. It asserts the explicit 50-member request limit and
that the number of rendered member rows stays below the number retained in
loaded client state.

`npm run test:e2e:message-delete` opens an authenticated production message
row, proves cancellation sends no mutation, verifies the Vietnamese and English
destructive confirmation, asserts the exact bucket-scoped `DELETE` request and
checks that a deliberately content-bearing server tombstone renders only the
localized deleted state with no remaining action menu.

`npm run test:e2e:message-edit` preserves an existing unsent draft while edit
mode owns the composer, proves cancellation sends no mutation, switches the
active edit controls from Vietnamese to English, asserts the exact bucket-scoped
`PUT` payload, restores the draft after success and verifies the canonical
`editedAt` marker plus the bucket-scoped revision-history request.

`npm run test:e2e:message-drafts` keeps independent text drafts for two rooms,
restores them after a full reload, preserves the active draft after an expected
503 send failure, removes only the successfully sent room draft, and proves a
second account in the same browser cannot render the first account's draft. It
also removes an invalid schema instead of interpreting old shapes, checks the
20,000-character composer contract, 390px overflow and unexpected console or
network failures.

`npm run test:e2e:message-interactions` starts with a populated server-side
interaction projection, verifies compact reaction and seen rendering, asserts
exact bucket-scoped reaction plus pin/unpin requests, reloads the page and
proves reaction/current-actor/pin state hydrates again without per-message
requests or WebSocket-only state. Selecting the seen state opens the bounded
seen-by dialog, verifies the hydrated reader profile, follows its cursor for a
second page and asserts both `limit=25` requests. It selects a real mention
target, serializes the canonical mention token and asserts the send payload
contains only the resolved member UUID. It also verifies reactive VI→EN
accessible names and reports unexpected console/request failures.

`npm run test:i18n:copy` statically checks every Vietnamese string in the shared
`UI_COPY`, messenger copy, and chat-theme copy registries plus every static
`localizeText(...)` call under `src/` (including the global admin feedback
surface) has an explicit English translation key.
Dynamic messages remain covered by the canonical patterns in
`src/shared/i18n/runtime.ts`; this check does not introduce runtime fallback
behavior.

`npm run test:errors:copy` guards the production error surfaces for messenger,
relationships, reports, calls, and presence. It rejects direct rendering of
native exception messages or server response messages; diagnostic logs remain
operator-only.

`npm run test:e2e:network` loads the public shell in a real browser, toggles the
browser offline state, verifies the bilingual network-loss status banner, then
restores connectivity and verifies the banner is removed. It fails on console
errors or request failures.

`npm run test:e2e:ui-quality` checks every public/auth/recovery page at 320,
390, 768, 1024 and 1440px: exactly one visible `h1`, no horizontal overflow, accessible names
for visible links/buttons, labels for visible fields, valid link targets, and
zero console/request failures.

The visual audit capture opens the global Settings dialog from the desktop and
mobile application rail and verifies the semantic dialog boundary. On mobile it
also opens a category, checks the layered detail/back transition, and captures
the full-viewport detail state. Keyboard Escape/Tab containment and
background-scroll locking are enforced by the shared focus-trap behavior; a
direct `/settings` deep link is a separate page-mode surface and is not the
rail's primary action.

On 2026-08-30 the Signal Relay public/auth pass was captured from the real
frontend runtime. `AUDIT_CAPTURE=home,about,help npm run test:ui:capture`
verified the poster-style public redesign at 1440x960 and 390x844; the earlier
`AUDIT_CAPTURE=home,login` run covers the auth shell. Home, About, Help and Login
have no horizontal overflow, console errors or failed requests. Evidence is
stored in `chatapp_frontend/artifacts/ui-audit/current/`.

The public header was also measured with a real browser scroll at 1440px. Its
top position remains `0` after scrolling 1,100px, it receives the
`site-nav-scrolled` state, and its progress indicator is present. A dark-theme
capture confirms the shared Nối wordmark uses the light foreground stroke while
its signal accents remain orange. Evidence:
`home-dark-scroll-desktop.png` in the same audit directory.

Authenticated visual evidence with real data is blocked in this run because
the canonical backend at `localhost:8084` refused connections. Existing
HTTP-fixture browser suites remain useful contract tests, but are not presented
as proof of a live-data workspace, admin surface, or custom-room theme. Email
delivery, social OAuth, MFA enrollment, push-provider delivery, production
media upload and production WebRTC also remain configuration-gated as defined
by `PRODUCT.md`.

On 2026-08-31 the interaction hardening pass added browser-verified selectable
states to the public signal sequence, technology relay, About principles, Help
tips, Privacy inspector and Terms disclosures. The technology relay exposes
the real Next.js, React, TypeScript, Spring Boot, PostgreSQL, WebSocket,
Tailwind and Radix marks and supports pointer plus arrow-key selection. The
public quality suite passed all eight public/auth/recovery routes at 320, 390,
768, 1024 and 1440px with no overflow, unnamed controls, unlabeled fields,
console errors or request failures.

The same pass moved Create Room, Create Poll and User Profile onto the shared
Radix-backed `ModalShell`; fixed Create Poll and Conversation Info to use
semantic light/dark tokens; and repaired the Notification Settings mounted
lifecycle so a successful save updates its draft state and displays feedback
under React Strict Mode. Production-build contract tests passed for room
creation, poll create/retry/vote/remove/close, profile locale switching and
notification persistence. `poll-create-*-*.png` and
`settings-notifications-*-*.png` are fixture-backed contract-test
captures, not evidence of a connected live backend. Public/auth captures
`technology-relay-*-redesign.png`, `auth-login-light.png`,
`auth-login-dark.png` and `auth-register-mobile.png` use the real public
runtime and contain no application data fixtures.

All tests must follow BUILD–OPERATE–CHECK and must not silently replace a failed
integration with a mock-success path. The browser admin check stubs only the
HTTP boundary inside the test process; no runtime code contains that stub.
# 2026-09-01 — Appearance, toast and global admin workspace

- Reworked the canonical four room themes and three bubble styles without
  inventing unsupported preference IDs. The appearance panel now previews real
  message content, time/read state and custom-background overlay strength.
- Routine message send/edit, poll voting, room appearance and notification
  saves now use visible in-context state instead of success toasts. Toasts use a
  single compact Signal Relay surface and remain available for errors and
  consequential outcomes.
- `/admin` is now split into Overview, Spaces, Safety, Event stream and Access;
  room-local roles still do not grant access to this route.
- `npm run type-check`, `npm run lint`, `npm run test:i18n:copy` (1,065 keys),
  `npm run build`, `npm run test:e2e:locale`, `npm run test:e2e:notifications`,
  `npm run test:e2e:ui-quality` and `npm run test:e2e:admin` passed. The admin smoke exercised
  policy update, archive/restore, reports, sanctions, roles, account status,
  session/device revocation and audit export with no console errors, request
  failures, horizontal overflow, unnamed controls or unlabeled fields.
- Visual capture produced updated desktop/mobile evidence for admin, its mobile
  workspace-selection layer, and room
  appearance. The broad capture still reports the known unavailable local
  WebSocket backend and invite fixture mismatch; these are infrastructure/fixture
  blockers, not converted into successful runtime states.
- `/admin` now renders through its dedicated `AdminPageShell`. Visual and admin
  route smoke checks assert the route remains operational without the chat app
  rail, global chat header, settings modal, or mobile bottom navigation.
- The available browser journeys for contacts, rooms, invites, messages, polls,
  communities, presence, search and network also pass on the rebuilt output;
  their contract fixtures do not replace the clean Cassandra/Redis/Kafka/
  Elasticsearch integration gate.

## Direct replies — controlled acceptance, 2026-10-20

Run `npm run test:threads:api` and `npm run test:e2e:threads` from
`chatapp_frontend/`; the browser script defaults to a separately started production
server at `http://localhost:3117` (`SMOKE_BASE_URL` overrides it).
Results:13 adapter groups and19 browser groups, eight light/dark viewport cells,
two custom-background captures and label contrast assertions. Failure-before/fix-
after coverage confirms new messages behind the thread are not marked read until
the panel closes. Intentional send503 produces one expected error log; unexpected
page/console errors and request failures are asserted empty.

These fixtures exercise production frontend code with controlled HTTP and
SockJS/STOMP, not live Cassandra, an external provider, or multi-client crash
recovery. Docker installation was deferred by the user. Full file mapping,
screenshots and remaining gates: `tasks/thread-ui-verification-2026-10-20.md`.

## Forward provenance backend — 2026-10-20

Java20 default suite after F1:427 tests/87 suites, no failures/errors/skips. New
policy, logged-batch binding, exact-retry repair, public serialization and
standalone MVC tests cover private source handling. Frontend mapper regression,
type-check/lint and production build pass. These are controlled tests, not live
Cassandra batchlog/restart/provider or two-client revocation evidence. See
`tasks/forward-backend-verification-2026-10-20.md`; F2 UI evidence follows below.

F2 preparation/client foundation: `test:forwards:api` passes20 controlled groups;
backend default suite passes429 tests/87 suites. Preparation preserves full source
attachment metadata; frozen command tests cover same-payload retry and committed
tombstones. Validate/build and existing thread/GIF/send-attempt regressions pass.
No UI is connected or browser-tested by this increment. See
`tasks/forward-client-verification-2026-10-20.md` and its open consumer/live gates.

F2 connected member UI: run `npm run test:forwards:api` (23 adapter groups) and
`npm run test:e2e:forwards` against the production Next server on port 3117.
The browser harness covers deliberate selection, query changes clearing hidden
recipients, unchanged-command uncertain retry, draft/focus, source revocation and
actual source-library requests, VI/EN and four-width light/dark/custom captures.
It intercepts canonical HTTP and controlled SockJS/STOMP; it is not a live
Cassandra/provider or multi-client test. Evidence and limitations:
`tasks/forward-ui-verification-2026-10-20.md`.

### Durable call authority prerequisite (C1)

C3 authorized history API follow-up2026-10-23:
`tasks/call-history-api-verification-2026-10-23.md` records own/room UTC-month
pages, exact participant detail, full scoped tuple cursors, current actor access,
fenced overdue expiry and actor-relative outcomes/consent facts. Final default
JUnit606/106 suites passes with zero failures/errors/skips;35 tests belong to
the four new history service/view/MVC/security suites. Actual signed-JWT filter
chain and MVC/Jackson/OpenAPI checks use controlled service/storage ports, not
live Cassandra. Static schema remains84 tables/713 columns. Member UI, live
revocation/two-client/crash/broker/media and new-contact peer eligibility remain
separate gates. No new frontend build/browser result is claimed by this slice.

C3 producer follow-up2026-10-23:
`tasks/call-history-producer-verification-2026-10-23.md` records immutable UTC-month
room/own indexes prewritten before authority claim, complete tie reads and
failure/retry/mutation guards. Focused32/3 suites and full default571/102 suites
pass; static schema84 tables/713 columns passes. New real-driver history IT is
compiled but unrun with Docker deferred. No public history API/UI or participant/
media acceptance was claimed by this producer increment; the subsequent API
report above records authorized hydration. Member UI and live C3 acceptance
remain open. No new frontend browser evidence is claimed by this producer slice.

Current C2 follow-up: `tasks/call-recovery-verification-2026-10-20.md` records
the connected cyclic worker/publication receipt and STATE contract;
`tasks/call-active-query-verification-2026-10-20.md` records the authenticated
point lookup; `tasks/call-client-recovery-verification-2026-10-20.md` records
active-DM entry/reconnect and detached-session UI. Historical prerequisites below
are not claims that those follow-ups were tested in the earlier runs. Global
incoming, history and live Cassandra/broker/crash/media acceptance remain open.

Connected incoming reminder follow-up,2026-10-22:
`tasks/incoming-call-ui-verification-2026-10-22.md` records the protected-route
private STATE subscriber/UI, memory-only session inbox, verified caller lookup,
explicit DM handoff and no automatic devices/mutations/focus theft. Run
`npm run test:calls:inbox` (31) and `npm run test:e2e:incoming-calls` (24 final
production Chromium groups against owned3117). VI/EN, signed-in public-invite
non-mount, four-width light/dark captures and independent scoped finish review
are recorded. Validate/build, locale1220, call32/workspace39/thread19 regressions
pass. Controlled HTTP/STOMP is not a live broker, offline pending-call lookup,
C3 history or Cassandra/crash/media gate; Docker remains deferred by the user.

Incoming discovery backend follow-up,2026-10-22:
`tasks/incoming-call-discovery-verification-2026-10-22.md` records pre-claim
callee/deadline discovery keys, current authority/access hydration, scoped
keyset pagination and canonical no-store JSON. Focused65 and full default561
tests/101 suites pass without failures/errors/skips using JDK20. Static schema
guard passes84 tables/720 columns and2 UDTs. Real MVC/security-chain tests use
signed generated test JWTs and controlled service/storage; no provider or live
database. The opt-in Cassandra class compiles with a new index paging/retention
test but was not run with Docker deferred. Frontend reload/reconnect lookup,
actual TTL/crash/broker and C3 history remain open; no new UI/browser evidence
is claimed by this backend-only follow-up.

Incoming discovery frontend follow-up,2026-10-22:
`tasks/incoming-call-client-verification-2026-10-22.md` records subscribe-before-
lookup on protected reload/reconnect, canonical HTTP/STATE merging, abort/session
fences, filtered continuation, bounded batches and local retry/dismiss feedback.
Run `test:calls:incoming-api` (85), `test:calls:discovery` (12),
`test:calls:inbox` (38) and `test:e2e:incoming-calls` (final49 groups/36GETs)
against the production Next server3117. Final17 captures cover four widths/both
themes plus English error; call32/workspace39/thread19, auth-lifecycle7,
realtime-subscriptions11, locale1225, auth-recovery3 and validate/build pass.
These are controlled transport/model/Chromium checks, not live Cassandra,
TTL/crash, broker/two-client, real media or C3 history acceptance. The report
records finite128-entry memory and disconnect/missed-event limitations. Backend
tests in the preceding report are historical prerequisite evidence, not rerun
by this frontend-only increment. Docker remains deferred by the user.

Participant-private server routing follow-up:
`tasks/call-private-state-verification-2026-10-20.md` records STATE handoff to both
user destinations, outbound revalidation and real Spring converter/resolver/encoder
tests. It is not a browser-global incoming UI, offline delivery or multi-node
broker acceptance. The active-DM client report remains scoped to that surface.

Deep-link/queued-subscription follow-up:
`tasks/conversation-point-summary-verification-2026-10-20.md` records the canonical
member-summary endpoint/adapter and a browser DM absent from the first directory
page. It also records the queued-subscription startup race and focused realtime
adapter regression test. This is not a global incoming-call UI or live broker gate.

`tasks/conversation-entry-ux-verification-2026-10-20.md` adds local summary-entry
loading/error/retry, session/selection ownership, deep-link exit and retained
locale checks. Final controlled model24, call/entry32, workspace39 and thread19
pass. Known-room initial message-history failures and global incoming are not
claimed fixed by the summary-entry tests.

`CallStateTest`, `CallLifecycleServiceTest` and `CassandraCallRepositoryTest`
cover 28 controlled tests: roles/terminal outcomes, deadline precedence,
both-peer heartbeat lease, exact identity retry, model-level competing starts,
current DM/access/block checks, pending-prewrite fencing and CQL bindings.
The default backend suite passes 457 tests / 90 suites. This is not C2 signaling
or C3 history acceptance. `CallLifecycleCassandraIT` is compiled and explicitly
included by the opt-in `chat-cassandra-it` profile, but unrun with Docker deferred.
Evidence: `tasks/call-authority-verification-2026-10-20.md`; ADR 0017.

C2 command-boundary tests add real lifecycle dispatch, version-stable replay,
post-commit broker failure recovery through the atomic in-memory model, exact
signal targeting, role/shape/length restrictions and sanitized error correlation.
`CallSignalingServiceTest` is not a wired STOMP or browser test. The controller,
private queue, client, worker and live gates remain open; see
`tasks/call-signaling-foundation-verification-2026-10-20.md`.

Connected follow-up: `CallControllerTest` runs actual Spring mappings and JSON
conversion for all eight actions, asserting the originating session on private
results and AsyncAPI/source parity. The interceptor tests active-user command and
exact result-queue authorization. Heartbeat archive/block regression is covered.
The default backend suite now has476 tests.
Run `npm run test:calls:channel` (20 groups) and `npm run test:e2e:calls` against
production Next port3117 (20 groups, four widths/two themes plus custom captures).
The browser uses controlled HTTP/STOMP and fake media, including real reconnect
framing, same-ID retry/local-attempt isolation, negotiation timeout and permission
failure. This does not satisfy real CQL/broker/media acceptance. Global incoming,
reload discovery, worker/event recovery and C3 history remain open. See
`tasks/call-transport-verification-2026-10-20.md`.

### C3 member call-history UI follow-up — 2026-10-23

Run frontend `npm run test:calls:history-api` (111 checks),
`npm run test:calls:history-reader` (19 groups), and
`npm run test:e2e:call-history` against a production Next server on3117
(17 groups/33 history reads). The browser uses isolated synthetic canonical
HTTP/STOMP, not real accounts or devices. It covers own/DM history, explicit
UTC month/continuation, detail consent roles, request ownership, retry/denial,
focus/Escape, four widths in both themes/custom room background and English.
Seventeen captures and `call-history-browser-report.json` live under frontend
`.impeccable/review/`. Final wrapper correction is checked by upper-right close
bounds and text contrast assertions. The final report retains one incumbent
presence-subscribe/disconnected warning during reload; no unexpected history
errors/request failures, call commands or media acquisition occurred.

Call32/workspace39/incoming49 regressions and full frontend validate/build pass;
these controlled checks do not satisfy real Cassandra, broker, two-client,
restart/crash or media-provider acceptance. Evidence and scoped finish status:
`tasks/call-history-ui-verification-2026-10-23.md`.

### Direct-call contact accounts — 2026-10-23

Canonical actor/peer account eligibility is tested by
`CallContactEligibilityTest` (22 tests), plus the real MVC/JWT
`ChatReadHttpSecurityTest` peer-denial case. Default `./mvnw.cmd -q test` on
JDK20 passes629 tests/107 suites with no failures/errors/skips; all107 fresh
reports were separated from the old2026-10-20 `ChatReadCassandraIT` Docker error
report, which was not rerun and is not passing evidence. Schema guard remains
84 tables/713 columns/2 UDTs. Full evidence and point-in-time versus atomic/live
revocation limits: `tasks/call-contact-eligibility-verification-2026-10-23.md`.

## Media upload preflight (2026-10-23)

`CloudinaryMediaUploadTest` and `ImageUploadPreflightTest` add 29 controlled tests
for actual-byte limits, MIME/header/canvas admission and provider-call isolation.
The default Java 20 run passed 658 tests across 109 fresh suites. No live provider
or Cassandra execution is implied; no frontend source changed in this increment.
See `tasks/media-upload-preflight-verification-2026-10-23.md` for commands, red
reproduction, real local WebP header check, old-report exclusion and remaining
thumbnail/lifecycle work.

## Confirmed media derivatives (2026-10-23)

`CloudinaryThumbnailPolicyTest`, `CloudinaryMediaThumbnailsTest`,
`MediaThumbnailRepositoryTest` and `MediaThumbnailControllerTest` add 39 tests:
actual installed SDK request encoding without network, provider response/identity
validation, upload persistence, owner access, bounded query/logged batch bindings,
standalone MVC JSON/errors and whole-OpenAPI YAML parsing. Full Java 20 run:
697 tests/113 fresh suites, no failures/errors/skips. Schema guard 84/714/2 passes.
The old Docker-dependent IT report is excluded as historical, not deleted or
treated as newly passing. No live provider/database/browser evidence is implied.
Commands, exact test scope and remaining M2/M3 gates:
`tasks/media-thumbnail-verification-2026-10-23.md`.

## Attachment metadata and exact-command retry (2026-10-23)

`test:attachments:metadata` verifies seven production-adapter/optimistic callback
groups. `test:e2e:attachments` exercises actual file selection, a controlled 503,
keyboard bubble retry and exact request/asset reuse: one upload, two sends, eight
light/dark width configurations with captures and no unexpected browser errors,
warnings or failed requests. Provider/broker/HTTP boundaries are fixtures.

Six additional MessageAttachmentPolicy tests cover registered READY thumbnail
matching, rejection/access/failure order and exact source dimensions/duration.
Full backend: 703 tests / 113 fresh suites, no failures/errors/skips. Additional
OpenAPI parsing/controller run passes after documentation changes. Validate/build,
chat workspace39, thread19, text draft/reload, GIF15, sticker4, send-attempt19,
forward adapter23 and locale1239 regressions pass.

The original command snapshot is memory-only and is removed after confirmation;
no persistent attachment outbox/reload or composer-upload reuse is implied. Exact
commands, file list, capture paths and remaining media lifecycle gates:
`tasks/attachment-metadata-verification-2026-10-23.md`.

## Composer confirmed-upload reuse (2026-10-23)

`test:attachments:upload-cache` passes seven controlled production-model groups.
`test:e2e:attachments` now supports ATTACHMENT_RETRY_MODE values composer, bubble,
new-draft, partial-upload and leave-upload. All five ran against the final owned
production build: 23 grouped checks; 32 final light/dark width captures for completed
sends. Composer/bubble retries use one upload/two identical message posts. Partial
upload uses three attempts for two files/one complete message, never a partial
message. Room departure observes actual client abort and zero message posts.

New-draft acceptance asserts old confirmed-file removal while keeping new text and
the newly selected file. Validate/build/final lint, metadata7, GIF15, sticker4,
send-attempt19, locale1239 and draft/edit/chat-workspace39 regressions pass. No
backend/schema rerun or live provider result is implied. The owned localhost server
was stopped and port3117 checked empty. Full commands and the separate offline-call
overlay defect: `tasks/composer-upload-recovery-verification-2026-10-23.md`.

### Incoming lookup layout follow-up — 2026-10-23

The previously recorded composer interception defect is now fixed by a measured
in-flow lookup row, not by suppressing feedback. Run message-edit smoke with
`EDIT_OFFLINE_CALLS=1` and `SMOKE_BASE_URL` pointing at an owned production server
to check waiting-state Save actions across 320/768/1024/1440 and light/dark.
Incoming-call browser65 also checks loading/error/unfinished in-flow layout;
workspace39 and discovery12/inbox38 regressions pass. Scope, screenshots and live
gates: `tasks/incoming-call-feedback-layout-verification-2026-10-23.md`.

### Message-scoped attachment reads — 2026-10-23

`test:attachments:read-api` (7 groups) and `test:e2e:attachments-read` (18 groups)
cover received/reloaded media, canonical MESSAGE_SEND, unavailable/error/forbidden,
spoiler no-preload, continuation and broken-image retry. Browser fixtures decode a
1px PNG; this does not prove live provider quality or playback. Sender bubble,
partial-upload and new-draft recovery regressions remain green against the new
confirmed-message read contract. Backend source full715 plus latest targeted13,
validate/build and thread19/workspace39 pass. Commands, captures and limitations:
`tasks/message-attachment-read-verification-2026-10-23.md`.

### Frozen attachment replay repair — 2026-10-23

Backend `MessageServiceTest` now covers initial-send interruption after message
commit, ordinary exact-payload reference repair, another interrupted repair,
deleted authority and fingerprint conflict. `MessageAttachmentRepositoryTest`
checks stable UDT/key binding, explicit LOCAL_QUORUM reads/writes and propagated
errors. Focused64 and final full724/116 fresh suites pass. Controlled repository
failures are not a process-crash/live-Cassandra proof. Durable side-effect
completion and conditional initial message creation remain open; see
`tasks/message-attachment-repair-verification-2026-10-23.md`.

### Conditional message creation — 2026-10-23

MessageCreationServiceTest5 and MessageCreationRepositoryTest2 cover applied /
unapplied/unknown creation outcomes, both claim-ownership interleavings, existing
edit/delete preservation and actual-creator publication. Old reply/forward tests
now verify conditional authority followed by deterministic repair, not the
superseded logged create batch. Focused56 and final full731/118 fresh suites pass.
ChatReadCassandraIT has an additional real two-client creation/edit/delete/revision
gate; it compiles but **was not run** while Docker remains deferred. ADR0023 and
`tasks/message-creation-verification-2026-10-23.md` explain distributed limits.

### Backend message revisions — 2026-10-23

MessageRevisionContractTest6 checks actual stored revision hydration, public
tombstone preservation, MVC JSON, real service realtime/projection payloads and
OpenAPI/AsyncAPI required bounds. MessageRevisionMutationTest3 checks exact CAS
prior/next, invalid storage and overflow without a write. Final full740/120 fresh
suites pass. Opt-in two-client IT revision assertions compile but were not run.
Frontend reconciliation/search ordering was a separate pending consumer slice;
`tasks/message-revision-contract-verification-2026-10-23.md` and ADR0024.

### Frontend message revisions — 2026-10-23

`node scripts/message-revision-order-smoke.mjs` runs 14 controlled groups against
actual store factories and adapter: invalid/missing revision, delayed live/edit,
deleted authority, history races/pagination and preview/timeuuid ordering.
`tasks/message-revision-client-verification-2026-10-23.md` records regression
commands, browser widths/themes and final-source results. These are controlled
client checks, not evidence that the deferred Cassandra/two-client/crash gate ran.

### Versioned conversation previews — 2026-10-23

Actual-service/MVC/repository tests cover edited/deleted authority, exact source
bucket, one point read per preview, missing authority and280-character bound.
Default backend747/120 fresh suites pass; schema guard passes with21 UDT fields.
Frontend directory adapter20/revision model14, validate/build and Chromium edit
reload/workspace39 pass. See
`tasks/conversation-preview-authority-verification-2026-10-23.md` for commands and
the fresh-bootstrap-only schema boundary. No live datastore/schema acceptance.

### Atomic search content snapshots — 2026-10-23

Focused projector/writer/repository-factory/search-reader8 and default752/122
fresh suites pass. Controlled tests verify canonical revision rejection, typed
scripted-upsert construction, redacted payloads, independent metadata paths,
failure propagation and fragment composition, not Painless execution. Opt-in
`./mvnw.cmd -q -Dtest=MessageSearchProjectionIT test` compiles but was **not run**
while Docker is deferred. It targets real Elasticsearch8.18.8 delayed/reordered
content and concurrent first writers. ADR0025 and
`tasks/message-search-ordering-verification-2026-10-23.md` record exact limits;
pin ordering/lost events/reindex and full runtime acceptance remain open.

### Exact message unpin release — 2026-10-23

MessagePinSlotRepositoryTest4 covers the exact bucket/message/timeuuid-generation
predicate, quorum/serial bindings, failed ownership, missing generation and no
unrelated slot release. A service regression rejects false success publication.
Default757/123 fresh suites pass. New two-client swapped-slot/same-message ABA
cases in ChatReadCassandraIT compile but were not run while Docker is deferred.
`tasks/message-unpin-ownership-verification-2026-10-23.md` records commands and
remaining versioned pin authority/projection/duplicate-claim/crash boundaries.

### Version-fenced pin capacity — 2026-10-23

MessagePinSlotRepositoryTest now has9 controlled cases including same-partition
revision/slot batching, exact prior/next binding, capacity5, duplicate claimant
reload, overflow, absent-vs-invalid state and retained generation release guards.
Default762/123 fresh suites and final focused9 pass; schema guard passes with
715 table columns and explicit static bigint validation. New same-message
two-client pin IT compiles but was not executed. ADR0026 and
`tasks/message-pin-capacity-verification-2026-10-23.md` distinguish internal
capacity mutation from still-open public snapshot/idempotency/publication/runtime
acceptance. No existing database was migrated or reset.

### Canonical full-pin protocol — 2026-10-23

Default770/124 fresh suites pass: required expected-revision body, no-store full
snapshot JSON/int64 string, stale intent, no-op publication suppression and pin
event version coverage. Frontend validate/build, adapter6/model18 and locale-copy
checks pass. Production Chromium interactions and extended workspace42 verify
HTTP pin/unpin0→1, reload, delivered full-state ordering10→11→stale10 and eight
theme/width cases. An initial combined-run read-ack timeout is retained in the
evidence; isolated and final rebuilt-source sequential repeats passed without
weakening assertions. Real pin-revision Painless/two-client IT remains compile-only.
ADR0027 and `tasks/message-pin-protocol-verification-2026-10-23.md` record current
projection/deletion/publication and runtime limits.

### Authoritative pin reads and empty candidate pages — 2026-10-23

Full default774/124 fresh suites pass, including stale projected flags on point,
history, thread, shared/forward source and search. Search checks no index pin
prefilter and retains continuation for empty visible candidate pages. Frontend
validate/build, production search baseline and empty-page continuation across
320/768/1024/1440 light/dark pass; final interaction regression also passes.
Screenshots and retained harness-development failures are described in
`tasks/message-pin-read-verification-2026-10-23.md`. All browser API data is
controlled. Stored projection repair, deletion cleanup and live engine/broker/
crash acceptance remain open; Docker remains user-deferred.

### Pin lookup recovery — 2026-10-23

`npm run test:messages:pin-sync` mounts the actual hook in React/DOM with
controlled boundaries:4 lifecycle groups pass. Adapter6/store18 and locale1248
checks pass. Production `PIN_LOOKUP_RECOVERY=1 node
scripts/message-interactions-smoke.mjs` proves repeated failure, disabled pending
Retry, successful recovery then actual observed-revision pin/unpin commands;
feedback captures cover all eight widths/themes. Workspace42 and frontend
validate/build pass. Evidence and retained harness failures:
`tasks/message-pin-retry-verification-2026-10-23.md`. Live gates remain open.

### Deleted pinned messages and concurrent commands — 2026-10-23

Final default JDK20 `./mvnw.cmd -q test`:789 tests/126 fresh suites, no failures,
errors or skips. Includes tombstone-only cleanup6, focused service deletion/
retry/read-repair and deterministic two-thread before/after pin-commit cases,
plus explicit deletion quorum/serial regression. No real engine proof implied.
Actual frontend store ordering20 and ordinary/pinned production browser deletion
pass; pinned mode reload and all eight theme/width cases retain tombstones with
no old content/actions. Frontend lint and diff check pass. No runtime frontend
source edit: prior production build reused. ADR0028 and
`tasks/deleted-message-pin-verification-2026-10-23.md` retain earlier failing
regressions, fixture corrections, screenshots and crash/live limitations.

### Typed global settings backend — 2026-10-23

Default JDK20 `./mvnw.cmd -q test`:817 tests/131 fresh suites, zero failures,
errors or skips. New catalog/repository/service/audit-recovery/MVC groups plus
actual public-community creation consumer tests pass. Covers strict JSON types,
SYSTEM_OPERATE boundaries, revision conflict, command replay and frozen audit
export recovery with bounded cursors. Static schema guard passes84/720 and2 UDTs/
21 fields. Updated OpenAPI parsing/infrastructure and compact contract manifest
are checked separately. No admin form/browser claim: A2 and real Cassandra/crash
gates remain open. ADR0029 and
`tasks/system-settings-backend-verification-2026-10-23.md`.

### Application settings UI / reduced admin density — 2026-10-23

Exit follow-up: `npm run test:settings:exit`6 state groups and the extended
`npm run test:e2e:system-settings`30 browser groups pass; eight light/dark width
cases include the protected exit dialog. Stay/Escape retains drafts, explicit
Leave navigates without PUT/retry, multiple editors aggregate correctly, native
warning clears on Cancel/denial, and English permission reload has no hydration
error. Actual admin operations and sticker-admin18 regressions pass; validate
and build pass. Evidence: `tasks/system-settings-exit-verification-2026-10-23.md`.
Not arbitrary route/browser Back/Forward or reload-persistent draft recovery.

`npm run test:settings:api`:7 controlled adapter groups; `npm run test:errors:copy`:
8 policy/status locale cases plus six unsafe-copy guards; locale1240, validate
and production build pass. `npm run test:e2e:system-settings` against the owned
production server proves20 groups and eight list+editor theme/width cases,
including protected focus, retained drafts, exact uncertain retry and authority-
driven preview. The final UI supersedes the first verbose form layout rejected
by the user. Admin operations, sticker18, pinned deletion8, poll and community
policy creation regressions pass. Current backend819 tests/132 fresh suites,
zero failures/errors/skips. Independent finish review scored its three required
refresh/mobile-name/close-target corrections resolved, not whole-app approval.

Evidence/captures and intermediate harness corrections:
`tasks/system-settings-ui-verification-2026-10-23.md`. All browser transport is
controlled; live Cassandra/process-kill/two-client gates stay open. Memory-only
drafts/retry commands and absence of a full SPA route-leave guard are explicit.

### Admin report inbox — 2026-10-23

From `chatapp_frontend`, `npm run test:admin:reports` runs25 controlled model/
search/label assertions. With a local production server at3117,
`npm run test:e2e:admin-reports` intercepts transport for14 groups and26 light/
dark320/768/1024/1440 captures. Set SMOKE_BASE_URL for another local port.
It never submits reports, sanctions or private investigations to a real backend.
Coverage includes own decision reasons, retained/resumed/discarded drafts,
busy/repeated input, app/native exit, late reads/old-target history and unknown
write results without blind re-submission. The two expected503/500 console
errors and one500 warning are recorded, not hidden as successful traffic.

Validate/build, admin mutation, room/workbench18 and settings30 regressions
pass. `tasks/admin-report-inbox-verification-2026-10-23.md` records the current
fixture boundaries, corrected capture synchronization and scoped finish review.
This does not prove Cassandra report transitions, concurrent reviewers,
crash-safe audit publication or durable draft recovery.

### Admin imagery and actionable preview — 2026-10-23

The current production UI checks use the same commands above, plus
`test:e2e:admin-visual` and `test:e2e:stickers-admin` (set SMOKE_BASE_URL to the
owned local server). Settings preview buttons must open the correct editor,
return keyboard focus to that exact trigger, never save implicitly and never
show unsaved values as current policy. Overview report previews must open the
exact selected report, including after mobile Back. Cover fixtures include
valid, missing and corrupt local imagery. Reduced-motion assertions accept the
existing0.01ms global override, not just the literal CSS value `0s`.

`tasks/admin-visual-affordances-verification-2026-10-23.md` records controlled
transport, production build identity, screenshot scope and finish-review limits.
These checks do not supply real artwork or extend into live datastore/provider
acceptance. The removed ornamental Play/Pause path is not a required behavior.

### Image-led settings without duplicate preview — 2026-10-23

The application-settings layout above is superseded by one illustrated
composition containing the actual saved-setting controls. There are no separate
preview actions or duplicate values. `test:e2e:system-settings` retains the30
controlled groups and eight theme/width cases; it additionally checks numeric
presets change only the draft, uncertain saves lock presets, and artwork failure
does not prevent editing. Both operations remain in the first viewport. Current
evidence/build identity and12captures:
`tasks/admin-settings-visual-controls-verification-2026-10-23.md`.

`test:settings:api`, `test:settings:exit`, `test:e2e:admin-visual` and
`test:e2e:admin` regressions passed on the same build (set SMOKE_BASE_URL for
the owned3117 server). Browser transport remains synthetic and isolated. The
authored community illustration is not actual members or usage; provenance and
delivery conversion are recorded in `docs/brand/noi-community-settings-art.md`.

### Admin user workspace — 2026-10-23

With a local production server at3117, run `npm run test:e2e:admin-users` from
`chatapp_frontend` (override SMOKE_BASE_URL for another local port). Its isolated
transport covers9behavior groups: search errors/empty/late reads, independent
roles/sessions/devices, permission-specific operations and owned audit reasons,
dirty replacement/Back, busy lock, unknown outcome with no blind retry, self
account/bootstrap protection, expiry, English denial and scoped authority
recovery. Recovery must not repeat the denied write or discard another report
draft. Restore-only operators must not see an unusable action for ACTIVE users.

The suite captures eight profile theme/width cases and four compact operation
dialogs in `.impeccable/review/admin-users/`. SMOKE_CAPTURE=false reruns behavior
without replacing those captures; use only when source/build identity is
unchanged. `tasks/admin-user-workspace-verification-2026-10-23.md` records build,
negative-path failures, regression results and the scoped finish verdict.
`test:e2e:admin-reports` now opens the explicit profile Sanctions action before
checking late target-history ownership; selecting a user alone does not load it.

These checks run synthetic canonical responses, never real admin writes or
private investigations. They do not prove live Cassandra, concurrent operators,
distributed audit/idempotency, browser Back/Forward or persistent draft recovery.

### Report recovery integration

From `chat-service`, run `./mvnw -Preport-recovery-it test` (Windows:
`.\mvnw.cmd -Preport-recovery-it test`) when Docker is available. The opt-in
profile runs only `ReportDecisionCassandraIT` and `ReportOutboxKafkaIT`
against isolated Testcontainers; it does not connect to an existing database
or broker. The combined test uses the real bootstrap schema and a Kafka
broker, injects a projection failure after the Cassandra CAS, then replaces
the driver session and worker. It verifies the original event in Kafka, a
durable Cassandra receipt, and no resend after re-enqueue with that receipt.
The narrower Kafka test uses a controlled outbox seam. The combined test
simulates a process failure at the driver boundary, not a process kill or
an exactly-once delivery guarantee.

For compile-only verification without starting containers, use
`./mvnw -Preport-recovery-it test-compile`.
