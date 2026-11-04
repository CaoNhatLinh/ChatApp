# A2 application settings and admin density

Scope: actual two-key settings API/form, admin chrome and user-facing policy
denial. This is not full-app or live Cassandra completion. User rejected the
first verbose implementation; the replacement is recorded in
`tasks/admin-settings-ui-brief.md`. Independent review scored all three requested
corrections resolved; its final ship verdict is scoped to those corrections.

## Runtime changes / reasons

- `chatapp_frontend/src/features/settings/api/system-settings.api.ts`: strict
  finite typed catalog/metadata and matched save receipts. Pristine values must
  match defaults; malformed responses never become invented settings.
- `features/settings/model/useSystemSettingEditor.ts`: typed draft, synchronous
  in-flight guard, UUID revision/command, exact uncertain retry,409 draft retention
  and explicit reload; per-editor abort lifetime and native reload warning.
- `features/settings/ui/SystemSettingsPanel.tsx`: loading/error/permission states,
  two compact saved-value rows; successful authority updates the visual preview.
- `SystemSettingEditor.tsx`: on-demand shared dialog, keyboard-accessible Radix switch,
  bounded integer input, reason only after editing, inline recovery. Escape/close
  retains drafts and uncertain commands while mounted; explicit Cancel discards
  an ordinary draft. Busy save prevents dismissal. Focus returns to Edit.
- `CommunitySettingsPreview.tsx`: shared brand mark and geometric access diagram,
  actual saved open/paused/default-limit values, explicit Play/Pause, fine-pointer
  hover, reduced-motion and offscreen gates. It is a labeled preview, not activity
  telemetry, invented participants or confirmation of an unsaved policy.
- `src/shared/ui/Switch.tsx`: reusable accessible switch from the already installed
  Radix package; no dependency installed. `ModalShell.tsx` adds optional explicit
  focus return without changing other callers.
- `src/route-pages/AdminPage.tsx`, `shared/layout/AdminPageShell.tsx`, `src/index.css`:
  compact desktop side navigation/native mobile selector, short workspace title,
  removed repeated hero/count cards/breadcrumbs and obsolete corresponding CSS.
  Existing room/report/audit/user/sticker capabilities remain reachable.
- `src/shared/lib/user-facing-error.ts`, i18n resources, backend
  `CommunityCreationDisabledException`, `ConversationService`, exception handler,
  OpenAPI: stable403 `COMMUNITY_CREATION_DISABLED` has localized pause guidance;
  ordinary403 remains an authorization explanation. No raw server text is shown.

## Observed verification

- Regression-first checks failed on the old implementation: malformed pristine
  catalog accepted, six-destination layout assumption, generic policy403 copy,
  real MVC policy codeFORBIDDEN instead of COMMUNITY_CREATION_DISABLED.
- API adapter smoke:7 groups pass, including strict types/catalog/bounds,
  metadata, pristine mismatch, same object forwarded, receipt identity, conflict
  without automatic replay and newer current authority on exact replay.
- Error copy smoke:8 VI/EN policy/status cases pass; six existing unsafe-copy
  guards pass. Locale scan:1240 current static keys, no missing translations.
- `npm run validate` and `npm run build`: pass on the new runtime source.
- Production `system-settings-browser-smoke.mjs`:20 controlled groups pass:
  invalid GET/retry, no permanent forms, keyboard switch/submit, pending/Escape
  lock, focus return, invalid integer bounds, saved-vs-draft preview, close/reopen
  and workspace draft retention, default/Cancel, auditPending,409/reload failure,
  unknown acknowledgement/exact retry after a newer state, independent later
  intent, English mobile selection, Play/Pause/reduced motion,403 data clearing
  and revoked permission hiding/no API request. Follow-up covers real settings
  Refresh after external changes, draft/uncertain refresh lock, a named mobile
  exit and measured44px close/reopen retaining the frozen command.
- Eight list and editor width/theme cases pass at320/768/1024/1440 light/dark,
  no horizontal overflow; both Edit actions finish at369–390px from viewport top.
 7 attempted PUTs correspond to4 controlled commits; exact retry never creates
  a second mutation. Three expected endpoint-specific409/network/403 console
  failures; zero page errors or unexpected console failures.
- Admin operations regression and sticker-admin18 groups pass with the new
  navigation; no unexpected errors. Room-create policy denial retains its draft
  and can subsequently succeed when the controlled policy permits it.
- After the shared Dialog correction, pinned-deletion browser mode passes all
  eight width/theme cases; poll creation/uncertain retry/vote/remove/close passes.
- Final backend default JDK20 `./mvnw.cmd -q test`:819 tests/132 fresh suites,
  zero failures/errors/skips. XML reports were filtered after
  2026-10-23T09:03:15.474Z using UTC DateTimeOffset conversion, excluding old ITs.
  Two new MVC tests exercise the real conversation creation consumer/controller
  and error mapping, not just a mocked error response.
- Scoped static detector on seven TSX targets returned[]; it did not scan the
  entire inherited CSS/codebase. `git diff --check`: pass.

Independent review found three issues: generic Refresh did not refresh settings,
mobile Back-to-app was unnamed, and modal close was a16px target. One correction
batch adds settings-owned actual refresh with draft/uncertainty lock, a localized
exit label and44px dialog close. The shared close retains its16px icon; settings
title spacing, Escape/focus return and busy dismissal lock remain intact.
`tasks/admin-settings-ui-finish-review-2026-10-23.md` contains the initial findings
and scoped final score: three resolved, zero partial/unresolved. This does not
mean whole-admin, whole-app or live runtime approval.

Harness corrections are retained as limitations of intermediate runs, not false
source regressions: a background region becomes aria-hidden while a modal is
open; its preview assertion now uses a DOM locator. Dialog bounds are checked
after the screenshot's animation settlement, not during entrance. Close target
likewise measures the settled44px target, not its temporary entrance scale.
Expected policy
403 network+application logger output is matched explicitly, not ignored broadly.

## Captures

Actual production Chromium renderings under
`chatapp_frontend/artifacts/ui-audit/current/`:

- `admin-settings-first-{desktop,mobile}.png`: Vietnamese initial state.
- `system-settings-{light,dark}-{320,768,1024,1440}.png`: compact saved settings.
- `system-setting-editor-{light,dark}-{320,768,1024,1440}.png`: on-demand form.
- `system-settings-{pending,conflict,uncertain}-vi.png`: real controlled pending
  and failure recovery states; `system-settings-forbidden-en.png`: permission loss.

No new shipping raster or image-generation asset; brand SVG is reused. Captures
contain controlled fixture data and are not evidence of real database/provider IO.

## Remaining gates

The closed three-fix verdict is recorded. Scoped DESIGN.md and design.json
documentation now describes the implemented admin/settings pattern; existing
identity, tokens, schema and unrelated component guidance were preserved. Full
SPA-route-leave confirmation and reload-persistent
command recovery are not implemented; drafts/commands are memory-only. Switching
admin workspaces and closing these dialogs preserve them, not leaving the page.
Native reload warning is not an app-wide routing guard.

Actual Cassandra prepare/CAS, two clients, process-kill audit recovery, retention/
load and external provider acceptance remain open while Docker is user-deferred.
No database reset, credential/provider change, new dependency, commit or push.
