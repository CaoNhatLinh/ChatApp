# C1 direct-call authority — 2026-10-20

Follow-up: C2 active-DM controller/client integration is recorded in
`call-transport-verification-2026-10-20.md`. Earlier-stage boundaries below remain
historical evidence, not a claim that the controller is still stateless today.

## Result and boundary

Implemented the internal durable authority prerequisite for the approved call
history work. The previous goal turn made concrete F2 UI/test/documentation progress;
this turn advances the next C1 dependency. It is not a completion claim for calls
or the full roadmap. STOMP still uses its incumbent controller until C2 integration.
No new call-history UI/API, automatic timeout worker, actual media connection
verification, provider deployment or production crash safety is claimed.

No database/container/volume was changed. Docker installation remains deferred by
the user. No provider IO, credentials, tunnel, commit or push was involved.

## Implemented and reviewed

- `CallState`: immutable identity, explicit ringing/accepted/terminal transitions,
  participant roles, server deadline precedence, non-extending ring heartbeat,
  both-peer accepted lease and no terminal resurrection. ACCEPTED is not media.
- `CallRepository` and `CassandraCallRepository`: same-partition slot/snapshot
  conditional batches, exact-key reads, revision fencing, prewritten expiry
  candidates, full-tuple bounded continuation and exact candidate removal.
- `CallLifecycleService`: current membership, archived-room and both-direction
  block checks, start permission, exact identity replay, bounded contention,
  overdue-slot takeover, lazy expiry and cleanup without user permission.
- Expiry prewrites include their expected slot revision. A missing snapshot with
  a still-eligible writer is retained, not discarded as an orphan.
- `chat_app_complete.cql`: two approved capability-owned access paths, no legacy
  migration/fallback or destructive DDL. Existing projections are unchanged.
- Schema guard updated to actual 82 tables / 706 columns / two UDTs. Before this
  slice, the old assertion was 692 but actual schema already had 694 columns from
  private forwarding metadata. C1 adds 12; this is not arbitrary count padding.

Five-axis local code review checked roles/expiry/CAS boundaries, named capability
ownership, no secrets/signals in snapshots, bounded queries and transparent gates.
The review caught one-direction-only block checking; the implementation now reads
both authoritative directions, with regression coverage. No new dependency.

## Changed files and reasons

Backend paths are relative to `chat-service/`.

| Files | Reason |
| --- | --- |
| `src/main/java/com/chatapp/chat_service/canonical/call/CallState.java` | Typed snapshot and state transition policy |
| `.../call/CallRepository.java` | Explicit authority/fenced-expiry persistence boundary |
| `.../call/CassandraCallRepository.java` | Conditional same-partition writes and bounded discovery |
| `.../call/CallLifecycleService.java` | Authorization, identity replay, contention and expiry orchestration |
| `src/test/java/com/chatapp/chat_service/canonical/call/{CallStateTest,CallLifecycleServiceTest,CassandraCallRepositoryTest}.java` | Policy, service/model concurrency and prepared-query/binding tests |
| `.../call/CallLifecycleCassandraIT.java`, `pom.xml` | Opt-in real two-driver Cassandra gate, compiled but unrun |
| Root `chat_app_complete.cql`, `scripts/test-local-schema.ps1`, `InfrastructureManifestTest.java` | Authority/expiry schema and exact static guards |
| `tasks/call-lifecycle-contract.md`, this report, `tasks/todo.md`, `docs/adr/0017-single-partition-direct-call-authority.md`, schema/architecture/testing/traceability docs | Contract first, decisions, evidence and remaining integration work |

Other pre-existing dirty files are not attributed to this slice.

## Verification

JDK 20 selected explicitly from `C:/Program Files/Java/jdk-20`.

| Command | Result |
| --- | --- |
| `./mvnw.cmd -q -Dtest=CallStateTest test` | Initial 8 policy tests passed |
| Focused policy/service/repository/manifest tests | Passed; final call groups contain 28 tests |
| `./mvnw.cmd -q test` | Exit 0: 457 tests, 90 suites, zero failures/errors/skips; prior failed IT reports excluded |
| `./scripts/test-local-schema.ps1` | 82 tables, 706 columns, two UDTs; missing/type/static/JSON parsing guards passed |
| `git -c core.safecrlf=false diff --check` | Clean |

The opt-in IT was added after the full default run; the subsequent focused run
compiles all tests, including that class, without running containers. Three live
scenarios cover actual competing claims, terminal release/stale-writer fencing,
and exact-deadline tuple paging. They remain **unrun**, not passing or skipped.

The service concurrency test uses a synchronized in-memory authority model. The
repository test checks actual prepared CQL text, parameters and driver flags with
mocked IO. Neither proves live Cassandra syntax, isolation, clock behavior, crash
recovery, production throughput or two browser clients. No frontend code changed,
so prior frontend screenshots/builds are not presented as new C1 evidence.

## Next acceptance

C2 must wire STOMP authority/error acknowledgment and revisioned events, preserve
one exact attempt on reconnect, enforce signal targeting/state, run a recoverable
expiry worker and handle replay/fan-out failure. C3 must expose authorized bounded
history/participants and honest outcomes in VI/EN UI. Live Docker/Cassandra,
restart/process-kill, actual two-browser media/ICE/TURN and provider gates remain
open. See ADR 0017 and `docs/testing/chat-cassandra-acceptance.md`.
