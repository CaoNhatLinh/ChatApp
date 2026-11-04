# A1 typed system settings backend

## Scope delivered

Two non-secret allowlisted settings now have real consumers in new public
community creation: boolean creationEnabled and integer defaultMaxMembers.
Existing rooms, DM and private-group behavior is unchanged; explicit valid room
limits remain valid. This is controlled A1 backend implementation, not the A2
admin form or proof of live Cassandra/crash correctness.

Contract and state matrix were recorded before source edits in
`tasks/system-settings-contract.md`; architecture rationale is ADR0029.

## Changed files and reasons

- `chat-service/.../canonical/settings/SystemSetting.java`: finite key/type/default/
  bounds catalog; no boolean/string/number coercion, secrets or unknown keys.
- `SystemSettingsRepository.java`: state, immutable command, expected revision
  and bounded cursor-scoped pending audit contract.
- `CassandraSystemSettingsRepository.java`: same-key STATE/COMMAND/PENDING
  conditional batches, quorum/serial configuration, metadata/command identity
  checks and exact pending acknowledgement. No arbitrary full-table read.
- `SystemSettingsService.java`: SYSTEM_OPERATE read/write authorization,
  validation, actor/payload-bound command replay, revision conflict, typed current
  authority responses and honest committed/auditPending outcome. A committed
  command with missing authority throws instead of masquerading as defaults.
- `SystemSettingsAuditRecovery.java`: immutable audit upsert before ack; finite
  key rotation and bounded25-row cursor pages. Failed exports remain discoverable
  and are revisited after wrap/restart without generating a new event ID.
- `SystemSettingsController.java`: GET/PUT no-store admin HTTP endpoints.
- `canonical/service/ConversationService.java`: actual community-only consumer
  before persistence; private groups and DMs do not query the new settings.
- `chat_app_complete.cql` / `scripts/test-local-schema.ps1`: replace the previously
  unused plain settings table definition with the canonical aggregate and verify
  all five new columns; current bootstrap84 tables/720 columns,2 UDTs/21 fields.
  No live table or old data was changed.
- Five new `canonical/settings/*Test.java` classes and updated
  `ConversationServiceTest.java`: typed catalog/repository/service/recovery/MVC
  and real consumer coverage.
- OpenAPI, compact canonical API manifest, schema summary, ADR0029 and task/test/
  traceability documents: one current contract, no compatibility endpoints.

## Observed verification

- New API/catalog/recovery tests were written before their implementations.
  Initial compile failures are expected RED evidence for new classes, not a
  passing behavior claim.
- Meaningful consumer RED: disabled-community test on old creation code failed
  because no exception occurred. New consumer passes and rejects before save.
- Meaningful invariant RED: committed command without state previously returned
  pristine defaults; regression failed, then passed after explicit invariant guard.
- Focused settings/consumer tests pass: strict value types/bounds, permission
  rejection before storage, stale/lost CAS without success audit, exact replay
  after a newer value, changed-payload/actor command reuse rejection, audit export
  failure, durable pending cursor rotation, metadata invariants and frozen command
  JSON round-trip. MVC checks no-store, real JSON primitive types,400/403/409 and
  successful commit receipt.
- Final default process-local JDK20 `./mvnw.cmd -q test`: **817 tests/131 fresh
  suites, zero failures/errors/skips**, XML reports filtered after
  2026-10-23T08:32:06Z. No stale optional IT reports counted.
- `./scripts/test-local-schema.ps1`: pass at84 tables/720 columns,2 UDTs/21 fields.
- Infrastructure/revision-contract tests also pass against the updated OpenAPI.
  Compact manifest parsing is checked separately after adding its new routes.
- `git diff --check`: pass. No frontend runtime source changed in this increment;
  no new build/browser screenshots are claimed for an admin form not yet built.

## Remaining gates and limits

A2 typed adapter/admin form, draft/409/uncertain-write retry/locale/keyboard/theme
browser coverage and clear user-facing disabled-community explanation remain open.
The current generic403 client copy does not yet explain the new global policy.

Actual Cassandra4.1 prepare/conditional-batch behavior, two clients, process-kill
audit recovery and load/retention acceptance have not run while Docker is deferred.
The command log has no automatic TTL; its low-write per-key partitions need
operational retention/size observation before expanding the catalog. Corrupt
persisted commands fail closed; this is not a silent corrupt-data skip tool.
Creation uses settings read during validation; it does not retroactively revoke
already in-flight creation or existing rooms.

No new dependency/provider/env secret, migration execution, volume reset,
commit or push. Current schema is fresh-bootstrap only; CREATE IF NOT EXISTS
does not upgrade an old table's primary key.

Primary references: [Cassandra4.1 DML](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html#batch),
[Java Driver4.19 batch statements](https://apache.github.io/cassandra-java-driver/4.19.0/core/statements/batch/).
