# T3 member reply panel — verification, 2026-10-20

## Scope and result

Implemented the approved direct-reply UI against the T2 canonical endpoint.
This extends the existing personal/community chat, not a sales workspace or a
visual-world replacement. Controlled frontend acceptance passed; live Cassandra,
two-client realtime, provider and crash-recovery acceptance remain open. Docker
installation was explicitly deferred by the user. No database was reset, provider
contacted, tunnel opened, credential changed, commit created or push performed.

## Behavior

- Source quotes and the message action open an exact conversation/bucket/message
  key, even when the source is outside loaded history. No cached-history scan.
- Parent first, oldest direct replies below; explicit continuation, refresh and
  inline retry. Empty filtered pages retain their real continuation. Cursor cycles
  stop with an error rather than scanning or looping.
- Desktop right-docked dialog; mobile single full-height layer. Escape/close,
  focus return, dirty-draft discard confirmation and pending-send protection.
- Independent text reply draft and canonical full-key send. Uncertain retry keeps
  the same clientMessageId and content. The main composer draft is preserved;
  switching to it supports existing rich attachment/sticker/GIF flows.
- Existing message renderer handles text, deleted messages, stickers/GIFs and poll
  reads. Attachment rows open the actual shared-content library: the thread API
  does not supply inline attachment metadata and the UI does not fabricate it.
- New reply events offer refresh; loaded-message/source events revalidate.
  Focus and local block changes revalidate. 403/404 removes previously displayed
  data. No promise of immediate membership-revocation push is made.
- A covered main timeline does not acknowledge a newly arriving message as read
  while this thread dialog is open. Closing reschedules visible-timeline reading.
  This is a thread-specific guard, not a claim that all overlays were audited.
- App-token opaque reading plane protects small labels from arbitrary room
  imagery. Custom image remains visible in gutters; message bubbles keep their
  chosen room appearance. VI/EN labels and reduced-motion layout are retained.

## Changed files and reasons

Paths are relative to `chatapp_frontend/` unless stated otherwise.

| Files | Reason |
| --- | --- |
| `src/features/messenger/api/thread.api.ts` | Typed canonical adapter, source/page/cursor validation and cancellation |
| `src/features/messenger/model/useMessageThread.ts` | Bounded paging, exact-cursor retry, stale-response protection and scoped revalidation |
| `src/features/messenger/components/Thread/MessageThreadDialog.tsx` | Responsive protected-focus panel, reading plane, source/reply states and draft handoff |
| `src/features/messenger/components/Thread/ThreadReplyComposer.tsx` | Independent text draft, same-command uncertain retry, inline send feedback |
| `src/features/messenger/components/Thread/ThreadMessage.tsx` | Shared read-only message rendering, authoritative profile/poll hydration and library action |
| `src/features/messenger/components/chat/MessageItem.tsx` | Read-only mode, full-source-key thread action, menu-to-dialog focus handoff |
| `src/widgets/chat-window/ChatWindow.tsx` | Actor/room/parent-keyed mounting, source navigation and composer integration |
| `src/widgets/chat-window/model/useReadTracking.ts` | Pause covered-timeline acknowledgment and resume when visible |
| `src/shared/i18n/resources.ts` | Vietnamese/English panel, draft and recovery copy |
| `scripts/thread-api-smoke.mjs`, `scripts/thread-browser-smoke.mjs` | Adapter and production-browser acceptance, including failure-before/fix-after read regression |
| `scripts/message-interactions-smoke.mjs`, `package.json` | Existing source-navigation regression and runnable thread test commands |
| `DESIGN.md`, scoped `.impeccable` records | Persist existing-world extension, reviewed reading-plane/interaction rules |
| Repository `tasks/todo.md`, this report, `docs/flows/chat-shared-content-and-reading.md`, `docs/TRACEABILITY_MATRIX.md`, `docs/TESTING.md` | Scope, implementation mapping and honest verification boundaries |

Other pre-existing dirty files are not attributed to this slice.

## Verification

Run from `E:/WORKSPACE/ChatApp/chatapp_frontend`, production Next server on port3117.

| Command | Result |
| --- | --- |
| `npm run validate` | TypeScript + ESLint exit0 |
| `npm run build` | Exit0, all17 routes generated |
| `npm run test:threads:api` | 13 controlled adapter groups passed |
| `npm run test:e2e:threads` | 19 groups passed; 8 width/theme cells plus2 custom captures |
| `npm run test:chat:unread-theme` | 22 ordering/theme/URL-safety checks passed |
| `npm run test:i18n:copy` | 1192 keys, missing=[] |
| `npm run test:e2e:chat-ux` | 39 groups and8 width/theme cells passed; sampled text contrast17.19/17.56 |
| `npm run test:e2e:stickers-member` | 26 groups,8 screenshots passed |
| `npm run test:e2e:message-interactions` | Exact pin/reaction/read-receipt/mention/reply requests passed; consoleErrors=[], requestFailures=[] |
| `npm run test:gifs:message-flow` | 15 controlled groups passed |
| `npm run test:messages:send-attempt` | 19 controlled groups passed |
| `npm run test:stickers:send-flow` | 4 controlled groups passed |

Thread browser coverage includes exact source outside cached history, page503
retaining content and retry cursor, send503 same-ID retry, retained main draft,
source deletion,403/404 clearing, filtered-empty continuation, cursor cycle,
late-response discard across parent changes, dirty-draft confirmation, focus,
English labels and covered-timeline read acknowledgment. The latter failed before
the guard (`true !== false`) and passed after it. Custom-room heading and sender
contrast is asserted >=4.5:1 against the opaque reading plane.

The thread harness intentionally injects one send503 and expects that error log;
unexpected page/console errors and request failures are empty. Browser tests use
controlled HTTP and actual controlled SockJS/STOMP frames, not live backend IO.
The prior T2 backend default suite passed407 tests/83 suites; it was not rerun or
represented as live-Cassandra verification in this frontend-only slice.

## Visual evidence and finish review

`chatapp_frontend/artifacts/ui-audit/current/` contains:

- `thread-light-{320,768,1024,1440}.png`
- `thread-dark-{320,768,1024,1440}.png`
- `thread-custom-{320,1440}.png`

Independent finish review requested one contrast fix. The opaque reading plane
was implemented, the same ten paths recaptured and custom-width contrast tested.
The same reviewer scored fix1 resolved, disposition **ship**, no remaining scoped
fixes. This is a local UI verdict, not a whole-app or live-backend readiness claim.
No new shipping raster or dependency was introduced.

## Open gates

Run the approved opt-in Cassandra acceptance after Docker is installed, including
fresh schema, actual tuple cursor/index behavior, reply batch/retry recovery,
access revocation and two-client read/realtime races. See
`docs/testing/chat-cassandra-acceptance.md`. Other roadmap capabilities remain
unchecked in `tasks/todo.md`; completing this panel does not complete them.
