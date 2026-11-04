# C2 active-call point lookup — 2026-10-20

Status: backend foundation implemented and locally tested; frontend reload/global
incoming discovery, history and live Cassandra/two-client acceptance remain open.
No Docker installation/probe, schema/volume reset, provider writes, commit or push.

## Change

- `chat-service/src/main/java/com/chatapp/chat_service/canonical/call/CallLifecycleService.java`:
  current-slot point read with membership before even an empty result, active DM
  restriction, exact participant/current peer membership/block checks, bounded
  changed-slot retry and authoritative lazy expiry through existing fenced writes.
  Absence never creates a slot or scans a projection/history table. Missing
  snapshot/invariant failure is not silently converted to "no call".
- `CallQueryController.java` in that package: authenticated actor extraction,
  `GET /api/conversations/{conversationId}/calls/active`, public View/200 or empty
  204, no-store. Capability-owned controller avoids growing the general room controller.
- `docs/api/openapi.yaml`: endpoint/status/cache contract and public snapshot,
  kept aligned with the existing STOMP snapshot. No SDP/ICE/internal heartbeat
  timestamps or started-order key in the public result.
- `CallActiveQueryTest.java`: current ring/accept/absence, current authorization,
  archived/non-DM/missing room, blocks, participant identity, exact deadline expiry,
  missing authority, slot replacement and bounded contention/CAS loss.
- `CallQueryControllerTest.java`: actual MVC binding, canonical advice, JSON/cache
  behavior, forged query actor ignored, 204, errors, invalid UUID and HTTP/STOMP
  required/property names matched to the actual public Java View.
- `ChatReadHttpSecurityTest.java`: actual SecurityConfig/filter, signed JWT,
  active-account lookup, real actor extraction, real lifecycle/authorization with
  mocked repository boundaries. Anonymous/invalid/revoked-account calls get 401;
  member success, blocking/archive/revoked membership are checked over HTTP.
- `tasks/call-lifecycle-contract.md` and `tasks/todo.md`: distinguish this backend
  prerequisite from still-unimplemented browser recovery/global incoming behavior.

## Evidence

Focused authority/MVC/security suites passed during implementation. Initial
test-first compilation failed because `active` did not exist, before implementing
the method.

- `./mvnw.cmd -q '-Dtest=CallActiveQueryTest,CallLifecycleServiceTest' test`: passed.
- `./mvnw.cmd -q '-Dtest=CallActiveQueryTest,CallQueryControllerTest,ChatReadHttpSecurityTest' test`: passed.
- Final `./mvnw.cmd -q test` with JDK 20: exit 0; 511 tests / 96 default suites,
  zero failures/errors/skips. Includes 9 active-authority and 5 query-controller
  tests, plus the expanded real HTTP security suite. Counts use `TEST-*Test.xml`,
  not old opt-in IT reports; no missing-Docker failure was erased or called passed.
- `git -c core.safecrlf=false diff --check`: passed.

No frontend code changed; no new browser screenshots, frontend build or i18n
claims are made for this backend-only slice. Schema is unchanged (83 tables).

The HTTP tests execute Spring MVC, the real authentication filter, JWT verification,
active-user gate, security-context extraction and lifecycle authorization. Storage
boundaries remain mocked/in-memory; they do not prove Cassandra isolation, actual
network HTTP deployment, two real browser sessions or media connectivity.

## Review and remaining work

Review used API/interface, incremental implementation, documentation and five-axis
code-quality guidance. No additional abstraction/dependency or alternate legacy
protocol was introduced. Queries remain point reads with at most four attempts;
there is no unbounded fan-out/list scan and no broad catch converting failures
to an empty result. Permission checks stay server-side and use the signed actor.

Responses are point-in-time, not a lock against a call ending immediately after
the read. An accepted snapshot means consent/signaling only. Browser recovery
must not automatically start camera/mic, invent a replacement ID, or pretend
that the old peer connection survived refresh. Those UX/state decisions and
global incoming discovery are the next C2 work. C3 history is still unimplemented.
Live datastore/crash/provider gates remain deferred by the user's Docker decision.
