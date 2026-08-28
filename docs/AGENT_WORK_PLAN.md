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

Current evidence: backend `./mvnw test` = 73 tests, 0 failures, 0 errors;
frontend `npm run validate`, `npm run build`,
`npm run test:e2e:smoke`, and mock-authenticated `npm run test:e2e:admin` pass.
The canonical message UI mapping rejects incompatible payload shapes instead of
silently translating legacy aliases or inventing sender/attachment metadata.
Friendship and presence clients likewise consume only their canonical backend
contracts; variant response adapters, presence aliases, fabricated IDs/statuses,
and unwired placeholder controls are out of runtime scope.
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
