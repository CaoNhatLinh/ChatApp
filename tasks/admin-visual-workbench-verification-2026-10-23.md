# Admin visual workbench — controlled verification

Date: 2026-10-23. Scope: Nối admin overview, room directory/detail, activity
breakdown, user-result portraits, and their shared admin layout. This is not a
whole-app completion or live backend/database acceptance report.

## Changes and rationale

- Overview uses loaded rooms/reports instead of duplicating the navigation as
  icon/description tiles. Source scope and caps are visible; no global counts
  or fake room photographs are invented.
- Room directory has accent-insensitive name/ID search and all/active/archived
  filters over at most 100 loaded rooms. This is not server-wide search or real
  cursor pagination.
- Desktop >=1024px uses list/detail. Smaller screens use one pane with an
  explicit Back action and focus restoration. Details load authoritatively;
  a late response cannot overwrite a newer selection. Failed reads clear the
  previous room, not masquerade as a successful empty result.
- IDs/member IDs and management fields are native disclosures, not permanently
  exposed forms. Destructive confirmation, audit reasons and server permission
  checks remain. Dirty selection/month/Back transitions require confirmation;
  active mutation blocks selecting another room.
- Activity replaces repeated count cards with keyboard-selectable UTC day bars
  and an event-type breakdown. Values come only from loaded events (<=200);
  they are explicitly not system-wide totals. Failed reads clear old graphs
  and offer Retry.
- User results use the returned avatar URL with a text fallback. Room API does
  not expose an avatar URL; monograms are honest identity fallback, not a claim
  of newly supplied rich imagery. Existing Nối SVG is reused only in the
  unselected/empty reading plane. No new dependency or shipping raster.
- App tokens supply light/dark planes and text. Admin date/month inputs now
  receive the correct native `color-scheme`. New control-state transitions
  respect reduced motion. No decorative entrance animation or success toast.

## Evidence

- `npm run validate`: passed TypeScript + ESLint, no final warnings.
- `npm run build`: passed all 17 routes, production bundle generated.
- `node scripts/admin-room-directory-smoke.mjs`: 8 checks passed.
- `node scripts/admin-activity-smoke.mjs`: 8 checks passed.
- `admin-route-smoke.mjs`: controlled production browser regression passed:
  policy payload, archive/restore reasons, report resolution, sanction/revoke,
  role grant, account status, session/device revoke, audit CSV export. No
  horizontal overflow, unnamed controls, unlabeled fields, unexpected console
  errors or failed requests in that script.
- `system-settings-api-smoke.mjs`: 7 adapter checks passed.
- `system-settings-exit-smoke.mjs`: 6 state aggregation checks passed.
- Visual browser run: 17 groups passed over light/dark at320/768/1024/1440px;
  28 screenshots and machine report live at
  `chatapp_frontend/artifacts/ui-audit/current/admin-visual-report.json`.
  Includes search/filter, mobile single-pane navigation/focus, stale reads,
  dirty Back guard, day selection/reset, reduced motion, failed read/retry,
  native date theme, English labels and singular member count, populated user
  avatar URL and corrupt-image fallback. Four added captures explicitly show
  selected-day breakdown/reset and available/unavailable avatar states.
- `system-settings-browser-smoke.mjs`: 30 controlled production groups passed,
  including all 8 theme/width cases, clean/draft/uncertain exits and 8 save
  attempts producing 5 confirmed fixture commits. Expected 409, lost-response
  and 403 cases are recorded by that script; no unexpected page errors.
- Zero unexpected page/console/request failures. Three deliberate HTTP500
  responses and their three application warnings are recorded explicitly,
  not reported as clean happy-path network traffic.
- Impeccable detector ran once. Findings shown were incumbent global CSS color
  sidecar drift and a layout transition outside the new admin block. Its long
  terminal output was truncated; this is not a zero-findings global audit.

## Test-development corrections

Activity tests began RED (missing aggregation module). Its first transpilation
used TypeScript's ES5 default and mishandled Map iteration; the fixture loader
was corrected to ES2022. Browser stale-response assertion initially matched a
URL suffix and missed `?limit=100`; it now matches pathname before releasing
the response. Reduced-motion uses the existing global0.01ms override, not exact
zero seconds. None of these harness corrections weakened the product contract.
The device fixture was completed to the real typed registration response to
remove an unrelated fixture warning.
A settings-browser regression initially timed out against a production server
retained across a rebuild. After restarting the owned server against the new
bundle, all 30 groups passed. This was not treated as product acceptance until
that successful run.

## Boundaries / final review

All requests above use controlled fixtures. No live Cassandra, provider,
two-client, restart/crash, performance or whole-admin accessibility acceptance
is claimed. Existing app-settings command identity, conflict/uncertain-save
and exit logic are preserved, not reimplemented. Backend, schemas, secrets,
Docker, Skipli and Git history were not changed in this UI increment.

Independent finish review is recorded separately in
`tasks/admin-visual-workbench-finish-review-2026-10-23.md`. Its final disposition
and any remaining imagery/UX limitations must be reported at that actual scope.

Final verdict pass: `ship` for the three listed material fixes only. Reviewer
reopened all 28 required captures and scored avatar/fallback evidence, visible
day selection with selected-state evidence, and design persistence resolved.
Richer room imagery remains unresolved; neither the whole surface nor the
whole user request has been certified complete. The final correction batch
passed validate, production build and the17-group/28-capture production smoke.
The owned local preview server was stopped after verification.
