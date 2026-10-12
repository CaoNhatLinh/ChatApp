# Testing strategy

Backend: Maven unit/service tests cover auth, refresh rotation, directory,
friendship, conversations, message idempotency/cursor merge, policies, roles,
contracts, report moderation, sanction expiry, actuator authority, session/device admin controls, direct-call peer authorization, notification settings policy, room notification precedence/evaluator, notification pagination, outgoing friend-request cancellation, atomic room membership/capacity/ownership, role catalog/deletion/assignment concurrency, community discovery/approval recovery, invite compensation, distributed presence scope/fan-out/expiry, conversation cursor pagination, bounded message interaction hydration, poll concurrency, invite viewer-state recovery, and infrastructure manifests (158 tests, 0
failures, 0 errors) when run with Java 20. On this host the default Java 17
cannot execute Java 20 test classes; use `JAVA_HOME=C:\\Program Files\\Java\\jdk-20`.
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
