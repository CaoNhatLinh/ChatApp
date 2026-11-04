# C3 member call history — controlled UI verification

Date:2026-10-23. Scope: own/DM UTC-month call history and exact participant
facts, extending the existing chat workspace. This does not complete C3's live
Cassandra, broker, two-client, restart/crash or media-provider acceptance.

## Implemented behavior

- Own history opens beside the chat-list filters, on desktop and mobile. DM
  history opens from its header menu, independently of new-call eligibility.
  No seventh bottom-navigation action or account-settings nesting was added.
- One protected-focus shared dialog holds month selection, list and detail.
  Mobile fills the viewport; desktop is capped36rem/85vh. Detail replaces the
  list. Back reloads the selected month; Escape/close restores entry focus.
- Actor/session-generation, room and month scope own the reading state. Effect
  cleanup aborts requests; current-session checks and request identity reject
  late successes and failures. Focus revalidates the current reading view.
- Explicit continuation supports filtered-empty pages. Merge by room/call key
  and monotonic version, never callId alone. A250-entry cap and finite cursor
  cycle/threshold guard report incomplete reading, not fake completion.
- Read failures clear potentially unauthorized content. Retry restarts the
  list from its head or re-reads the exact selected detail. No toast is added.
- Known authorized DM summaries supply peer names only on exact ID match;
  unavailable names use neutral call/role labels and actual participant IDs in
  detail. No profile, presence or deletion status is fabricated.
- Outcomes retain incoming MISSED versus outgoing UNANSWERED. Participant facts
  describe initiation and consent only; no measured duration, join/leave claims,
  callback button, call command or automatic device acquisition.
- VI/EN copy and opaque app-theme reading surfaces, even over custom room art.

## Changed production source

- `src/features/calls/model/call-history-reader.ts`: feature-owned bounded,
  abortable list/detail orchestration, separate from presentation.
- `src/features/calls/hooks/useCallHistory.ts`: React/session ownership and focus
  revalidation; no private history persistence or background all-month fetch.
- `src/features/calls/ui/CallHistoryDialog.tsx`: shared list/detail reading plane,
  loading skeletons, month, retry, pagination and explicit incomplete feedback.
- `src/features/calls/ui/CallHistoryFacts.tsx`: compact rows and factual roles/
  timestamps, using names only from existing authorized DM summaries.
- `src/widgets/chat-sidebar/ChatSidebar.tsx`: own-history entry.
- `src/widgets/chat-window/components/ConversationHeader.tsx`: DM menu entry and
  retained mobile voice/video actions; desktop keeps direct call controls.
- `src/widgets/chat-window/ChatWindow.tsx`: scoped history integration, cleared
  on room change while preserving the message composer.
- `src/shared/i18n/resources.ts`: concise English counterparts.
- `package.json`, reader/browser smoke scripts: repeatable verification commands.

Paths above are relative to `chatapp_frontend/`. Development-only direction and
state matrix live in `tasks/call-history-ui-brief.md` and the preceding client
boundary report; generated surface brief is under `.impeccable/surfaces/`.

## Executed verification

- Red/green reader tests: missing reader and load-more/detail behavior failed
  before implementation. A final-page overflow regression failed before the
  incomplete marker was fixed. **19 groups pass**.
- Existing adapter suite: **111 checks pass**.
- `npm run validate`: full frontend type-check and ESLint **pass** after UI fixes.
- `npm run build`: Next16.3.3 production compile/type-check/17-page generation
  **pass** after UI fixes. No new route, dependency or database change.
- `npm run test:e2e:call-history`: **17 groups,
  33 history reads**, no unexpected errors or request failures; zero call
  commands and mic/camera acquisition. Covers own/DM entry, list/detail, focus,
  Escape, explicit continuation from an empty page, month switch, a pending old
  month's response, transient retry, forbidden detail and fresh retry, VI/EN.
  The final capture run records one existing presence-subscribe/disconnected
  warning during reload, explicitly retained in the JSON report rather than
  counted as a history error or hidden behind a clean-console claim.
- `node scripts/call-browser-smoke.mjs`: **32 groups pass**.
- `node scripts/chat-workspace-ux-smoke.mjs`: **39 groups pass**.
- `node scripts/incoming-call-browser-smoke.mjs`: **49 groups pass**,36 incoming
  reads. These are controlled canonical HTTP/SockJS/STOMP Chromium regressions,
  not live calls, Cassandra or real media connectivity.
- `node scripts/locale-copy-smoke.mjs`: **1239 keys**, none missing.
- Impeccable detector once on four changed UI targets: **[]**.

The first render batch found the native month picker icon unreadable in dark
mode. The correction sets native color-scheme by app theme and enlarges close.
Two render-inspection batches were used, opening all17 files in each; no further
build-thread visual hunt follows. A harness-only canvas readback warning was
then corrected; the final functional run reused existing captures via
`--no-capture`, without UI changes or a third build-thread inspection round.
The fresh reviewer then requested a scoped correction: the shared Button's
relative positioning had displaced the close control into a layout row. An
absolute wrapper resolves that source issue; a single reviewer fix round rebuilt
and recaptured the same17 files. Final upper-right close-position assertions and
text-contrast assertions (4.5:1 or better) pass. Root opened every final capture
once for evidence validity; reviewer verdict is pending, not self-certified.

## Rendered evidence

`chatapp_frontend/.impeccable/review/` contains list and detail captures named
`call-history-{list|detail}-{light|dark}-{320|768|1024|1440}.png`, plus
`call-history-detail-en-1440.png`:17 captures. All four widths were captured in
both app themes with a deliberately white custom room image behind the opaque
panel. Browser report: `call-history-browser-report.json` in the same directory.
These screenshots are QA evidence, not shipping raster assets.

## Finish and limits

Fresh Impeccable finish review identified two material fixes: close positioning
and missing design documentation. Both were applied; the same reviewer scored
both **resolved**, disposition **ship at the two-fix verdict scope**, not a new
whole-surface or whole-app audit. Record:
`call-history-ui-finish-review-2026-10-23.md`. The shipped documenter merged the
built pattern, bounded verdict and actual evidence into frontend `DESIGN.md` and
`extensions.noiMemberCallHistory` in `.impeccable/design.json`, preserving
unrelated metadata. No shipping raster/provenance work was needed.

Code review checked correctness, readability, feature ownership, session/privacy
boundaries and bounded work against the actual API/reader/browser tests. This
surface deliberately pauses at250 retained entries or its cursor guard; the
member sees incomplete feedback, not an unlimited-history promise. It is not
evidence of capacity/load or real authorization revocation across two clients.

No commit/push or external provider action was performed. The owned Next3117
process was stopped and no listener remained. Real datastore/broker/media gates
remain open while Docker is deferred. A separate remaining contact-policy item
was rechecked in source: `CallLifecycleService.requireActivePeer` checks exact
DM membership/archive/block, but neither it nor
`ConversationAuthorizationService.requireDirectPeer` reads peer account status.
Suspended/deleted-peer new-contact protection still needs its own tests/fix;
history readability must remain separate from callback eligibility.
