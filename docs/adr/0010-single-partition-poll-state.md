# ADR-0010: Store poll votes and aggregate state in one Cassandra partition

## Status

Accepted

## Date

2026-08-30

## Context

The previous model wrote a conditional voter row and separate counter rows.
A process failure between those writes could leave counts inconsistent, while
poll reads scanned every voter and exposed voter identifiers. Poll messages also
could not restore their poll state from a message-page response.

Required properties are exact vote changes under concurrency, bounded page
hydration, viewer-specific vote state, compact realtime fan-out, and no voter
identity disclosure.

## Decision

Use `poll_state_by_poll`, partitioned by `poll_id` and clustered by `voter_id`.
Aggregate counts, total voters, closed state and an aggregate version are static columns.
Create, change and remove operations compare the aggregate version and voter row
inside one conditional batch and require `is_closed = false`. Closing first seals
this partition, so a concurrent vote cannot commit after closure. A failed
condition retries from current state.

Message pages batch-read metadata, static aggregates and the authenticated
member's voter rows only for poll IDs in that page. HTTP responses include that
member's selected indexes. STOMP publishes a separate aggregate contract without
selected indexes.

The client keeps one `clientMessageId` for the lifetime of a create-poll draft.
The server derives `poll_id` deterministically from the actor and that ID, then
returns an existing matching poll before any initialization write. Retrying a
lost response therefore cannot duplicate the poll message or reset votes.

## Alternatives considered

### Separate Cassandra counters

Fast to increment, but counters cannot be atomically committed with the
conditional voter row and are not idempotent. Rejected because retries can drift.

### Recount every voter on each read

Exact and simple, but read cost and response latency grow linearly with poll
participation. Rejected for active communities.

### Redis as aggregate authority

Atomic scripts are possible, but this would introduce a second durable authority
and cross-store recovery protocol for a feature already owned by Cassandra.
Rejected for operational complexity.

## Consequences

- A poll mutation uses Paxos and is intentionally more expensive than an ordinary
  write, but its state transition is linearizable within one partition.
- Reads are bounded by poll IDs in the current message page and do not scan voters.
- Very large, extremely hot polls can create a single-partition write hotspot.
  Reconsider sharded event aggregation if measured Paxos contention or partition
  size breaches the production capacity target.
- Voter identity disclosure is not part of the product or API contract.
