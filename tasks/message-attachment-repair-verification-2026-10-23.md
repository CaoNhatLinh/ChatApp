# Frozen attachment replay repair — 2026-10-23

## Defect and change

`MessageService.repairCommittedMessage` repaired attachment rows only for
forwarded messages. A normal media send interrupted after saving the message
could return its existing message on retry without writing missing references.
Three new service checks failed before the fix: absent ordinary writes, a
silently successful interrupted repair and projection repair on a deleted row.

Exact-fingerprint retries now replay the frozen attachment references for normal
and forwarded messages. They keep the original room/bucket/message/attachment
keys and propagate a failed reference write instead of acknowledging success.
The message itself is not overwritten, and asset metadata is not reconstructed
or reauthorized from a mutable upload/source snapshot after commit.

Deleted authority rows keep bucket/tombstone discovery but skip attachment and
source-index repair. This is a point-in-time check, not a fence against concurrent
delete. Public tombstone redaction remains in place.

Reference writes and both head/continuation reads explicitly use LOCAL_QUORUM,
matching the message authority's local-datacenter policy. This does not make
message, references, projections and external IO one atomic transaction.

## Files in this increment

All Java paths are relative to `chat-service/src`:

- `main/java/com/chatapp/chat_service/canonical/message/MessageService.java`:
  all frozen attachment repair, deleted-row guard.
- `main/java/com/chatapp/chat_service/canonical/message/CassandraMessageRepository.java`:
  explicit reference read/write consistency.
- `test/java/com/chatapp/chat_service/canonical/message/MessageServiceTest.java`:
  five regressions for ordinary replay, retry after repair interruption, deleted
  rows, fingerprint conflict and initial-send interruption after message commit.
- `test/java/com/chatapp/chat_service/canonical/message/MessageAttachmentRepositoryTest.java`:
  stable key/UDT binding, nullable metadata, read/write consistency and error propagation.
- OpenAPI send description, TODO, testing/traceability and this report:
  corrected contract and still-open distributed guarantees.

No schema, provider/configuration, frontend source or dependency change. Existing
unrelated changes remain untouched. No commit/push or live file mutation.

## Verification

- New service tests: first **4 run/3 fail**, proving the missing ordinary repair
  and missing deleted guard; conflict guard was already correct.
- After the service fix, repository consistency tests: **3 run/2 fail** because
  the read/write statements did not explicitly set LOCAL_QUORUM. Fixed the
  production statements, not the assertions.
- Focused run: MessageService46 + attachment repository3 + reader9 + controller4
  + forward repository1 + reply repository1 = **64 tests pass**.
- Final `./mvnw.cmd -q test`, process-local JDK20: **724 tests/116 fresh suites,
  zero failures/errors/skips**. Aggregate uses only reports modified since this
  invocation started; stale Cassandra IT output is excluded.
- The fault tests exercise the real MessageService with a controlled repository
  map and an injected failure between two writes. They verify exact metadata/keys,
  no second message write/allocation and successful repair on the same command.
- Repository tests execute actual production repository methods against controlled
  driver statements/UDT; they do not prove a live quorum, process crash or cluster recovery.

No frontend rebuild/browser run is implied by this backend-only increment.

## Review and remaining correctness work

The repair remains behind current send permission, membership/chat policy and
matching request fingerprint. It does not grant new asset access; the message
attachment reader still resolves readiness and visibility independently.
Replaying bounded identical reference upserts costs additional writes, not new
provider uploads. Performance has not been load-tested.

This is not durable completion of the send pipeline. A lost first attempt can
still miss last-message projections, mention work, audit/notification/realtime
publication. The retry path deliberately does not blindly repeat those side
effects. A durable completion/outbox record and replay policy are still needed.
Recipients may need history reload until that recovery exists.

Inspection also found the next authority issue: initial message creation is an
unconditional INSERT. Two workers can both observe an absent row; a delayed
creator can subsequently overwrite an edit/delete/revision. The current "already
committed" fast path does not protect that interleaving. Conditional creation
and the related projection/retry contract need a separate tested change before
claiming concurrent/crash-safe sends.

M2 pre-provider intents, frozen durable commands, reference lifecycle, recoverable
provider deletion/orphan work and actual restart/two-client/Cassandra tests remain
open. Docker remains deferred by the user. Full roadmap is not complete.
