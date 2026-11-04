# ADR0015 — Authorized direct-reply threads with complete keyset cursors

Status: accepted implementation; live Cassandra acceptance pending.
Creation/batch portion partially superseded by ADR0023 (2026-10-23): conditional
message authority and explicit source-index repair replace the logged create batch.
Date: 2026-10-20. Scope: approved feature-expansion T1/T2, not the complete T3 UI.

## Context

Messages live in hour/shard partitions. A message ID alone is not a lookup key.
Cached conversation history cannot represent every reply, and index rows cannot
be treated as authoritative content or permission. Equal child creation times
must not lose entries on pagination. Source deletion and membership revocation
must not reveal retained investigation content.

## Decision

Use the existing `replies_by_parent_message` partition, keyed by conversation and
full parent bucket/ID. New message/index writes share a logged batch; exact send
replay repairs the same deterministic index identity. The server resolves the
parent sender rather than accepting it from the client (T1).

`MessageThreadController` delegates reads to `MessageThreadService`, separate
from the message command orchestrator and the shared-content archive. Each page
checks current membership, validates the parent key/cursor and reads the actual
parent. Missing/blocked parents are unavailable; soft-deleted parents are public
tombstones so existing authorized replies remain readable.

The index is traversed ascending by both clustering columns: creation timeuuid
and child message timeuuid. Opaque bounded cursors include both columns and the
actor/conversation/full parent scope. They are navigation positions, not signed
authorization capabilities: every request independently checks membership.

Each request consumes at most the requested1–50 index entries plus one lookahead.
Hydration point-reads the message authority, verifies the actual parent reference
and applies current block filtering/public deletion redaction. Block decisions are
memoized per distinct sender for that request, not cached across requests.
No content is taken from a projection sender or a browser history slice.

Filtered/missing/stale references may produce an empty page with continuation.
Clients must use `hasNext`/`nextCursor`, never infer completion from content length.
No full-table scan, ALLOW FILTERING, count query or unbounded fill-until-full loop.

## Alternatives rejected

- Fetching replies by scanning all message buckets: costly and not a stable index.
- Returning projection rows directly: stale/deleted/wrong-parent data could leak.
- Cursor containing creation time only: loses replies tied in the same millisecond.
- Filling a visible page by scanning until enough messages survive: unbounded IO
  when many senders/references are filtered.
- Preloading all block relationships for each thread: potentially unbounded work.
- Reusing cached main-timeline messages as a thread: incomplete by construction.

## Consequences and limits

This is a direct-replies endpoint, not recursive descendant aggregation or a total
count. Reads are bounded point hydration with at most50 messages, not a zero-IO
cache. It provides no multi-partition snapshot/linearizable revocation guarantee;
concurrent backdated writes can require refresh. Logged batches do not make every
attachment/notification/projection side effect crash-safe.

No new schema or provider is needed for T2. The fresh schema and input contract
remain canonical; no legacy migration or compatibility DTO is introduced.
UI, composer races, exact source viewer and live Cassandra/realtime acceptance
remain tracked separately. Docker installation was deferred by the user.
