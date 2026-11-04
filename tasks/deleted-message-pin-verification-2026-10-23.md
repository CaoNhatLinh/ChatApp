# Deleted message pin cleanup and concurrent commands

## Problems reproduced

An already committed tombstone returned successfully without releasing its pin.
A pin command could read a live message, commit after deletion and return a
tombstone together with a pin snapshot still referencing it. The regression
for deletion retry failed against the previous source (release was never called).
A second regression showed deletion statements did not explicitly set quorum/
serial levels. Both now pass.

## Implementation and changed files

- `chat-service/.../canonical/message/DeletedMessagePins.java`: tombstone-only
  cleanup, bounded fresh snapshot/CAS retries. Each attempt uses the currently
  observed pin revision; the existing repository generation fence remains in
  force. No unconditional release, version fallback or storage-error retry.
- `MessageService.java`: ordinary deletion and idempotent retry release slots;
  a losing concurrent deletion returns the committed tombstone without duplicate
  delete publication. A pin observing deletion after commit compensates and
  returns conflict without publishing a pinned success. Member pin snapshot
  lookup repairs up to five proven tombstone references and returns fresh state.
  Missing rows are deliberately not treated as proof of deletion.
- `CassandraMessageRepository.java`: deletion state read and tombstone write
  explicitly LOCAL_QUORUM; deletion CAS explicitly LOCAL_SERIAL.
- `DeletedMessagePinsTest.java`:6 focused cleanup groups (proof requirement,
  no-op, generation/revision replacement, concurrent removal, bounded contention,
  non-conflict storage failure).
- `MessagePinDeletionTest.java`: focused service tests, including two actual
  worker threads paused immediately before/after pin commit; repository authority
  is controlled, not Cassandra. This group was extracted from the already-large
  `MessageServiceTest` rather than leaving an additional156 lines there.
- `MessageServiceTest.java` / `MessageRevisionContractTest.java`: explicit empty
  pin authority fixtures for existing deletion tests, no production null fallback.
- `MessageRevisionMutationTest.java`: explicit statement consistency regression.
- `chatapp_frontend/scripts/message-revision-order-smoke.mjs`: actual store
  coverage for deletion before cleanup snapshot and delayed/newer pin snapshots
  or old HTTP/history after a tombstone. No runtime store code needed changing.
- `scripts/message-delete-smoke.mjs`: canonical pin snapshot/tombstone fixtures,
  optional `DELETE_PINNED=1`, reload and eight light/dark width checks.
- OpenAPI, ADR0028 and task/test/traceability documents record read-repair
  behavior, permissions, bounded conflict and remaining durability gates.

## Checks observed

- Full backend before test extraction:789 tests/125 fresh suites, zero failures,
  errors or skips. The first full run caught one old revision-contract fixture
  missing its pin state; it was explicitly corrected and the full suite rerun.
- Focused run after extraction passes new service/cleanup groups plus existing
  MessageService, revision mutation and HTTP revision-contract tests. The final
  full run passes **789 tests/126 fresh suites, zero failures/errors/skips**;
  XML reports filtered after2026-10-23T08:14:20Z, excluding stale IT reports.
- Two-thread service cases prove controlled interleavings: deletion finishes
  before pin commit, or finishes after pin commit but before its final authority
  read. Both converge to an empty pin state with revision2 and do not publish
  `MESSAGE_PIN` success. They do not prove real CQL or broker concurrency.
- Actual frontend store/strict adapter ordering:20 groups pass, including
  deleted messages remaining unpinned even with a later pin snapshot and no
  resurrection from old pin responses/history.
- Production browser ordinary deletion and `DELETE_PINNED=1` pass: VI cancel
  does not delete, English confirmation sends one scoped DELETE, tombstone hides
  content/actions; reload remains deleted. No reported console/request failures.
- Pinned deletion after reload fits320/768/1024/1440 in light/dark. Eight captures
  are `chatapp_frontend/artifacts/ui-audit/current/deleted-pin-{theme}-{width}.png`;
  dark320 and light1440 visually inspected. The capture also exposed existing
  “1 members” copy, retained as an open copy-audit item rather than ignored.
- Frontend lint passes after script changes. No frontend runtime source changed
  in this increment, so the existing production build was reused rather than
  claiming a fresh build or repeating type-check without a relevant source edit.
- Final `git diff --check` passes. Owned production smoke server stopped;
  port3117 has no listener.
- Test development also caught an incorrect `isMember` test stub; it was changed
  to the repository's actual `findConversationMember` contract before passing.

## Boundaries and remaining work

There is still no atomic message/pin/outbox transaction or durable background
deletion completion. A crash may lose audit/search/realtime publication; a later
member snapshot lookup repairs slot state, not every missed event. No-live-reader
background recovery and stored message flag projection repair remain open. Read
repair may conflict after bounded retries and expose the existing inline Retry.
Do not describe controlled interleavings as crash-safe production acceptance.

Real Cassandra/two-client/broker/crash tests remain user-deferred with Docker;
no engine was probed or installed. No schema/dependency/env/provider mutation,
commit or push performed.

Statement configuration follows installed Apache Java Driver4.19.0's
[official immutable statement guidance](https://apache.github.io/cassandra-java-driver/4.19.0/core/statements/#statements).
