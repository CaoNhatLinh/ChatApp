# NovaChat Backend Architecture

## Canonical runtime

- **Spring Boot / Java 20** owns authentication, validation, authorization,
  command orchestration, REST and authenticated STOMP/WebRTC signalling.
- **Cassandra 4.1** is the authoritative query-designed store for identity,
  rooms, membership/RBAC, messages, media metadata, notifications,
  moderation, audit and outbox records.
- **Redis** owns ephemeral presence/typing state, bounded cache and distributed
  rate-limit state. It is never the source of durable product history.
- **Kafka** transports Cassandra outbox events to durable consumers and DLQ;
  it is not the source of truth for synchronous commands.
- **Elasticsearch** is the authorized, rebuildable room/message search
  projection. Search requests enforce membership/visibility before returning
  projection data.
- **Cloudinary** is the configured binary provider; Cassandra stores immutable
  attachment snapshots and lifecycle metadata.

The outbox publisher reads `outbox_pending_events_by_partition`, a pending-only
Cassandra projection, so published rows cannot starve newer events behind a
`LIMIT`. The immutable outbox row and pending-index lifecycle are updated in
logged batches; Kafka acknowledgement is still required before removal from
the pending index.

## Canonical write flow

`REST/STOMP command -> validation -> app/room authorization -> policy and
rate-limit checks -> Cassandra authoritative write + projections + audit/outbox
-> response -> Kafka consumers/realtime/search/notification projections`.

Every query is bounded by its declared partition key and cursor. No Cassandra
scan, `ALLOW FILTERING`, offset pagination, in-memory fake store or legacy API
alias is part of the runtime.

## Realtime and calls

Authenticated STOMP destinations publish messages, reactions, read state, pins,
notifications, presence and typing updates. Presence/typing state is TTL based
and resynchronizes from the canonical snapshot after reconnect.

Calls are explicitly **1–1 DM calls**. `CallController` verifies both peers,
the DM membership and call permission before accepting start/join/leave/signal/
end commands. The frontend owns native SDP/ICE media; the backend persists
short-lived call metadata and targeted signalling events only. Group/SFU calls
are not exposed until a separately approved media-provider contract exists.

## Security and operations

JWT access tokens are short-lived; refresh tokens are rotated and stored only as
hashes. App-level permissions are separate from conversation-local roles.
Mutation endpoints require explicit reason where policy demands it and append
immutable audit/outbox records. Health/readiness and metrics are exposed only
through the protected actuator policy.
