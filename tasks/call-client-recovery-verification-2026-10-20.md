# C2 active-DM client recovery — 2026-10-20

Status: connected to the canonical backend point-read contract; verified with
controlled transport/browser fixtures. Full roadmap remains active. Global
incoming outside the active DM, history, live Cassandra/broker/crash and real
media remain open. No Docker/provider/environment secret writes or Git commit/push.

## Behavior and changed files

- `chatapp_frontend/src/features/calls/api/active-call.api.ts`: shared authenticated
  API client, AbortSignal, only 204 means absence. Validates exact room/participants,
  nonzero UUID call identity, public snapshot shape/version/status. Malformed,
  terminal or denied/unavailable responses do not become an empty-success fallback.
- `src/features/calls/hooks/useActiveCallDiscovery.ts`: point read on DM entry and
  successful realtime reconnect. Cancel obsolete scope/retry requests; ignore late
  results after abort/unmount. Inline loading/error/retry, no toast. Initial read
  is not duplicated by the connection listener's synchronous ready callback.
- `src/features/calls/hooks/useWebRtcCall.ts` and `types.ts`: recovered RINGING
  recipient state offers explicit answer; other recovered nonterminal states are
  detached. No automatic getUserMedia, peer creation, START/JOIN or heartbeat
  claiming this tab participates in media. Detached states converge using SYNC.
  Do not overwrite a currently owned call or regress its version. Merely viewing
  an incoming/detached state and leaving does not send LEAVE or mark it closed.
  Detached END is explicit, locks while pending, and waits for authoritative
  terminal state; uncertain errors retain the panel rather than announcing success.
- `src/widgets/chat-window/components/CallSessionPanel.tsx`: localized checking/
  retry and detached explanation using the existing SurfacePanel/Button system.
  Detached calls have a clearly named end action, no misleading mic/camera controls.
- `ConversationHeader.tsx` and `ChatWindow.tsx`: eligible header call controls stay
  visible but disabled until successful discovery/no competing local session.
  Composer start availability uses the same policy; the hook guards commands too.
- `src/shared/i18n/resources.ts`: four concise VI/EN strings; no backend feature
  claim, automatic-media-restoration claim or invented device ownership.
- `scripts/call-active-api-smoke.mjs`, `call-browser-smoke.mjs`, `package.json`:
  adapter/parser and production-browser recovery scenarios. Thread/chat-UX fixtures
  explicitly return canonical 204 for their no-call rooms, not unsupported dummy data.
- `DESIGN.md`, `tasks/call-lifecycle-contract.md`, `tasks/todo.md`,
  `docs/TRACEABILITY_MATRIX.md`, `docs/TESTING.md`: narrow operational pattern,
  current mapping and verification boundaries. Incumbent Signal Relay is preserved;
  no new layout, imagery, motion, dependency or custom control system.

## Verification

- `npm run test:calls:active-api`: 15 controlled adapter/parser groups passed.
- `npm run test:calls:channel`: 20 correlated channel groups passed.
- `npm run validate`: TypeScript + ESLint passed after implementation/header fix.
  Earlier lint caught an unnecessary default generic argument; removed, not ignored.
- `npm run build`: installed Next 16.3.3 production build passed, 17 routes.
- `SMOKE_BASE_URL=http://127.0.0.1:3117 npm run test:e2e:calls`: final run passed
  27 groups, no captured page/console errors or unexpected request failures.
  Includes existing calling/ACK/retry/media regression plus incoming reload,
  no implicit device/control command, navigation without decline, detached
  accepted state, explicit same-ID end and discovery-error/retry behavior.
- `npm run test:e2e:threads` against that production server: 19 groups passed.
- `npm run test:e2e:chat-ux`: 39 groups passed.
- `npm run test:i18n:copy`: 1209 statically discoverable keys checked, missing[].
  This is not a claim that dynamic conditional copy is exhaustively covered;
  new recovery copy also rendered in the browser through real locale resources.
- `git -c core.safecrlf=false diff --check`: passed. All browser test handles
  finished before stopping the owned test server on port 3117; unrelated servers
  were untouched.
- Impeccable context/hardening/polish guidance used to preserve the existing
  operational surface and make actions/states honest. Mechanical detector ran
  once on the initial changed targets and returned []; the header's later
  disabled-prop adjustment was reviewed through build/browser, not called a
  second detector-clean result. No call-specific persisted brief was selected
  by the helper; incumbent DESIGN/component truth guided the narrow refinement.

Two verification defects were found and corrected, not counted as success:
the first recovery browser run exposed hidden rather than disabled call controls;
those controls were fixed. Later DOM assertions passed but screenshot inspection
found blank captures caused by the synthetic timeout clock persisting over reload.
Advancing that clock did not fix it (the new opacity guard failed). Timeout-clock
testing now runs last, after screenshots; capture waits for painted ancestor
opacity. The final 27-group run and recaptured images are the accepted evidence.
No production timing/CSS workaround was introduced to make test screenshots pass.

## Visual evidence

Under `chatapp_frontend/artifacts/ui-audit/current/`:

- Refreshed existing `call-{light,dark}-{320,768,1024,1440}.png` and
  `call-custom-{320,1440}.png`.
- New `call-recovered-{light,dark}-{320,768,1024,1440}.png`, including the configured
  custom room fixture behind the app-token panel. Light 320 and dark 1440 were
  visually inspected after the final paint guard passed; earlier blank images
  were overwritten and are not accepted evidence.

Browser uses isolated Playwright Chromium, controlled canonical HTTP/SockJS/STOMP
and fake getUserMedia/RTCPeerConnection. Backend unchanged in this slice; latest
backend evidence is 511 default tests/96 suites from the prior point-read slice.
No new backend/JUnit/live/provider claim is inferred from frontend checks.
