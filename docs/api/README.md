# Canonical API contracts

`openapi.yaml` is the authoritative HTTP contract and `asyncapi.yaml` is the
authoritative STOMP/event contract. The compact route list in
`../contracts/canonical-api.yaml` is the canonical human-readable manifest; it
must not introduce a second endpoint or status vocabulary.

## Ownership rules

- Spring controllers validate input, authenticate the caller, and enforce
  server-side app/room permissions before touching a repository.
- Cassandra owns durable user, room, message, moderation, audit, outbox and
  session/device state. Redis, Kafka and Elasticsearch are projections or
  delivery infrastructure, never authorization authorities.
- Every bounded list accepts a limit capped by the backend. Cassandra queries
  must begin from a known partition or access-pattern key; no API may depend on
  a full-table scan or `ALLOW FILTERING`.
- Dangerous admin mutations require a reason and emit an immutable audit/outbox
  event. The global admin surface uses app permissions; room-local roles cannot
  grant `/api/admin/**` access.
- Refresh token hashes are never returned by session inventory endpoints.
  `SESSION_REVOKE` is required for operator session/device invalidation.

## Verification

The current manifest contains 92 HTTP paths and 20 unique STOMP destinations
(all represented as named AsyncAPI channels). Contract
tests check that canonical route fragments exist and that protected auth paths
are not accidentally covered by the public wildcard. Live Cassandra/Kafka/
Redis/Elasticsearch integration remains an environment-dependent gate and must
be reported as blocked when those services are unavailable.
