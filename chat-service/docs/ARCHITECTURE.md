# Nối Backend Architecture

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

The outbox publisher reads `outbox_pending_events_by_partition` through a small
`OutboxRepository`, so published rows cannot starve newer events behind a
`LIMIT`. Kafka sends each bounded poll batch concurrently. Results are still
applied per event, and acknowledgement is required before removal from the
pending index.

## Canonical write flow

`REST/STOMP command -> validation -> app/room authorization -> policy and
rate-limit checks -> Cassandra authoritative write + projections + audit/outbox
-> response -> Kafka consumers/realtime/search/notification projections`.

Every query is bounded by its declared partition key and cursor. No Cassandra
scan, `ALLOW FILTERING`, offset pagination, in-memory fake store or legacy API
alias is part of the runtime.

## Module boundaries

The runtime remains a modular monolith. `auth`, `user`, `device`, `appearance`,
`notification`, `community`, `invite`, `message` and `poll` own their
controllers, validation and application orchestration. `ConversationService`
owns only conversation lifecycle, membership and room policy. `MessageService`
owns message commands, history, interactions, read state and message-triggered
notifications. Shared membership repair is exposed through
`ConversationMembershipService` instead of duplicating projection writes.

Application orchestration must not depend directly on Spring WebSocket or Kafka
clients. It publishes through application-owned ports. STOMP adapters own
realtime destination assembly, while the Kafka adapter owns producer records,
batch dispatch and acknowledgement. Cassandra outbox polling owns only bounded
pending-event lifecycle.
See ADR 0011.

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
