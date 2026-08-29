# Testing strategy

Backend: Maven unit/service tests cover auth, refresh rotation, directory,
friendship, conversations, message idempotency/cursor merge, policies, roles,
contracts, report moderation, sanction expiry, actuator authority, session/device admin controls, direct-call peer authorization, notification settings policy, room notification precedence/evaluator, notification pagination, and infrastructure manifests (99 tests, 0
failures, 0 errors) when run with Java 20. On this host the default Java 17
cannot execute Java 20 test classes; use `JAVA_HOME=C:\\Program Files\\Java\\jdk-20`.
Frontend: `npm run type-check`,
`npm run build` (Next), `npm run lint`
(zero errors), and `npm run test:e2e:smoke` with `next start` running.

The public/deep-link Playwright smoke currently passes (`/`, `/login`, `/about`,
`/403`, `/search`, `/settings?tab=reports`, and `/admin` with unauthenticated redirect) with zero
console errors or request failures. The global admin page is therefore covered
for deep-link protection. A mock-authenticated Playwright check also loads the
operator overview plus bounded admin panels, verifies the VI→EN admin heading
and validation feedback, exports the audit CSV, and verifies `/admin` → `/app`
navigation with zero console/request failures via `npm run test:e2e:admin`; it
does not replace a real backend journey. An authenticated Cassandra-backed
operator journey is still pending. Pending layers: Testcontainers/compose integration for
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
state before and after a tab change. An unavailable realtime transport does not
block the REST-backed screen. Realtime transport failures are reported
separately because the local
integration stack is intentionally absent.

`npm run test:e2e:profile` loads the authenticated profile route with an explicit
HTTP-boundary fixture and verifies the profile quick-link title and all link
labels after switching from Vietnamese to English.

`npm run test:e2e:presence` loads the authenticated workspace with an explicit
HTTP-boundary fixture, verifies the Online/Do not disturb/Invisible status menu
in Vietnamese and English, verifies the status control keeps an accessible name
at 390px, and keeps unavailable realtime transport separate from UI assertions.
The Contacts view tracks the active friend/request/search rows through the same
presence subscription path; live STOMP snapshots remain an integration concern.

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
