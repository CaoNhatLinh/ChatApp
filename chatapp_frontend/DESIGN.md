---
name: Nối
description: A privacy-conscious realtime conversation product with a focused workspace and a global operator surface.
platform: web
register: adaptive
---

# Nối design system

## Direction

Nối uses a signal-orange accent over a cool ink canvas. The landing surface
is confident and editorial, while signed-in screens stay quiet and operational.
The product should feel like a reliable relay: every state is visible, every
action has a clear place, and nothing ornamental competes with the conversation.

Design read: **Signal Relay** — a full visual overhaul for a consumer and team
messaging product. Public pages can be art-directed and expressive; signed-in
surfaces keep the same warm signal language but stay quiet, readable and fast.
Dial values: landing variance 8, motion 5, density 4; product variance 4,
motion 2, density 6.

## Tokens

Tokens are defined in `src/index.css` and are the only source for color, radius
and elevation decisions.

- Accent: `--primary`, signal orange, reserved for actions, active state and live status.
- Canvas: `--background`, cool near-white in light mode and ink blue in dark mode.
- Content: `--foreground`, `--muted-foreground`, `--border`.
- Surfaces: `--card`, `--secondary`.
- Radius: `sm` for compact controls, `md` for controls, `lg` for panels. No ad-hoc 24px+ cards.
- Elevation: thin borders and a short tinted shadow only where hierarchy requires it.
- Signal detail: `--signal-glow` and `--line-soft` create one restrained visual
  rhythm for focus, selection, loading and meaningful empty states. Do not add
  a new accent color per page.

## Typography

One sans family is used throughout: `Avenir Next`, `Segoe UI`, then system UI.
Landing headings use high contrast in size and weight, not a second serif family.
Product UI uses fixed rem sizes with `text-wrap: balance` for headings and a
maximum prose width of 65-75ch.

## Layout and navigation

- Public navigation: Home, About, Help, then legal links in the footer.
- Authenticated navigation: Workspace, Friends, Search, Profile, Settings.
- `/app` is the canonical conversation workspace. `/home`, `/messages`, and `/activity` are removed because they were duplicate or non-canonical surfaces.
- `/admin` is a global app-level operator surface. Room roles never grant app admin access.
- Mobile collapses navigation to horizontal scroll or a single-column flow; no desktop-only assumptions.
- Conversation room information is an on-demand overlay below the desktop
  breakpoint (1024px), then an aside. Chat and composer flex children can shrink
  so the member sticker shelf remains contained on narrow screens.

## Component rules

- Use semantic landmarks and one `h1` per page.
- Every control has focus, hover, active, disabled and pending states.
- Loading uses layout-matched skeletons. Empty states explain the next action.
- Errors are contextual and never replaced by invented data.
- Use the existing Lucide icon family consistently until a deliberate migration is planned.
- Keep motion on transform and opacity, under 250ms for product UI, and disable it for reduced-motion users.

### Admin workspace and application settings

The operator surface keeps Signal Relay's app canvas, compact sans type,
Lucide icons and shared brand mark. A sticky compact header holds language,
theme and the localized back-to-app action. From 768px, use a quiet vertical
workspace navigation (12rem) with a gap (2rem) before the content; below 768px,
use one native workspace selector in the compact pagebar. Selected navigation
uses a neutral surface and an orange icon. Keep the page title at the task,
without repeating the admin hero, permission counters or breadcrumbs on child
workspaces. This is a local Operate extension of the incumbent visual system.

Overview presents actual loaded rooms and pending reports in unequal reading
areas, with system connection status above them and explicit actions into the
corresponding workspace. The areas share a row from 1024px and stack below it.
Preview up to three loaded rooms as an image-led gallery: a featured circular
portrait (7rem) precedes secondary portraits (5.5rem), with the actual name,
member/archive state and the featured room's description when returned. Keep
sparse results sparse. Each portrait/caption is one native button that opens
that room's real detail. Pending report rows show localized reason, description
or target fallback and status; selecting one opens that exact report in the inbox.
Show the selected UTC month/day and the loaded-result scope; preserve local
loading, read failure and honest empty states. **The Loaded Content Rule.** A
record preview or count describes only the authorized response already loaded;
it must not imply a system-wide total or replace an error with an empty result.

The room directory searches names and IDs without case or Vietnamese accent
distinctions and offers All, Active and Archived filters over at most 100 loaded
rooms for the selected creation month (UTC). This is a local loaded-result
filter, not server-wide search or cursor pagination. From 1024px, the room list
and reading detail share the content area with a gap (2rem); below 1024px, one
pane owns the view. The visible Room list action returns from detail to search
and restores focus after an accepted return. Focus the room title when a detail
opens. Keep list names truncated, detail titles wrapping, and member count,
archive state and chat policy readable before disclosure. Put technical IDs,
loaded member IDs and permission-gated management fields behind native
disclosures. A dirty policy, slow mode or nonempty reason requires confirmation
before room selection, month change or Back discards it. An active mutation
blocks reselection and return. Fence authoritative detail requests so an older
response cannot replace the current selection; clear the previous detail on a
failed read and support retry by explicit selection. Directory read failure has
its own Retry action. Existing destructive confirmation and audited reasons
remain part of the management flow.

User administration uses the portrait-led list/detail pattern documented in
**Admin user workspace** below. Returned portraits lead recognition; native
disclosures keep technical identity and own permission codes secondary.
Room summaries and detail carry additive nullable `avatarUrl` values from the
canonical `conversations_by_id.avatar_url`; no image is inferred from a name or
description. Overview, list and detail share the same portrait source and
fallback. The gallery uses the circular sizes above; directory tiles are compact
(2.75rem) and the detail portrait is larger (5rem), with the existing visibility
or archive icon. Preserve the portrait's space and monogram while loading; missing
or failed images retain that local fallback. Use `referrerPolicy="no-referrer"`
and reset image state when its URL changes. The current UI loads at most 100
rooms; the API caps the monthly directory at 200 and enriches only those room
IDs in batches of at most 32. Authorized list/detail GET responses are
`no-store`; this does not change an already public image URL's cache policy.

When a detail has an image URL, its explicit View image button opens the shared
protected-focus modal by click, touch or keyboard. Keep its reading plane opaque
in app background/foreground tokens and contain the image at its original aspect
ratio within the secondary frame. Loading preserves the frame; image failure
announces the local error and offers Retry. Escape or close returns focus to the
image trigger. Inspection changes only the local viewer state and preserves the
room's policy/reason draft; a missing URL offers the portrait fallback without
an image action.
The existing Nối orbit SVG supports only the unselected/empty reading plane;
it is not a substitute for a room's returned identity. Add no invented photographs.

Activity uses loaded UTC day bars and a descending event-type breakdown over
at most 200 loaded events. Keep the compact visible VI/EN selection cue
(“Chọn ngày để xem” / “Choose a day to inspect”), native keyboard buttons,
pressed state and visible focus. Selecting a day updates the caption, count
and type breakdown; selecting it again or using All days restores the loaded
range. Retain the written caveat that these are loaded-event counts, not
system-wide totals. Failed reads clear the previous graph and offer Retry;
loading and a successful empty range have their own states.

Keep the compact type ramp: subordinate metadata and chart labels (0.75rem),
row text and disclosures (0.875rem), section titles and facts (1rem), and the
wrapping room detail title (1.25rem). Reuse neutral card/secondary planes and
the existing small/control/panel radii; orange identifies active/action states.
Semantic success, warning and destructive tokens carry operational feedback
with written state, never a page-specific color palette. Native date/month
controls follow the shell's light/dark `color-scheme`. Row and navigation state
changes use short transitions (160ms); disclosure rotation and bar state use
the same restrained grammar (180ms), with reduced-motion transitions disabled.
No entrance choreography is established by this pattern.

Application settings uses one unboxed composition: an authored community
illustration and the two actual saved-setting controls, with compact titles,
written saved values and one explicit Edit action per setting. From 1100px,
the decorative art sits at the left (20rem) and the controls at the right with
a gap (3rem); below 1100px, the controls come first and the smaller art (12rem)
follows. Keep both Edit actions in the first viewport. Separate the controls
with space, without hairline dividers, a second preview panel, duplicate values
or duplicate actions. The member limit uses prominent tabular numerals (2rem)
within the compact hierarchy. Loading, read failure/retry, lost permission and
save feedback stay local; never fill the surface with invented values or activity.

Edit one value in the shared protected-focus dialog: an actual switch for
creation policy or an integer field for member capacity. Keep the centered
dialog within viewport gutters (1rem), with a bounded desktop width (28rem),
an icon/title and compact actions. Reveal the required change reason when the
value is dirty or a reason already exists. Numeric presets (50, 250 and 1000),
when within the returned bounds, change only the draft. They never save or
bypass integer validation, the required change reason or explicit Save changes;
the locked fieldset also disables presets during an uncertain save. Preserve
the draft when Escape or close returns to the controls; Cancel explicitly
discards an ordinary draft. Restore focus to the exact invoking Edit button.
Permission denial and catalog reload clear the active editor and its obsolete trigger, so a later
successful read does not reopen the old editor. The shared close control has a square
hit area (44px) around its small icon (16px); reserve title space for it. Busy
save/reload blocks Escape and outside close and hides the close control.

A revision conflict keeps the draft until the explicit load-latest/discard
action succeeds; a failed reload keeps it too. An uncertain save freezes its
value, reason, revision and command ID, then offers retry of that exact command.
Show confirmed current authority and audit-pending feedback without inventing
success. The settings catalog owns its named Refresh settings action; disable
it while any row has a dirty draft, nonempty trimmed reason, busy command or
uncertain outcome, with a localized explanation. Generic pagebar refresh
belongs only to Overview.
Drafts and retry commands live only in memory while the rows remain mounted,
including workspace switches. Native reload warning is present; this pattern
does not promise universal route protection or recovery after reload.

The application's Back-to-app action exits directly when settings are clear.
Otherwise, reuse the centered protected-focus dialog, viewport gutters (1rem),
bounded desktop width (28rem), Lucide warning icon and shared controls. Stay
receives initial focus; Stay, Escape or close preserves work and returns focus
to the invoking exit action without navigation or a PUT. Aggregate each editor
independently: busy takes priority over uncertain, then draft, then clear. Busy
disables Leave; clearing one editor cannot clear another editor's risk. A
successful save, explicit Cancel or permission cleanup clears the affected risk.
Workspace switches preserve the mounted editors, so the same exit protection
applies while another admin workspace is visible without warning on the switch.

Use separate concise VI/EN explanations for an ordinary draft and an uncertain
save. The latter explicitly says the server may already have saved, leaving
does not cancel the save and retry information will be lost. Explicit Leave
only calls the existing route action to `/app`; it never saves or retries.
Keep the dialog's accessible title/description authoritative and its repeated
visible text unannounced. This protection covers the app-owned action only;
browser Back/Forward, arbitrary routes and reload-persistent retry remain
separate acceptance work. Admin session/loading copy uses the root locale
context, including English reloads.

The community illustration is the transparent authored WebP on the existing
app canvas, without an enclosing card. It is decorative, hidden from assistive
technology and carries no controls, people count, usage or service-status claim.
Written Open/Paused and the member limit come only from validated saved policy,
never the editor draft. Saved creation state selects the open-door or lock
symbol and lowers artwork saturation when paused. Hover or visible focus on a
real Edit action gives the artwork one short upward lift (180ms); reduced motion
removes the transition and lift. Image failure preserves the illustration's
space and shows the shared BrandMark fallback. Do not replace the artwork with
placeholder icon people or revive the separate interactive preview, capacity
silhouettes, Play/Pause, signal path or idle playback. Keep the localized mobile
exit name even when its visual text is hidden.

Use VI/EN copy, both themes and the 320/768/1024/1440px layout matrix. Controlled
browser evidence and the bounded three-correction ship verdict are recorded in
`../tasks/system-settings-ui-verification-2026-10-23.md` and
`../tasks/admin-settings-ui-finish-review-2026-10-23.md`. This local pattern
does not establish whole-admin/app approval or live Cassandra, broker,
two-client, restart/crash or media-provider acceptance. That earlier settings
increment added no shipping raster; the later authored-art exception is
recorded below.

The later exit increment is recorded in
`../tasks/system-settings-exit-verification-2026-10-23.md` and
`../tasks/system-settings-exit-finish-review-2026-10-23.md`. Corrected validation
and production build passed; controlled evidence covers 6 state groups, 7 typed
API groups and 30 production-browser groups across the eight theme/width cases.
Clean, draft and uncertain exits navigate to `/app`; Stay/Escape do not navigate
or mutate. The fixture records 8 PUT attempts and 5 commits, with no submission
or retry caused by Leave. Admin operations and 18 sticker-admin regression
groups passed. Captures under `artifacts/ui-audit/current/system-settings-exit-`
include the eight layouts plus ordinary-draft VI and corrected uncertain VI/EN.
The reviewer scored the sole explicit non-cancellation copy correction resolved
and returned ship only for that correction; the earlier three-correction review
and the remaining acceptance boundaries retain their original scope.

The later visual workbench increment is recorded in
`../tasks/admin-visual-workbench-verification-2026-10-23.md`, its machine report
at `artifacts/ui-audit/current/admin-visual-report.json`, and the bounded finish
review at `../tasks/admin-visual-workbench-finish-review-2026-10-23.md`. These
record controlled local transport/browser evidence across VI/EN, light/dark
and the 320/768/1024/1440px layout matrix; final verification and the review
disposition belong to those records. This documentation does not extend them
to whole-admin/app, live Cassandra, broker, two-client, restart/crash,
performance or media-provider acceptance. The application-settings command,
conflict/uncertain-save and exit behavior above remains the incumbent pattern.
No dependency or shipping raster is added by this increment.

The room-image continuation uses the contract in
`../tasks/admin-room-image-contract.md`. The current
`artifacts/ui-audit/current/admin-visual-report.json` records 18 controlled
browser-fixture groups and 36 captures, including room list/detail/viewer in
both themes at 320/768/1024/1440px, keyboard focus return, missing/corrupt images,
Retry, changed-URL recovery and preserved drafts. It reports no unexpected
page, console or request failures or warnings; three deliberate HTTP 500 errors
and their three warnings belong to tested negative paths. The room-image finish
review is recorded in `../tasks/admin-room-image-finish-review-2026-10-23.md`.
The earlier workbench verification remains historical. Fixture imagery uses an
existing synthetic default asset, not new shipping photography or evidence of
a real community image. These records do not complete the broader admin UX or
live Cassandra, broker, two-client, performance or media-provider gates.

The earlier visual-affordances correction follows
`../tasks/admin-visual-affordances-contract.md`; its evidence and bounded finish
disposition belong to `../tasks/admin-visual-affordances-verification-2026-10-23.md`
and `../tasks/admin-visual-affordances-finish-review-2026-10-23.md`. The gallery,
saved-setting controls and sticker shelf are local extensions of Signal Relay;
they add no approved comp, new identity, dependency or shipping raster. This
documentation does not certify the refreshed browser run or widen the earlier
acceptance boundaries.

The later application-settings composition follows
`../tasks/admin-settings-visual-controls.md`. Its production build
(`bId0qX1bw_NvernjtBXBT`), typed/build checks, 30 existing settings browser
groups plus the added preset/artwork checks, eight theme/width cases and admin
regressions are recorded in
`../tasks/admin-settings-visual-controls-verification-2026-10-23.md`.
The 12 captures are under `.impeccable/review/admin-settings-visual-controls/`.
The reviewer opened all 12 and requested only this documentation correction;
the bounded verdict belongs to
`../tasks/admin-settings-visual-controls-finish-review-2026-10-23.md`.
This persistence update does not assign a ship verdict or establish whole-admin/app,
live Cassandra, provider IO, concurrency/crash or media-provider acceptance.
The authored decorative raster's exact prompt and conversion provenance are in
`../docs/brand/noi-community-settings-art.md` and
`public/noi-community-settings.webp.json`; this is a specific settings-art
exception within the existing asset policy, not a new visual identity.

### Admin user workspace

Find a person, inspect their roles or sign-ins, then choose one audited operation.
Keep the existing neutral app planes, compact sans, Lucide symbols and shared
controls. Search requires at least two characters and returns at most 20 users;
the result scope is written beside the input. Idle, loading, read failure/Retry,
successful empty and populated results remain distinct. User names truncate in
the list and wrap in detail. Use the returned `avatarUrl`, no-referrer loading
and the reserved initials fallback for absent or failed portraits; list portraits
are compact (44px) and the selected portrait is larger (80px). The existing orbit
SVG belongs only to the unselected reading plane. No new raster is required.

From 1024px, unequal list/detail columns share the existing gap (2rem); below
1024px, one pane owns the view. Opening a person focuses the profile heading.
The named User list action returns to search and restores focus after an accepted
return. Native Roles and Sign-ins buttons expose pressed state and visible focus;
account/session IDs and own role/permission codes use secondary disclosures.
Use written account, device and session states rather than color alone. Rows use
the incumbent background transition (160ms ease-out), disabled for reduced motion.
Avoid reintroducing permanently exposed form stacks or nested card grids.

Role, session and device reads start concurrently and keep each resource's
successful data or local failure; one failed resource must not erase another's
success. Sign-ins describes at most 100 loaded sessions and 100 loaded devices.
Search/detail completions are owned by their abort signal, current actor,
mounted lifetime and selected person. Clear previous resources on selection;
late, canceled or old-actor responses cannot replace the current view. Retry and
Refresh profile explicitly inspect fresh data without inventing an empty result.

Open only the chosen role grant/revocation, account status, session revocation or
device revocation in the shared protected-focus dialog. Keep it centered within
viewport gutters (1rem), with a compact maximum width (28rem) from 640px and
internal scrolling within the viewport. Each operation snapshots its exact
person/resource, owns its required reason and validates its own fields. Preserve
the canonical API payloads and permissions: role tasks require APP_ROLE_MANAGE;
session/device tasks require SESSION_REVOKE independently; USER_SUSPEND and
USER_RESTORE govern their own status destinations. Show Account status only
when another permitted destination exists; restore-only access on an ACTIVE
account offers no dead-end task. Self-suspension and own SUPER_ADMIN revocation
remain unavailable. **The User Operation Ownership Rule.** One chosen operation
owns its frozen target and audited reason; it never borrows another task's draft.

Busy work blocks repeat submission, selection, replacement, Back and dialog close.
Ordinary close/Escape retains changed intent while mounted, with Resume and the
same reason; explicit Cancel discards an ordinary draft. Replacement, Back or
Discard action asks before losing retained work. Hidden workspace switches keep
the mounted editor. The app-owned Back-to-app action and native unload warn for
retained work; this is memory-only protection, without a universal route,
browser Back/Forward or reload-persistent recovery claim. Restore focus to the
exact operation trigger, or the profile heading after an acknowledged action.

Unknown write results freeze the operation and remove direct resubmission.
Load data to inspect can refresh authority but never certifies that write,
unfreezes the intent or resubmits it. Failed inspection preserves the unknown
state. Explicit discard warns that the server may already have acted and that
discard neither cancels nor resubmits the request. These legacy APIs have no
server idempotency or distributed write/audit recovery guarantee.

A mutation 403 clears private user results, query, selection, resources, pending
operation and focus target. Offer the localized, keyboard-reachable Reload user
access action with busy and failed-reload feedback. Recovery fetches a fresh
complete authority snapshot, accepted only for the captured and current actor
under generation/lifetime fencing. Replace the workspace's authority wholesale
so permission loss updates its controls; never replay the denied operation.
This recovery is local to user administration and preserves independent mounted
report/settings work. The explicit profile Sanctions action opens the separate
target tool and starts a fenced history read; merely selecting a person does
not fetch history. Later report-target changes invalidate old history responses.

Sources are `AdminUserWorkspace.tsx`, `AdminUserDetail.tsx` and
`AdminUserActionDialog.tsx` under `src/features/admin/components/`,
`src/features/admin/model/useAdminUsers.ts`, the canonical `admin.api.ts` and
`src/route-pages/AdminPage.tsx`. Scope and evidence are recorded in
`../tasks/admin-user-workspace-contract.md`,
`../tasks/admin-user-workspace-verification-2026-10-23.md`,
`../tasks/admin-user-workspace-finish-review-2026-10-23.md` and
`.impeccable/review/admin-users/report.json`. Supplied current-build evidence
(`HNJczQ2eCDHGpxYSm7UsU`) passed nine user behavior groups and regenerated all
12 required captures: eight profile theme/width cases at 320, 768, 1024 and
1440px, plus four intentional compact-dialog captures with viewport-bound
assertions. The parent opened all 12. Current-build admin mutation/CSV,
19-group/36-capture workbench, 14-group/26-capture reports and 30-group/eight-case
settings regressions also passed. Supplied final frontend validate, production
build and scoped diff checks passed. This persistence pass did not rerun them.
The linked finish review resolved all three listed material fixes and returned
`ship` only at that bounded three-fix scope; it is not a new whole-surface audit
or broader admin/app/live-backend approval.
Controlled frontend/transport evidence does not establish whole-admin/app
readiness, live Cassandra/provider, two-client, restart/crash or durable
reload recovery. No new dependency, raster, API shape or backend change.

### Admin report inbox and decisions

The report inbox extends the existing admin workbench with a compact loaded
queue, reading detail and a separate decision dialog. Native UTC day and status
controls, search and the written ceiling of 50 loaded reports lead the queue.
Search matches the same localized reason/target labels shown by the UI, plus
raw reason code, description, report ID and target-user ID, without case or
Vietnamese accent distinctions. It filters loaded results only. Keep skeletons,
read failure/Retry, successful empty results and no search match distinct; stale
day/status reads cannot replace the current queue.

Lucide user, message and conversation symbols support recognition beside a
localized reason and the actual report description. Unknown reason/target codes
remain raw text. Report text renders as untrusted text, with no invented person,
profile image, message preview, evidence or global count. From 1024px, list and
detail share the incumbent unequal columns and gap (2rem); below it, one pane
owns the view. Opening detail focuses its heading; Report list restores search
focus. Technical IDs and extra metadata live in a native disclosure. Keep the
target type beside status below the report heading, rather than above it.

Reuse neutral card/secondary planes, control/panel radii, the wrapping report
title (1.25rem), compact decision heading (1.125rem), row copy (0.875rem) and
subordinate metadata (0.75rem). Target symbols occupy the same compact footprint
(2.75rem) as room identities. Selected/hover rows use neutral state, a visible
focus ring and short background transitions (160ms); reduced motion disables
the transition. The shared protected-focus dialog supplies its existing motion.
No new palette, entry choreography or shipping raster is established here.

**The Report Decision Ownership Rule.** A decision owns its report snapshot,
intended next status, required reason and terminal resolution code. It never
borrows the sanction tool's reason or code. The dialog names Resolve, Dismiss or
Take review as an intended action; Dismiss confirmation uses destructive
treatment. Only OPEN can enter IN_REVIEW; RESOLVED and DISMISSED are read-only.
Preserve REPORT_MANAGE, the exact report/day/creation-key/current-status request
identity and audit reason. Recheck loaded identity/status before submission,
and accept success only for the exact returned identity and intended status.

Close/Escape keeps a nonempty memory-only draft with Resume; replacement or
discard requires explicit confirmation. Workspace switches retain the mounted
inbox. Busy state blocks repeated writes, scope changes, selection, close and
app-owned exit. Native unload provides a warning; app-owned Back confirms before
losing draft work. Neither protects every browser Back/Forward or arbitrary
route, nor persists a draft across reload/crash. Response application checks the
current actor user ID; these local controls do not establish server concurrency.

An unknown result, network failure, 5xx, 404, 409 or inconsistent mutation
response keeps the draft frozen against blind resubmission. Reload original
queue restores its day/status for inspection; it does not clear the frozen
decision or certify its outcome. Other write errors keep the draft and local
error feedback. This report flow has no idempotent command/retry guarantee;
application settings' exact-command retry pattern remains separate.

Selecting the report's target only pre-fills the separate sanction tool, clears
its prior history and fences late old-target reads. Applying a sanction has its
own explicit confirmation. Investigation and sanctions stay in secondary
disclosures below the inbox. No report decision automatically punishes an
account or fetches private message content; inspection remains an explicit,
authorized and reasoned action.

Sources are the three `src/features/admin/components/AdminReport*.tsx` files,
`src/features/admin/components/report-labels.ts`,
`src/features/admin/model/report-decision.ts`, `src/route-pages/AdminPage.tsx`
and the scoped rules in `src/index.css`. Direction and evidence are recorded in
`../tasks/admin-report-inbox-contract.md`,
`../tasks/admin-report-inbox-verification-2026-10-23.md`,
`../tasks/admin-report-inbox-finish-review-2026-10-23.md` and
`artifacts/ui-audit/current/admin-reports-report.json`.
The final corrected packet (BUILD_ID `dwpT0OuT_A191OhK3EWcw`) records validation
and production-build success, 14 controlled browser groups and 26 regenerated
captures across 320/768/1024/1440px in both themes. Coverage includes English
`scams` search, terminal/unknown-result states, two explicit report fixture
writes and zero sanction side effects. All 25 model assertions pass, including
English `scams` and accent-free Vietnamese `lua dao` visible-label regressions.
At the close of that earlier report-inbox increment, no production source had
changed after its build. The later visual continuation has its own record below.
Supplied admin mutation,
room-image (18 groups) and settings (30 groups) regressions retain their own
recorded scope; the admin run verifies separate report and sanction reasons/
codes, including the explicit sanction reason-code assertion. The bounded finish
verdict belongs to the linked review; this persistence pass does not certify it.
Controlled transport/browser evidence does not establish whole-admin/app,
live Cassandra/provider or two-operator
acceptance. Concurrent report transitions and crash-safe audit recovery remain
backend work; queue reload does not make either safe.

### Sticker catalog and draft editors

Sticker administration extends the existing operator controls and theme tokens.
Use a two-column, image-led catalog shelf with contained covers above the pack
name and an explicit published/unpublished label. Neutral hover/selection
(160ms), a visible focus ring and short cover transform feedback (180ms) support
browsing; reduced motion disables those transitions. Missing or corrupt covers
receive the named local fallback, and changed cover URLs reset failed-image
state. No artwork is invented. From 1024px, catalog and editor sit beside each
other. Below 1024px, one pane owns the view: selecting a cover or Create reveals
the real editor and focuses its heading. Sticker pack list returns to the
invoking catalog button, or the catalog heading if that trigger no longer exists.
Hiding the same mounted editor for this return preserves its draft on reopen;
this does not add general draft recovery across pack switches, navigation or
reload. The editor's artwork inventory uses two columns, then three from the
small breakpoint.

Keep loading, empty, error and save feedback beside the affected list or form.
Pending uploads and commands lock conflicting controls. After a revision
conflict, explicit reload shows the current server fields alongside the preserved
draft, including publication state and artwork; pack comparison also includes
the official flag and cover. An uncertain save retries the same command with its
draft locked. A confirmed save followed by a failed read offers reload without
resubmitting. Catalog removal uses a confirmation that explains soft
deactivation and retained artwork/history. Drafts and retry commands live only
in memory; do not imply they survive navigation or refresh. The conflict and
server-comparison pattern is inherited behavior, not a redesign or new approval
from the visual-affordances correction.

### Member sticker picker and history

The member picker is a bordered, theme-token shelf above the composer, with
horizontal pack choices and neutral selected state. Its contained artwork grid
uses three columns, then five from the small breakpoint (640px); the shelf
scrolls within the viewport (60dvh). Keep artwork's own colors and aspect ratio.
Compact headings, labels and existing buttons retain the conversation's type
hierarchy. Explicit load-more buttons consume opaque cursors for packs and items.

Keep loading, list errors, empty states and send recovery beside their affected
content. Sending preserves the text draft; failed sends recover from the failed
message. Closing, including Escape, returns focus to the composer textarea.
Members choose from the member catalog without catalog editing or upload controls.

Historical sticker images load through the conversation-authorized message
endpoint after entering the viewport; changed message identity or unmount aborts
the request. Contain artwork within the message footprint, with a named
unavailable state for absent images or denied/missing history (403/404), and an
explicit retry for transient fetch or image failures. Sticker messages omit
copy and edit actions. These patterns describe the local member surface;
notification previews and live backend/provider completion are separate work.

### GIF picker and history

Keep GIPHY results in their own composer shelf, never mixed with internal
stickers. Use a two-column grid, three from640px, within60dvh; preserve provider
order and artwork proportions. Previews start static and have an explicit motion
toggle. Search disclosure, loading, empty, quota and retry feedback stay beside
the affected field/grid; no decorative live badges or success toasts.

Opening from the content menu transfers focus only after that menu closes.
Image retry restores focus to the corresponding GIF choice. Selection preserves
the composer draft. Use the unmodified official GiphyAttribution mark with its
own dark backdrop, rather than recoloring it to match Nối's orange. History has
separate play/pause and reduced-motion behavior. Blank provider key renders a
clear unavailable state and no provider request, not a simulated GIF catalog.

### Message reply panel

The reply panel extends the shared protected-focus dialog: a full-height layer
on mobile and a right-docked pane from the small breakpoint (640px), capped at
36rem. Keep the title and refresh action above one scrollable reading area,
with the independent text reply composer below. Use compact headings to separate
the original message from its chronological replies, with divided rows rather
than nested decorative cards. Reuse the shared read-only message renderer and
the room's bubble style.

Keep the reading plane opaque in app background/foreground tokens, including
sender names, section labels and status text. Custom room imagery belongs in
the outer gutters; room signal and its paired foreground belong to message
bubbles. Room-selected text colors must not override the reading plane's
contrast. The header and composer also use app tokens.

Show layout-matched initial skeletons, explicit refresh and load-more actions,
and local empty/error/retry feedback. Only render the authoritative full-key
parent and returned replies; denied or missing access clears that content.
Keep attachment navigation connected to the conversation's real media library.

Preserve the main composer draft while replying here. Lock the local draft for
an uncertain send and retry the same command; require discard confirmation
before leaving a nonempty reply. Closing restores focus to the main composer.
Use the existing VI/EN copy and shared focus treatment; the panel adds no entry
or exit animation. This is a local component pattern, not evidence of live
backend completion.

### Member forwarding and source reading

Forwarding extends Signal Relay's shared protected-focus dialog with an opaque
app-background reading plane, compact sans type and existing controls. Keep the
source preview above recipient search and the scrolling conversation list;
keep the explicit send/cancel footer outside that list. The preview is bounded
and scrolls independently. Mobile uses the full viewport height; from the small
breakpoint (640px), the dialog is centered, capped at 36rem wide and the shared
85vh maximum height. Use the existing border, shadow and desktop panel radius.

Recipient rows use quiet neutral hover and selected backgrounds, wrapped names,
visible focus and a check alongside the selected name. Choosing a row never
sends; changing search clears the selection. Keep headings at the shared dialog
title size, body and actions compact, and sender/attachment labels subordinate.
Room imagery and room-specific text colors must not replace this reading plane.
The dialog content adds no entry or exit animation.

Show source skeletons, directory paging, empty states, errors and retry actions
beside the affected content. Success stays inside the dialog. An attempted send
locks its destination and snapshot; an uncertain result retries the same command
and client ID. Closing that uncertain attempt requires the explicit warning that
retry state lasts only while this screen remains open and sending again may
duplicate it. Do not imply recovery after navigation or refresh.

Source reading renders only the authorized response, clears prior content on
reload, and revalidates on window focus and block-list changes. Unavailable
source stays a local named state. Attachment actions open the actual source
conversation's library. Both dialogs preserve the main composer draft and
restore focus to its textarea on close. Use existing VI/EN copy and inline
feedback without success toasts. This records the local member pattern; it does
not establish live backend or Cassandra verification.

### Opening an unknown conversation

Keep summary loading and failures inside the conversation area, with the shared
app background/foreground, Button and Skeleton. Retain a named back-to-list action
and the surrounding navigation; a failed summary must not masquerade as an empty
room or expose a composer/call control. Transient failures offer retry, while
denied/missing/invalid links explain availability without claiming deletion.

Announce errors locally and move focus only when the current entry owns it.
Returning to the list restores focus to search. Semantic errors translate in
place when the app language changes. No toast, decorative art, new modal or motion
is needed. This is the summary-entry pattern; known-room history errors and global
incoming-call UX have separate implementation/acceptance boundaries.

### Direct-call discovery and recovery

Keep call feedback in the existing conversation panel, using app theme tokens
rather than room imagery/text overrides. A point read on DM entry/reconnect shows
inline checking or error/retry feedback. Keep eligible header call controls
visible but disabled until discovery succeeds; absence needs no extra notice.

A recovered ringing call addressed to this member offers the normal explicit
answer/decline controls. Other recovered nonterminal calls say that this tab has
no mic/camera connection; do not imply media resumed or blame another device.
Use a clearly named end-call action with pending feedback and confirmed terminal
state, not a "Close" control that silently ends a call. Viewing/leaving these
unattached states must not send leave/end. Never acquire devices automatically.
Reuse current panel spacing, typography and VI/EN resources; add no animation.

### Incoming-call notice

Extend the protected app with one quiet, nonmodal notice for a ringing call
outside the visible DM. Use an opaque app-card surface, app foreground/border
tokens and the established panel radius; room imagery and custom room text
colors do not override it. Below the medium breakpoint (768px), keep both side
insets at 16px and place it above mobile navigation (80px plus the bottom safe
area). From 768px, anchor it bottom-right with a bounded width (384px), right
inset (16px) and bottom inset (24px). Keep internal padding (16px) and the icon
and text gap (12px).

Reuse the sans family, compact semibold call-type title (14px) and wrapping
caller line (16px, 24px line height). Use the existing Lucide voice/video icon
(20px), shared small primary Button to open the conversation and shared ghost
icon Button to hide the notice. Retain their hover, active and visible keyboard
focus treatment. Announce the text politely without taking focus or blocking
the page. The notice adds no entry/exit animation, sound or success toast.

Show a caller name only when the authorized DM peer matches the event's caller;
otherwise use the existing generic invitation to open the conversation. Preserve
VI/EN copy. Opening navigates to the actual DM; answering remains an explicit
action there and never acquires media automatically. Hide is local dismissal,
not decline. Do not duplicate the notice while that DM is visibly open, or show
blocked callers, hidden, accepted, terminal or expired calls. Auth loading and
initialization errors suppress this surface; only protected pages opt in.

Checking, connection-waiting, incomplete and lookup-error feedback occupy this
same opaque plane. Keep checking/waiting copy compact and muted (14px, 24px line
height), incomplete copy compact (14px, 24px line height), and actionable error
copy at the caller-line size (16px, 24px line height). Use status announcements
for progress and an alert for failure. If a ringing call is already visible,
retain its Open conversation action and put feedback below it, separated by the
app border with top spacing (16px) and padding (12px). Use shared small outline
Buttons for retry or explicit continuation and the shared ghost icon Button to
dismiss an error locally. Dismissal is neither successful absence nor decline.
Successful absence removes lookup feedback without a toast or focus change;
never add a second overlapping notice.

On protected entry and reconnect, register the participant-private subscription
before the authenticated pending-call lookup. Merge canonical callee-scoped
RINGING snapshots from HTTP and private STATE through the same versioned inbox;
an omitted HTTP entry does not erase an observed call. Follow filtered-empty
pages, pause after eight pages for explicit continuation, and start retry or
reconnect from a fresh traversal head. Repeated/invalid cursors, the finite
cursor guard (128 cursors), and lookup failures produce actionable feedback,
never successful absence.

The session inbox is memory-only (128 distinct call states), cleared on logout
or actor/session-generation change. Local hide and accepted/terminal replay
protection last only while an entry remains retained; eviction and reload do
not preserve them. A request already in flight can finish after disconnection,
and a missed terminal event can leave a notice until its fixed deadline. Opening
the DM revalidates authority before explicit answer controls. This pattern does
not promise gapless offline delivery, missed-call history or unlimited discovery.

Controlled local verification covered 85 API-adapter checks, 12 discovery
controller groups, 38 inbox checks and 49 production-browser groups with 36
discovery reads and zero unexpected console/page/request failures. TypeScript,
ESLint and the production build passed. Seventeen captures cover recovered
ringing and lookup errors at 320/768/1024/1440px in both themes, plus English
error feedback at 1440px. The scoped finish review requested this documentation
correction; the reviewer scored that sole persistence fix resolved, disposition
ship at that scoped verdict. This evidence does not
establish live Cassandra, broker delivery, two-client or media-provider
acceptance. No new shipping raster is part of this pattern.

### Member call history and participant facts

Own history opens beside the chat-list filters; DM history opens from the
header's advanced menu independently of eligibility to start a new call. Keep
one shared protected-focus dialog over the preserved conversation/composer.
Its opaque app background/foreground reading plane fills mobile height; from
640px it centers at a maximum width of 36rem and maximum height of 85vh. Use
the shared desktop border, radius and shadow. Room imagery and room-selected
text colors do not tint this plane.

Keep the compact title and upper-right close above a wrapping month/refresh
toolbar and one scrollable list or detail view. Anchor close in an absolute
wrapper so the shared Button's positioning cannot turn it into a layout row;
reserve header space for it. Reuse the shared sans title (18px semibold),
compact body/actions, subordinate timestamp/identifier labels and Lucide icons.
Divided rows have neutral hover/active states and visible focus. A missed-call
icon may use the existing destructive token; the written outcome carries the
meaning too. The native month input uses the app's light/dark color scheme.

Choose an explicit UTC month from January 1970 through the current UTC month;
retain UTC labels on list and detail timestamps. Load-more is explicit, even
after a filtered-empty page. The reader merges exact room/call identities by
version and bounds reading to 250 entries and a finite 128-cursor/cycle guard.
Reaching a bound says reading is incomplete and offers reload or another month;
it never implies that all history was read. Skeletons, empty states, alerts and
retry stay beside their affected content. Refresh/retry and window focus clear
and revalidate the current list or exact detail. Failed reads clear prior
content; actor/session, room/month and request ownership fence late responses.

Detail replaces the list with the two authoritative caller/callee roles,
actual identifiers and initiation/consent timestamps. Preserve incoming MISSED
versus outgoing UNANSWERED and distinct cancellation/decline outcomes. Use a
peer name only from an existing authorized DM summary with the exact matching
peer ID; otherwise use neutral call/participant labels. Consent does not prove
audio/video connection. Do not infer talk duration, joined/left events, profile,
presence, deletion status or callback eligibility from these facts. History
contains no callback action, call command or automatic media acquisition.

Moving between list and detail focuses the title; Back reloads the selected
month. Escape/close returns focus to the own-history trigger or DM menu trigger.
The reading state is memory-only and requests abort on scope cleanup. Use VI/EN
resources and shared control states; the dialog content adds no entry/exit
motion, success toast or shipping raster.

Controlled evidence covered 111 adapter checks and 19 reader groups; regressions
covered 32 call, 39 workspace and 49 incoming-call groups with 36 incoming
discovery reads. After the final close-wrapper correction, TypeScript, ESLint
and production build passed, and 17 production-browser groups passed with 33
history reads. All 17 final captures were refreshed and checked; upper-right
close bounds and contrast assertions passed. There were no errors or request
failures; one incumbent presence.subscribe-disconnected warning during reload
is explicitly recorded. The reviewer scored both listed material fixes resolved
and returned ship only at that two-fix scoring scope; this is not a new
whole-surface audit or app completion. Evidence and the bounded verdict are in
`../tasks/call-history-ui-verification-2026-10-23.md` and
`../tasks/call-history-ui-finish-review-2026-10-23.md`. This local pattern
does not establish whole-app completion or live Cassandra, broker, two-client,
restart/crash or media-provider acceptance.

## Shared brand and art assets

- `src/shared/ui/Brand.tsx` owns the mark/lockup.
- `src/shared/ui/BrandWord.tsx` owns the reusable `Nối` word treatment inside
  translated copy.
- `public/noi-mark.svg` is the canonical app mark; `public/noi-signal-orbit.svg`
  is reserved for loading and empty states.
- `public/noi-relay-hero.png` is the single landing hero image. Do not repeat it
  inside product panels.
- `public/noi-community-settings.webp` is the specific authored decorative
  exception for application settings: built-in generated abstract paper/clay
  community art (640×640, alpha, 66,564 bytes), not actual members, usage or
  service status. Keep its empty alt text and decorative wrapper, reserved-space
  BrandMark failure fallback, exact prompt sidecar and provenance in
  `../docs/brand/noi-community-settings-art.md`. It does not expand the landing
  hero, room-identity or other product-image policy.

## Landing art direction

The landing uses a split hero and a generated Nối signal image at
`public/noi-relay-hero.png`. Copy stays concrete and short. No decorative
version labels, fake metrics, generic logo walls, repeated eyebrows, or
duplicate CTA intents.

## Accessibility and verification

Target WCAG 2.1 AA contrast, keyboard-complete interaction, 320/768/1024/1440px
layouts, both theme modes, and Playwright smoke checks with zero console or
request failures. Browser and integration evidence belongs in `docs/TESTING.md`.
