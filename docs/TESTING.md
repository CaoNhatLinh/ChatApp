# Testing strategy

Backend: Maven unit/service tests cover auth, refresh rotation, directory,
friendship, conversations, message idempotency/cursor merge, policies, roles,
contracts, report moderation, sanction expiry, actuator authority, session/device admin controls, direct-call peer authorization, notification settings policy, room notification precedence/evaluator, notification pagination, outgoing friend-request cancellation, atomic room membership/capacity/ownership, role catalog/deletion/assignment concurrency, community discovery/approval recovery, invite compensation, distributed presence scope/fan-out/expiry, conversation cursor pagination, and infrastructure manifests (146 tests, 0
failures, 0 errors) when run with Java 20. On this host the default Java 17
cannot execute Java 20 test classes; use `JAVA_HOME=C:\\Program Files\\Java\\jdk-20`.
Frontend: `npm run type-check`,
`npm run build` (Next), `npm run lint`
(zero errors), and `npm run test:e2e:smoke` with `next start` running.
`npm run test:e2e:room-management` verifies permission-backed room role
creation and assignment, ownership transfer, live VI→EN rendering and the
390px responsive layout against a strict HTTP fixture.

The public/deep-link Playwright smoke currently passes (`/`, `/login`, `/about`,
`/403`, `/search`, `/settings?tab=reports`, and `/admin` with unauthenticated redirect) with zero
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
page with an explicit HTTP-boundary fixture, toggles push delivery, verifies the
canonical `PUT /notifications/settings` payload, and fails on console or request
errors.

`npm run test:e2e:search` loads the authenticated search page with an explicit
HTTP-boundary fixture, verifies message type/attachment/pin filter payloads and
English labels, and confirms that message search is not requested without the
required conversation context.

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

`npm run test:e2e:ui-quality` checks every public/auth/recovery page at 320px
and 1440px: exactly one visible `h1`, no horizontal overflow, accessible names
for visible links/buttons, labels for visible fields, valid link targets, and
zero console/request failures.

All tests must follow BUILD–OPERATE–CHECK and must not silently replace a failed
integration with a mock-success path. The browser admin check stubs only the
HTTP boundary inside the test process; no runtime code contains that stub.
