# Admin visual affordances — controlled verification

## Scope

Actual `/admin` production components: Overview room imagery and report
shortcuts, saved community-settings preview/editor entry, sticker-cover shelf.
Contract: `tasks/admin-visual-affordances-contract.md`. This is not whole-app or
backend report concurrency/recovery acceptance.

## Implementation

- Room contact sheet uses returned images at recognizable sizes with circular
  monogram fallback, not large empty rectangular plates. Selecting opens the
  existing canonical room detail. At most three loaded rooms are previewed.
- Overview report reasons use the same VI/EN vocabulary as the inbox; selecting
  opens that exact report, including after mobile Back. No investigation or
  sanction is triggered by previewing a report.
- Community preview shows saved access/capacity and opens the corresponding
  real protected-focus editor. Closing returns to the exact preview/row trigger.
  It cannot submit a command; drafts do not change the saved preview. Ornamental
  Play/Pause and its animated path were removed.
- Sticker covers lead the existing catalog, with contained image sizing, local
  missing/corrupt fallback, written publication state and selection feedback.
  Introductory copy was shortened. Existing item/editor commands are retained.
- Neutral semantic app tokens,160–180ms interaction transitions and the existing
  reduced-motion override. No new dependency, shipping raster or external art.

## Evidence before finish review

`npm run validate` and `npm run build` passed. Production BUILD_ID:
`QdwUfI7BpKuwJJO5jFXBx` (17 routes).

- `node scripts/system-settings-browser-smoke.mjs`:30 groups,8 theme/width cases,
  preview keyboard entry/focus return/no implicit save, existing draft, conflict,
  uncertain retry, permission cleanup and clean/draft/uncertain app exits.
  Fixture8 PUT attempts/5 commits, no unexpected runtime errors.
- `node scripts/admin-visual-workbench-smoke.mjs`:19 groups,36 captures;
  exact report shortcut/reopening, recognizable imagery, room list/detail/image
  behavior, fallback/retry/draft, selected activity and local read-failure paths.
- `SMOKE_BASE_URL=http://127.0.0.1:3117 node scripts/sticker-admin-smoke.mjs`:
  existing18 groups plus8 loaded-shelf captures, missing/corrupt cover fallback,
  VI/EN, both themes and four widths.
- `node scripts/admin-report-inbox-browser-smoke.mjs`:14 groups/26 captures;
  no report-reason contamination, uncertain result retained, double-click busy
  guard, terminal read-only and stale read protection.
- `test:admin:reports`:25 checks; `test:settings:api`:7; `test:settings:exit`:6.
- `admin-route-smoke.mjs`: room, report, sanction, account/role/session/device
  commands passed against controlled transport; unnamed controls0, unlabeled
  fields0, horizontal overflow false.
- One detector pass over8 changed TSX targets returned `[]`. This is not a
  global CSS or whole-app detector approval.

The new preview acceptance assertion first failed against the old production
bundle because the actionable preview did not exist. Intermediate harness
corrections: reduced-motion permits the established0.01ms global override;
lazy corrupt-cover checks scroll into view and account for its accessible label;
report force-double-click settles dialog animation before exercising busy state.
One earlier double-click wait timed out without proving an application defect;
the diagnostic and final settled run passed. Overview captures reset document
scroll before capture; the earlier clipped set is not visual evidence.

## Visual review packet

14 inspected, correctly named final captures are copied to
`chatapp_frontend/.impeccable/review/admin-affordances/`: Overview and settings
light/dark at320/1440, VI settings desktop/mobile, sticker shelf light/dark at
320/1440. The source harnesses also exercise768/1024. Fixture images reuse local
synthetic brand assets; they are not real community photos or shipped sticker
packs. No user content was manufactured in production.

The first independent review returned `fix` for permission recovery, mobile
sticker task continuity and stale design documentation. Its scoped findings and
scored verdict belong to `tasks/admin-visual-affordances-finish-review-2026-10-23.md`.

## Review correction evidence

Corrected application BUILD_ID `arclRXdB-PENnSbIt9Eac`: validate and build pass.
Settings30 now additionally proves permission-denial -> catalog Retry remains
closed -> next editing restores the current trigger. Visual19 passes unchanged.
Sticker18 plus the extended eight width/theme cases prove Create focuses its
editor, mobile catalog/detail are separate, cover selection focuses the actual
form, Back restores the cover/Create trigger, and reopening the SAME pack keeps
its mounted draft.4 extra editor captures accompany the8 shelf captures.

The original14 review files were recaptured and refreshed; mobile editor light/
dark320 captures were added to the review packet (16 required files). The first
correction capture harness checked immediate visibility during resize and could
skip Back, misnaming an editor screenshot as a shelf. It now checks the explicit
pane state and waits for catalog visibility. That invalid intermediate set was
not sent for verdict. Final targeted lint of the4 updated browser scripts and
scoped diff check pass. Detector was not repeated.

Both new behavior regressions were observed RED on the pre-correction bundle.
No app code was changed to mask a failing test; the later capture synchronization
correction changes only the test harness.

The actual admin mutation regression was also rerun on the correction build:
room policy/archive/restore, report decision, separate sanction/revoke, user
role/status/session/device and export commands pass with no unexpected console
or request failures. Its accessibility checks report0 unnamed controls,
0 unlabeled fields and no horizontal overflow.

A scoped documenter merged the actual implementation into DESIGN.md, the
sidecar and admin/sticker surface briefs. JSON parsing and diff checks pass;
legacy unrelated metadata was preserved. This persistence is not itself a ship
verdict.

Final independent verdict: `ship` for the three listed corrections, all scored
resolved after16 valid recaptures. The finish record retains that narrow scope;
it is not whole-surface/app approval. The owned3117 preview is stopped.

## Limits

No live database/provider writes, deployment, secret/config change, commit or
push. Docker/live Cassandra/two-client/crash gates remain deferred. Full route
navigation/reload recovery and the broader remaining feature/UX TODOs are not
completed by these controlled browser checks.
