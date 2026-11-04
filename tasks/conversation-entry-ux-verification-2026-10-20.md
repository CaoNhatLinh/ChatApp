# Conversation entry recovery — 2026-10-20

Status: unknown-room summary loading/error/retry is connected and controlled-tested.
This closes the summary-entry UX gap in the preceding point-summary report, not
global incoming calls, live backend acceptance or the full expansion roadmap.
No backend/schema/provider/environment/credential changes, commit or push.

## Behavior and state matrix

| State | UI/action | Boundary |
| --- | --- | --- |
| Summary pending | Local named skeleton; return to conversation list remains available | No composer, call controls or fake room/profile |
| Network/server/409 failure | Local explanation and explicit retry | Same selected room; no success/error toast or full-app replacement |
| 403 | No-access copy; return to list or choose another loaded room | Does not describe denial as a transient outage |
| 404 | No-longer-available copy; return to list | Does not claim deletion when the contract cannot prove it |
| 400 | Invalid-link copy; return to list | No fabricated conversation |
| Successful retry | Canonical peer/member summary then normal history path | No automatic media acquisition |
| Selection/session/request changes | Ignore late success/error from older request | Session-generation, active-room and request-ID guards |
| Leave handled deep link | Keep new selection and update/remove room query | No repeated forced selection of the failed room |
| VI/EN change while failed | Translate retained semantic error in place | No extra summary request |

Initial message-page failures for an already known room still use the existing
global messenger error path. This slice specifically handles summary entry;
that broader history-error behavior is not claimed fixed here.

## Files

- `features/messenger/model/conversation-entry.ts`: capability-owned summary
  loader, in-memory request ownership and session/selection guards. Store only
  typed error reasons, never native/server error messages.
- `messenger.store.types.ts`, `conversation.slice.ts`: explicit loading/error
  entry union, selection cancellation and session reset. No persistent cache.
- `useMessenger.ts`: unknown selection uses the guarded loader; a failed or
  superseded summary does not continue to fetch messages.
- `widgets/messenger-layout/MessengerLayout.tsx`: wait for initial directory
  setup before consuming the deep link, handle each changed query once, retain
  the rest of the app while entry fails, and return focus to list search on exit.
  Manually selecting a different room updates the handled link rather than
  being overwritten by it; stale message-highlight query is removed on exit.
- `components/ConversationEntryState.tsx`: token-based local reading plane,
  shared Button/Skeleton and Lucide back action. Loading, actionable error and
  unavailable/permission copy; accessible live feedback, selective heading focus
  without a native focus box, retained keyboard focus on list search. Locale
  context subscription updates an already visible error. No new animation/modal.
- `shared/i18n/resources.ts`: eight concise VI/EN entries.
- `scripts/conversation-entry-smoke.mjs`, `package.json`: runnable controlled
  model test for error reasons, retry, navigation, session replacement and
  older competing requests.
- `scripts/call-browser-smoke.mjs`: unknown-target deep link now covers 503,
  pending retry, 403, 404, 409 and successful retry; no premature composer/calls;
  choosing another loaded group, returning to list/search focus, in-place locale
  change and the existing active-call regression path.
- DESIGN/todo/testing/traceability and this report record scoped acceptance.

## Verification

- Test-first production-browser scenario failed against the old build because
  the error/retry surface never appeared. The model test first failed because
  the new implementation module did not yet exist.
- `node scripts/conversation-entry-smoke.mjs`: 24 controlled assertions pass.
  Includes exact latest-request ownership and session-generation isolation,
  not just requests that resolve in the same order they were started.
- Directory adapter17 and queued realtime adapter11 pass; unchanged backend
  evidence remains in the preceding report, not rerun or reclassified here.
- `npm run validate`: exit 0 before the bounded polish batch; targeted ESLint
  covers all changed model/component/test files after that batch.
- Final `npm run build`: exit 0, TypeScript and 17 routes.
- `node scripts/locale-copy-smoke.mjs`: 1217 static keys, none missing.
- Final production Chromium: call/entry32, workspace39 and thread19 groups pass.
  Controlled canonical HTTP and STOMP, fake media, no live datastore/provider.
  Call checks retain incoming/recovery/permission/timing coverage; this does not
  establish a working two-person media call or a global incoming subscription.
- Entry captures: 320/768/1024/1440 light/dark, reduced motion and horizontal
  containment. Existing call captures also include custom-room appearance;
  workspace checks retain opposite app/room theme inheritance.
- Batched visual review: light320 and dark1440 inspected before/after the single
  polish batch. Final captures contain painted content; focused heading no longer
  has the default black/white browser box. Interactive buttons retain shared focus
  treatment. No new visual world, art assets, typography or dependency.
- `git diff --check`: pass. Existing dirty-tree work preserved. Owned browser
  tests reached terminal results before the owned test server was stopped.

Screenshots: `chatapp_frontend/artifacts/ui-audit/current/conversation-entry-error-{light,dark}-{320,768,1024,1440}.png`.

## Remaining work

Continue C2 global incoming-call UI/subscription and offline pending lookup,
C3 history/participants, then the rest of `tasks/todo.md`. Known-room initial
history failure containment remains a distinct UX follow-up. Live Cassandra,
broker/two-client/restart/media/load gates remain unverified with Docker deferred.
No parent checkbox or full-goal completion is inferred from these local checks.
