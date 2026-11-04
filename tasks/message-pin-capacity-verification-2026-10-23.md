# Version-fenced message pin capacity — 2026-10-23

## Delivered

Replace independent per-slot claims with one internal version-fenced mutation
per conversation. The same partition's static pin_revision is advanced with its
slot write/release in a conditional batch. A losing same-message pin reloads and
returns an idempotent desired-state no-op rather than consuming another slot.
Five distinct occupied slots reject another pin. Exact release generation
fencing from the prior increment is retained inside that batch.

Absence initializes a new empty aggregate through CAS; populated unversioned or
invalid state is rejected. Reads are bounded6, mutation retries bounded5, version
overflow checked. No process-local lock or timestamp-derived logical revision.

## Files changed in this increment

- `chat-service/src/main/java/com/chatapp/chat_service/canonical/message/CassandraMessagePins.java`:
  active bounded aggregate reader/validator, initialization and versioned mutation.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/message/CassandraMessageRepository.java`:
  delegate slot decisions to that helper, remove old independent claim/read/delete
  statements/loop, retain explicit quorum write to the separate message projection.
- `chat_app_complete.cql`: static pin_revision bigint and corrected operation notes.
- `scripts/test-local-schema.ps1`:715 table columns, explicit static bigint guard.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/message/MessagePinSlotRepositoryTest.java`:
  nine controlled regressions: exact release/batch consistency, lost release,
  missing generation, unrelated slots, version+slot batch/binding, capacity,
  duplicate claimant reload, overflow and no fabricated revision for old rows.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/conversation/ChatReadCassandraIT.java`:
  versioned swapped-slot seed plus concurrent same-message two-client case,
  requiring exactly one slot and revision1. This compiles but has not run.
- ADR0026/checklist/test/traceability documents: limits and evidence.

## Verification

A new controlled batch test failed against the independent-slot implementation.
After implementation, repository/service focused checks passed; full default
JDK20 `./mvnw.cmd -q test` passed **762 tests,123 fresh suites,0 failures/errors/
skips**. XML was filtered after invocation start2026-10-23T06:19:25Z. A final
tightening of the existing batch test asserts exact prior0/next1 bindings and
the static revision predicate; that focused nine-test rerun also passed.

`./scripts/test-local-schema.ps1` passed84 tables/715 columns/2 UDTs(21 fields),
including static type validation. This does not execute CQL on Cassandra.
`git diff --check` passed. No frontend source changed in this increment, so no
new frontend/browser result is claimed.

## Not complete

Fresh bootstrap only: the new static column is not applied by replaying CREATE
TABLE IF NOT EXISTS on an existing table. No migration/reset/provider/env change.
Docker remains deferred; real CQL conditional batches, initial static-only rows,
two-client convergence and crash/reload behavior are unverified runtime gates.

The counter is internal, not yet in a full-pin HTTP/realtime snapshot. Public
commands still need explicit stale-intent/idempotency semantics. Message flag
projection, audit/outbox/realtime publication and search pin-order recovery are
not atomic with this partition. Do not mark the whole pin workflow, distributed
recovery or overall roadmap complete based on these controlled tests.
