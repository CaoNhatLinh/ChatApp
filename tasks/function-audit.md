# NovaChat End-to-End Function Audit

Audit date: 2026-08-29 (Asia/Saigon)

## Status legend

- **Working:** build/test evidence exists for the current contract.
- **Partial:** production code exists, but the flow is incomplete, untested, or disconnected.
- **Wrong:** an existing implementation conflicts with the canonical contract or fails verification.
- **Missing:** no production implementation was found for the capability.
- **Blocked:** verification requires a missing local dependency.

No capability is considered end-to-end complete until the browser flow, Spring adapter,
authorization, Cassandra write/query, required runtime integrations, and automated evidence all pass.

## Verified baseline

| Gate | Result | Evidence |
| --- | --- | --- |
| Frontend type-check | Working | `npm run type-check` exited 0. |
| Frontend lint | Working | `npm run lint` exits 0 with no warnings or errors after splitting the i18n barrel, runtime, provider and hooks modules. |
| Frontend production build | Working with risk | Next.js App Router production build exits 0; authenticated bundle/runtime profiling remains pending. |
| Backend compile/test | Working at unit level | With Java 20 (`JAVA_HOME=C:\\Program Files\\Java\\jdk-20`), `mvnw test` reports 97 tests, 0 failures, 0 errors. The host default Java 17 cannot run the Java 20 test classes; clean-stack integration is still pending. |
| Docker Compose validation | Blocked | Docker executable is not installed or not in `PATH`. |
| Browser E2E | Partial | `scripts/browser-smoke.mjs`, `locale-smoke.mjs`, `admin-route-smoke.mjs`, `notification-settings-smoke.mjs`, `contacts-locale-smoke.mjs`, `profile-locale-smoke.mjs`, `presence-status-smoke.mjs`, and `search-filter-smoke.mjs` pass their bounded journeys; authenticated multi-account E2E is still pending. |
| Backend automated evidence | Partial | Unit/contract tests pass; no clean-stack Cassandra/Kafka/Redis/Elasticsearch integration suite is available on this host. |

The shared copy registries are additionally guarded by
`chatapp_frontend/scripts/locale-copy-smoke.mjs` (`npm run test:i18n:copy`):
764 static Vietnamese copy keys are checked and currently have no missing
English translation key, including every static `localizeText(...)` call under
`src/`. This is a source-contract check, not evidence of live
provider delivery or authenticated service persistence.

User-facing failure copy is additionally guarded by
`chatapp_frontend/scripts/error-copy-smoke.mjs` (`npm run test:errors:copy`).
The check covers messenger, relationships, report modals, calls, and presence;
it rejects direct native exception/server response rendering while allowing
operator-only diagnostic logs.

The public/auth/recovery responsive and accessibility baseline is guarded by
`chatapp_frontend/scripts/ui-quality-smoke.mjs`
(`npm run test:e2e:ui-quality`) at 320px and 1440px. It currently passes with
one visible `h1` per route, no horizontal overflow, named controls, labeled
fields, valid links, and no console/request failures; authenticated workspace
coverage remains pending.

## Complete function inventory

| Domain | Functions that must work end-to-end | Current status | Main gaps / wrong behavior |
| --- | --- | --- | --- |
| Public/auth shell | Home, about, help, privacy, terms, 404, login redirect, protected routes | Implemented but not fully verified | Native Next App Router entries, loading/error/not-found, public pages and protected redirect are built and smoke-tested; authenticated service journey remains pending. |
| Identity and sessions | Register, login, logout, current user, refresh rotation, revoke sessions, devices, profile update/search | Partial | Register/login/me/logout and rotating refresh cookie paths exist; canonical device registration/heartbeat plus admin revocation are wired; authenticated Cassandra/browser journey and refresh-token/device integration evidence remain. |
| App RBAC/admin identity | Assign/remove app roles, permission evaluation, global user status, protected admin actions | Implemented but not fully verified | Server-gated `/admin` UI and app-role/status APIs are present; full permission matrix and integration tests remain. |
| Friends and blocks | Search user, send/cancel/accept/reject request, list friends/requests/status, mutual friends, block/unblock | Implemented but not fully verified | Canonical friendship projections, user search, request/status/mutual/block routes and frontend adapters are present; live two-user journey remains. |
| Presence | Online/custom status, heartbeat, multi-tab/device presence, subscribe/unsubscribe, reconnect snapshot | Implemented but not fully verified | Presence service/controller, heartbeat, batch sync, local/Redis TTL, workspace status selector, and bounded room/contact subscriptions are present; Redis reconnect/two-instance proof remains. |
| Room creation/discovery | Idempotent DM, group, private channel, community channel, visibility/search/join policy | Implemented but not fully verified | Canonical DM/group create/list/member APIs and frontend adapters are present; community discovery and live join-policy proof remain. |
| Room list/order/unread | Per-user list, last-message preview, automatic reorder, cursor pagination, unread watermark | Implemented but not fully verified | Per-user projection/last-message DTO and canonical list route are wired; live projection and cursor mutation proof remain. |
| Room pins | Personal pin/unpin/reorder with atomic max 3 | Implemented but not fully verified | Slot-based POST/DELETE contract and frontend pin/unpin adapters are wired; concurrent max-3 integration proof remains. |
| Room roles/membership | Custom roles/color/order/permission union, add/join/assign/remove/kick/leave/transfer owner | Implemented but not fully verified | Member search/add/remove/leave, role listing/assignment, kick and chat policy UI hooks are wired; hierarchy/system-message/audit proof remains. |
| Messaging history/send | Bucketed history, idempotent `clientMessageId`, optimistic reconcile, cursor traversal | Implemented but not fully verified | Bucket-aware cursor history, idempotent send and canonical frontend pagination are wired; clean Cassandra retry/boundary proof remains. |
| Message interactions | Reply, mention, reaction add/remove/counts, read watermark/seen-by, forward | Implemented but not fully verified | Reactions, monotonic read receipt, revision/pin routes and realtime events are wired; reply/mention/seen-by and browser reconciliation remain. |
| Edit/delete/pins | Edit window, soft delete, revisions, max-5 message pins | Implemented but not fully verified | Edit/delete/pin/unpin backend/frontend paths exist; revision query and concurrency/permission proof remain. |
| Media | Single/multiple upload, immutable attachment metadata, preview/thumbnail, safe delete/webhook/cleanup | Implemented but not fully verified | Controller/service and frontend uploader preserve attachment metadata; trusted webhook, reference-safe cleanup, lifecycle tests and Cloudinary E2E remain. |
| Realtime | JWT STOMP, authorized subscriptions, message/reaction/read/pin events, reconnect/resync, cross-instance fan-out | Implemented but not fully verified | Authenticated STOMP commands, message/reaction/read/pin/call publishers, notification/presence queues and frontend subscriptions are wired; authorization/two-instance tests remain. |
| Rate limits/chat policy | Distributed rate limit, timed mute/slow mode, EVERYONE/ADMINS_ONLY/LOCKED | Implemented but not fully verified | Canonical policy/member override requests are wired; Redis atomic enforcement, expiry, retryAfter and cross-instance tests remain. |
| Outbox/Kafka | Cassandra outbox claim/publish/retry/DLQ/replay and idempotent consumers | Partial | Publisher now reads a dedicated pending Cassandra projection and atomically removes it after Kafka acknowledgement; listener failures retry three times then publish to the configured DLT, while consumer idempotency, replay, integration tests and operational metrics remain incomplete. |
| Search | Authorized room/message search, full filter matrix, projections, rebuild/reindex | Partial | The frontend now exposes the canonical message filter matrix (sender, reply sender, mention, type, date range, attachment, pin) and maps it to the authorized message-search contract. Room search, membership leakage tests, and rebuild workflow are missing; live Elasticsearch proof remains pending. |
| Polls | Create/get/vote/change/remove/close/deadline/anonymous policy and realtime UI | Partial | REST and UI clients/components exist; policy/concurrency/realtime/audit E2E evidence is missing. |
| Moderation | Room ban, timed mute, app sanction, reports, language moderation, appeal/review | Partial | Room bans, timed sanctions, message/profile report submission, caller report history, queue/resolution and operator review UI exist; language moderation and appeals remain. |
| Invites/QR | Preview/create/list/consume/decline/revoke, approval requests, expiry/usage states, QR | Partial | Backend and frontend surfaces exist; concurrency/state/security/browser tests are missing. |
| Notifications | Inbox CRUD, unread counts, global policy precedence, quiet hours, room default, member override, devices, web/mobile delivery | Implemented but not fully verified | Canonical inbox/count/stats/settings/read/delete controller plus evaluator-backed room-default/member-override endpoints, device registration/heartbeat and UI controls are present; latest-12-month Cassandra query and provider delivery are not live-verified. |
| Personal appearance | Global/per-room theme, private background/bubbles, safe asset references | Partial | Source-controlled theme/bubble registry, account-namespaced browser cache, authenticated global/per-room preference endpoints and member authorization are implemented; clean Cassandra persistence and cross-account live proof remain. |
| Voice/video calls | Authorized 1–1 signaling, native browser media lifecycle, call metadata | Implemented but not fully verified | Authorized `/app/call.start|join|leave|signal|end` signaling, native `RTCPeerConnection`, incoming accept/decline and controls are wired; live two-browser media/reconnect proof and approved STUN/TURN remain. Group/SFU is intentionally not exposed. |
| Profile/search pages | Canonical profile update, user/message search and recovery states | Implemented but not fully verified | `/profile` and `/search` use canonical API clients and explicit loading/empty/error states; live directory/search index proof remains. |
| Admin/analytics/operations | Global admin UI, all-room directory, user status/roles, room policy/archive, audit timeline, report queue, sanctions, dashboards, investigation timeline, bounded export, health/metrics/runbooks | Partial | `/admin` native route and `/api/admin/**` cover capability gate, monthly room directory, room policy/archive, user status/app-role/session/device management, monthly audit timeline, bounded CSV audit export, report queue/resolution, sanctions and bounded daily analytics; language moderation, appeals, long-range dashboards and recovery drills remain. |
| Accessibility/performance | Loading/empty/error/offline states, keyboard/SR, responsive UI, virtualization, bundle limits | Partial | Some states and virtualization exist; no accessibility suite or responsive E2E; build reports oversized chunks. |
| Release engineering | Clean Docker start, idempotent schema, integration/E2E/security/load tests, rollback/replay/reindex | Blocked / Missing | Compose files and public smoke harness exist, but Docker/clean-stack integration, multi-account E2E, load/security/recovery evidence remain unavailable locally. |

## Confirmed contract mismatches to fix first

The highest-risk mismatches above have been repaired in the canonical adapters. Remaining
gaps are verification/infrastructure gaps rather than hidden mock success paths: native route
decomposition, clean Cassandra/Kafka/Redis/Elasticsearch runs, authenticated multi-account
browser coverage, full attachment/search/provider delivery, moderation depth and WebRTC media.

## Execution rule

Work follows `tasks/plan.md` and `tasks/todo.md`. A checkbox may be completed only when
its production path and stated verification evidence both exist. Compile, contract, and clean-stack
gates take precedence over adding new feature surface.
