# 0026 — One version-fenced conversation pin aggregate

Date: 2026-10-23. Status: connected mutation implementation/controlled tests;
live CQL and downstream recovery pending.

## Problem

Independent IF NOT EXISTS claims bound the number of occupied slots, but two
workers could claim different slots for the same message. Checking for an
existing pin before claiming was not a uniqueness guarantee. Exact release
generation fencing remains necessary but does not serialize all room pin changes.

## Decision

The existing `pinned_message_slots_by_conversation` partition now carries static
bigint `pin_revision`. Only an absent partition is initialized through CAS.
Existing rows without a valid revision are invariant errors, not legacy revision0.

Within a bounded scan of at most6 rows, validate up to5 distinct valid slots and
their shared nonnegative revision. An already-desired state is a no-op. To create
or release a pin, advance the static revision and mutate the slot in one
same-table/same-partition conditional batch at LOCAL_QUORUM/LOCAL_SERIAL. Pin
losers reload and re-evaluate uniqueness/capacity, at most5 attempts. A conflicting
unpin returns conflict rather than target a replacement generation. Revision
overflow fails before writing.

`CassandraMessagePins` owns this focused workflow, called by the existing
`CassandraMessageRepository.setPinned` path. The old independent slot claimant/
alreadyPinned loop and prepared statements were removed. This is active code,
not a new unused repository or alternate legacy implementation.

The CQL strategy follows Apache Cassandra's documented
[static column conditional batches](https://cassandra.apache.org/doc/stable/cassandra/reference/static.html)
and [conditional batch/DELETE semantics](https://cassandra.apache.org/doc/stable/cassandra/developing/cql/dml.html).
Those semantics do not imply an atomic commit across the separate message row,
outbox, audit, search and realtime systems.

## Boundaries still open

Follow-up: ADR0027 now exposes full state, expected-version intent semantics and
independent client/search ordering. The paragraph below records the boundary at
this earlier slice; durable projection/publication and live gates remain open.

The existing boolean command return/public API has not yet exposed this revision
or a versioned full-pin snapshot. Client command receipts/expected revisions and
ordered realtime/search hydration are next work, not implied by an internal CAS.
In particular, an old retry after an intervening unpin can still express a new
pin intent through the current API. The message is_pinned flag remains a separate
projection; a crash or concurrent update can leave it stale. Durable repair and
publication still need implementation.

The canonical fresh bootstrap adds a static column. No existing database was
migrated, reset or deleted. The startup schema guard will reject the old schema.
Real two-client creation, conditional batch parsing/execution and recovery gates
remain deferred with Docker. See
`tasks/message-pin-capacity-verification-2026-10-23.md`.
