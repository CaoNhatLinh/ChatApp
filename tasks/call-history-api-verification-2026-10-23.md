# Authorized call-history API — 2026-10-23

Status: own/room month pages and exact detail implemented and controlled-tested.
The member history/detail UI and live datastore/broker/two-client/media gates
remain open. The C3 parent and full goal are not complete.

Contract: `call-history-contract.md`; producer prerequisite:
`call-history-producer-verification-2026-10-23.md`; decision: ADR0020.
No provider, credentials/environment file, dependency, database/schema/volume,
Docker, server, commit or push change was made in this API increment.

## Connected reads and policy

- `GET /api/calls/history?month&cursor&limit` derives actor only from security.
- `GET /api/conversations/{conversationId}/calls/history?month&cursor&limit`.
- `GET /api/conversations/{conversationId}/calls/{callId}/history`.

Successful responses are explicitly JSON and no-store, including requests
without an Accept header. Canonical errors remain400/401/403/404/409/500 as
appropriate, not successful empty fallbacks.

Require current actor membership, existing DM and exact authority caller/callee.
No global-admin bypass or peer's current membership requirement. Archives and
blocks do not erase an authorized member's own historical facts, but readable
history grants no new-contact, profile/presence or callback eligibility. A removed
actor cannot continue reading through the personal index. Missing/non-DM/denied
list hints are filtered; exact detail returns the appropriate canonical error.

Each page scans at most1..50 raw keys (default25) in one explicit UTC month,
1970 through the current UTC month. Hydration verifies exact room/call/start
tuple and creation month. Failed-claim/missing/stale keys can produce empty
content with a continuation. Continuation uses the last scanned complete tuple,
including same-millisecond and reused-call-ID ties, not the last visible entry.
Cursor is version/actor/month/own-or-room scoped, max1024, validates canonical
nonreserved UUIDs and original start-order timeuuid before index access. It is
not authorization, a frozen snapshot or raw driver paging state.

Terminal history remains readable after a later call replaces the active slot.
For overdue nonterminal state, delegate to the existing fenced expiry and bounded
reread; slot replacement races reread rather than expiring another call. Missing
slot/invariant failure and sustained contention are errors. Never manufacture
MISSED from a client clock, stale index status or a display-only timeout.

## Public facts, not invented media

`CallHistoryView` exposes room/call/caller/callee/type, direction, actor-relative
outcome, creation/consent/end timestamps, version and exactly two participants.
Authority MISSED becomes MISSED for the recipient and UNANSWERED for the caller;
CANCELLED, DECLINED and FAILED stay distinct. Accepted lease timeout is FAILED,
not MISSED. Each participant has only ID, role and caller initiation/callee
consent facts. No heartbeat, last-seen, SDP/ICE, provider, profile, fake joined/
left attendance or measured media duration is serialized. ACCEPTED is consent,
not proof of media connectivity.

## Files and reasons

Production files under `chat-service/src/main/java/com/chatapp/chat_service/canonical/call/`:

- `CallHistoryService.java`: current actor/DM/participant policy; bounded
  actor/room/month query, exact authority hydration, expiry and local error rules.
- `CallHistoryCursor.java`: feature-owned full-tuple/scoped codec; no generic
  cursor framework, compatibility parser or authorization-by-token.
- `CallHistoryView.java`: explicit allowlisted actor-relative DTO and immutable
  two-role/consent list, separate from raw authority or media state.
- `CallHistoryController.java`: three authenticated read mappings, actor from
  security context, typed query/path binding and JSON/no-store responses.

New tests under `chat-service/src/test/java/com/chatapp/chat_service/canonical/call/`:

- `CallHistoryServiceTest.java`:21 tests covering current access, removed peer/
  actor, archived DM, exact participant, real membership helper, raw-key paging,
  stale start keys, cross-room reused IDs, scoped/malformed cursor/month/limit,
  exact-deadline expiry, replacement race, contention, missing slot/storage and
  clock failure. Storage and lifecycle expiry ports are controlled.
- `CallHistoryControllerTest.java`:7 actual MVC/Jackson/advice/OpenAPI tests;
  shape/field allowlist, binding, default/explicit paging, no-store, JSON, actor
  identity and sanitized errors. Service is controlled.
- `CallHistoryHttpSecurityTest.java`:4 tests through the production security
  configuration/filter chain, real signed generated test JWT and actor helper.
  All routes reject anonymous/bad signatures; missing/suspended account fails;
  forged user parameters cannot choose an actor. Service/user storage controlled.
- `CallHistoryViewTest.java`:3 pure outcome/consent/nonparticipant checks; no
  media-attendance claim. Existing producer/repository tests remain in the suite.

Other changes: OpenAPI and canonical HTTP manifest, ADR0020, architecture,
testing/traceability, task contract and checklist. No frontend production change,
so no new browser/screenshot or frontend build result is claimed by this slice.

## Verification and fixes

JDK20 via process-scoped JAVA_HOME; machine configuration unchanged.

1. Test-first service/controller commands initially failed compilation while the
   respective production classes were absent; implementations followed.
2. First combined controller/service run exposed a Mockito restubbing error:
   `when` invoked a method already configured to throw. `doThrow` now replaces
   that fixture behavior correctly; assertions and production errors were not
   weakened. Service tests had passed.
3. Focused service/controller/security command passed31 tests after scoped tuple,
   access and OpenAPI parity coverage was added:
   `./mvnw.cmd -q '-Dtest=CallHistoryServiceTest,CallHistoryControllerTest,CallHistoryHttpSecurityTest' test`.
   Additional DTO and clock-regression checks followed, so this historical31 is
   not presented as the final current focused-class count.
4. Self-review identified the month validator's broad catch could convert an
   internal Clock failure into400. A new21st service test reproduced that failure
   before the fix. Validation is now straight-line; infrastructure failure
   propagates to canonical500 rather than blaming the client month.
5. Final `./mvnw.cmd -q test`: exit0. All current `TEST-*Test.xml` reports:
   **606 tests / 106 suites, zero failures/errors/skips**; oldest write
   2026-10-23T06:05:48, from this full run. The four new API/view classes account
   for35 passing tests. Historical opt-in IT reports are neither counted as
   passing default tests nor deleted to hide the missing live gate.
6. `./scripts/test-local-schema.ps1`: exit0,84 tables/713 columns,2 UDTs/20 fields.
   No schema changed this increment; this is a static parser/mismatch guard,
   not Cassandra execution.
7. `git -c core.safecrlf=false diff --check`: pass.

## Review and remaining gates

Main-agent five-axis review checked tests before source, DTO shape/enum parity,
exact scope and key identity, canonical error propagation, no profile/heartbeat
leaks, read/expiry ownership and finite raw-row/retry bounds. The clock finding
was fixed and guarded. No remaining concrete blocking finding was identified
within this controlled API slice. This is not an independent/live review.

- Implement frontend adapters and member history/detail UI: deliberate month/
  page/refresh controls, states, VI/EN, app-theme/mobile, focus and actual API IO.
- Live Cassandra CQL/tuple/conditional-batch/expiry races, two clients and crash/
  restart/broker/media acceptance remain unverified. Docker remains deferred by
  the user; no repeated probe or installation request.
- Membership and call state are separately read authorities, not a linearizable
  permission snapshot. Live revocation/concurrency acceptance remains open.
- Key hydration and retry bounds limit requested rows, not storage tombstone
  scans or latency. Monthly load, orphan-hint growth, retention and the existing
  unbounded conversation authority partition need measurements/separate policy.
- History does not certify peer-account eligibility for a new call; verify/harden
  that contact policy separately before deriving any callback affordance.
- Fresh-schema producer assumptions, no old-volume backfill, and the remaining
  media/settings/email/moderation roadmap remain unchanged. Push is deferred.

Design sources, not runtime proof:
[Spring6.2 JSON request mapping](https://docs.spring.io/spring-framework/reference/6.2/web/webmvc/mvc-controller/ann-requestmapping.html#producible-media-types),
[Spring Security6.5 MockMvc setup](https://docs.spring.io/spring-security/reference/6.5/servlet/test/mockmvc/setup.html),
[Cassandra4.1 tuple restrictions](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html).
