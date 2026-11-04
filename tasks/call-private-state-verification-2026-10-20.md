# C2 participant-private STATE handoff — 2026-10-20

Status: backend routing/security prerequisite connected and locally verified.
Global incoming browser subscription/UI, offline pending-call lookup, C3 history
and live acceptance remain open. Full goal remains active. Docker installation
is deferred; no engine probes, database/provider/environment writes, tunnels,
commit or push were performed. Existing unrelated changes were preserved.

## Implementation and files

- `chat-service/src/main/java/com/chatapp/chat_service/canonical/call/CallDelivery.java`:
  capability-owned typed room/call/revision/STATE-or-SIGNAL scope. No transport
  framework dependency or caller-supplied authorization in this domain record.
- `CallDeliveryHeaders.java`: fresh internal SIMP metadata for each destination;
  exact typed fields are required on read. STOMP native/client headers are not a
  substitute. Kept separate from the public JSON snapshot and command DTO.
- `CallLifecycleService.java`: read-only `requireDelivery` rechecks authoritative
  call, exact participant, active DM/peer membership, both block directions and
  deadline. STATE must match the current revision. An in-flight SIGNAL can survive
  a heartbeat revision if the same call remains ACCEPTED, never terminal/overdue.
- `CallStatePublisher.java`: same public STATE to room, caller's user destination,
  callee's user destination, then exact publication receipt. Either private
  handoff throwing keeps work pending; retry may repeat earlier handoffs safely.
- `CallSignalingService.java`: only the room SIGNAL path, stamped with trusted
  current call scope. No SDP/ICE handoff to the participant-private state queue.
- `realtime/StompAuthenticationInterceptor.java`: allows only canonical own
  `/user/queue/calls`; raw/foreign queues and broker SEND remain forbidden. Outbound
  room/private call frames require trusted scope, exact room match where applicable,
  active account/token and current delivery permission. Private SIGNAL is denied;
  missing scope, denied or unavailable authority fail closed without payload logs.
- Tests: `CallActiveQueryTest`, `StompAuthenticationInterceptorTest`,
  `CallRecoveryTest`, `CallSignalingServiceTest`, `CallLifecycleServiceTest`,
  `CallControllerTest`, new `CallPrivateRoutingTest`.
- `docs/api/asyncapi.yaml`, ADR 0018, call lifecycle contract, todo, testing and
  traceability docs: declared private STATE channel/operation and explicit limits.

No schema, frontend, UI style, provider, credentials or dependency change. The
current browser still subscribes only to active-DM call events; adding a backend
destination does not imply a connected global incoming surface.

## Verification

- Test-first new policy tests initially failed compilation before the delivery
  record/method existed, then passed after implementation.
- Focused authority, recovery, signaling and subscription/outbound suites passed.
- `./mvnw.cmd -q test` with JDK 20: exit 0; 519 tests / 97 default suites,
  zero failures/errors/skips. Counts use `TEST-*Test.xml`; old failed opt-in
  missing-Docker reports were not erased or counted as passing.
- After the full run, an additional wire-encoding assertion was added to the
  existing routing test; `./mvnw.cmd -q '-Dtest=CallPrivateRoutingTest' test` passed.
- Real `SimpMessagingTemplate` with the configured Jackson mapper converted STATE
  to bytes. Real `DefaultUserDestinationResolver` mapped each participant to that
  user's two mocked session IDs, not another user. Internal scope survived routing
  input; real `StompEncoder` output omitted all internal scope field names.
- Mocked broker failures at either private recipient prevented receipt advancement;
  retry handed off the same state. Signal tests assert no private destination call.
- Outbound tests reject missing/forged-native scope, wrong room, private SIGNAL
  and unavailable authorization; domain tests reject nonparticipants, revoked
  membership, archive, block, deadline, terminal SIGNAL and stale STATE while
  allowing accepted SIGNAL across heartbeat-only revision changes.
- `git -c core.safecrlf=false diff --check`: passed before final evidence update.

No new frontend/build/browser/screenshot claim: none changed in this backend-only
slice. The existing client evidence report is not a live regression of this
backend security change. Unit/component tests do not establish full WebSocket
network handshake, real broker/datastore behavior, competing clients or crash/load.

## Review and remaining gates

API/interface, incremental implementation, documentation and five-axis review
guidance informed this slice. A typed shared delivery scope avoids repeating
ad-hoc payload parsing in generic realtime security; call policy stays in the
owning capability. No broad fallback accepts old/unscoped call frames. Delivery
adds current-authority reads per recipient/session; no throughput claim is made.

The current simple broker/user registry is node-local. Successful template handoff
is not subscriber delivery, even when no user session resolves. Global pending-call
listing/reconnect repair is still needed for calls begun while offline; no client
should enumerate every room or infer completion from this queue alone. Distributed
registry/broker routing, live revocation races, real CQL/crash and actual media are
unverified. Docker remains deferred rather than repeatedly requested.

Design basis, not execution evidence:
[Spring 6.2 user destinations](https://docs.spring.io/spring-framework/reference/6.2/web/websocket/stomp/user-destination.html).
