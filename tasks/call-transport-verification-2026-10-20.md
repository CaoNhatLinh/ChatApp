# C2 connected call control — 2026-10-20

## Scope

Replaced the incumbent stateless STOMP relay with the canonical durable command
boundary and connected it to the existing WebRTC hook. This is personal DM call
control in the active conversation, not a group/SFU calling feature. No new visual
world, dependency, schema, credential, provider write, public tunnel, commit or
push is part of this slice. Existing dirty changes are preserved.

The previous goal turn implemented/tested the internal command boundary. This
turn changes actual controller/client behavior, with separate Spring routing and
production-browser controlled evidence. C2 is still incomplete: unattended expiry,
durable event recovery, incoming calls outside the active room and reload-time
discovery are not solved by this connected transport. C3 history remains open.
Docker is deferred; no Cassandra/media/provider live acceptance is claimed.

## Behavior

- All eight named call actions bind the authenticated STOMP principal. No actor
  comes from payload. The old arbitrary DTO/relay path and unused messenger call
  types were removed; there is no parallel compatibility contract.
- Each command has a fresh requestId and receives a session-private result at
  `/user/queue/call-results`. Spring `broadcast=false` targets the originating
  session, not every session of that user. The interceptor permits only the exact
  command/result destinations and active authenticated users.
- Client correlation is bounded (64 requests), timed (10 seconds), scope-checked
  and disposable. Malformed, cross-room/peer/action/type, stale request IDs and
  contradictory result shapes do not become media authority. No automatic queue
  or durable browser retry state is implied.
- An uncertain outgoing retry keeps call identity/type/peer. Each local media
  attempt has a separate token, so old async failures cannot close its new peer.
  Explicit close clears the held attempt and sends a best-effort terminal command.
- Typed authority versions suppress stale state; duplicate acceptance/reconnect
  does not create another offer for the same local peer. Closed IDs are bounded
  tombstones, preventing a late ringing replay from reopening the panel.
- Same-account state events can close ringing on another device; own SDP/ICE is
  not fed back into the peer. Exact peer/room/type and state/event shape are checked.
- Incoming unanswered calls sync; active local attempts heartbeat/reconcile every
  ten seconds. Reconnect schedules reconciliation after subscription restoration.
  No new START is invented by a reconnect. Denials stop local media with inline
  copy, not a toast.
- Heartbeat repeats active-room and both-direction block checks, so it cannot
  renew a newly blocked/archived call. This is cooperative-client revalidation,
  not an instantaneous server-enforced interruption of an already established P2P
  media path. Denied/missing acknowledgments stop the local path; live revocation
  timing remains unverified.
- An uncertain ICE/SDP acknowledgment revalidates authority instead of immediately
  killing a working media path. Negotiation has a 30-second local deadline after
  server acceptance, not while ringing; a connected peer clears that timer.
  Negotiation/device failures are reported as FAIL, not left to become a false
  missed call. Closing before pending getUserMedia resolves stops returned tracks
  without publishing a delayed START. The main message draft is unchanged.
- Accept locks immediately while device permission is pending; mic/camera
  controls are disabled until a local stream exists. Repeated clicks cannot
  allocate competing streams/peers. End remains available during that wait.

ACCEPTED still means consent/signaling only. Only the browser's actual peer
connection state drives its local connected label; server history must not infer
media duration or connection from that signaling state.

## Changed files and reasons

Paths relative to the repository root:

| Files | Reason |
| --- | --- |
| `chat-service/.../realtime/CallController.java` | Canonical authenticated dispatch and private results, replacing the arbitrary fan-out path |
| `chat-service/.../realtime/StompAuthenticationInterceptor.java` | Exact call/result destination allowlist |
| `chat-service/.../canonical/call/CallLifecycleService.java`, matching service test | Heartbeat rechecks current archive/block authority rather than extending revoked access |
| `chat-service/src/test/.../realtime/CallControllerTest.java` | Actual Spring mapping/JSON conversion/private-session result headers and AsyncAPI/source parity |
| `chat-service/src/test/.../realtime/StompAuthenticationInterceptorTest.java` | Call destination authentication/suspension and raw/foreign queue rejection |
| `chatapp_frontend/src/features/calls/model/call-command-channel.ts` | Typed views, boundary parsing, bounded correlation, timeout and cleanup |
| `chatapp_frontend/src/features/calls/hooks/useWebRtcCall.ts` | Acknowledged control/signals, authority versions, local attempt isolation, negotiation/heartbeat/reconnect and cleanup |
| `chatapp_frontend/src/features/calls/types.ts`, `src/features/messenger/types/messenger.types.ts` | Feature-owned canonical event/session types; removed unused old DTOs |
| `chatapp_frontend/src/shared/i18n/resources.ts` | Natural VI/EN inline rejection/uncertainty/retry copy |
| `chatapp_frontend/src/widgets/chat-window/components/CallSessionPanel.tsx` | VI/EN labels distinguish connecting from in-call; remove mixed-language/jargon copy without changing layout |
| `chatapp_frontend/scripts/call-command-channel-smoke.mjs`, `scripts/call-browser-smoke.mjs`, `package.json` | Runnable protocol and production-browser acceptance |
| `docs/api/asyncapi.yaml`, call contract/checklist/architecture/testing/traceability docs and this report | Current wire contract, evidence and honest outstanding gates |

The `...` backend paths mean `src/main/java/com/chatapp/chat_service` or the
matching `src/test/java/com/chatapp/chat_service` under `chat-service/`.

## Verification and failures that changed the implementation

JDK20 and production Next on port3117. No existing user server was stopped.

- New channel test first failed because its production module did not exist,
  then passed after implementation. The final channel suite has20 groups.
- Actual Spring routing initially failed because the test message omitted session
  attributes; those were added to model a real STOMP frame. It then verified all
  eight mappings, actual JSON conversion and originating-session headers.
- Reconnect browser acceptance failed on a missing result subscription: heartbeat
  raced restoration. Scheduling reconciliation after that synchronous restoration
  fixed it; the same production-browser sequence passed.
- The recipient media-permission test failed because no FAIL command was sent.
  Device acquisition failure now reports failure explicitly rather than waiting
  for ringing expiry. The final run below verifies the correction.
- A new lifecycle test failed because a blocked heartbeat did not throw. Heartbeat
  now repeats the active-peer guard, including archived rooms and both block
  directions. The full backend suite below includes that regression.
- A browser regression failed because Accept stayed actionable during held device
  permission (`1 !== 0`). The local session now enters connecting synchronously
  before media acquisition, preserving cancellation and preventing duplicate accepts.

| Command | Final result |
| --- | --- |
| `./mvnw.cmd -q test` (JDK20) | Exit0; 476 tests / 92 suites, zero failures/errors/skips; opt-in IT reports excluded |
| `npm run validate` | TypeScript + ESLint exit0 |
| `npm run build` | Exit0; all17 routes generated from final production source |
| `npm run test:calls:channel` | 20 controlled correlation/boundary/timeout/cleanup groups |
| `npm run test:e2e:calls` | 20 production-browser groups, eight width/theme cells and two custom captures |
| `npm run test:e2e:threads` | 19 groups and eight width/theme cells |
| `npm run test:e2e:chat-ux` | 39 groups, eight width/theme cells; sampled body contrast17.19 light /17.56 dark |
| `npm run test:i18n:copy` | 1209 checked keys; missing=[] |
| `./scripts/test-local-schema.ps1` | 82 tables / 706 columns / two UDTs; guards passed |
| `git -c core.safecrlf=false diff --check` | Clean |

No failed run is counted as passing. One earlier regression sequence was interrupted
when the owned production server was rebuilt; the final sequence runs against the
completed final build and is recorded separately. Earlier screenshots do not prove
a later source edit. All ten call capture paths are recaptured by the final suite.

## Visual evidence

`chatapp_frontend/artifacts/ui-audit/current/`:

- `call-{light,dark}-{320,768,1024,1440}.png`
- `call-custom-{320,1440}.png`

These show the retained call panel, not an invented new layout. Desktop/mobile
and custom captures are inspected against actual app tokens. No shipping raster
or new design-system identity was introduced.

## Remaining gates

Controlled browser HTTP and real controlled SockJS/STOMP frames use fake media.
The Spring handler test is separate, not a running WebSocket server connected to
that browser. Neither proves live CQL, two physical clients, actual audio/video,
TURN/NAT behavior, multi-node broker delivery or process-kill recovery.

The current hook observes only the active DM. Global incoming-call discovery and
reload-time active-call lookup remain open and must not be presented as solved.
Follow-up: the cyclic timeout worker and latest-state handoff repair are now
connected; see `tasks/call-recovery-verification-2026-10-20.md` for separate evidence.
They are not live crash/restart acceptance. C3 must implement bounded,
authorized history/participants and honest missed/failed outcomes. Other roadmap
items (media, settings, email, moderation) remain in `tasks/todo.md`.

Source: [Spring Framework 6.2 user destinations and session-only replies](https://docs.spring.io/spring-framework/reference/6.2/web/websocket/stomp/user-destination.html).
The installed Next client-boundary guide was checked; no new server/client route
boundary or framework API was introduced.
