# C2 signaling command foundation — 2026-10-20

Follow-up: the adapter/client are now connected; see
`call-transport-verification-2026-10-20.md`. The scope below records the earlier
foundation step, not the current transport integration status.

## Scope and result

Advanced the approved C2 dependency after the previous C1 authority implementation.
The internal command boundary is implemented and tested. **It is not yet connected
to `CallController`, the private STOMP result queue or the frontend call hook.**
Shipping signaling still follows its incumbent controller until both sides can
switch coherently; no compatibility/fallback handler was added. The automatic
expiry worker, durable event recovery, reconnect UX and C3 history remain open.
This is concrete dependency progress, not a completed call feature or full goal.

No database/runtime/provider/credential was changed, no tunnel was opened and no
commit/push was created. Docker remains deferred; live gates are not retried here.

## Changes and reasons

Backend paths relative to `chat-service/`:

- `canonical/call/CallState.java`: initial version 1 and increment alongside each
  actual CAS transition; duplicate/terminal replay keeps the same version.
- `canonical/call/CallLifecycleService.java`: authorize a signal against the
  current exact peer, active room, both authoritative block directions and
  accepted state. Expired/nonaccepted calls cannot signal through this path.
- `canonical/call/CallSignalingService.java`: typed commands, sanitized correlated
  results, state view, real lifecycle dispatch, post-authority fan-out and bounded
  ephemeral SDP/ICE relay. Caller/offer and callee/answer roles are enforced;
  undeclared payload fields are removed. No SDP/ICE storage or logging.
- `canonical/call/CallSignalingServiceTest.java`: protocol/relay/error/replay tests.
- `canonical/call/CallLifecycleServiceTest.java`: signal authorization/revocation
  and combined real-lifecycle recovery after a committed start loses its broadcast.
- `canonical/call/CallStateTest.java`: version/replay assertions.
- `tasks/call-lifecycle-contract.md`, checklist, this report and testing/architecture
  docs: distinguish implemented internals from unconnected runtime features.

No schema addition, dependency or frontend change is part of this step. Other
pre-existing dirty changes are preserved and are not attributed to this slice.

## Invariants verified

Authoritative start precedes fan-out; failure after commit is UNAVAILABLE, not a
fabricated rollback. Retrying the same start with the real lifecycle service and
atomic test model returns the same revision/version and performs only one claim.
Terminal replay emits END. SYNC reads authority rather than repeating a mutation.
Errors echo request scope without exposing exception text or private payloads.
Wrong targets and rejected signal authorization never broadcast. Sanitization
keeps only declared bounded SDP/ICE fields.

The concurrent/atomic model is still in memory. Unit checks do not prove broker
delivery, CQL parsing/isolation, provider/media connection, crash recovery or two
browser clients. ACCEPTED is consent/signaling, not verified media or call duration.

## Verification

JDK 20 selected explicitly. Verification results:

| Command | Result |
| --- | --- |
| Focused state/lifecycle/repository/signaling tests | Passed; 42 call tests across four classes |
| `./mvnw.cmd -q test` | Exit 0; 471 tests / 91 suites; zero failures, errors or skips; opt-in IT reports excluded |
| Focused `CallSignalingServiceTest` after strengthening exact error-code assertions | 11 tests passed |
| `./scripts/test-local-schema.ps1` | 82 tables / 706 columns / two UDTs; guards passed |
| `git -c core.safecrlf=false diff --check` | Clean |

Local review checked authority-before-fan-out, target/role/access boundaries,
bounded sanitized relay fields, monotonic replay semantics and non-disclosure of
raw exceptions. Existing C1 replay/revocation/expiry/CQL-binding regressions pass.
There is no new UI screenshot/build claim for this backend-only step.

An initial protocol test failed because Mockito `when(...).thenThrow(...)`
re-stubbing invoked its previous throwing stub. It was corrected to `doThrow`;
this was a test harness issue, not silently reported as a passing first run.

## Required next integration

Wire authenticated STOMP controller actions and session-private correlated results
with allowlisted destinations; then connect a typed client channel with timeout,
same-call uncertain recovery, stale/version guards, heartbeats and reconnect sync.
Switch both sides together, remove the incumbent unvalidated relay path, and test
actual controller dispatch and production browser behavior. Add durable worker/
event reconciliation before marking C2 complete. Docker/Cassandra and real media
remain separate live gates; do not mark them complete from these fixtures.
