# Call-history producer foundation — 2026-10-23

Historical producer execution scope. The subsequent authorized API implementation
is recorded separately in `call-history-api-verification-2026-10-23.md`.

Status: immutable history repository, canonical fresh schema and pre-claim
producer wiring implemented and controlled-tested. No authorized public history
API, participant DTO, or member history UI is connected by this increment.
The C3 parent and full roadmap remain unfinished.

Contract: `call-history-contract.md`; decision: ADR0020. Existing unrelated work
was preserved. No provider, credential/environment file, dependency, live
database/volume, Docker, server, commit or push operation was performed.

## Behavior now connected

- New-call claim writes the room/month key and both participant/month keys before
  incoming discovery, cyclic work and the authority CAS. Any history failure
  propagates and prevents the later stages. Same-call uncertain retry repeats
  the original keys; losing claims can leave hints, not fabricated authority.
- Key tables contain no mutable status, copied profile, provider or media facts.
  Heartbeat and terminal transitions do not rewrite them. There is no projection
  deletion or TTL race to erase a competing producer's key.
- Internal repository reads select one actor/room UTC-month partition with limit
  1..50, descending full-tuple continuation and explicit immutable results.
  They consume at most the requested rows and do not call unbounded `.all()`.
- Call IDs remain room-scoped: personal history keys include conversationId;
  timestamps are the exact original start-order timeuuid, not a regenerated ID.
- The fresh initializer replaces the unused provider-shaped room history and
  call-ID-only participant projection with the real immutable room/actor indexes.
  This removed seven unsupported columns from schema definitions, not data from
  any existing database. Future exact two participant facts derive from authority.

These keys are NOT a public read boundary. The next service must authorize actor
membership and exact participant, hydrate authority, filter failed-claim/stale
keys by exact start tuple/month, and follow raw-key continuation even when the
visible page is empty. It must not return these hints as successful calls.

## Files and reasons

Production under `chat-service/src/main/java/com/chatapp/chat_service/canonical/call/`:

- `CallHistoryRepository.java`: capability-owned immutable key and bounded own/
  conversation read contract; no authorization bypass or general repository.
- `CassandraCallHistoryRepository.java`: prepared key inserts/range reads,
  LOCAL_QUORUM and idempotent immutable writes, original identity validation,
  UTC month and complete tie bindings.
- `CassandraCallRepository.java`: injected history producer and registration
  before existing incoming/work/authority claim; no compatibility constructor.

Tests under `chat-service/src/test/java/com/chatapp/chat_service/`:

- `canonical/call/CassandraCallHistoryRepositoryTest.java`: eight controlled
  query/binding/iteration/identity/failure/uncertain-retry checks.
- `canonical/call/CassandraCallRepositoryTest.java`: ordering, history failure
  prevents claim, losing/uncertain retry keeps same keys, no heartbeat/terminal
  rewrite; existing authority invariants remain covered.
- `canonical/call/CallLifecycleCassandraIT.java`: real repository constructor
  wiring and added two-driver history tie/month/actor/reused-callId test. Compiles
  with the default build, but was NOT executed and is not counted as passed.
- `common/config/InfrastructureManifestTest.java`: exact month keys and descending
  order, absence of fake media/status fields and obsolete participant definition.

Other changes: `chat_app_complete.cql`, `scripts/test-local-schema.ps1`, schema/
architecture/testing/traceability docs, ADR0020 and task contract/checklist.
`chatapp_frontend/DESIGN.md` only corrects the previous scoped review's final
documentation verdict; no layout, token, component or browser bundle changed.

## Verification

Using JDK20 via process-scoped JAVA_HOME; machine configuration unchanged:

1. Test-first repository run failed compilation because production class did not
   exist. The next red compile proved authority constructor wiring was absent.
2. Initial focused execution found three overbroad Mockito assertions that counted
   constructor statement preparation as forbidden IO. Assertions now prohibit
   `session.execute` while preserving checks that no incoming/work/CAS follows a
   history failure. No production error was swallowed to satisfy these tests.
3. `./mvnw.cmd -q '-Dtest=CassandraCallHistoryRepositoryTest,CassandraCallRepositoryTest,InfrastructureManifestTest' test`:
   exit0,32 tests/3 suites, no failure/error/skip.
4. `./mvnw.cmd -q test`: exit0. All current `TEST-*Test.xml` reports:
   **571 tests / 102 suites, zero failures/errors/skips**. Oldest report write
   2026-10-23T05:47:14, from this full run. Historical opt-in IT reports are not
   included as successful default tests or deleted to hide missing Docker.
5. `./scripts/test-local-schema.ps1`: exit0,84 tables/713 columns,2 UDTs/20 fields;
   detects missing/type/static mismatches and parses controlled cqlsh rows.
   This is static schema verification, not execution against Cassandra.
6. `git -c core.safecrlf=false diff --check`: pass.

No frontend production source changed, so no new frontend build, browser or
screenshot acceptance is claimed. Previous incoming-call captures remain scoped
to the previous client increment.

## Review and limits

Main-agent five-axis review checked tests before implementation, constructor
callers, bound values, complete key identities, failure propagation, immutable
write semantics, absence of public exposure, full-tuple descending schema/query
alignment and bounded row consumption. No outstanding concrete blocking finding
was identified in this producer slice. This is NOT an independent source review
or a live datastore review. Prior agents supplied contract/evidence analysis
before the interruption; they did not execute or approve this implementation.

Still open:

- C3 own/room/detail authorization, canonical DTO and cursor validation at HTTP
  boundary; actor-relative MISSED/UNANSWERED and truthful participant consent.
- Member history/detail UI, paging/month controls, VI/EN, themes, mobile and
  loading/error/retry states; no fake media duration or callback capability.
- Failed/paused prewrites may accumulate false-positive hints. Month partitions
  and LIMIT do not establish latency/storage capacity; retention and the existing
  unbounded authority partition require measurements and a separate safe policy.
- Fresh schema only: `CREATE IF NOT EXISTS` will not upgrade an existing old
  volume. No automatic migration or historical authority backfill is promised.
- Live Cassandra statement preparation/tuple order/conditional batches, real
  two-driver/process-kill/restart, broker and media acceptance. Docker remains
  deferred by the user; no installation/probe/request was repeated.
- The approved media/settings/email/moderation roadmap and deferred push remain
  separate; this increment does not satisfy them.

Design basis, not execution evidence:
[Cassandra4.1 tuple restrictions/LIMIT](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html),
[Java driver4.19 statements](https://apache.github.io/cassandra-java-driver/4.19.0/core/statements/).
