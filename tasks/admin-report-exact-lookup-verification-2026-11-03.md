# Admin report decision — exact queue lookup

The decision endpoint used to search the newest 200 rows in a status/day
partition and compare the creation key afterward. An existing report outside
that window could therefore return 404. The existing request already carries the
full primary key: status and UTC day identify the partition, creation timeuuid
and report ID identify the row. Use those four values in one point read. No
schema, data migration, endpoint, or frontend change is required.

The server checks REPORT_MANAGE before access, rejects non-v1 creation UUIDs
before binding, and matches the existing UI decision rules: OPEN can enter
review or finish; IN_REVIEW can finish; terminal reports cannot reopen.
The response contract is documented in OpenAPI. See the Apache Cassandra
[WHERE clause](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/dml.html)
and [native types](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/types.html).

Focused verification: 12 tests passed across AdminModerationServiceTest,
ModerationReportLookupTest and ReportServiceTest. The point-read test asserts
that the repository binds the full primary key, returns the exact row or
absence, and never uses the list query. Service tests cover authorization call,
no mutation on absence, invalid timeuuid and forbidden transitions. This is
mocked driver verification, not a live Cassandra test.

Full default backend suite: 870 tests, zero failures, errors or skips;
Maven BUILD SUCCESS on JDK 20. The optional Cassandra profile was not run.

Remaining: a status-independent report authority, conditional decisions across
concurrent operators and recoverable publication of queue/reporter/audit
records. The old mutation still writes multiple projections, and this change
does not make it atomic or safe to retry after an unknown outcome.

## Follow-up: competing decisions

In the current single-datacenter setup, the stable reporter row now gates
status changes with a conditional update at LOCAL_QUORUM/LOCAL_SERIAL.
Only the winner submits the logged queue move and proceeds to audit. A loser
that already read the old row returns 409 without projection or audit writes.
If the old queue row has already disappeared before lookup, the existing 404
still applies. New reports write the reporter row before publishing the queue
entry. No schema change or frontend change is required.

The 15 focused tests passed, including exact CAS binding, success ordering,
no projection on rejected CAS, and no audit on the service conflict. These
tests mock Cassandra; they do not demonstrate live concurrency.
The full default backend suite also passed: 873 tests, zero failures,
errors or skips. Live Cassandra tests were not run.

The logged queue batch is separate from the conditional update and audit. A
crash or lost acknowledgement after CAS but before batch submission can
strand the queue; a crash before audit can still lose the audit entry. Next
increment needs the winning decision metadata and recovery intent stored with
the authority change, and replay-safe projection/audit writes. Do not mix old
unconditional writers with this guarded writer during deployment.

## Follow-up: retain the winning decision at the status write

The guarded write now merges the decision intent into the same reporter row
in the same conditional statement as the status change. Each intent records
its own timeuuid, actor, assignee, reason, destination and optional resolution
metadata. The immutable report metadata is already on that row. Keys are
scoped by the previous status, so the only two possible decisions (from OPEN
and IN_REVIEW) do not erase each other. Reporter history uses an explicit
column list and never reads or returns the internal reasons.

The fresh-bootstrap schema adds `decision_intents` to `reports_by_reporter`.
An existing database must have that column provisioned before using this
backend; rerunning CREATE TABLE IF NOT EXISTS does not modify an existing
table. No database was changed by this work. The write model uses Cassandra
[conditional updates](https://cassandra.apache.org/doc/stable/cassandra/developing/cql/dml.html)
and a bounded [map](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/collections/map.html).

This persists recovery inputs, but does not automatically discover, project
or publish unfinished decisions. The intent ID is not yet used as the audit
or outbox identity. Do not blindly replay the legacy event recorder. Recovery
still needs bounded discovery, projection ordering and stable audit/outbox
delivery semantics. This cannot reconstruct metadata lost by older versions.

Verification: 29 focused tests passed, including schema guards and a mocked
queue failure after the applied CAS. This checks statement bindings and
execution order, not persistence on a live cluster.

## Follow-up: bounded recovery discovery

Register a pointer at LOCAL_QUORUM before submitting the status CAS. Its
identity is the deterministic shard (16 shards), report ID and previous
status, with reporter ID and creation timeuuid to hydrate the exact authority
row. The reader uses a full clustering-tuple cursor and caps each page at 50.
It returns only the selected transition's intent, not its sibling transition.
No TTL is used: an outage must not erase an acknowledged pointer.

A pointer by itself is not proof of a committed decision. An interrupted
pre-CAS request can leave a pointer without intent; a concurrent contender
can still commit it, so absence is not safe grounds for deletion. There is
not yet a worker or completion/cleanup step: pointers, including those for
successfully published decisions, are retained. Intents from builds preceding
registration are not automatically indexed. The fresh bootstrap adds
`report_decision_work_by_shard`; no running database was changed.

Next: durable completion markers and a rotating bounded worker, replay-safe
queue publication that cannot resurrect an older status, and deterministic
audit/outbox handling that does not reset an already-published event.

Verification: 26 focused tests passed, including failed registration (no
CAS), loser pointer retention, exact cursor/intent bindings and schema
guards. No live Cassandra, restart, or worker replay was exercised.

## Follow-up: shared decision and event identity

The service generates the decision timeuuid before the conditional write and
passes that exact ID to the event recorder only after the write and queue
move succeed. The recorder derives event time and UTC audit/outbox partitions
from the persisted ID, so they do not change across hour/month boundaries.
The existing audit tables use the resulting stable keys. Other producers
continue generating their own event identity.

This does not make the legacy outbox safe to replay: enqueue can still
recreate a removed pending entry, and historical outbox partitions may be
outside publisher lookback. The new recorder entry point is for the initial
publication, not the recovery worker. Before enabling replay, split audit
repair from outbox delivery and verify ordered queue projection.

Full backend suite: 878 tests, zero failures, errors or skips. Coverage
includes matching IDs from the winning CAS through initial publication,
no publication on conflict, and a fixed ID at the UTC year/month boundary.
No Cassandra or Kafka replay integration test was run.

## Follow-up: ordered report queue projection

Read the exact source projection at LOCAL_QUORUM. Use a microsecond stamp
strictly greater than that row's reporter cell stamp, even when the decision
clock is behind. Store the stamp in the same CAS as the winning decision,
then use it for both queue mutations. Replay reconstructs the projection from
the report authority and the selected stored intent, not the worker clock.
If authority is already terminal, replay of an earlier review step does not
reinsert its intermediate destination. Missing source or inconsistent
authority cannot cause a new decision write or a speculative projection.

The timestamp guards overlapping publications while newer Cassandra
[tombstones](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/tombstones.html)
are retained. It is not an unbounded guarantee against a writer suspended
past tombstone compaction. The replay primitive is not scheduled; a worker
still needs a replay horizon or a durable visibility fence, completion
markers, audit/outbox handling and live crash verification. Legacy intents
without a stored stamp must not be replayed with a freshly invented stamp.

Verification: 30 focused tests passed after fixing a Mockito matcher that
incorrectly cast a batch statement. Tests cover exact source lookup,
source stamp ahead of the local clock, and current versus obsolete replay.
No live Cassandra test was run.

## Follow-up: scheduled queue and audit repair

A scheduled worker cycles through the 16 recovery shards, processing at most
25 pointers per invocation, and advances past an item that fails. It repairs
the queue using the stored write stamp, rewrites room and admin audit
projections with the original audit identity and UTC month, then marks the
intent recovered. It does not replay analytics or enqueue Kafka events.
Report audit and initial report outbox writes explicitly use LOCAL_QUORUM
before completion markers can be set. On the initial success path, the
durable enqueued marker precedes pointer deletion. If deletion fails or a
late contender recreates a pointer, the worker can remove it without replay.

Missing or uncommitted intents are retained, as are recovered decisions
without a confirmed enqueue. An enqueued marker is not a broker delivery
receipt. The worker intentionally cannot recover a missing outbox write:
re-enqueueing by ID alone can recreate a pending row. Decisions written
before stable identity and ordered projection stamps must not be blindly
replayed. A Cassandra/Kafka restart test and protections beyond tombstone
retention are still required.

Verification: all 883 default backend tests passed. New worker tests cover
projection-before-audit-before-marker ordering, stable audit identity,
eligible cleanup, failure retention and shard/cursor advancement.

## Follow-up: report outbox receipt fence

Report enqueue now reads the exact receipt at LOCAL_QUORUM and skips an
acknowledged event. Unacknowledged report events use the same seed timestamp
for every logged enqueue; ordinary producers keep their current behavior.
The publisher-side repository checks the durable receipt before offering a
report event for sending, even if an obsolete pending row appears after
[tombstone compaction](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/tombstones.html).
It removes such pending rows. Failed report sends update only attempt
metadata on the authority row; they cannot clear published_at or recreate a
pending row. Successful report receipt writes use LOCAL_QUORUM.

This is not exactly-once Kafka delivery: concurrent in-flight sends or a
broker acknowledgement followed by process death before receipt persistence
can still deliver duplicates. The decision ID remains stable for consumer
deduplication. The repair worker is not yet connected to this enqueue path;
hourly partition lookback still needs a solution for old decisions.

Verification: 23 focused tests passed, including five repository tests
covering acknowledged enqueue, stable seed writes, ordinary producers,
stale pending cleanup and late failed attempts. No live broker or Cassandra
verification was run. When adding always-polled report partitions, freeze
the routing version in new intents; do not silently move old hourly IDs
to another key, where the old receipt would not be visible.

## Follow-up: versioned report routing and recovered enqueue

New decisions persist `outboxRoute=sharded-v1` in the winning CAS. Initial
publication and the worker use the same stable report partition, ID,
original occurrence time and audit payload. The worker records enqueue
completion only after the receipt-aware outbox operation returns. Failed
enqueue leaves work discoverable. Missing or unknown route versions are
not moved from hourly partitions: their receipts may already exist there.

Each publisher tick scans one of 16 report partitions, independent of the
hourly lookback and with a separate budget of at most 25 rows. Cursor
advancement uses the last raw scanned ID, not just deliverable events, so
filtered or failed items do not block later items. An empty page wraps the
cursor on its next visit. The original hourly scan remains in place.

Fixed partitions retain receipt history; future retention must preserve
deduplication for as long as replay is possible. No automatic legacy
backfill, exactly-once Kafka guarantee or live restart acceptance is implied.

Verification: 892 backend tests passed with Mockito 5.17.0 loaded as an
explicit JVM agent. The first run compiled but failed during Mockito
self-attachment. Tests cover old sharded events outside hourly lookback,
continued hourly publishing, cursor advancement after a rejected send,
matching initial/recovery payloads, and recovery retry after enqueue failure.

## Follow-up: authority-backed visibility and legacy receipts

The admin queue treats its rows as bounded candidates, not authoritative
status. Read the queue and exact reporter statuses at LOCAL_QUORUM. Preserve
queue order while checking at most eight candidate keys concurrently and
return only rows whose authority still has the requested status. An absent
row is hidden; a read failure propagates instead of appearing as an empty
queue. Filtering can yield fewer than the requested number of rows; this
change does not add an unbounded refill scan or pagination.

Recovery also reconciles unversioned work with a confirmed receipt under
its original UTC hourly key and then removes the work pointer. Missing
receipts are not proof of a failed send. Unacknowledged old hourly events
and unknown routing versions are not rerouted or re-enqueued. No running
database or broker was contacted.

Verification: all 898 default backend tests passed with explicit Mockito
agent and reduced JVM heap/Serial GC. The initial fork could not allocate
native memory and did not run tests. New coverage checks stale/missing
queue entries, authoritative read failure, exact legacy UTC receipt routing,
confirmed cleanup, missing receipt retention, and unknown route isolation.

## Follow-up: opt-in integration gate

`-Preport-recovery-it test-compile` succeeded on JDK 20 and produced both
integration classes. The copied canonical schema matches the repository
file byte-for-byte. Cassandra coverage is designed to force competing CAS
across two independent sessions, inject a projection write failure after
CAS, and verify repair through a newly constructed session and worker.
Its broker acknowledgement is simulated. The Kafka fixture uses a real
isolated broker with a mocked outbox seam to verify delivery of an old
report event and its original headers before receipt write.

Neither container test was executed, respecting the Docker deferral.
These are complementary component integration gates, not a combined
real Cassandra/Kafka process-kill test. Run the profile in docs/TESTING.md
when Docker is available.

## Follow-up: combined Cassandra and Kafka gate

The Cassandra fixture now also starts an isolated Kafka broker. After
injecting a projection failure and rebuilding the client/worker, the test
checks the original event in Kafka, the persisted Cassandra receipt, and
unchanged broker end offset after re-enqueue and fresh publisher ticks.
The failure is injected at the driver boundary; it is not an OS process
kill. The narrower Kafka contract fixture remains separate.

`-Preport-recovery-it test-compile` passed again on JDK 20. No container was
started and the combined scenario remains unexecuted until Docker is ready.
