# Chat read acceptance: HTTP security and live Cassandra

## Why two gates

Unit/browser fixtures do not prove CQL validity, UUID clustering order or
concurrent read-pointer behavior. Conversely, a repository container test does
not prove HTTP actor extraction. These tests keep those responsibilities separate.

`ChatReadHttpSecurityTest` runs actual MVC mappings, production SecurityConfig,
JwtAuthenticationFilter, signed/validated JWTs, SecurityContextHelper, JSON mapper,
SharedContentService and membership authorization. Missing/invalid authentication
must return401 (allowing the existing client refresh flow); authenticated membership
denial remains403. Repository/account-role
boundaries are mocked. It covers anonymous/invalid-token/revoked-account denial,
caller binding, current membership, source blocking/missing state, no-store
response headers and client-input errors. It is included in ordinary `mvnw test`.
It is not a full running Boot server, real session refresh or a database test.

## Run the live CQL gate

On2026-10-20 the user deferred Docker installation. Do not count this gate as
passed or install/start an engine on their behalf. Continue controlled tests;
resume this gate only when an engine is available. The opt-in suite also includes
reply source-bucket round-trip and repeated reply-index repair (six scenarios).

Prerequisites: JDK20, working Docker engine accessible to Testcontainers,
permission/network to pull the same `cassandra:4.1` image family as local Compose.
The existing Maven Testcontainers dependencies are reused; no provider credentials
or API keys are needed.

From `chat-service` in PowerShell:

```powershell
./mvnw.cmd -Pchat-cassandra-it test
```

For only this integration class:

```powershell
./mvnw.cmd -Pchat-cassandra-it '-Dtest=ChatReadCassandraIT' test
```

The profile copies the existing root `chat_app_complete.cql` as a test resource
without modification. Testcontainers initializes an isolated Cassandra instance
from that exact canonical schema and assigns a random host port. The test does
not connect to the app's database, run migrations against it, expose a public
tunnel, or contact file-provider URLs. Container lifecycle cleanup removes only
the ephemeral test database and its fixtures.

The class checks:

- actual prepared statements/schema and traversal through all16 message shards
  in an hour and a previous hour, without duplicate/missing link items;
- >25 attachment references, real UUID cursor ordering, image/file filtering,
  canonical media-asset lookup and membership loss on continuation;
- directory continuation across14 persisted rooms with identical activity times,
  ascending IDs, pinned/unpinned boundaries and an older activity timestamp;
- typed GIPHY identity through actual message-table columns, repository hydration
  and conversation-authorized source lookup (no provider request);
- two independent driver sessions advancing the same membership read pointer,
  monotonic final state, and conditional projection clearing that preserves newer
  content when an older acknowledgment arrives.

The integration class is excluded from the ordinary unit-test naming pattern
and explicitly included by `chat-cassandra-it`. Missing Docker is a failing gate,
not a disabled/skipped test counted as success. Initialization/all five scenarios
must actually pass before this live CQL gate can be checked off. This gate still
does not test two full browser clients, provider lifecycle, crashes or every
delivery/projection interleaving.

## Evidence on 2026-10-20

The user explicitly deferred installing Docker ("tôi sẽ cài sau"). Keep this live
gate open until then; do not install Docker, repeatedly ask for it, or report the
container scenarios as passing. Other local implementation and checks may continue.

The class compiles. The profile copied the schema with identical SHA-256 hashes.
An actual invocation failed before container startup because Testcontainers1.21.2
could not find a Docker environment; zero skips. Therefore no live CQL scenario
passed or is claimed. Local port inspection also found no listeners on9042,
6379 or8084; the pre-existing frontend3116 was left untouched.

Retain the integration failure report separately from normal unit results:
`chat-service/target/surefire-reports/TEST-com.chatapp.chat_service.canonical.conversation.ChatReadCassandraIT.xml`.
An old failed IT report may coexist with a later successful default unit run.
Do not aggregate all XML files into one passing unit count or discard the failed
gate to make the report green.

## Direct-call authority gate added with C1

The same opt-in profile also includes `CallLifecycleCassandraIT` (three scenarios),
using a separate disposable Cassandra 4.1 instance and two driver sessions.
It checks real conditional start contention, slot release and stale mutation
fencing, exact-deadline revision tuple continuation and expected-slot expiry
metadata. Run only when Docker is available:

```powershell
./mvnw.cmd -Pchat-cassandra-it '-Dtest=CallLifecycleCassandraIT' test
```

This class compiles but has not run. It is not evidence of two-browser signaling,
process-kill recovery, a deployed timeout worker or provider/media connectivity.
The user deferred Docker; do not retry engine discovery as a substitute for
implementation progress. See `tasks/call-authority-verification-2026-10-20.md`.

Reference: the [official Testcontainers Cassandra module](https://java.testcontainers.org/modules/databases/cassandra/)
documents init scripts, mapped contact points and local datacenter setup. The
implementation was also checked against the installed1.21.2 module API.

The authentication entry point is explicitly wired in `SecurityConfig`. It already
existed but was unused, leaving Spring's default403 response for unauthenticated
requests. That response prevented the production frontend's401-only refresh
interceptor from running. This is a response-semantics fix, not relaxed access.
See [Spring Security's exception translation architecture](https://www.springframework.org/spring-security/reference/servlet/architecture.html).
