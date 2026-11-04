# Admin user workspace — controlled verification

Current production build: `HNJczQ2eCDHGpxYSm7UsU`,17routes.
Contract: `tasks/admin-user-workspace-contract.md`. No backend/schema/provider,
credential, new dependency, shipping raster, commit or push change.

## Change

Replaced the permanently exposed access/role/security forms with a portrait-led
list/detail workspace. Desktop shares the two panes from1024px; smaller screens
show one pane and an explicit Back. Roles and sign-ins are separate views;
account/role/session/device operations open only their own protected dialog and
own their reason. Technical IDs and own permissions are secondary disclosures.
The actual APIs/permissions/audited reason contract remain in place.

AdminPage was reduced from1106 to approximately810lines by removing its shared
user-form state and handlers. Feature boundaries now separate read ownership,
workspace navigation, profile content and audited-operation drafts. Search and
three independent detail reads accept AbortSignal. This deletes the shared-role
reason dependency that blocked session-only operators and the sequential
roles-before-security waterfall. No new generic form or data framework.

## Evidence

- TypeScript, scoped ESLint, whole-frontend `npm run validate`, production build
  and scoped tracked diff check passed after the review fixes. The report
  model/search/label suite also passed all25assertions.
- New workspace browser requirement failed against the preceding build, as
  expected, before the new named workspace existed.
- Actual production Chromium + controlled transport:9behavior groups, eight
  profile width/theme cases and four compact-dialog captures passed. Coverage:
  separate no-match/error search; SESSION_REVOKE without role permission; own
  reason and exact target payload; parallel/late/aborted reads; replacement
  guard; retained/resumed mobile draft; pending close lock; fixed focus target;
  partial read/retry; committed-but-unacknowledged session mutation with no
  blind retry; app-owned exit; explicit warned discard; restore-only and
  role-only permission subsets; own account/bootstrap protection; invalid
  expiry; fresh reason after discard; English403 cleanup; restore-only ACTIVE
  has no unusable status action; scoped authority reload failure/pending and
  fresh permission loss; no repeated denied write or loss of a report draft.
- The initial extension rerun used SMOKE_CAPTURE=false. The reviewer-fix build
  regenerated all12same-file captures. After a test-only locale locator fix,
  the9groups passed with SMOKE_CAPTURE=false, reusing that unchanged build's
  captures rather than adding a visual-polish round.
- Machine report and12required captures:
  `chatapp_frontend/.impeccable/review/admin-users/report.json` and sibling PNGs.
- Expected failures: three500reads (including authority recovery), one503after fixture commit and one403write;
  two canceled reads are explicitly recorded as ERR_ABORTED. No runtime
  exceptions or unexpected console/request failures in the user suite.
- Admin mutation/CSV regression passed on this build with exact report and
  separate sanction reason/code, user role/status/session/device payloads;
  zero unnamed controls, unlabeled fields, overflow, console/request failures.
- Settings30group/eight-theme-width regression passed on this build, retaining
  its8PUTattempts/5fixture commits and expected negative-path failures.
- Workbench19groups/36captures and report inbox14groups/26captures also passed
  on the current build. Earlier builds/results remain historical, not evidence
  substituted for these current regressions.
- Manual detector ran once on the three new user TSX surfaces: `[]`. No full
  stylesheet or whole-app detector certification.

## Bounded visual corrections and harness notes

The first screenshot batch exposed a full-height mobile operation dialog. The
single parent correction batch centered it within1rem gutters and removed the
persisting "reloading" wording after acknowledged operations. All12final
captures were regenerated and opened; intentional dialog element captures are
paired with viewport-bound assertions in the browser test.

The independent reviewer requested three material fixes: valid status task
destinations, reachable permission recovery, and design persistence. The source
batch hides the restore-only action for already ACTIVE users. Mutation403 now
clears the complete private user read/draft state and offers localized keyboard
recovery with pending/error feedback. Recovery accepts the complete fresh
authority snapshot only for the captured/current actor with lifetime/generation
fences; it stays scoped to user management, preserving other mounted drafts.
It does not claim the root administration or every other permission refreshed.
The same12viewports were recaptured/opened after that one source correction
  batch. Documentation/final scoring are recorded below.

Test-only corrections: reason inputs use their accessible name because a
datetime-local field is also a textbox. Without screenshot capture, await the
actual entry animations before measuring dialog bounds. The older admin smoke
now waits for the report confirmation to close before filling the independent
sanction form, and asserts its reason code before submission. An earlier
combined command's admin failure was not counted as pass; the standalone
corrected current-build command returned exit0 with the exact expected code.
The report regression formerly assumed implicit sanctions loading on user
selection; it first failed rather than being counted as a pass. The explicit
profile Sanctions action now loads fenced history. The test follows that action
and retains the original late-old-history/new-report-target assertion. A final
English recovery test initially used the Vietnamese workspace locator; a
locale-aware test-only locator corrected that timeout without changing UI.

Fixture identities/images are synthetic and use the existing default asset or
an intentionally corrupt response, not new user photography. No live Cassandra,
provider IO, real concurrent managers or reload-persistent command proof.
Unknown legacy writes have no server idempotency guarantee; inspection never
unfreezes/resubmits the old intent or certifies its outcome. Universal browser
Back/Forward protection and distributed audit/write recovery remain open.

Chrome DevTools MCP is not configured in this session; verification used an
isolated Playwright Chromium fallback against the production frontend instead.
No browser install or live backend operation was performed.

## Scoped finish

A fresh independent reviewer first returned `fix` with the three items above.
After the source batch, same-file recaptures and fresh scoped documenter merge,
the same reviewer scored all three `resolved` and returned `ship`. See
`tasks/admin-user-workspace-finish-review-2026-10-23.md`. That is a bounded
three-fix verdict, not a new whole-surface audit, whole-app readiness or live
backend acceptance. Documentation records the actual source, constraints and
evidence in DESIGN.md, its sidecar and the matching surface brief. Final
disposition wording is a documentation-only synchronization, without source
or screenshot changes.

The owned local production server was stopped after verification. Existing
unrelated work remains untouched; nothing was committed or pushed.
