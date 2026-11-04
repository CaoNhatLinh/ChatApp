# Connected incoming-call reminder — 2026-10-22

Historical connected-STATE UI increment. Authenticated HTTP reload/reconnect
discovery was connected afterward; see
`incoming-call-client-verification-2026-10-22.md` for that separate execution.

Status: the protected app now receives participant-private call state outside
the active DM and offers an explicit route into that conversation. Implementation
and controlled acceptance are complete for this local slice, not for offline
discovery, call history or the full feature-expansion roadmap.

Docker installation remains deferred by the user. No Docker installation/probe,
database reset, provider call, environment/credential change, commit or push was
performed in this slice. Existing unrelated work is preserved.

Product/design and the current `tasks/plan.md` / `tasks/todo.md` were consulted.
The originally named `tasks/ui-art-direction-plan.md` and
`tasks/ui-art-direction-todo.md` are absent in this checkout; no missing document
was treated as read or silently recreated.

## Route/state matrix

| Route/state | Behavior | Boundary |
| --- | --- | --- |
| Authenticated protected page outside the incoming DM | One opaque reminder, voice/video title, verified caller name when available, open/hide actions | Exact own `/user/queue/calls`, canonical STATE only |
| Visible active DM | Suppress duplicate global reminder | Existing conversation call panel remains responsible for answering |
| Signed-in public invite or auth page | No incoming-call subscriber/notice from this component | Session-aware initialization alone does not enable it |
| Unknown caller/DM | Abortable canonical member-summary lookup; generic guidance while name unavailable | Verify DM, current peer and archive state; no fabricated user name |
| Summary 403/404 or wrong peer/type | Hide local reminder | Do not expose unavailable conversation content |
| Duplicate/older STATE | Preserve one latest entry | Exact room/call identity and monotonic version |
| Local hide | Suppress this call through later state updates | Does not send DECLINE/END/LEAVE |
| ACCEPTED, terminal or elapsed deadline | No ringing reminder | Terminal tombstone cannot be resurrected; local clock never writes server state |
| In-app protected-route navigation | Retain the same-session inbox | Unsubscribe on unmount, not a session reset |
| Logout/session replacement | Clear private memory; ignore late frames/responses | Actor/session-generation guards; no persistence middleware |
| Open conversation | Route to canonical `/app?conversationId=...`, load summary and active call | No automatic answer or microphone/camera acquisition |

The inbox retains at most 128 call identities, including terminal tombstones.
It is deliberately memory-only. A hard reload, offline interval, or reconnect
with no fresh event is not repaired by this queue. Durable pending-call listing
is a separate required access path; do not enumerate every room or infer delivery
from the backend publisher's handoff receipt.

## Files and reasons

Paths below are relative to `chatapp_frontend/` unless explicitly noted.

- `src/features/calls/model/incoming-call-inbox.ts`: canonical private-event
  validation, bounded reduction, immutable identity, version/tombstone/regression
  guards, local hide and deadline/visible-room selection.
- `src/features/calls/model/incoming-call.store.ts`: memory-only session-scoped
  inbox, same-session remount retention and explicit reset.
- `src/features/calls/hooks/useIncomingCallInbox.ts`: shared authenticated realtime
  subscription, old-session rejection and a timer only while ringing is relevant.
- `src/features/calls/ui/IncomingCallNotice.tsx`: shared app-token reminder,
  verified/abortable caller lookup, block filtering, explicit open and local hide.
- `src/app/native/NativeRouteShell.tsx`, `ProtectedRoute.tsx`: a separate explicit
  protected-route opt-in; public session-aware invite pages do not mount it.
- `src/features/auth/model/auth.store.ts`: reset the private inbox alongside
  other cross-feature state on session changes.
- `src/features/messenger/api/messenger.api.ts`: optional AbortSignal for the
  existing canonical point-summary adapter; DTO/access contract unchanged.
- `src/shared/i18n/resources.ts`: concise voice/video, hide and fallback VI/EN copy.
- `scripts/incoming-call-inbox-smoke.mjs`: real parser/reducer/store with controlled
  canonical snapshots/clock, including route remount, logout and old generation.
- `scripts/incoming-call-browser-smoke.mjs`: connected UI, protected/public routing,
  keyboard focus, language, deadlines, navigation and responsive/theme checks.
- `scripts/auth-lifecycle-smoke.mjs`: include the new cross-feature reset dependency.
- `package.json`: runnable `test:calls:inbox` and `test:e2e:incoming-calls` commands.
- `DESIGN.md`, `.impeccable/design.json`, the scoped surface brief and
  `tasks/incoming-call-ui-brief.md`: preserve the incumbent identity and record
  only the implemented reminder pattern. No shipping raster or dependency added.
- Root `tasks/todo.md`, `docs/TESTING.md`, `docs/TRACEABILITY_MATRIX.md` and this
  report: scoped implementation/evidence and remaining gates.

## Verification

Commands ran in `chatapp_frontend/`:

| Command | Final result |
| --- | --- |
| `npm run validate` | Exit 0: TypeScript and ESLint |
| `npm run build` | Exit 0: production build, TypeScript and 17 routes |
| `node scripts/incoming-call-inbox-smoke.mjs` | 31 controlled assertions |
| `node scripts/auth-lifecycle-smoke.mjs` | 7 groups |
| `node scripts/realtime-subscriptions-smoke.mjs` | 11 groups |
| `node scripts/conversation-directory-api-smoke.mjs` | 17 groups |
| `node scripts/locale-copy-smoke.mjs` | 1220 static keys, missing=[] |
| `node scripts/incoming-call-browser-smoke.mjs` | 24 final production Chromium groups |
| `node scripts/call-browser-smoke.mjs` | 32 regression groups |
| `node scripts/chat-workspace-ux-smoke.mjs` | 39 regression groups |
| `node scripts/thread-browser-smoke.mjs` | 19 regression groups |
| Targeted ESLint for the new inbox/hook/UI/guard and both new scripts | Exit 0 |
| `git -c core.safecrlf=false diff --check` | Exit 0 |

The browser harnesses use a separately owned production server on port 3117,
isolated browser contexts and controlled canonical HTTP/SockJS/STOMP. Incoming
checks assert zero console/request failures, no automatic device acquisition or
mutating call command, unchanged search focus, same-session cross-route retention,
unknown-DM summary/active-call reads, signed-in public-invite non-mount, terminal
and expiry suppression. English is selected through the real Settings UI.
Other call tests use fake media, not a real two-person media connection.
Every owned browser command reached a terminal result before the owned test
server was stopped. No existing user server was stopped.

Initial tests failed while the inbox/store modules did not exist. The first
post-UI type-check identified an unsafe optional peer comparison and duplicate
translation key; both were fixed before the final passing validate/build.
Independent logic review found session-aware public routes were also enabling
the notice. A separate protected-route opt-in fixed this, and the final browser
test asserts the negative public-route case. No unrelated broad cleanup followed.

No backend/schema changed in this slice, so earlier backend JUnit counts are not
presented as newly run evidence. These frontend results do not establish live
Cassandra, broker, concurrent-client, revocation-race, crash/load or provider IO.

## Visual and independent review

All eight final controlled captures are under
`chatapp_frontend/artifacts/ui-audit/current/`:

- `incoming-call-light-{320,768,1024,1440}.png`
- `incoming-call-dark-{320,768,1024,1440}.png`

Each file was opened and checked for painted content, viewport containment and
readability. The reminder clears mobile navigation, stays opaque in both themes
and uses existing shared buttons/Lucide icons rather than room-specific colors.
No automatic focus, decorative motion, sound, extra modal or toast was added.

Impeccable detector ran once on the changed UI/shell/guard targets: `[]`.
A fresh finish reviewer inspected all eight captures and the source. Its scoped
disposition was **ship**, with no material fixes; persistence, fidelity, ceiling,
material_fixes and keep sections were supplied. No separate QUALITY BAR card was
supplied; the reviewer explicitly used the recorded Operate bar and DESIGN.md.
This is approval of the incoming reminder, not of the whole Friends page/app.

Existing Friends header overlap at 320px and cramped tabs at 768px are recorded
as a separate layout follow-up, not silently treated as fixed by this reminder.

## Still open

- Durable participant-scoped pending-call lookup for offline/reload discovery.
- C3 bounded call history/participants API and UI.
- Known-room initial message-history error containment (separate from summary-entry).
- Friends header/navigation layout follow-up observed in the captures.
- Live Cassandra/broker/two-client/restart/crash/media/load gates, with Docker
  deferred again on 2026-10-22; no repeated installation request is needed.
- Remaining media lifecycle, global settings, email history/recovery and actual
  moderation-provider/policy work in `tasks/todo.md`. Push remains deferred.

No parent roadmap checkbox or full-goal completion follows from this slice.
