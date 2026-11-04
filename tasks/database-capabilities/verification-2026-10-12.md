# Database capabilities: first slice evidence

## Implemented, not the entire feature roadmap

`join_requests_by_user` now receives invite and community request indexes. `GET /api/me/join-requests` uses the authenticated actor, no client user ID, no invitation tokens and `Cache-Control: no-store`. Pagination includes both clustering keys, continues equal-time UUIDs before older times, and caps pages at 50 (UI uses 25).

Invite status comes from the manager resolution authority. Current community status comes from `community_join_request_by_user`; a superseded attempt can use only terminal historical outcomes. Missing/mismatched authority reports `RETRY_REQUIRED`, never a fabricated approval. Discovery is written before the manager projection and pending retries repair both indexes.

The community page has an initially collapsed bilingual request list, refresh, real cursor pagination, approved-room links, skeleton, contextual error and empty states. Closing/unmounting aborts requests; account/locale changes remount the list. No success toast or invented catalog data was added.

## Files and purpose

- `canonical/invite/UserJoinRequestRepository.java`: scoped discovery, full-key cursor, authoritative status reads.
- `canonical/controller/UserJoinRequestController.java`: private authenticated API and cache policy.
- `canonical/invite/CassandraInviteRepository.java`: repairable own-request discovery on invite approval requests.
- `canonical/repository/CanonicalCqlStore.java`: community discovery writes alongside existing projections.
- `UserJoinRequestRepositoryTest.java`, `UserJoinRequestControllerTest.java`, `JoinResolutionRepositoryTest.java`: cursor/status/identity/cache/repair-order regressions.
- `features/communities/api/join-requests.api.ts`: typed API client and abort signal.
- `features/communities/components/OwnJoinRequests.tsx`: request list and disclosure using shared tokens/primitives.
- `route-pages/CommunityDiscoveryPage.tsx`: integrates list and refreshes it after a successful join command.
- `shared/i18n/resources.ts`: English translations for new Vietnamese copy.
- `scripts/own-join-requests-smoke.mjs`, frontend `package.json`: browser fixture regression and command.
- `docs/api/openapi.yaml`: endpoint, cursor, statuses and error contract.
- `tasks/database-capabilities/plan.md`, `todo.md`: full remaining scope and explicit provider/runtime gates.

## Checks

- Java 20: `mvnw.cmd -q test`: 239 tests, 52 suites, zero failures/errors/skips.
- Root `npm run validate`: type-check and lint passed.
- Root `npm run build`: production build passed, 17 routes.
- Frontend `npm run test:i18n:copy`: 1125 checked keys, no missing static translations.
- Frontend `npm run test:e2e:join-requests`: light/dark at 320/768/1024/1440; Vietnamese and English, lazy fetch, pagination, refreshed approval, failed request preserving rows, empty state and real room link. Fixture-only, not live backend proof.
- `scripts/test-local-schema.ps1`: 78 tables, 676 columns, 2 UDTs; schema guards passed. No CQL change in this slice.
- `git diff --check`: passed.

Screenshots: `chatapp_frontend/artifacts/database-capabilities/join-requests-{light,dark}-{320,768,1024,1440}.png` (768 uses English). These are generated test fixtures, not real-user data.

## Remaining limits

- No live Cassandra/Docker on this host. Prepared statement validity, actual ordering and crash recovery still need datastore integration tests.
- An interruption before discovery is written still requires retry/reconciliation; no claim of complete crash safety. A missing authority is honestly surfaced rather than repaired by guessing.
- Status hydration uses bounded point reads per row (up to two for historical community requests), not a full-table scan. Latency needs live measurement before changing batching/concurrency.
- The existing schema does not store privacy-safe room-name snapshots; this initial list shows real room IDs instead. Do not fetch newly private metadata just to decorate the list.
- Remaining twelve tables and corresponding roadmap features have not been implemented in this slice.
- Resend selected; verified sender/domain and local key configuration missing. Push provider and moderation policy undecided. Nothing is externally delivered or automatically moderated.
- Changes are not committed or pushed in this turn.
