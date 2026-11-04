# Incoming-call discovery backend — 2026-10-22

Historical backend execution scope. The subsequent connected client increment is
recorded in `incoming-call-client-verification-2026-10-22.md`; frontend limitations
below describe the boundary at the end of this backend increment.

Status: canonical incoming discovery index, pre-claim registration, authorized
read service and authenticated JSON API are implemented and controlled-tested.
The protected reminder is still subscribed to private STATE only: this backend
increment does not imply that frontend reload/reconnect lookup is connected.
The full roadmap remains unfinished.

Contract: `incoming-call-discovery-contract.md`. Decision: ADR0019. No provider,
credential/environment, dependency, live database/volume, commit or push change.
Docker installation/probing was not attempted; the user deferred it.

## Behavior and consistency

- `GET /api/calls/incoming` derives callee exclusively from authentication and
  returns the existing canonical CallSnapshot page, no-store and explicitly JSON.
- `incoming_calls_by_user` stores only callee, fixed ringing deadline, room and
  call keys. New-call claim writes it before cyclic recovery work and the
  single-partition authority CAS. An index failure cannot commit authority;
  losing/uncertain claims can leave false-positive keys, never copied truth.
- Reads reuse the current active-call policy: current slot/snapshot, active DM,
  both memberships and both block directions. Return only matching call/callee/
  deadline, current RINGING and not elapsed. Accepted/terminal, replaced, old
  retry timestamps, inaccessible, missing and uncommitted pointers are excluded.
- Only documented access/missing/non-DM denials are filtered. Contention remains
  409; datastore/unavailable/inconsistent authority remains canonical 500.
  The reused active lookup may expire a call by fenced CAS if its deadline
  passes during hydration. Discovery never starts/accepts a call or opens devices.
- The physical TTL is 86400 seconds; ringing eligibility is fixed 45 seconds and
  heartbeat never extends it. No projection delete/worker is needed. ADR0019
  records the paused-producer proof and synchronized-clock/load assumptions.
- At most 50 raw keys per request, default 25; no room enumeration, offset,
  ALLOW FILTERING or exposed driver paging state. Full tuple keyset continuation
  follows scanned rows, even when every candidate is filtered. A full page can
  require one final empty read to establish exhaustion.
- Cursor is actor/version-scoped, max 1024 characters, max 60 seconds from initial
  traversal. Reject future/expired lower bounds, malformed/reserved UUIDs,
  out-of-CQL-range/submillisecond times and malformed/oversized whitespace.
  Cursor is not authorization. Reads recheck actual time; pagination is a
  changing feed, not a snapshot of concurrently inserted keys.

## Files and reasons

Production paths under `chat-service/src/main/java/com/chatapp/chat_service/`:

- `canonical/call/IncomingCallRepository.java`: typed immutable discovery keys
  and bounded actor/deadline/tuple read boundary.
- `canonical/call/CassandraIncomingCallRepository.java`: prepared key insert and
  two bounded single-partition range queries, LOCAL_QUORUM, immutable result.
- `canonical/call/CassandraCallRepository.java`: inject the index and prewrite
  before existing work/CAS. All constructor callers were updated; no legacy shim.
- `canonical/call/IncomingCallService.java`: bounded discovery, current authority
  hydration, explicit error filtering, page cursor and CQL timestamp validation.
- `canonical/call/IncomingCallController.java`: authenticated actor extraction,
  declared JSON-only GET and no-store canonical page.

Tests under `chat-service/src/test/java/com/chatapp/chat_service/`:

- `canonical/call/CassandraIncomingCallRepositoryTest.java`: exact query/key
  bindings, complete deadline-tie tuple, row order, limit, consistency/idempotence,
  registration restrictions and failure propagation.
- `canonical/call/CassandraCallRepositoryTest.java`: incoming/work/CAS ordering,
  failed registration, uncertain same-key retry and losing claim, no heartbeat/
  terminal index rewrite.
- `canonical/call/IncomingCallServiceTest.java`: current authority only, immutable
  eligibility through heartbeat, stale/wrong/terminal/expired/denied filtering,
  error propagation, tied-deadline and filtered-empty continuation, scope/limit/
  age/shape/precision/range validation before repository interaction.
- `canonical/call/IncomingCallControllerTest.java`: actual MVC/advice/JSON and
  OpenAPI parity; exact actor, paging, no-store, errors and no leaked fields.
- `canonical/call/IncomingCallHttpSecurityTest.java`: real production security
  chain/JWT filter/actor helper with generated signed test tokens. Anonymous,
  bad-signature, missing/suspended-account rejection and forged identity query
  parameters; no-Accept requests still return JSON. Discovery service is mocked.
- `canonical/call/CallLifecycleCassandraIT.java`: constructor wiring plus a new
  opt-in two-driver index range/tuple/actor-scope and TTL metadata test. Compiled,
  **not executed**; it is not counted as a passing/skip live gate.
- `common/config/InfrastructureManifestTest.java`: exact 84-table guard and exact
  incoming index key/order/default-TTL schema assertion.

Other paths:

- `chat_app_complete.cql`: one four-column incoming index in the canonical fresh
  initializer, not an ALTER/upgrade script or reset of any existing database.
- `scripts/test-local-schema.ps1`, `docs/SCHEMA_CONSOLIDATION.md`: current static
  count 84 tables/720 columns, two UDTs/20 fields.
- `docs/api/openapi.yaml`, `docs/contracts/canonical-api.yaml`: canonical endpoint,
  page schema, limit/cursor and error/no-store/JSON contract.
- ADR0019, call lifecycle contract, architecture, todo, testing and traceability
  docs: reasoning, current implementation and still-open consumer/live gates.

## Verification and review

Using JDK 20 via process-scoped JAVA_HOME (machine configuration unchanged):

1. Test-first initial compilation failed while the new interfaces/service and
   HTTP controller were absent; then the implementation was added.
2. First complete focused run: 61 tests, one security-test response-format failure.
   Actual MVC converters included a transitive XML converter. The endpoint was
   made explicitly JSON-only, with a real no-Accept security regression rather
   than weakening JSON/actor assertions.
3. Independent review found an extreme Instant cursor could pass Java parsing
   but fail CQL epoch-millis binding. The new regression failed before the fix;
   epoch-millis roundtrip validation now rejects it before querying. Oversized
   whitespace validation and tied-deadline service coverage were also added.
4. Final focused command: `./mvnw.cmd -q '-Dtest=IncomingCallServiceTest,CassandraIncomingCallRepositoryTest,CassandraCallRepositoryTest,IncomingCallControllerTest,IncomingCallHttpSecurityTest,InfrastructureManifestTest,CallActiveQueryTest' test`.
   Exit 0: 65 tests across seven suites, no failures/errors/skips.
5. `./mvnw.cmd -q test`: exit 0. Current default `TEST-*Test.xml` reports:
   **561 tests / 101 suites, zero failures/errors/skips**. Historical opt-in
   missing-Docker results were not deleted or counted as passing default tests.
6. `./scripts/test-local-schema.ps1`: exit 0, 84 tables/720 columns, two UDTs.
   This is a local schema/parser/mismatch guard, not execution against Cassandra.
7. `git -c core.safecrlf=false diff --check`: pass. Unrelated existing work kept.

A fresh independent five-axis source review returned no outstanding Critical/
Required findings after the cursor/JSON fixes. That reviewer did not run tests;
the command/report evidence above is the main agent's execution, not a second
independent runtime validation.

No frontend files changed, so no new frontend build/browser/screenshot result
is claimed. Previous reminder captures remain evidence of that previous slice.

## Remaining acceptance

- Connect subscribe-before-lookup on protected entry/reconnect, abort/session
  guards, filtered continuation and versioned merge preserving local hide.
- Actionable local lookup failure/retry; never interpret failure as no calls.
- Controlled frontend reload/reconnect, stale HTTP vs terminal STATE, cursor
  expiry/cycles, denied data and VI/EN/light/dark/custom-room checks.
- Live Cassandra CQL/TTL/claim/crash/two-driver/restart/broker tests after Docker
  is installed. LIMIT does not bound storage tombstone scans or latency; actual
  retention, compaction/backlog and capacity require measurements.
- Actual two-client media/STUN/TURN and C3 history/participants; rest of roadmap.

No parent C2/C3 or full-goal completion is inferred from these backend tests.

Design sources, not runtime evidence: [Cassandra4.1 tuple ranges/TTL](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html),
[Java driver4.19 paging and page-size limits](https://apache.github.io/cassandra-java-driver/4.19.0/core/paging/),
[Spring6.2 producible media types](https://docs.spring.io/spring-framework/reference/6.2/web/webmvc/mvc-controller/ann-requestmapping.html#producible-media-types).
