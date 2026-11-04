# M1 confirmed thumbnail backend — 2026-10-23

## Implemented result

The canonical image upload requests synchronous Cloudinary eager generation of
SMALL/MEDIUM/LARGE static PNG first-frame derivatives at 320/768/1280 max edge,
without stretching or replacing the original. The service uses returned metadata,
not a generated delivery URL. Reordered provider entries are matched by exact
transformation identity. Missing, ambiguous, invalid, pending or oversized results
are UNAVAILABLE; explicit failures are FAILED. Only validated READY records carry
a URL and actual width/height. Original uploads may remain usable independently.

Delivery validation requires HTTPS, no credentials/fragment, same original host,
port and Cloudinary tenant/image-upload prefix, and the same public ID ending in
`.png`. It rejects cross-tenant and wrong-asset URLs even on res.cloudinary.com.
Dimensions reject fractional, non-finite, non-positive, string and out-of-bound
values. No raw provider failure text is placed in the thumbnail row or public DTO.

One logged batch stores the asset plus exactly three outcome rows. Original upload
JSON keeps its existing fields and adds the typed `thumbnails` array; thumbnailUrl
is only a READY SMALL URL or null. The URL generator was removed, not retained as
a compatibility fallback. Explicit resource types keep image/video/audio/raw
upload and delete routing aligned; PDF uses raw, not auto/image.

`GET /api/files/{assetId}/thumbnails` is an owner-only no-store read of a ready,
non-deleted original. It returns assetId, applicable and persisted variants, not
provider internals or an implicit retry. Non-images are not applicable. Image
rows missing from storage remain missing/unavailable, not invented PROCESSING.
Queries bind one asset and limit to four rows to detect excess/unknown variants;
the public model permits at most the three canonical variants.

## Source changes and rationale

- `chat-service/src/main/java/com/chatapp/chat_service/canonical/media/MediaThumbnail.java`:
  typed variant bounds/outcomes and public metadata invariants; failure redaction.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/media/CloudinaryThumbnailPolicy.java`:
  actual SDK eager requests, bounded external-response validation/identity mapping.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/media/CloudinaryMediaService.java`:
  connects generation, source metadata validation, batch persistence and actual
  SMALL URL; owner inspection; consistent provider resource types. Earlier
  preflight/retention/deletion edits in the dirty tree are preserved.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/media/MediaAssetRepository.java`:
  bounded thumbnail query, strict stored-row mapping and logged asset/outcome batch;
  existing standalone save and retention/deletion fencing remain usable.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/media/MediaController.java`:
  owner read using SecurityContextHelper, no-store, existing error contract.
- `chat_app_complete.cql`: one `status text` column in the existing thumbnail table;
  no new table, historical data deletion or compatibility schema.
- `scripts/test-local-schema.ps1`: expected canonical column count 714 instead of
  713; missing/type/static/parser checks retained.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/media/CloudinaryMediaUploadTest.java`:
  incumbent happy-path expectation follows the new asset/outcome save boundary.
- Four new test classes in the same test capability: `CloudinaryThumbnailPolicyTest`,
  `CloudinaryMediaThumbnailsTest`, `MediaThumbnailRepositoryTest`,
  `MediaThumbnailControllerTest` (39 tests/invocations total).
- `docs/api/openapi.yaml`: typed upload/thumbnail schemas, owner route, error and
  availability semantics; the entire YAML is parsed by the contract test.
- ADR0021, this report, `tasks/todo.md`, `docs/TESTING.md` and
  `docs/TRACEABILITY_MATRIX.md`: decision, controlled evidence and remaining gates.

No frontend source, dependency, provider account, environment variable, credential
or machine configuration was changed. No real upload/delete, tunnel, email,
commit, push or database reset was performed.

## Verification actually executed

Maven used process-local `JAVA_HOME=C:/Program Files/Java/jdk-20` in chat-service.

- Initial implementation did not compile because a Java 21 collection method was
  used under Java 20; corrected to indexed access before successful verification.
- An offline test through the installed SDK's real `buildUploadParams` rejected
  both a string-list prototype and REST-style eager string with ClassCastException.
  The implementation now passes actual Transformation objects. That same real SDK
  builder test passes and verifies the exact encoded pipe-separated request; no
  network call or credential is involved. Mock-only transport tests could not have
  established this boundary.
- Repository-test harness issues (expanded Mockito varargs and nested stubbing)
  were corrected. They were not treated as evidence of a Cassandra failure or a
  production fix. Final tests inspect the real driver BatchStatement structure,
  CQL text and exact bound values while mocking execution.
- Final focused command:
  `./mvnw.cmd -q -Dtest=CloudinaryThumbnailPolicyTest,CloudinaryMediaThumbnailsTest,MediaThumbnailRepositoryTest,MediaThumbnailControllerTest test`:
  exit 0, **39 tests**. Earlier expanded runs also covered incumbent upload/retention.
- `./mvnw.cmd -q test`: exit 0, **697 tests across 113 fresh suites**, zero
  failures/errors/skips. Fresh report aggregation starts at
  `2026-10-23T07:17:14+07:00`; the old 2026-10-20 ChatReadCassandraIT report remains
  on disk and is excluded, not deleted or misrepresented as rerun/passing.
- `./scripts/test-local-schema.ps1`: exit 0, **84 tables / 714 columns / 2 UDTs**;
  mismatch and cqlsh-output parser checks passed. This is not execution of DDL/CQL
  on a live database.
- `git diff --check`: exit 0, including the documentation changes. Existing
  CRLF-normalization notices are unrelated.

Coverage: policy/SDK21; upload/inspection/failure9; repository5; standalone MVC and
OpenAPI4. Owner policy tests use the actual service with mocked storage/provider;
controller tests use actual MVC/Jackson/advice with a mocked service and actor
helper, not real JWT or a live server. The unchanged global security chain requires
authentication for this path; no new permit rule was added. No browser or frontend
build/type-check rerun is claimed for this backend-only increment.

## Review and boundaries

Correctness: success is contingent on confirmed returned metadata and completed
local persistence, while thumbnail failure does not falsely fail the usable source.
Readability/architecture: capability-local provider policy and typed data model;
no god repository additions, generic job framework or duplicate URL fallback.
Security: authenticated owner source, no arbitrary target-user input, no raw
provider error response, bounded point query and fixed variant count. Performance:
three synchronous provider transforms, one four-statement logged write for an
image, one authority read plus bounded variant read for inspection; live latency,
throughput, quota and image-quality evidence remains absent.

Logged batches are not snapshot isolation. Provider success/local commit failure
or process death still needs durable pre-IO intents, ownership/references,
orphan/deletion jobs and replay convergence (M2). These tests do not prove crash
safety or execute Cassandra/batchlog. Provider output has not been downloaded or
visually inspected. Historical recipient attachment validation, UI state/retry/
upload cancellation and browser verification remain M2/M3 work. Do not mark the
parent media or full roadmap complete.

Concrete next boundary defect found during review: the current frontend
`messenger.api.ts` upload mapping and HTTP send serializer omit width/height/
durationMs, while backend `MessageAttachmentPolicy` compares those fields against
the asset authority. This is source-inspected, not a newly passing end-to-end send
test. It needs correction and upload/send/retry coverage in the following media
data-boundary increment. Submitted message thumbnail references also need server
validation; this increment proves the upload/owner-read contract, not arbitrary
historical message thumbnail provenance.

## Official sources inspected

- [Cloudinary eager and incoming transformations](https://cloudinary.com/documentation/eager_and_incoming_transformations)
- [Cloudinary Upload API eager parameters](https://cloudinary.com/documentation/image_upload_api_reference#eager)

The actual pinned Java SDK parameter builder, not a guess from the REST shape,
was used to verify the request representation. Real account-specific output and
provider IO remain a separate live acceptance gate.
