# Image-led settings — controlled verification

Production BUILD_ID: `bId0qX1bw_NvernjtBXBT` (17routes).
Scope/contract: `tasks/admin-settings-visual-controls.md`.

Implemented one image-led saved-setting composition instead of the duplicate
list/preview. No new dependency, backend change or additional permanent form.
Native keyboard Edit, protected-focus modal, explicit reason/save, retained
draft, revision conflict, exact uncertain retry and permission cleanup remain.
Three numeric presets change only a validated draft; uncertain save locks them.

Checks:

- TypeScript and ESLint passed before build; production build passed.
- New browser requirement first failed against the preceding production build
  because the illustration did not exist (expected red test).
- Settings browser suite:30existing groups, eight light/dark/width cases,
  three exit cases;8PUTattempts/5fixture commits. Additional checks cover all
  three presets, saved value not changed by draft/presets, no duplicate preview
  controls, image failure fallback/recovery and locked uncertain presets.
- Both actual Edit actions finish at y388–408 in the tested1000px viewport.
- Settings API7checks and exit aggregation6checks passed.
- Admin visual regression19groups/36captures passed; rooms/report shortcut,
  directory/image viewer, activity and user-avatar behavior retained.
- Runtime exceptions/unexpected request failures: none in these controlled
  runs. Deliberate409, lost-response and403 settings failures and500 visual
  read failures remain expected negative-path evidence, not hidden app failures.

Harness correction: background article locators are excluded by protected
modal accessibility. The preset invariant reads the existing saved-value DOM
directly rather than asking the accessibility tree for hidden background roles.
No production correction was needed for that assertion.

Required captures are the12files in
`chatapp_frontend/.impeccable/review/admin-settings-visual-controls/`: eight
width/theme views, two Vietnamese first views and two320px numeric editors.
Illustration:640×640 alpha WebP,66,564bytes, generated abstract art. Exact prompt
and conversion recorded in `docs/brand/noi-community-settings-art.md` and the
image provenance sidecar. Not actual users, usage metrics or service status.

Browser testing used the existing isolated Playwright Chromium fixture harness;
Chrome DevTools MCP is not configured. Transport is controlled. This does not
certify live Cassandra, provider IO, concurrency/crash recovery or the whole app.
No commit/push or data/environment mutation.

Final ESLint and scoped `git diff --check` passed. One detector call over the
three changed TSX targets returned `[]`; no second detector or full-CSS audit.
The new WebP provenance sidecar was read back successfully.

Admin route regression initially used its default3100 port and could not
connect; rerun points SMOKE_BASE_URL to the owned3117 production server.
Rerun passed room policy/archive/restore, report resolution, separate sanction/
revoke, user role/status/session/device and audit CSV operations. Zero unnamed
controls, unlabeled fields, horizontal overflow, console errors or request
failures.

The independent reviewer opened all12required captures, judged them valid and
found no material scoped visual/control defect. Its initial disposition was
`fix` solely because design records still described the previous composition.
The documenter updated only DESIGN.md, design.json and the workbench surface
brief, preserving unrelated identity/history. Parent parsed JSON and checked
the scoped diff. The reviewer then scored that one persistence correction
resolved and returned `ship` only at that scoring scope; see
`tasks/admin-settings-visual-controls-finish-review-2026-10-23.md`.
No UI/source/asset change followed the original review, so the same build and
captures remain authoritative. No second detector, rebuild or screenshot round
was needed. The owned3117preview server was stopped. Broader app/live gates
remain open.
