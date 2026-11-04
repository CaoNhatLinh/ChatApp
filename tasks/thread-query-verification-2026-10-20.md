# T2 thread query — verification, 2026-10-20

## Implemented

`GET /api/conversations/{conversationId}/messages/{messageId}/replies`
requires parent `bucket`, accepts `limit`1–50 (default25) and an opaque `cursor`.
It returns canonical `parent`, `content`, `nextCursor`, `hasNext`.

- Parent lookup uses current conversation and exact canonical bucket/timeuuid.
- Membership is rechecked before source lookup or cursor decoding on every page.
- Missing/blocked parent returns404. Deleted parent and children are public
  tombstones, not retained content. Child block checks use authoritative sender.
- Separate bounded index query and message hydration; wrong-parent/orphan entries
  are excluded. No fake totals, index-content authority, scan or ALLOW FILTERING.
- Cursor binds actor/conversation/full parent and both clustering keys. Empty
  filtered pages advance from the last consumed index row without scanning ahead.
- Complete OpenAPI response/parameters/errors and ADR0015 record the contract and
  deliberate non-snapshot/direct-reply semantics. AsyncAPI now documents the exact
  parent bucket already emitted by the T1 message event; no new thread event added.

## Files and reasons

Main paths relative to `chat-service/src/main/java/com/chatapp/chat_service/`:

- `canonical/message/MessageThreadService.java`: bounded, authorized read policy,
  hydration/redaction and actor/parent-scoped keyset cursor.
- `canonical/controller/MessageThreadController.java`: signed actor binding and
  typed read endpoint; does not grow the existing message command controller.
- `canonical/message/MessageRepository.java`, `CassandraMessageRepository.java`:
  projection reference/position records, bounded first/tuple-continuation queries.
- `canonical/message/MessageReplyPolicy.java`: existing source-key validator shared
  with thread reads; no duplicate bucket parser or compatibility path.
- Tests: `MessageThreadServiceTest`, `MessageThreadRepositoryTest`, extended
  `ChatReadHttpSecurityTest` and opt-in `ChatReadCassandraIT`.
- Documentation: `docs/api/openapi.yaml`, `docs/api/asyncapi.yaml`,
  `docs/adr/0015-bounded-authorized-message-threads.md`, this report, checklist.

## Observed checks

- RED first: new service tests failed compilation for absent service/repository
  thread contracts before implementation.
- Focused JDK20 reply/thread policy and repository tests: exit0.
- Focused actual MVC/security/JWT + thread service tests: exit0. Repositories are
  mocked, not a real Boot server/datastore.
- Full JDK20 `./mvnw.cmd -q test`: exit0;407 tests/83 default suites, zero failures,
  errors or skips. Retained failed opt-in Cassandra IT XML excluded from this count.
- Added opt-in actual Cassandra checks for same-millisecond two-column continuation
  through both repository and thread service; compile gate run separately.
- JDK20 `./mvnw.cmd -q -DskipTests test`: exit0, including compilation of the
  extended opt-in IT. This compiles tests; it does not execute the Cassandra gate.
- OpenAPI/AsyncAPI YAML parsed with the existing `js-yaml` dependency; syntax passed.
  The optional `yaml` module was unavailable, so no dependency was installed.
- Scoped `git diff --check`: exit0.
- No frontend code changed in this slice: no new browser acceptance or screenshot
  claim. T1 screenshots/reports remain historical evidence only.

Tests cover source key/limit/cursor errors, actor/room/bucket/parent cursor scope,
equal creation-time continuation, filtered empty continuation, bounded hydration,
missing/blocked source, source/child deletion redaction, tuple CQL bindings,
anonymous401, no-store response and member revocation403 before further reads.

## Review and remaining gates

Scoped self-review checked correctness, security, architecture, bounded IO and
readability. No library/framework/dependency, schema mutation or external provider
was introduced. Queries bind every partition/clustering key; commands and reads
remain separate capability services. Query-binding tests do not prove CQL execution.

T3 panel/mobile layer, composer context, refresh/error/pagination and source point
UI are not implemented by this endpoint alone. Live Cassandra/tuple order, batch
recovery, two-client realtime and revocation acceptance remain open while Docker
installation is deferred. No engine installation, provider requests, database reset,
credential edits, commit or push occurred.
