# Incoming-call reload/reconnect client — 2026-10-22

Status: protected frontend consumer implemented; controlled browser/model checks
pass. This closes the frontend discovery increment, not C2 live acceptance, C3
history/participants or the full feature roadmap. The user will install Docker
later; it was not installed or probed in this increment.

Backend prerequisite: `incoming-call-discovery-verification-2026-10-22.md`.
Behavior: `incoming-call-discovery-contract.md`. Existing reminder design brief:
`incoming-call-ui-brief.md`. No dependency, environment/credential/provider,
database/volume, commit or push change.

## What works in the controlled production browser

- Register the own private STATE subscription before incoming GET on each
  connected protected entry/reconnect. A full reload can recover a currently
  ringing call from HTTP without a fresh private STATE event.
- Request bounded pages of 50, including continuation after a filtered-empty
  page. Stop automatic traversal after eight pages and offer explicit continuation.
  Repeated/malformed cursors and failed later pages are errors, not empty success.
- Abort superseded traversals and fence stale success/failure by request,
  lifetime, actor and session generation. A retry starts from the head.
- Merge HTTP and STATE through the same version/identity/tombstone/local-hide
  reducer. Delayed HTTP cannot resurrect an observed accepted/terminal call;
  reconnect and retry do not undo local hide. Do not treat omitted HTTP entries
  as authoritative removal from a changing feed.
- Show checking/waiting/incomplete/error feedback locally in the same notice
  plane. Error has retry and local dismissal; an existing ringing call keeps its
  Open conversation action. No second overlapping aside, success toast or focus
  stealing. No automatic media access, answer, decline or end-call command.
- Keep protected-only mounting: signed-in public invite preview does not discover
  calls, and a late protected request cannot place a notice on that route.
- Preserve existing unknown-DM summary/active-authority handoff. Opening the notice
  navigates to the real conversation; the member explicitly answers there.
- Use app light/dark tokens independent of room imagery. Wrap feedback at 320px;
  retain the existing 768px desktop anchor, mobile navigation clearance and VI/EN.

## Files changed in this increment

Paths below are relative to `chatapp_frontend/` unless stated otherwise.

| Files | Reason |
| --- | --- |
| `src/features/calls/api/incoming-calls.api.ts` | Typed no-store abortable GET; canonical page/cursor and actor-scoped RINGING validation through the shared snapshot parser. No fake empty fallback. |
| `src/features/calls/model/incoming-call-discovery.ts` | One traversal owner: abort/identity/scope guard, empty continuation, eight-page batches, cycle/memory guard and fresh retry. |
| `src/features/calls/model/incoming-call-inbox.ts`, `incoming-call.store.ts` | One merge for validated HTTP and private STATE; preserve session, version, immutable identity, terminal/accepted and local-hide rules. |
| `src/features/calls/hooks/useIncomingCallInbox.ts` | Subscribe-before-lookup, queued readiness, reconnect, auth loading/scope cleanup and feedback actions. |
| `src/features/calls/ui/IncomingCallNotice.tsx`, `IncomingCallLookupFeedback.tsx` | Same-plane checking/error/continue; keep known call action on lookup error, local dismiss, existing theme/focus/nonmodal behavior. |
| `src/shared/i18n/resources.ts` | Eight new Vietnamese/English lookup labels and states. |
| `package.json` | Named API/controller test commands; no dependency change. |
| `scripts/incoming-calls-api-smoke.mjs`, `incoming-call-discovery-smoke.mjs`, `incoming-call-inbox-smoke.mjs` | Actual adapter/parser/controller/store tests with controlled responses and deferred races. |
| `scripts/incoming-call-browser-smoke.mjs` | Actual production UI reload/reconnect, cursor/error/retry/hide/focus/access/locale tests and captures. |
| `scripts/call-browser-smoke.mjs`, `thread-browser-smoke.mjs`, `chat-workspace-ux-smoke.mjs` | Add canonical empty incoming-page fixtures for the new protected read; do not loosen production validation. |
| `scripts/auth-recovery-browser-smoke.mjs` | Canonical incoming/channel fixtures and useful unexpected-request diagnostics; retain failure assertions. |
| `DESIGN.md`, `.impeccable/design.json`, surface brief/sidecar | Scoped documentation of the extended notice, without replacing the incumbent visual identity or unrelated metadata. |
| Root `tasks/`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/TRACEABILITY_MATRIX.md` | Current contract, evidence, limits and still-open acceptance. Historical backend/UI reports retain their original execution scope. |

## Commands and results

All terminal results below are for this increment unless explicitly historical.

| Command | Result / boundary |
| --- | --- |
| `npm run validate` | Exit0: TypeScript and ESLint. |
| `npm run build` | Exit0: production Next build; all17 route outputs generated. |
| `node scripts/incoming-calls-api-smoke.mjs` | 85 checks: actual adapter/parser with controlled HTTP; no backend. |
| `node scripts/incoming-call-discovery-smoke.mjs` | 12 groups: traversal, abort/stale success/failure, scope/disposal, cycle, retry, eight-page continuation, no overlap and bounded cursor memory. |
| `node scripts/incoming-call-inbox-smoke.mjs` | 38 checks: actual reducer/Zustand store, HTTP/STATE merge and old-session/wrong-recipient rejection. |
| `node scripts/auth-lifecycle-smoke.mjs` | 7 lifecycle groups with controlled transport. |
| `node scripts/realtime-subscriptions-smoke.mjs` | 11 actual adapter groups with controlled shared transport, no broker. |
| `node scripts/locale-copy-smoke.mjs` | 1225 static translation keys checked, none missing. |
| `node scripts/incoming-call-browser-smoke.mjs` | Final49 production Chromium groups, 36 discovery reads, zero unexpected console/page/request failures. Controlled canonical HTTP/STOMP, not a live call. |
| `node scripts/call-browser-smoke.mjs` | 32 production Chromium groups, controlled HTTP/STOMP and fake media. |
| `node scripts/chat-workspace-ux-smoke.mjs` | 39 production Chromium groups, including filters/Ctrl+K/library/unread/theme; controlled backend. |
| `node scripts/thread-browser-smoke.mjs` | 19 production Chromium groups, controlled canonical replies/STATE. |
| `$env:SMOKE_BASE_URL='http://localhost:3117'; node scripts/auth-recovery-browser-smoke.mjs` | 3 recovery scenarios: notifications320 light VI, notifications1440 dark EN, admin320 dark VI. No live auth/provider claim. |
| Impeccable detector on both changed UI targets | Exit0, `[]`; no findings. Not a browser/accessibility verdict. |
| `git -c core.safecrlf=false diff --check` | Pass. Existing unrelated changes preserved. |

Test-first adapter/controller runs initially failed because their production
modules did not exist; green results above follow implementation. First auth
recovery run exposed a missing `/notifications/channels` fixture as an unexpected
500. The fixture was corrected to the existing disabled-channel contract;
assertions remain strict and all three scenarios then passed. No production
error suppression or fake provider capability was added.

Production server was started only after the build completed, on owned port3117.
It was stopped after every browser run completed, after verifying exact PID30624
and its Next3117 command. Server session92785 then ended as expected. The user's
unrelated3116 server was not modified. Backend Maven/schema checks
were not rerun: no backend/schema file changed in this frontend increment. The
561-test backend result belongs to the preceding backend report, not this run.

## Captures and finish review

Final browser run produced17 full-page1000px-high captures. Main agent opened
all17 once in a batched inspection. Sources in `artifacts/ui-audit/current/`:

- `incoming-call-{light,dark}-{320,768,1024,1440}.png`: HTTP-recovered ringing call.
- `incoming-call-lookup-error-{light,dark}-{320,768,1024,1440}.png`: local failure.
- `incoming-call-lookup-error-en-dark-1440.png`: English error and retry.

Reviewer copies in `.impeccable/review/` use `incoming-reload-*` and
`incoming-lookup-error-*` names. These are controlled verification artifacts,
not shipped art or evidence of real incoming calls. No shipping raster was added.

Open representative captures:
[mobile light](../chatapp_frontend/.impeccable/review/incoming-reload-light-320.png),
[desktop dark](../chatapp_frontend/.impeccable/review/incoming-reload-dark-1440.png),
[mobile error](../chatapp_frontend/.impeccable/review/incoming-lookup-error-dark-320.png),
[English error](../chatapp_frontend/.impeccable/review/incoming-lookup-error-en-dark-1440.png).

Fresh scoped finish review inspected all17 captures and source. TYPE, MATERIAL,
GROUND, THESIS/STORY, FIRST VIEWPORT and recovery matched the brief; its initial
disposition was `fix` solely because DESIGN still documented the earlier
STATE-only/no-pending-lookup boundary. No UI correction was requested.

The shipped documenter merged only `DESIGN.md#incoming-call-notice` and
`extensions.noiIncomingCallNotice` in the sidecar. It verified unrelated text was
unchanged, JSON parsed and all17 capture paths existed. The same reviewer then
scored the sole persistence fix **resolved**, disposition **ship**. This verdict
closes that scored documentation fix, not a new whole-app or live-runtime review.
No recapture/build was needed for this documentation-only correction.

## Remaining limits and acceptance

- Docker/Cassandra, real query/TTL/conditional batches, crash/restart, broker and
  two real clients remain unverified. Do not infer them from stubs/fake media.
- Inbox memory is capped at128 distinct calls. A hidden/terminal entry can be
  evicted; protection is not permanent or reload-persistent.
- A lookup already in flight can finish after socket disconnection. If a terminal
  event was missed, an earlier ringing item can remain until its fixed deadline;
  omission from the changing feed is not proof it ended. DM entry revalidates
  authority before showing answer controls. No gapless offline delivery promise.
- The backend cursor ages out after60 seconds; delayed continuation may require
  explicit fresh retry. Eight-page batches and the128-cursor guard bound client
  traversal, not datastore latency/capacity or unlimited history discovery.
- C3 call history/participants, media lifecycle, revisioned global settings,
  email operational/history UI and real moderation detection remain on the
  approved roadmap. Push remains deferred by the user.
- Existing Friends header overlaps at320 and cramped tabs at768 are visible in
  background captures. They predate this narrow call extension and remain a
  separate UX follow-up, not claimed fixed by these notice tests.

The full goal remains active; this report does not mark the roadmap complete.
