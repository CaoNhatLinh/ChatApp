# Exact unpin ownership — 2026-10-23

Follow-up: ADR0026 and `tasks/message-pin-capacity-verification-2026-10-23.md`
supersede the independent slot mutation/capacity limitations with an internal
version-fenced batch. Public snapshot/idempotency/projection/publication and live
acceptance limits remain open; the evidence below describes the earlier slice.

## Failure reproduced

The repository scanned a slot, then unconditionally deleted its slot number.
A different pin could occupy that slot before deletion. The old worker would
remove the replacement and clear the message projection. Two new repository
tests failed against that code: no exact conditional predicate, and reporting
success/clearing the projection when ownership had been lost.

## Changed behavior

Read the existing `pinned_at` timeuuid with the slot. Release only if the exact
bucket, message ID **and observed timeuuid generation** still match. The last
condition also distinguishes unpin/re-pin of the same message in the same slot.
Use LOCAL_QUORUM for the observed read and conditional write, LOCAL_SERIAL for
the delete CAS, and inspect `wasApplied` before clearing the message projection.
Missing generation is an invariant error, not an unfenced compatibility delete.

On lost ownership, return a conflict from `unpinMessage` before writing audit/
outbox/realtime success. No schema, dependency, public payload or frontend change.
This follows Cassandra's documented
[conditional DELETE](https://cassandra.apache.org/doc/stable/cassandra/developing/cql/dml.html#delete),
not an assumption that a read followed by a plain delete is atomic.

## Files

- `chat-service/src/main/java/com/chatapp/chat_service/canonical/message/CassandraMessageRepository.java`:
  select generation, exact conditional release, consistency and applied outcome.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/message/MessageService.java`:
  reject a failed release rather than publish false success.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/message/MessagePinSlotRepositoryTest.java`:
  four controlled tests for exact binding/generation/consistency, lost ownership,
  missing generation and unrelated slots.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/message/MessageServiceTest.java`:
  conflict path publishes neither projection event nor realtime success.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/conversation/ChatReadCassandraIT.java`:
  opt-in two-client race, swapping the observed slot before the actual repository
  delete, both to another message and the same message's new generation. Compiled
  only; Docker is deferred. No real database was touched.

## Verification

Initial repository2 tests failed as expected against the previous source. The
first implementation's focused repository/service suite passed. Final
`JAVA_HOME` process-local JDK20 + `./mvnw.cmd -q test` passed **757 tests across123
fresh suites,0 failures/errors/skips**. Reports were filtered after the recorded
invocation start2026-10-23T06:08:37Z, excluding old IT XML. The expanded repository
four and service conflict regression are included. `git diff --check` passed.
No frontend code changed, so this increment does not claim new browser evidence.

## Still required for full pin correctness

This is **not** a versioned pin aggregate or atomic multi-table operation.
Concurrent pins can still claim multiple slots for one message; pin/unpin and
message projection writes can race, and a crash can interrupt projection repair
or publication. Multiple observed duplicate slots can be partially released
before a conflict. An empty scan can race a new claim. Independent pin event
ordering remains open in UI/search.

The next design must establish one versioned conversation pin authority with
bounded capacity and idempotent commands, then derive message/search/realtime
state from it with durable recovery. `pinned_at` fences an observed slot
generation; it must not be passed off as a globally monotonic pin revision.
Real Cassandra/CQL/two-client/crash acceptance remains unchecked until Docker is
available. No completion claim for the full pin feature or overall roadmap.
