# Backend message revision contract — 2026-10-23

## Scope delivered

Canonical message reads and realtime now expose the stored `revision_no` as
required nonnegative integer `revision`. Creation supplies zero; edit/delete keep
the existing CAS increment semantics, with overflow protection. The repository
does not invent zero for a missing/negative stored version. Public deletion
redaction preserves the authority revision. Realtime and projection event maps
both include it. No database migration, provider/configuration or dependency change.

**Frontend ordering is not implemented by this increment.** Its current adapter
and stores still need to consume/validate the field. The stale-event/UI issue and
the full recovery roadmap remain open. This is the backend prerequisite, not a
substitute for consumer/browser/live acceptance.

## Files and reasons

Paths below are relative to `chat-service/src`:

- `main/java/com/chatapp/chat_service/canonical/model/CqlCanonicalRecords.java`:
  explicit canonical revision component and nonnegative invariant; no old
  constructor overload.
- `main/java/com/chatapp/chat_service/canonical/message/CassandraMessageRepository.java`:
  hydrate real revision; reject null/negative state in reads/mutations; prevent
  integer increment wrap before CAS.
- `main/java/com/chatapp/chat_service/canonical/message/MessageService.java`:
  initial zero and actual revision in public realtime/projection events.
- `main/java/com/chatapp/chat_service/canonical/message/PublicMessageView.java`:
  keep the same revision on a public tombstone.
- `test/java/com/chatapp/chat_service/canonical/message/MessageRevisionContractTest.java`:
  six controlled storage/JSON/MVC/realtime/schema checks.
- `test/java/com/chatapp/chat_service/canonical/message/MessageRevisionMutationTest.java`:
  three controlled mutation prior/next, invalid and exhausted-version checks.

Existing constructor fixture callers were mechanically updated to supply an
explicit initial revision, not a runtime compatibility fallback. These include:

- `canonical/conversation/{ChatReadHttpSecurityTest,ChatReadCassandraIT}.java`.
- `canonical/admin/AdminMessageServiceTest.java`.
- `canonical/poll/PollServiceRecoveryTest.java`.
- `canonical/search/MessageSearchServiceTest.java`.
- `canonical/sticker/StickerMessageServiceTest.java`.
- `canonical/message/MessageCreationServiceTest.java` (edited/deleted snapshots
  explicitly use 1/2), `MessageServiceTest.java`, `PublicMessageViewTest.java`,
  `MessageForward{SourceService,Repository,Policy,Controller}Test.java`,
  `MessageReplyRepositoryTest.java`, `MessageThreadServiceTest.java`,
  `MessageGif{Repository,Controller}Test.java`, `SharedContentServiceTest.java`.

Those paths are under `test/java/com/chatapp/chat_service/`. The constructor
inventory covered 36 sites across 21 existing files, including the three main
constructor sites above. Public redaction and repository hydration use the actual
revision, not the mechanically supplied initial fixture value.

`docs/api/{openapi,asyncapi}.yaml` require bounded revision for Message/MessageEvent;
ADR0024, TODO/testing/traceability and this report record scope and remaining work.
Existing unrelated worktree edits were preserved. No commit/push.

## Verification actually run

- Pre-fix JSON checks failed with expected revision7 versus absent field. The
  initial mock query selector was corrected to match the actual multiline CQL;
  the same meaningful failures were reproduced before the production change.
  A Java overload-inference fixture compile error was fixed with a typed matcher.
- Targeted revision contract6 + mutation3: **9 tests pass**.
- Contract checks cover persisted7 in JSON, public tombstone7, invalid storage,
  actual MVC serialization, actual MessageService deletion publishing redacted8
  in realtime and projection maps, and required bounds in both API schemas.
- Mutation tests cover null/negative state, max-int overflow without a write, and
  exact prior7/next8 CAS bindings for edit/delete. They are controlled repository
  tests, not a real concurrent database run.
- Final `./mvnw.cmd -q test`, process-local JDK20: **740 tests / 120 fresh suites,
  zero failures/errors/skips**. XML aggregation includes only reports modified
  since this invocation started; stale Cassandra IT reports are excluded.
- Existing two-client Cassandra IT now asserts hydrated1 after edit and2 after
  delete. It **compiled but was not executed**, because Docker is deferred.
- `git diff --check`: pass, incumbent CRLF normalization notices only.

No frontend source changed, so no frontend build/browser/screenshots are claimed.
No Cassandra/broker/provider or real user data was contacted. No new schema gate
is claimed; this consumes the existing revision_no column used by canonical code.

## Review and follow-up

The source of ordering is explicit and local to message authority; no clock or
event-receipt timestamp is substituted. Tombstone privacy annotations/redaction
remain intact. Version transport adds no new lookup and is constant-size. Source
constructor changes compile across runtime/test callers. Invalid storage fails
rather than making an old event look like a fresh revision0.

Next: update frontend canonical DTO validation and content/deletion reconciliation
without rolling pin/reaction/read state backward; verify older SEND after newer
EDIT/DELETE, out-of-order edit responses, history/live races and conversation
previews in production Chromium. Do not accept missing revisions as an old
compatibility mode. Search event projection ordering also remains open; the added
payload value is not proof that the search consumer now rejects old events.

Durable completion for references/mentions/audit/notification/realtime, actual
crash/restart/two-client acceptance and media lifecycle remain separate unclosed
work. The full app goal is still active.
