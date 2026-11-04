# 0025 — Atomic content revisions in the message search index

Date: 2026-10-23. Status: implementation and controlled checks; real engine acceptance pending.

## Context

The Kafka search consumer used Java read/modify/save of a whole document. A
delayed SEND could overwrite an edit or tombstone, and concurrent first writers
had no content-order guard. An observed regression test against the previous
consumer resurrected a deleted document. Authorized search reads already hydrate
Cassandra content, but that does not repair corrupted candidate selection.

## Decision

Require the canonical content/deletion revision on every handled message event.
Do not synthesize revision0 for malformed/missing events or existing unversioned
index documents. Index content through a Spring Data repository fragment using
one scripted upsert, with a bounded conflict retry. The comparison runs within
the Elasticsearch document update, not in a Java find/save window.

A new document initializes its snapshot. Only a strictly higher content revision
can replace existing content fields, and a tombstone cannot be replaced by a
non-deleted snapshot. Deleted documents have empty content, no attachment/pin
affordance and no mention identities. The source stores canonical revision; ID
is explicitly keyword-mapped for the existing search-after tie-break sort.

Pin and mentions are deliberately excluded from the content replacement map.
Only pin/unpin events (or initial creation) update the pin flag. Immutable
creation-time mention IDs can arrive after an edit without rolling content back;
events that omit mentions do not clear them. Deletion always clears them.

## Limits

Follow-up: ADR0027 now carries and compares a separate canonical pin revision.
The original pin-version limitation below is superseded for delivered events,
not for lost publication, pin projection repair or real-engine acceptance.

Content revision is not a pin revision. Two pin/unpin events can still arrive in
the wrong order; a separately versioned pin aggregate/authority reconciliation
remains necessary. Do not describe this as ordering every search filter.

No exactly-once event delivery, outbox recovery beyond its existing lookback,
reindex/backfill, stale directory-pointer repair or independent metadata fencing
is implied. An already-populated index lacking canonical revisions must be
deliberately rebuilt; no runtime compatibility fallback or automatic deletion
was introduced. A typed request and compilation do not prove Painless execution.

## Sources and evidence

Installed Spring Data Elasticsearch5.5.1 API signatures were inspected locally,
including UpdateQuery's explicit INLINE script type. Implementation follows
[Elasticsearch scripted upserts](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/update-document#run-a-scripted-upsert)
and Spring's documented
[repository fragment model](https://docs.spring.io/spring-data/elasticsearch/docs/5.0.0/reference/html/#repositories.custom-implementations).
Actual repository-factory composition and request construction have local tests.
`MessageSearchProjectionIT` compiles but awaits the user-deferred Docker engine;
it exercises the real Spring transport/Painless engine, delayed delete/send,
metadata separation and concurrent first writers against Elasticsearch8.18.8.

See `tasks/message-search-ordering-verification-2026-10-23.md` for commands and
actual outcomes. Full roadmap and runtime gates remain open.
