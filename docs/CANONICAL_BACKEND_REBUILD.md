# Canonical backend rebuild contract

## Objective

Replace every legacy Spring Data Cassandra entity, repository, query and API
path with the `chat_app_complete.cql` contract. The backend is authoritative
for authorization, limits, audit/outbox writes and realtime publication.

## Stack and commands

- Java 20, Spring Boot 3.5, DataStax Cassandra driver/Spring Data Cassandra,
  Redis, Kafka and Elasticsearch.
- Backend source: `chat-service/src/main/java`.
- Tests: `chat-service/src/test/java`.
- Verify: `cd chat-service; .\mvnw.cmd test`.

## Contract rules

1. REST payloads use camelCase. Errors use the existing `ApiResponse`/error
   envelope consistently and carry a machine-readable code.
2. Every write uses a typed command service. Controllers never issue CQL.
3. Every Cassandra table is accessed only through a repository method whose
   partition key is completely supplied. No `ALLOW FILTERING`, offsets or
   unbounded scans.
4. `messageBucket` is mandatory for every direct message lookup. The bucket is
   calculated by one shared policy service from timestamp and stable shard.
5. Every mutation writes its authoritative row, all required projections, a
   room/audit event and an outbox record. Retried message and invitation
   commands are idempotent.
6. App RBAC and custom conversation RBAC are separate. Conversation permission
   is the union of bounded `roleIds`; owner/system-role protections are service
   invariants.
7. External input is validated at REST and WebSocket boundaries; authorization,
   bans, mutes, slow mode and chat mode are evaluated before message writes.

## Delivery slices

1. Bootstrap: canonical keyspace loading, remove legacy entity scanning,
   typed shared identifiers/enums/CQL bucket policy, and a compiling baseline.
2. Identity and app RBAC: canonical user, login/idempotency token repositories,
   blocks, preferences and device notification preferences.
3. Conversation: room creation, membership, custom role CRUD/transfer/kick,
   room list ordering and max-three pin slots.
4. Messaging: bucketed send/edit/delete/reply/attachments/mentions/reactions,
   reads, max-five pins, room/audit/outbox events and typing/presence.
5. Poll, moderation, reports, sanctions, invite/QR approval, notifications and
   call metadata.
6. Search projection and admin/dashboard query APIs, then integration and
   two-user end-to-end tests.

## Success criteria

- No Java `@Table` or CQL query refers to a legacy table.
- Backend compiles and tests against the canonical Docker stack.
- Core write flows are retry-safe, authorized and observable through audit and
  outbox tables.
- Contract tests cover pin limits, room role permission union, slow mode,
  message idempotency, invite states and notification precedence.

## Boundaries

- Always: prepared/typed Cassandra operations, boundary validation, cursor
  pagination, audit/outbox and tests for each command.
- Ask first: a new external provider, a retention-policy change or a new
  dependency.
- Never: legacy table access, `ALLOW FILTERING`, raw password/token logging or
  exposing one user's private chat appearance to another.
