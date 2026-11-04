# Sticker catalog read foundation — verification

Date: 2026-10-12. User approved the expansion plan and necessary canonical schema additions. This report covers **S1 reads only**, not a completed sticker feature or the entire roadmap.

Historical snapshot of the first read slice. The later command implementation replaces its three-table authority and updates the schema to 80 tables / 692 columns; see [command verification](sticker-admin-verification-2026-10-12.md) and ADR 0014. The original test counts below describe that earlier slice, not current totals.

## Changed files and reasons

- `chat-service/src/main/java/com/chatapp/chat_service/canonical/sticker/StickerRepository.java`: capability-specific read boundary and canonical records; no feature logic added to `CanonicalCqlStore`.
- `.../sticker/CassandraStickerRepository.java`: bounded global directory, pack-scoped tuple pagination and point authority reads.
- `.../sticker/StickerCatalogService.java`: active/inactive visibility, global admin permission, cursor/limit validation, stale-pointer rejection and real asset availability checks.
- `.../sticker/StickerCatalogController.java`: four authenticated GET routes, session-derived actor, admin mode chosen by route, private responses `no-store`.
- `.../common/exception/GlobalExceptionHandler.java`: malformed typed HTTP parameters return canonical 400 rather than falling into generic 500; no raw input echoed.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/sticker/{StickerCatalogServiceTest,StickerCatalogControllerTest,CassandraStickerRepositoryTest}.java`: 17 service, HTTP-boundary and query-binding tests.
- `chat_app_complete.cql`: pack/sticker revision columns, authoritative sticker ordering and global catalog directory. These are fresh-schema additions; no migration/legacy fallback.
- `scripts/test-local-schema.ps1`, `.../common/config/InfrastructureManifestTest.java`: current manifest count 81 tables / 694 columns / two UDTs.
- `docs/api/openapi.yaml`, `docs/contracts/canonical-api.yaml`, `docs/flows/sticker-catalog.md`: exact read routes, schemas, permissions, continuation rules and incomplete work.
- `docs/SCHEMA_CONSOLIDATION.md`, `docs/flows/resend-email.md`: current schema reference, preventing stale bootstrap counts. Earlier dated verification snapshots are preserved.
- `tasks/feature-expansion-spec.md`, `tasks/plan.md`, `tasks/todo.md`: approval recorded, read foundation checked separately, writes/admin/UI/send remain unchecked.

## Verification

- `cd chat-service; ./mvnw.cmd -q test` with JDK 20: **passed, 289 tests / 60 suites, zero failures/errors/skips**. Includes 17 new sticker tests. The first full run failed a MockMvc JSON negotiation assertion; fixed by requesting JSON, then rerun green. A subsequent review added real exception advice to validate malformed parameters and reran the full suite green.
- `./scripts/test-local-schema.ps1`: **passed**, 81 tables, 694 columns, two UDTs; type/static/missing-column guards and cqlsh output parsing.
- `git diff --check`: **passed**; only an existing SecurityConfig CRLF normalization warning.
- OpenAPI/compact contract YAML is parsed by `CanonicalContractManifestTest` in the backend suite. This is YAML/contract-manifest verification, not a complete OpenAPI semantic validator.

Repository query tests use a mocked CqlSession, not live Cassandra. Driver prepare semantics, actual query latency, projection recovery and concurrency need live validation. No Docker/Cassandra/provider service was started; no assets uploaded, emails sent or webhook registered by this slice. No frontend files were changed in this slice, so there is no new UI screenshot/browser smoke to present.

## Review and remaining work

Admin reads require global `SYSTEM_OPERATE` before repository access. Client actor/admin query overrides are ignored. User reads filter inactive authority and invalid assets; an empty filtered page still continues using the last scanned pointer. Both sticker ordering keys are included in the cursor. Lookahead is not hydrated. Stored raster assets are used; no arbitrary remote URL fetching, seeded artwork, fake moderation scores or unavailable image placeholders returned as valid images.

Per-item authority/asset hydration is bounded but still requires multiple point reads; performance at realistic load is unproven. Scan/moderation `PENDING` does not mean approved or safe. Fresh catalog is honestly empty until real validated admin commands exist.

**Not complete:** S1 revision CAS writes; S2 admin create/update/disable/publish commands, recoverable audit/projection intents and media retention; S3 admin UI; S4/S5 validated sending, historical rendering and picker. Revision columns alone do not implement concurrency control. The existing generic message path must not be treated as a completed validated sticker-send path.

GIPHY, threads, forward provenance, durable call history, thumbnail/lifecycle, global settings and email operational history/recovery remain in the approved checklist. Push is deferred by user choice. Automatic moderation still needs an actual detector/policy/privacy scope; no automatic account lock is authorized. No commit or push was performed.
