# ADR 0011: Clear auth and messaging boundaries

## Status

Accepted

## Date

2026-09-05

## Context

The canonical backend is a modular monolith, but `CanonicalBackendService` had
accumulated authentication, user, conversation and messaging responsibilities.
It also depended directly on `SimpMessagingTemplate`. The Cassandra outbox
poller similarly owned both pending-event lifecycle and Kafka record delivery.

Those dependencies made application behavior harder to test without framework
infrastructure and allowed transport details to leak into command orchestration.
The public HTTP, STOMP and event contracts must remain unchanged.

## Decision

- Authentication, users, devices, appearance, notifications, community
  discovery/join and polls live in focused feature packages. Their controllers
  call those application services directly.
- Invites and join requests use focused services built on the shared
  conversation-membership capability. Message commands, history, interactions,
  read state and notification fan-out are owned by `MessageService`; neither
  its controller nor poll orchestration depends on `ConversationService`.
- Application services publish realtime events through
  `RealtimePublisher`; the STOMP adapter alone owns destination assembly.
- The Cassandra outbox poller publishes a transport-neutral `DomainEvent`
  through `DomainEventPublisher`; the Kafka adapter alone
  owns producer records, headers, acknowledgement and timeout behavior.
- Pending outbox rows are exposed through `OutboxRepository`; the scheduler no
  longer imports the all-purpose Cassandra store.
- Kafka sends a bounded scheduler batch concurrently, then returns one result
  per event. The scheduler records success or retry independently for every
  event, retaining ack-before-delete semantics.
- Cassandra remains authoritative. An outbox row is marked published only after
  the configured transport acknowledges the event.
- Existing REST paths, response records, STOMP destinations and Kafka record
  contents remain canonical and unchanged.

## Alternatives considered

### Keep framework clients in the central service

Rejected because it preserves the god-service dependency graph and makes
business tests depend on Spring messaging details.

### Add a new facade while retaining the old methods

Rejected because pass-through wrappers would relocate complexity without
removing responsibilities from `CanonicalBackendService`.

### Split the backend into microservices

Rejected because independent deployment and ownership are not current product
requirements. The operational cost would be larger than the coupling it solves.

## Consequences

- Extracted feature services and transport adapters can be tested independently.
- The conversation service has no message, notification fan-out, password, JWT
  or Spring WebSocket responsibility.
- Additional vertical slices can migrate incrementally without changing the
  external API.
- A slow Kafka acknowledgement blocks only completion of the current bounded
  poll batch; it no longer serializes every send in that batch.
