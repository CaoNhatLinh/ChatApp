# Media upload byte/header preflight — 2026-10-23

## Scope and result

M1 prerequisite implemented in the existing canonical upload path. The service
now bounds the actual stream read to 10 MiB + 1 sentinel byte, rejects empty or
oversized actual content and checks supported image headers/canvas dimensions
before Cloudinary IO or media authority persistence. Null MIME is a client error,
not a `Set.of(...).contains(null)` failure. The existing multipart metadata check
remains an early rejection; it is no longer the sole byte-size check.

The stream is closed before provider upload. Valid bytes are passed unchanged;
size/checksum/persistence continue to use those bytes. Limits are inclusive:
16,384 pixels per edge and 25,000,000 pixels per canvas/first frame. Multiplication
uses long arithmetic. JPEG/PNG/GIF use JDK ImageIO header reading, without raster
allocation or process-global/disk-cache mutation. GIF logical canvas and first
frame are checked separately. WebP uses the RIFF/VP8/VP8L/VP8X canvas headers;
lossy, lossless, extended and animation-capable VP8X remain supported. A separate
header reader is necessary because stock JDK ImageIO has no WebP codec.

This is deliberately a preflight, not full-image validation. Malformed compressed
payloads after a valid header may still reach Cloudinary. It does not bound total
animation frame work, validate non-image contents, scan malware, detect 18+/scam,
or prove image safety. Cloudinary must still decode the complete image. It does
not create/persist thumbnail variants, add processing jobs, reconcile orphaned
uploads, or complete M1/M2/M3. Existing thumbnailUrl remains a transformation URL,
not evidence of an already generated durable derivative.

## Changed files and reasons

- `chat-service/src/main/java/com/chatapp/chat_service/canonical/media/CloudinaryMediaService.java`:
  bounded stream admission before existing upload/save, shared 10 MiB constant,
  null MIME rejection. Existing retention/deletion changes in the dirty tree were
  preserved, not introduced or reworked in this increment.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/media/ImageUploadPreflight.java`:
  capability-local MIME/header and shared dimension policy, no dependency on UI,
  database or provider implementation.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/media/WebpUploadHeader.java`:
  small header-only reader for the already allowed WebP format, including RIFF
  length/first-chunk bounds/padding, version/reserved flags and canvas limits.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/media/CloudinaryMediaUploadTest.java`:
  eight tests through the actual upload service boundary, using mocked provider
  and repository. Rejections must not invoke either dependency.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/media/ImageUploadPreflightTest.java`:
  21 tests/parameterized invocations for real JDK-generated JPEG/PNG/GIF headers,
  boundary/overflow, truncated input, GIF logical canvas, WebP header formats,
  container/flags/padding/malformed cases and deliberate non-image scope.
- `docs/api/openapi.yaml`: existing single/multiple upload admission limits,
  400 response and honest non-atomic multi-upload/thumbnail limitations.
- `tasks/todo.md`, `docs/TESTING.md`, `docs/TRACEABILITY_MATRIX.md`: scoped
  evidence and remaining gates; parent media checkbox stays open.

No dependency, schema, frontend, environment, credentials or provider setup was
changed. No real upload/delete, email, tunnel, commit or push was performed.

## Executed verification

All Maven commands used process-local `JAVA_HOME=C:/Program Files/Java/jdk-20`
from `chat-service`; the machine's default Java installation was not modified.

1. Red reproduction: `./mvnw.cmd -q -Dtest=CloudinaryMediaUploadTest test`:
   three tests failed because disguised text, PNG declared as JPEG and an
   excessive PNG canvas reached provider IO. The failure was the wrong exception
   after the mocked provider returned no asset ID, not a compilation failure.
2. After implementation, focused upload/deletion/retention run passed. Expanded
   focused command:
   `./mvnw.cmd -q -Dtest=ImageUploadPreflightTest,CloudinaryMediaUploadTest,CloudinaryMediaDeletionTest,MediaAssetRetentionTest test`:
   exit 0; 29 new tests plus four incumbent deletion/retention tests passed.
3. `./mvnw.cmd -q test`: exit 0; **658 tests / 109 fresh suites, zero failures,
   errors or skips**. Reports were aggregated by modification time after this
   run began at `2026-10-23T06:58:08+07:00`. The old
   `ChatReadCassandraIT` report dated 2026-10-20 remains on disk, is not a fresh
   execution and was excluded. Docker/live Cassandra were not attempted.
4. JDK JShell invoked the compiled preflight against the actual existing
   `chatapp_frontend/public/noi-default-avatar.webp`: exit 0, accepted 6,908 bytes.
   This is local header compatibility evidence, not full decoding/provider IO.
5. `git diff --check`: exit 0; existing CRLF-normalization notices only.

No frontend source changed, so type-check/browser/build were not rerun for this
backend admission increment. No screenshot is claimed for a non-visual change.
No schema changed; the earlier schema guard is historical, not rerun evidence.

## Review and remaining acceptance

Correctness: byte metadata cannot bypass actual length; accepted image types
retain format-specific paths; invalid inputs stop before mutation. Readability:
two focused package-local header policies rather than codec logic in the upload
or god repository. Architecture: existing canonical controller/service and error
contract, no generic plugin framework or compatibility adapter. Security:
bounded admission, no full raster allocation, no secrets/logged image contents.
Performance: at most 10 MiB + 1 of upload bytes read into the preflight path,
no database reads or new per-request network calls. This is not a throughput or
peak-heap benchmark; ImageIO may maintain bounded input/cache buffers internally.

Remaining: actual eager derivatives and durable variant metadata/state; recoverable
upload/delete intent/reference processing; provider error/restart/cleanup tests;
corresponding UI; live provider/datastore acceptance. The full feature-expansion
goal remains active. Docker remains deferred by the user.

## Primary references

- [Java 20 ImageReader](https://docs.oracle.com/en/java/javase/20/docs/api/java.desktop/javax/imageio/ImageReader.html)
  for format recognition, metadata dimensions and reader disposal.
- [Google WebP container specification](https://developers.google.com/speed/webp/docs/riff_container?hl=en)
  for RIFF/chunk layout, padding and VP8/VP8L/VP8X canvas representation. Header
  fixtures deliberately do not assert complete compressed-image decoding.
