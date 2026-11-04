# Application settings: intentional exit

Scope: protect the existing admin Back-to-app action from accidental settings
draft/unknown-command loss, without redesigning the accepted compact operator
surface. This is progress on A2, not whole-app or complete navigation recovery.

## Changes and reasoning

- `chatapp_frontend/src/features/settings/model/system-settings-exit.ts`:
  finite clear/draft/busy/uncertain states, independent-editor priority and a
  route-owned React context. No global mutable cross-user draft store.
- `features/settings/ui/SystemSettingsExitBoundary.tsx`: shared protected-focus
  modal only when leaving with unfinished changes. Stay receives initial focus;
  Escape/close returns focus to Back-to-app. Busy blocks Leave. Unknown outcomes
  explicitly warn that the server may have saved and leaving loses retry state.
  Leave only invokes the existing route callback; never saves/cancels/retries.
- `SystemSettingEditor.tsx`, `SystemSettingsPanel.tsx`,
  `model/useSystemSettingEditor.ts`: publish current per-editor exit state;
  aggregate it without clearing another editor's pending command. Workspace
  changes retain mounted editors. Existing Refresh lock,409/exact retry,
  authorization clearing and native beforeunload warning remain intact.
- `src/app/admin/AdminEntry.tsx`: installs the boundary for the canonical admin
  route. Uses the root locale context rather than a duplicate i18n provider and
  global-runtime loading copy, fixing the observed English reload hydration
  mismatch. No router/history monkey-patching or browser-storage admin data.
- `scripts/system-settings-exit-smoke.mjs`, existing browser smoke and package
  alias `test:settings:exit`: executable state/behavior regression coverage.

## Verification

- RED before implementation: production Back-to-app navigation never presented
  the required draft confirmation; the browser assertion timed out.
- First new browser harness corrections: a shared accessible description and
  visible paragraph correctly duplicated text in DOM, so the test now checks
  the actual aria-describedby target; Playwright browser.newPage's implicit
  context cannot create sibling tabs, so the harness now uses an explicit
  isolated browser context. No behavior assertions were weakened.
- Further RED: English permission-reload produced React418 hydration mismatch.
  Root-context admin loading copy and removal of duplicate locale provider made
  the same assertion pass; no console allowlist was added for hydration.
- State aggregation:6 groups, each checked in both editor orders, pass.
- Actual typed settings API:7 groups pass. Locale scan:1240 static keys, no
  missing translations. `npm run validate` and `npm run build` pass.
- Production Chromium:30 controlled groups pass. Main admin path has zero page
  errors and only the three expected endpoint-specific409/network/403 errors.
  Eight list/editor/exit width-theme cases cover320/768/1024/1440 light/dark.
  Both setting actions remain in the first390px; exit bounds stay in viewport.
- Clean, ordinary-draft and unknown-outcome exit cases really navigate to
  `/app`; Stay/Escape do not navigate or mutate. Leave never submits/retries.
  Entire fixture records8 PUT attempts and5 commits, including one explicit
  lost-ack exit case; the existing same-command retry remains verified.
- Actual after-revocation clearing removes beforeunload protection. Canceling
  one editor does not clear another unknown save; workspace changes retain risk.
- Main opened all ten new dialog captures once. Scoped detector over the four
  changed TSX targets returned[] once; not a whole-codebase quality verdict.

Captures: `chatapp_frontend/artifacts/ui-audit/current/system-settings-exit-`
plus `{light,dark}-{320,768,1024,1440}.png`, `draft-vi.png` and `uncertain-vi.png`.
The correction also records `system-settings-exit-uncertain-en.png`.
They are actual dialog renders with controlled transport, not shipping artwork.

Admin operations regression passes: room policy/archive/restore, report
resolution, sanction/revoke, user role/status/session/device and audit CSV;
zero overflow, unnamed/unlabeled controls, console errors or failed requests.
Sticker-admin18 groups pass with only its expected network/409 failures. Their
first invocations used the scripts' different default ports and failed before
loading a page; setting SMOKE_BASE_URL to the owned3117 server made them run.
Independent finish review returned fix for one precise contract omission:
uncertain-outcome text did not explicitly state that leaving cannot cancel the
save. The correction adds that clause in VI/EN, preserves the lost-retry-state
warning, and adds an English accessible-description assertion/capture. Its
final verdict is recorded after corrected build/browser evidence, not assumed
from the initial review. `tasks/system-settings-exit-finish-review-2026-10-23.md`.
Corrected validate/build and browser30 rerun are terminal exit0. Both VI and EN
accessible descriptions are asserted; both updated uncertainty captures were
opened and checked. No additional detector or self-directed polish was run.
The reviewer scored the sole non-cancellation copy fix resolved and returned
ship at that correction-only scope. No whole-app or universal navigation
approval is inferred from it. The final scoped merge records this actual pattern
in `chatapp_frontend/DESIGN.md` and `extensions.noiAdminSettings` in its
`.impeccable/design.json` sidecar. JSON parsing and scoped diff check pass;
unrelated global identity/schema/tokens and the prior review history stay intact.
The owned production server was stopped; port3117 has no listener.

## Remaining boundaries

This guard covers the application's own Back-to-app action, including while a
different admin workspace is visible. It is not a universal Next.js route,
browser Back/Forward or external-link interceptor. Native beforeunload remains
best effort; it does not persist drafts or uncertain commands after reload,
browser crash or navigation explicitly accepted by the member. Real datastore,
crash/restart and two-client acceptance remain unrun while Docker is deferred.
No dependency, provider, schema, environment, credential, database reset, commit
or push was added. The original full goal and parent A1/A2 checklist stay open.

Reference: installed Next.js App Router useRouter/Link documentation and
[official Link navigation blocking guidance](https://nextjs.org/docs/app/api-reference/components/link#blocking-navigation).
No deprecated router.events, private history sentinel or unsupported global
route-blocking guarantee was introduced.
