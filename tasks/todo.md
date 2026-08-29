# NovaChat Canonical Production Rebuild Checklist

> Không đánh dấu `[x]` nếu chưa có test/command evidence. Runtime chỉ expose contract
> canonical; legacy consumers/data are outside scope and are not restored.

## Recovery Gate: Current Broken/Inconsistent Work

- [X] R.1 Fix friendship projections and run the existing Maven tests (97 tests pass at the current baseline).
- [X] R.2 Freeze OpenAPI + AsyncAPI/STOMP contracts and add duplicate-key/path-parameter checks.
- [ ] R.3 Complete authenticated auth -> user search -> friend -> DM -> message/read E2E flow (implementation is present; live infrastructure and two-account proof are pending).
- [ ] R.4 Add clean-stack integration and Playwright multi-account tests (the public/deep-link smoke harness exists; Docker/Testcontainers stack is unavailable on this host).
- [ ] Recovery checkpoint passes; see `docs/FEATURE_INVENTORY.md` and `docs/TRACEABILITY_MATRIX.md` for the evidence-backed status.

## Phase 0: Contract And Stack Recovery

- [X] 0.1 Capability matrix + deletion guard.
- [ ] 0.2 Final CQL access-pattern/partition/LWT audit (schema and migrations are present; Cassandra parser/clean apply still pending).
- [X] 0.3 Restore Spring Redis/Kafka/Elasticsearch/WebSocket/Cloudinary dependencies and config.
- [ ] 0.4 Complete Docker stack + reliable Cassandra schema-init (Docker is not installed/on PATH here).
- [ ] Checkpoint 0: clean infrastructure and Spring context pass.

## Phase 1: Identity And App RBAC

- [X] 1.1 Canonical Java/TypeScript/OpenAPI/error/event contracts for implemented slices.
- [ ] 1.2 Authentication, refresh rotation, profiles and devices (refresh/profile paths plus canonical device registration/heartbeat are implemented; authenticated integration and refresh-token/device linkage evidence remain).
- [ ] 1.3 App roles, permissions, sanctions and admin user controls.
- [ ] Checkpoint 1: auth/RBAC/audit integration tests pass.

## Phase 2: Rooms And Room RBAC

- [X] 2.1 DM/group room creation and canonical list/member discovery.
- [X] 2.2 Last-message projection and automatic room ordering (unit/service evidence; live projection proof pending).
- [X] 2.3 Personal room pins with slot-based max-3 contract.
- [ ] 2.4 Custom conversation roles, colors, ordering and permission union (API/UI slice exists; role hierarchy integration pending).
- [X] 2.5 Add/remove/assign/kick/leave lifecycle for the supported canonical operations; owner transfer/community join policy remain.
- [ ] Checkpoint 2: room flows + system message/room log/audit pass.

## Phase 3: Messaging, Media And Realtime

- [X] 3.1 Idempotent bucketed sends using `clientMessageId` and cursor history.
- [X] 3.2 Reaction and monotonic read state; reply/mention/seen-by integration remains to be proven live.
- [X] 3.3 Edit/delete/pin/unpin command paths; revision query and five-pin concurrency proof remain.
- [ ] 3.4 Detailed attachment/media lifecycle with Cloudinary (configuration-gated).
- [X] 3.5 Authenticated STOMP command/publish paths plus Redis-backed canonical presence/typing implementation; cross-instance proof remains.
- [X] 3.6 Chat policy/slow-mode request paths; distributed atomic limiter and live cross-instance expiry proof remain.
- [ ] Checkpoint 3: complete two-user realtime message flow passes.

## Phase 4: Events, Search, Polls, Moderation And Invites

- [ ] 4.1 Cassandra outbox -> Kafka -> idempotent consumers/DLQ/replay (publisher pending-index path and bounded listener retry-to-DLT handler are implemented; consumer idempotency/replay and clean Kafka proof remain pending).
- [ ] 4.2 Authorized Elasticsearch room/message search with all filters (integration/configuration pending).
- [X] 4.3 Poll create/vote/close request and UI paths; concurrency/realtime proof remains.
- [ ] 4.4 Ban/mute/sanction/report/language moderation and audit (report queue, APP/CONVERSATION sanctions, bounded expiry worker and enforcement are implemented; language moderation, appeals and live expiry proof remain).
- [X] 4.5 Invite link/join request API and UI paths; expiry/usage concurrency proof remains.
- [ ] Checkpoint 4: durable event/search/poll/moderation/invite flows pass.

## Phase 5: Notifications, Appearance And Calls

- [ ] 5.1 Discord-like global/room/quiet-hour notification precedence (canonical inbox/settings API exists; policy matrix remains).
- [ ] 5.2 Web/mobile notification delivery, dedupe, retry and device lifecycle (canonical web device registration/heartbeat is implemented; provider credentials/worker and delivery retry remain).
- [ ] 5.3 Private source-controlled chat UI/background preferences with authenticated backend sync (implementation exists; clean Cassandra and cross-account proof remain).
- [X] 5.4 Authorized 1–1 call signalling, native SDP/ICE lifecycle and acceptance UI; group/SFU provider remains explicitly blocked.
- [ ] Checkpoint 5: multi-device notification/theme/call tests pass.

## Phase 6: Admin And Operations

- [ ] 6.1 Global admin IA foundation is implemented (`/admin`, capability gate, whole-app room directory, room policy/archive controls, audit timeline, report queue/resolution, sanctions, app-role and bounded session/device management, bounded analytics panel); language moderation, appeals, long-range analytics/SLO/export tabs and full permission matrix remain.
- [ ] 6.2 BA/DA metric dictionary, operational aggregates and dashboards.
- [ ] 6.3 Investigation timeline, moderation/support actions and bounded export (monthly audit CSV export is implemented; support workflows and broader export/reporting remain).
- [ ] 6.4 Observability, health, backup, replay/reindex and incident runbooks.
- [ ] Checkpoint 6: admin permission/investigation/ops drills pass.

## Phase 7: Frontend And Release Gate

- [X] 7.1 Replace the highest-risk frontend API/types with canonical clients.
- [ ] 7.2 Complete UI states, accessibility, responsiveness and virtualization (loading/error/not-found paths exist; full accessibility/responsive evidence pending).
- [ ] 7.3 Full Playwright multi-account E2E on clean Docker stack (public/deep-link smoke only; clean stack blocked).
- [ ] 7.4 Security/load/partition review and production release gate.
- [ ] Final: all Definition of Done checks in `tasks/plan.md` pass.

## Mandatory Verification Commands

- [ ] `docker compose -f chat-service/docker-compose-full.yml config` (Docker unavailable on this host)
- [ ] `docker compose -f chat-service/docker-compose.yml config` (default manifest mirrors the full stack; Docker unavailable on this host)
- [ ] `docker compose -f chat-service/docker-compose-full.yml up -d` (Docker unavailable on this host)
- [ ] Canonical CQL applied twice successfully to Cassandra 4.1.
- [ ] `cd chat-service; .\mvnw.cmd test`
- [ ] `cd chatapp_frontend; npm run type-check`
- [ ] `cd chatapp_frontend; npm run lint`
- [ ] `cd chatapp_frontend; npm run build`
- [ ] Playwright canonical E2E suite passes from clean state (`scripts/browser-smoke.mjs` covers public/deep-link/auth redirect only; multi-account suite remains).
- [ ] `git diff --name-status` deletion audit confirms no capability/integration was removed without replacement.
