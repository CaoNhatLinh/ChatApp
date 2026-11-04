# F2 member forwarding — verification, 2026-10-20

## Scope

Connected the canonical F1/F2 transport to the member message menu, deliberate
target chooser and authorized source dialog. This extends personal/community
chat in the existing Signal Relay system; no new identity, dependency, schema,
provider write, database reset, commit or push is part of this slice.

Docker installation was explicitly deferred. Controlled HTTP/STOMP acceptance
does not establish live Cassandra, two-client, provider or crash safety.

## Behavior

- Forward opens a protected-focus shared dialog after the message menu closes.
  Selecting a joined conversation never sends immediately. Search and continuation
  use the actual directory API, including exact-cursor error recovery.
- The source snapshot comes from the authorized preparation endpoint, not cached
  message history. Attachment names use authoritative metadata. Unsupported poll
  and system messages do not gain a fake forward action.
- An attempt freezes source, target, payload and clientMessageId. Uncertain retry
  uses that exact command. Controls cannot silently change its destination; pending
  sends cannot be dismissed. Closing an uncertain attempt warns that its in-memory
  retry state will be lost and a later new send could duplicate the message.
- Definitive rejection before any uncertain result allows explicit target reset.
  Success and errors stay inline, with no added toast. A successful acknowledged
  message updates the destination and directory, including paged search targets.
- Forward attribution is immutable: forwarded copies do not offer editing.
  The public marker does not expose private source identifiers. Opening a source
  calls the authorized point endpoint; unavailable/error/revalidation clears old
  content. Focus and local block changes revalidate. No instantaneous remote
  membership-revocation notification is claimed.
- Source attachment navigation opens the actual source room's shared-content
  library, not the destination library. It does not invent attachment previews.
- Main composer drafts survive. Closing restores composer focus. Covered main
  history does not acknowledge new messages while forward/library overlays are open.
- Dialog planes use app theme tokens independently of arbitrary room backgrounds;
  message bubbles retain room appearance. Full-height mobile, bounded desktop,
  keyboard close, VI/EN labels and reduced-motion configuration are covered.

The command is not durable across closing, reload or navigation. A retained
destination copy is not retroactively retracted when its source becomes private.

## Files changed in this slice

Paths below are relative to `chatapp_frontend/` unless stated otherwise. Other
pre-existing dirty changes are not attributed to this slice.

| Files | Reason |
| --- | --- |
| `src/features/messenger/components/Forward/ForwardMessageDialog.tsx` | Source preparation, server-backed target search/paging, explicit confirmation and unchanged-command recovery |
| `src/features/messenger/components/Forward/ForwardSourceDialog.tsx` | Permission-scoped source reading, revalidation and source library handoff |
| `src/features/messenger/model/useForwardResource.ts` | Abortable scoped reads and optional focus revalidation |
| `src/features/messenger/components/chat/MessageItem.tsx` | Forward action, source marker, immutable-attribution edit restriction and menu focus handoff |
| `src/widgets/chat-window/ChatWindow.tsx` | Actor/room/message-keyed dialogs, correct library room, covered-timeline read guard |
| `src/shared/i18n/resources.ts` | Vietnamese/English interaction, error and recovery copy |
| `scripts/forward-browser-smoke.mjs`, `package.json` | Production Chromium functional/matrix acceptance and repeatable command |
| `scripts/forward-api-smoke.mjs` | Additional raw attachment, GIF and sticker forwarding adapter checks |
| Repository `tasks/forward-member-surface-brief.md`, this report, `tasks/todo.md`, `docs/TESTING.md`, `docs/TRACEABILITY_MATRIX.md`, `docs/flows/chat-shared-content-and-reading.md` | Surface intent, traceability and honest acceptance boundary |
| `DESIGN.md` and scoped `.impeccable` records | Record the built local extension after independent finish review |

## Verification

Commands ran from `E:/WORKSPACE/ChatApp/chatapp_frontend`; browser target is our
production Next server on port 3117, with controlled canonical HTTP and actual
controlled SockJS/STOMP frames, not a live backend.

| Command | Result |
| --- | --- |
| `npm run validate` | TypeScript and ESLint exit 0, no warnings |
| `npm run build` | Exit 0, all 17 routes generated |
| `npm run test:forwards:api` | 23 controlled adapter groups passed |
| `npm run test:e2e:forwards` | 23 groups and 8 width/theme cells passed; 19 screenshots |
| `npm run test:i18n:copy` | 1208 keys, missing=[] |
| `npm run test:e2e:threads` | 19 groups and 8 width/theme cells passed |
| `npm run test:e2e:message-interactions` | Exact message actions passed; unexpected console errors/request failures empty |
| `npm run test:e2e:chat-ux` | 39 groups and 8 width/theme cells passed; sampled body contrast 17.19 light / 17.56 dark |
| `git -c core.safecrlf=false diff --check` | Clean |

Forward browser acceptance includes preparation 503/retry, directory continuation
503/exact-cursor retry, server query, send 503/same-body-and-ID retry, uncertain
close confirmation, locked destination, preserved draft/focus, source unavailable,
actual source library request, English labels and no horizontal overflow.
Intentional injected HTTP failures are not counted as unexpected console errors.

Raw nullable/large attachment metadata and empty-content GIF/sticker payloads are
covered by adapter tests. The browser sending journey covers text; it does not
claim live provider GIF/artwork/file forwarding. Backend production code did not
change in this UI slice: the prior 429-test backend result is not a fresh Java run.

## Visual evidence and finish review

Under `chatapp_frontend/artifacts/ui-audit/current/`:

- `forward-{light,dark}-{320,768,1024,1440}.png`
- `forward-source-{light,dark}-{320,768,1024,1440}.png`
- `forward-custom-{320,1440}.png`
- `forward-source-unavailable-1440.png`

The initial reviewer returned **recapture**, because seven message entrance
animations were not settled at capture time; that was not a UI verdict. The
capture harness now waits for final message opacity and all 19 paths were
recaptured. Full independent review then found one material issue: searching for
B could hide selected recipient A while Send remained enabled. Query changes now
clear selection. The production browser regression selects A, searches B, asserts
Send disabled and zero sends, then explicitly selects B and verifies same-command
retry goes to B. Validate/build passed again and all 19 paths were recaptured.
The same reviewer scored fix 1 resolved, disposition **ship**. This verdict covers
the scored fix only; it is not whole-app or live-backend readiness.
No shipping raster was introduced.

## Open gates

F1/F2 live Cassandra tuple/index/batchlog recovery, real access revocation,
two-client races and provider-backed attachment/GIF/sticker journeys remain open.
Use `docs/testing/chat-cassandra-acceptance.md` after Docker is installed.
This report does not complete call history, media lifecycle, global settings,
email recovery, moderation or the full feature-expansion roadmap.
