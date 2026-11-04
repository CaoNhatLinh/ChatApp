# Message search ordering — 2026-10-23

## Delivered implementation

Canonical message events now require integral revision0..2147483647 before a
search write. The consumer no longer reads/replaces an entire search document.
Its repository fragment submits one atomic scripted upsert with three conflict
retries, monotonic content revisions and irreversible tombstone content.

Content updates do not overwrite the independent pin flag; pin/unpin events
update that path explicitly. Creation-time mention IDs can be supplied by a late
SEND while preserving newer content, and tombstones clear retained search text,
attachment/pin flags and mention identities. This does not version pin mutations.

## Files changed in this increment

Paths are under `chat-service/src/`:

- `main/java/com/chatapp/chat_service/canonical/search/MessageSearchProjector.java`:
  strict canonical version, fresh event snapshot and custom writer delegation;
  remove the Java read/modify/save race and obsolete existing-createdAt branch.
- `main/java/com/chatapp/chat_service/canonical/search/MessageSearchDocument.java`:
  integer revision and explicit keyword ID mapping for current tie-break sort.
- `main/java/com/chatapp/chat_service/canonical/search/MessageSearchRepository.java`:
  compose the writer fragment while retaining existing repository/index bootstrap.
- `main/java/com/chatapp/chat_service/canonical/search/MessageSearchWriter.java`
  and `MessageSearchWriterImpl.java`: focused atomic-write boundary, Painless
  policy, explicit INLINE script, scoped index coordinates and bounded retry.
- `test/java/com/chatapp/chat_service/canonical/search/MessageSearchProjectorTest.java`:
  canonical routing, pin/unpin separation, malformed versions, index failure
  propagation to Kafka recovery and unrelated-event handling.
- `test/java/com/chatapp/chat_service/canonical/search/MessageSearchWriterTest.java`:
  actual installed UpdateQuery construction, configured index, tombstone payload
  redaction and exclusion of metadata from the content replacement map.
- `test/java/com/chatapp/chat_service/canonical/search/MessageSearchRepositoryFragmentTest.java`:
  actual Spring repository factory composition and custom-command delegation.
- `test/java/com/chatapp/chat_service/canonical/search/MessageSearchProjectionIT.java`:
  opt-in real Elasticsearch8.18.8 transport/script tests, compiled only so far.
- ADR0025 and execution/checklist documentation: decisions and honest runtime gates.

No frontend, CQL, environment, dependency, credential or provider changes in this
increment. Other pre-existing dirty files are not claimed as this increment.

## Evidence

Before implementation, a test against the old projector observed a retained
deleted document become non-deleted after a delayed SEND. After implementation,
the actual local consumer/writer/factory/service focused suite passes8 tests.
These controlled tests inspect routing and construction, **not execution of the
Painless guard**. The corresponding real engine regression/concurrency tests are
in the opt-in IT, not silently replaced by a fake Java script interpreter.

Command: process-local JDK20 with
`./mvnw.cmd -q -Dtest=MessageSearchRepositoryFragmentTest,MessageSearchProjectorTest,MessageSearchWriterTest,MessageSearchServiceTest test`.
Full default `./mvnw.cmd -q test` passed with **752 tests,122 fresh suites,
0 failures/errors/skips**. Reports were selected by LastWriteTimeUtc after the
recorded invocation start2026-10-23T06:02:21Z, excluding older IT reports.
`git diff --check` also passed (existing CRLF notices only).

## Runtime gates / next work

After Docker is installed/enabled, explicitly run
`./mvnw.cmd -q -Dtest=MessageSearchProjectionIT test` with JDK20. This uses a
dedicated ephemeral test container; it does not connect to the user's index.
The IT is not part of the default no-Docker test selection. It has not run.

Still open: real repository auto-discovery/bootstrap against the engine, mapping
and Painless acceptance, concurrent pin ordering and candidate-filter freshness,
durable lost-event recovery/reindex, directory-pointer ordering/repair and live
two-client/crash/performance gates. Missing-revision existing index documents
fail instead of being treated as canonical revision0; no old index was rebuilt
or deleted. Docker remains deferred at the user's request.
