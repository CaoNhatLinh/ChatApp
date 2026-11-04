# Direct-call contact-account eligibility — 2026-10-23

## Result and scope

Call contact now requires both canonical accounts to exist and be ACTIVE, in
addition to the existing exact DM/participant/membership/archive/block gates.
This closes the source-review finding left after C3's controlled history UI.
It does not add a profile/account-status field to call history or pretend that
readable history grants callback eligibility.

This is a controlled backend policy increment. No frontend source, UI assets,
database schema, provider configuration, credentials or existing data changed.
No commit/push was performed. Real Cassandra/broker/two-client/crash/media
acceptance remains open because Docker was deferred by the user.

## Actual bug and correction

Before the fix, `CallLifecycleService.requireActivePeer` checked current direct
membership, active conversation and both block directions, but neither it nor
`ConversationAuthorizationService.requireDirectPeer` read peer account status.
An ACTIVE acting user's authentication could not establish the peer's status.

Red reproduction:10 parameterized cases (caller/callee × SUSPENDED, BANNED,
DELETED, UNKNOWN and blank) all failed because start still allocated a call.
The test used a separate canonical account mock; there was no production account
dependency before the fix, demonstrating the missing gate rather than a storage
error. The subsequent missing/null-status tests fail closed as well.

The service now injects the existing canonical `UserRepository` explicitly and
reads both accounts at the shared contact gate. Missing or any non-ACTIVE status
uses the same generic `ForbiddenException("call participant is unavailable")`;
it does not disclose the participant or account status. The same gate covers:

- start before slot initialization/claim;
- nonterminal acceptance and heartbeat;
- accepted-call SDP/ICE authorization;
- an existing active-call point read and incoming discovery hydration;
- final outbound room/private STATE and SIGNAL delivery.

Repository failure is not converted to missing/inactive: STOMP START preserves
the sanitized UNAVAILABLE result without a new call or broker publication.
Discovery still propagates storage/contention failures rather than returning a
false successful empty result. Inaccessible discovery hints may be filtered by
the existing policy; a full-key active HTTP read returns canonical403.

Explicit END/LEAVE/FAIL, server expiry and authorized historical reads keep their
separate policies. An inactive acting account is still rejected by the existing
HTTP/STOMP authentication boundary. Historical expiry can converge to
MISSED/UNANSWERED even if the former peer account disappeared; this is not a new
contact or an invented media-duration record.

## Changed files and reasons

- `chat-service/src/main/java/com/chatapp/chat_service/canonical/call/CallLifecycleService.java`:
  explicit UserRepository dependency and one private account gate reused by the
  existing contact policy. No old-constructor fallback or copied status cache.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/call/CallContactEligibilityTest.java`:
  22 tests for both roles, invalid/missing/null states, fresh revocation after
  ringing/consent, active reads/heartbeat/signal/outbound denial, incoming
  filtering, explicit cleanup, real history expiry and sanitized storage failure.
- `CallLifecycleServiceTest.java`, `CallActiveQueryTest.java` in that directory:
  canonical ACTIVE account fixtures and the current explicit constructor.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/conversation/ChatReadHttpSecurityTest.java`:
  actual MVC/JWT/security/real lifecycle wiring, current peer fixture and a new
  generic403 test for suspended/banned/missing peers with no authority mutation.
- `tasks/call-lifecycle-contract.md`, `docs/api/openapi.yaml`,
  `docs/api/asyncapi.yaml`, ADR0017: record the contact/history distinction and
  updated account authorization behavior without changing payload schemas.
- This report, todo and testing/traceability records: current evidence and limits.

## Verification executed

With process-local `JAVA_HOME=C:/Program Files/Java/jdk-20`:

1. `./mvnw.cmd -q -Dtest=CallContactEligibilityTest test`: red10/10 before the
   gate; final22 pass after the extended coverage.
2. Focused lifecycle/active-query/MVC security run passed after dependency wiring.
3. `./mvnw.cmd -q test`: **629 tests /107 suites,0 failures,0 errors,0 skipped**,
   exit0. The four directly related classes account for66 tests
   (22 contact,17 lifecycle,12 active query,15 MVC/security).
4. `./scripts/test-local-schema.ps1`: **84 tables /713 columns /2 UDTs pass**.
5. `git diff --check`: pass (existing CRLF-normalization notices are not errors).

Fresh default-suite XML reports have oldest write time2026-10-23T06:46:55 in
this environment. A separate `ChatReadCassandraIT` report from2026-10-20 records
an old Docker-related error; it was **not executed by this default run**, was not
deleted, and is not counted as a newly passing live integration test. Summing
all historical files indiscriminately would give a misleading630/108 result
with that stale error. The newly executed107 reports were checked separately.

Expected fault-injection logs and the Mockito JVM class-sharing notice are not
a claim that the suite ran against a real Cassandra or message broker.

## Review and remaining limits

The implementation stays within the existing call capability and UserRepository
boundary. No compatibility overload, legacy data repair, schema branch, new
dependency, generic policy framework or UI claim was introduced. Existing exact
participant/block checks still precede account reads; storage failures retain
their failure semantics. No raw provider, token or signal data is logged here.

Each successful contact gate adds two canonical point reads; outbound fan-out
rechecks them per delivery. There is deliberately no cross-command status cache
that would prolong eligibility after suspension. Real latency/load is unmeasured.
These are fresh point-in-time checks, not an atomic account/call transaction:
status can change after a read. Already established media is not instantly
terminated by a new database status. The existing browser heartbeat failure path
calls `failSession`; real two-client revocation/cleanup timing remains unverified.

Do not mark the full C1/C2/C3 or feature-expansion roadmap complete from these
tests. Live datastore/broker/media gates and the remaining media/settings/email/
moderation work are still tracked in `tasks/todo.md`.
