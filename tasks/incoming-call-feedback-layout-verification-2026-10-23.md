# Incoming call lookup: non-blocking layout

## Scope and evidence

The previous fixed bottom-right lookup panel intercepted Save changes. A new
`EDIT_OFFLINE_CALLS=1` mode in the production message-edit browser test withholds
the broker CONNECTED frame. Before the fix, its ordinary trial click timed out
because the waiting paragraph intercepted pointer events. No force-click or
hidden overlay is used.

Lookup loading/waiting/error/unfinished feedback now uses a normal-flow row above
protected content. Its actual ResizeObserver height is exposed as a route-local
`--app-viewport-height`; viewport-sized app shells and the rail consume the
remaining height. Errors still have retry/dismiss, unfinished discovery still has
load-more. A known ringing call retains its separate reminder/Open action. No
call authorization, transport, API or database behavior changes.

Visual review caught a second failure: `.page-shell` still forced 100dvh and
allowed the banner to scroll offscreen. The regression now requires the waiting
banner to remain visible, the Save control inside the viewport, and no overlap or
horizontal page overflow. The shared page-shell min-height now consumes the same
route-local variable, defaulting to 100dvh outside this layout.

## Files changed in this increment

- `src/features/calls/ui/IncomingCallNotice.tsx`: separate in-flow discovery
  feedback, measured height and retained actual-call reminder.
- `src/app/native/NativeRouteShell.tsx`: local available-height boundary.
- `src/route-pages/shared/layout/AppPageShell.tsx`,
  `src/route-pages/shared/layout/AppNavigationRail.tsx`, `src/index.css`:
  consume available viewport height, preserving public fallback.
- `src/route-pages/MessengerPage.tsx`: use parent height, remove competing fixed
  viewport/minimum height.
- `src/widgets/messenger-layout/components/MessengerLayoutShell.tsx`: anchor
  mobile list toggle to its shifted workspace, not the browser viewport.
- `scripts/message-edit-smoke.mjs`: disconnected edit/save and eight visual
  theme/width checks, keeping the connected mode.
- `scripts/incoming-call-browser-smoke.mjs`: in-flow geometry and loading/more
  matrices in addition to the existing error/call states.
- This report, `tasks/todo.md`, and `docs/TESTING.md`: evidence and remaining gates.

Paths above are relative to chatapp_frontend unless explicitly rooted at tasks
or docs. Existing unrelated worktree changes were preserved; no commit/push.

## Verification

From `chatapp_frontend`:

- `npm run validate`: pass (type-check + lint).
- `npm run lint`: pass after the remaining TSX/test edits.
- `npm run build`: pass for the final CSS/TSX source.
- `SMOKE_BASE_URL=http://127.0.0.1:3117 EDIT_OFFLINE_CALLS=1 npm run test:e2e:message-edit`:
  pass, eight width/theme checks, exact PUT bucket/content, preserved draft and
  revision read; no collected non-broker console errors/request failures.
- The default connected `test:e2e:message-edit` mode also passes against the final
  build with the same exact edit/revision assertions and no collected errors.
- `npm run test:e2e:incoming-calls` with the same base URL: 65 groups pass,
  including 25 lookup captures and eight actual-call width/theme cases.
- `npm run test:e2e:chat-ux` with the same base URL: 39 groups pass, including
  all four widths, both themes and custom-room overrides.
- `npm run test:calls:discovery`: 12 groups pass.
- `npm run test:calls:inbox`: 38 groups pass.
- `git diff --check`: pass; incumbent CRLF normalization notices only.

All browser checks use production Next/Chromium with controlled canonical
HTTP/STOMP fixtures. The intentionally unacknowledged broker in offline-edit mode
does not represent a real network outage. It verifies the observed waiting state
and independent HTTP editing, not offline mutation support.

## Screenshots

- `.impeccable/review/call-feedback-edit-{light|dark}-{320|768|1024|1440}.png`
- `artifacts/ui-audit/current/incoming-call-lookup-{loading|more|error}-{light|dark}-{320|768|1024|1440}.png`
- `artifacts/ui-audit/current/incoming-call-lookup-error-en-dark-1440.png`

Visually inspected final waiting dark320 and lookup-error light320 in addition to
automated geometry/theme assertions. No full-app visual acceptance is inferred.

## Review and limits

The measured value is scoped to the mounted native route, not persisted or shared
between actors. The observer disconnects on visibility/unmount; hidden feedback
resets height to zero. Existing translations and semantic card/border/text tokens
are retained. Resize measurement observes only the feedback row, not the resized
content, avoiding a content-height feedback loop. Browser tests cover retry,
dismiss, load-more, reload/reconnect and preserving a known call.

Actual incoming-call reminders remain floating and actionable by design; this
increment fixes discovery/status feedback, not every global overlay. The separate
network banner and mobile navigation/title spacing deserve their own UI audit.
No live Cassandra/broker/two-client/crash/provider acceptance was run. Docker is
deferred by the user; the full roadmap remains incomplete.
