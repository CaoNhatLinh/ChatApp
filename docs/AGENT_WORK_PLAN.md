# End-to-end completion work plan

1. **Baseline and inventory** — complete. Backend tests and frontend builds are
   repeatable; dirty user worktree is preserved.
2. **Canonical contracts and storage** — complete for identity, directory,
   friendships, conversations, messages, reactions, reads, pins, polls, invites,
   notifications, presence command surfaces, and the admin capability/role slice.
3. **Next App Router migration** — complete for the supported route surface.
   Native entries cover every supported URL, including the dynamic invite route;
   the obsolete catch-all entry/App bootstrap and all BrowserRouter hooks were
   removed. Interactive feature trees remain explicit client islands by design.
4. **Realtime and integrations** — in progress. Message, presence, notification,
   and targeted 1–1 call signalling/media flows are wired; Redis, Cassandra,
   Elasticsearch, Cloudinary, Kafka, a reviewed STUN/TURN provider, and a
   browser reconnect journey need a real stack.
5. **Quality hardening** — in progress. Type-check, Next build, Maven
   compile/tests, YAML parsing, and Playwright route smoke pass. Accessibility
   tree, performance trace, dependency review, and migration rehearsal remain.
6. **Global admin workspace** — foundation implemented in the existing projects:
   `/admin` is server-gated and can browse the monthly whole-app room directory,
   inspect room details, change global chat policy, archive/restore rooms, review
   the monthly audit timeline, process report queues, apply/revoke sanctions,
   search users, manage app roles and revoke bounded user sessions/devices.
   Timed sanctions use a bounded UTC-day
   expiry worker with conditional cleanup. Analytics/export and operator E2E
   remain planned rather than mocked.
   Abuse reporting now has message and profile entry points plus a bounded
   user-facing report-history tab; `/403` and the Next global error boundary
   cover permission/runtime recovery states.
7. **Release evidence** — pending. Do not label the release complete until each
   matrix row has runtime evidence or an explicit blocker.

8. **Visual system** — complete. All canonical pages use one documented
   signal-orange/cool-ink system, the generated landing visual, shared shells,
   semantic controls, responsive layout rules, and no compatibility pages for
   removed routes. Visual QA covered desktop landing/recovery and mobile public
   pages without horizontal overflow.

9. **Public community discovery** — implemented and locally verified. The
   authenticated `/communities` route uses the bounded sharded directory,
   canonical room hydration, direct or approval admission, stable cursor
   pagination and bilingual responsive UI. Clean Cassandra migration and
   multi-user authorization/contention proof remain release gates.

10. **Room RBAC and ownership** — backend authority and management UI hardened. Owner identity,
    OWNER role mutation, removal protection and role assignment now share the
    membership partition's conditional consistency boundary. The bilingual
    member/role/transfer panel consumes effective permissions from the server;
    its production-browser journey now passes. Role-code/count creation and
    delete-versus-assign/transfer races now use catalog CAS plus a membership
    revision barrier. Clean Cassandra verification remains pending.

Current evidence (2026-08-30): backend Java 20 `./mvnw test` = 147 tests, 0 failures, 0 errors
(the host default Java 17 is not compatible with the Java 20 test classes);
frontend `npm run validate`, `npm run build`,
`npm run test:i18n:copy`, `npm run test:errors:copy`, `npm run test:e2e:network`, `npm run test:e2e:ui-quality`, `npm run test:e2e:smoke`, and
mock-authenticated `npm run test:e2e:admin`, `npm run test:e2e:communities`, `npm run test:e2e:contacts`, `npm run test:e2e:profile`, `npm run test:e2e:presence`, and `npm run test:e2e:search` pass. The locale smoke also passes
the English landing/auth/recovery journey, and notification settings payload
smoke passes without console or request failures.
The canonical message UI mapping rejects incompatible payload shapes instead of
silently translating legacy aliases or inventing sender/attachment metadata.
Message edit/delete browser journeys preserve drafts and content privacy. The
required message-page interaction projection now restores reactions and latest
read state after refresh with bucket-bounded queries; pin/unpin applies the
canonical response immediately. `test:e2e:message-edit`,
`test:e2e:message-delete`, and `test:e2e:message-interactions` pass without
console or request failures. ADR 0009 records why per-message N+1 reads,
room-wide snapshots and replay-unsafe counter projections were rejected.
Friendship and presence clients likewise consume only their canonical backend
contracts; variant response adapters, presence aliases, fabricated IDs/statuses,
and unwired placeholder controls are out of runtime scope.
Presence subscriptions are session-scoped, authorization-scoped and capped at
200 targets per session; per-session heartbeat expiry is aggregated in Redis
and presence changes fan out through the configured Redis Pub/Sub channel.
Client rows use an Intersection Observer window rather than subscribing an
entire loaded directory, and a 50 ms scope-aware batcher coalesces viewport
churn before STOMP delivery. Conversation lists now use an opaque cursor page, and
mention lookup requests additional member pages only when the compact result
set needs them.
Room-management member pages request 50 rows at a time and use variable-height
virtualized rendering with a measured load-more footer; stale requests are
discarded when the selected room changes.
Typing now follows the same boundary: commands contain only canonical command
fields, and server-emitted user summaries use `username` plus required
`displayName`.
Access JWTs are memory-only; a non-authorizing session hint allows refresh
bootstrap only for a previously authenticated browser. Notification inbox state
has one realtime owner and AsyncAPI now declares its read/delete destinations.
Local ports 8084/9042/6379/9092/9200 are not
running in this workspace, so authenticated Cassandra/Redis/Kafka/Elasticsearch
journeys remain blocked rather than being replaced with mocks.

The authoritative API sources are `docs/api/openapi.yaml` and
`docs/api/asyncapi.yaml`; the compact route manifest is a canonical human-readable
index in `docs/contracts/canonical-api.yaml`.

Global-admin scope and the remaining operator work are tracked in
`docs/ADMIN_PLAN.md`. The final consistency pass is recorded in
`docs/SELF_REVIEW_STATUS.md`.
