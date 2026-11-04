# Admin settings finish review — 2026-10-23

## 1. Disposition

**Fix.** Keep the current composition and Signal Relay direction. Three bounded
behavior/accessibility corrections are required before the scoped UI verdict can
be ship. A rebuild or another visual concept is not warranted.

This was an independent source-and-capture finish review. Runtime source was not
edited by the reviewer. The supplied pass counts were treated as supporting
evidence, not as a substitute for inspecting the result.

## 2. Prioritized material findings and concrete fixes

### P1 — Refresh does not refresh the visible settings

`chatapp_frontend/src/route-pages/AdminPage.tsx:909` sends the pagebar Refresh
action only to `loadOverview(true)`. That function reads admin overview and
health, not the settings catalog. The settings panel stays mounted with the same
actor key (`:931`), and its load effect runs only at mount
(`features/settings/ui/SystemSettingsPanel.tsx:38`). Switching workspaces also
preserves this panel. Consequently, another operator can change creation policy
or the member limit, and clicking Refresh still shows the stale saved rows and
saved-policy diagram.

**Fix:** make the visible Refresh action revalidate this workspace's canonical
settings, with an explicit policy that preserves existing drafts and frozen
uncertain commands. Alternatively, remove the unrelated action from this
workspace and provide an accurately named settings reload action. Do not remount
the panel and silently discard its draft/retry state. Add one controlled check:
change the fixture's authoritative values after initial load, activate Refresh,
and assert an additional settings read plus updated rows/preview; check that a
retained draft or uncertain command survives that action.

### P1 — The mobile back-to-app control has no accessible name

`route-pages/shared/layout/AdminPageShell.tsx:35` renders the exit Button without
an `aria-label` or `title`. Its arrow is `aria-hidden`, and the only text span is
`display: none` below 768px (`src/index.css:818`). The resulting icon button has
no accessible name on the exact mobile layout represented by the captures.

**Fix:** add the localized back-to-app `aria-label` directly to the Button, or
keep equivalent screen-reader-only text when its visual label disappears. Assert
the control can be found by its VI/EN accessible name at 320px and still performs
the existing exit action.

### P2 — Dialog close is a 16px target on touch

The settings editor inherits `shared/ui/Dialog.tsx:46`: the close button has no
width, height, or padding and contains a 16px icon. The small target is visible in
`system-setting-editor-light-320.png` and the recovery captures. This matters
more than a cosmetic detail: in conflict and uncertain states, Cancel is
disabled, so close is the visible non-destructive way to return while retaining
the draft/command.

**Fix:** give this close control a 44px square hit area while keeping the icon
small, reserving title space, and preserving focus restoration and busy-close
blocking. Scope the adjustment to the settings dialog if changing the shared
control would create unrelated layout risk. Verify computed bounds and a touch
close/reopen in conflict or uncertain state; the same draft/retry command must
remain intact.

## 3. Capture and behavior coverage

Visually inspected together:

- Both supplied rejected desktop/mobile screenshots in the local Temp folder.
- VI initial state: `admin-settings-first-desktop.png` and
  `admin-settings-first-mobile.png`.
- All eight list captures:
  `system-settings-{light,dark}-{320,768,1024,1440}.png`.
- `system-setting-editor-light-320.png` and
  `system-setting-editor-dark-1440.png`.
- `system-settings-conflict-vi.png`, `system-settings-uncertain-vi.png`,
  `system-settings-pending-vi.png`, and `system-settings-forbidden-en.png`.

These files are under `chatapp_frontend/artifacts/ui-audit/current/`, apart from
the two explicit Temp anti-references. The inspected captures were dated
2026-10-23 around 16:22 local time. Themes, typography, geometry and content
correspond to the inspected source.

The full list matrix has no visible overflow or lost Edit control. Both rows
appear before the supporting diagram. Mobile uses one native workspace selector;
desktop uses one compact vertical navigation. At 1024px the diagram grows below
the rows, but it does not obstruct the primary actions. Wide desktop leaves
space rather than inventing additional settings to fill it.

Source review covered the admin shell/workspace orchestration, settings panel,
editor, editor state model, preview, Switch, ModalShell/Dialog, and the relevant
admin/settings CSS. The editor uses a real switch and integer input; the reason
appears only when needed. Saved state drives the diagram rather than the draft.
The diagram reuses BrandMark, contains no fabricated activity, and has a real
Play/Pause button, fine-pointer hover behavior, offscreen guard and reduced-motion
rule. The editor retains local state across dialog/workspace close, freezes an
uncertain command, and restores focus to Edit through the shared modal boundary.

The supplied controlled browser script was inspected. It covers initial read
failure/retry, boolean keyboard input, pending close blocking, numeric bounds,
draft retention across workspace switches, defaults/cancel, confirmed save,
audit-pending feedback, 409/reload failure/reload, lost-ack same-command retry,
later authority, preview state, Play/Pause/reduced motion, both themes and four
widths, permission loss, focus return, and unexpected runtime failure checks.
Its current assertions do not exercise the three findings above.

Reported implementation evidence: 17 browser scenario groups with no page
errors, seven adapter checks, copy/locale/validate/build passes, admin/sticker
regression passes, and a clean detector result on seven TSX targets. Those
commands were not rerun by this reviewer. The detector did not scan global
`index.css`; the relevant CSS was manually inspected here.

## 4. Limits

This is a scoped finish review of admin chrome, overview entry and the two real
application settings. It is not a whole-admin or whole-app approval, live backend
acceptance, or an independent rerun of the full test suite. Screen-reader and
physical touch-device use were not executed; the name and close-target defects
follow directly from the source and captures.

Actual Cassandra/Docker, two-client, broker and restart/crash acceptance remain
deferred. Memory-only drafts and exact-retry commands do not claim persistence
after leaving the SPA route or reloading. No new shipping raster or approved
external comp is part of this work; the visual asset here is geometric SVG plus
the existing shared brand mark.

After the one correction batch, review only the corresponding changed controls,
behavior assertions and refreshed mobile/desktop/recovery captures. Do not start
another open-ended design pass.

## 5. Verdict rationale

The rejected screenshots made operators pass through a large hero, role/permission
counters and repeated context before reaching permanent forms. The current
interface removes those obstacles, brings the two actual operations into the
first viewport, and uses protected-focus editing to keep the list readable.
Concise recovery copy remains attached to the affected edit. The preview adds an
authored Signal Relay moment based on actual saved policy without pretending the
catalog is larger than it is.

The design therefore meets the direction sufficiently to keep. The remaining
work is to make Refresh match its promise and make the mobile exit/close controls
usable and named. **Fix these three items, then return for the bounded verdict.**

---

## Correction-batch verdict — 2026-10-23

**Current scoped disposition: ship.** This addendum supersedes the initial
fix disposition above. It scores only the three requested corrections; no new
design audit or whole-surface approval is implied.

| Original finding | Score | Evidence inspected |
| --- | --- | --- |
| P1: Refresh does not refresh settings | Resolved | The generic pagebar refresh now appears only on Overview. `SystemSettingsPanel` owns the localized Refresh settings action and calls its actual catalog `load()`. Each child reports `model.needsWarning`; a nonempty pending set disables refresh and supplies a localized explanation. The controlled browser assertions change canonical capacity to 500 then 250, require one additional catalog read each time, and assert both row and preview update. Retained-draft and uncertain-outcome assertions require refresh to stay disabled. |
| P1: Unnamed mobile back-to-app control | Resolved | `AdminPageShell` now supplies the localized back-to-app `aria-label` directly on the existing Button and retains the same exit handler. The mobile text-hiding rule no longer removes the accessible name. The browser assertion finds Back to app at 320px. CSS also provides a 44px minimum height and mobile minimum width. |
| P2: Dialog close has a 16px touch target | Resolved | Shared `DialogContent` now renders close as a centered 44px square with the same 16px icon and existing name/focus behavior. The test measures width and height at least 44px after the dialog capture settles its entrance animation. It closes an uncertain attempt through the actual close control, reopens it and confirms the exact frozen retry payload is retained. Existing busy-close blocking and focus restoration remain in place. |

Scoring totals: **3 resolved, 0 partial, 0 unresolved.**

For this bounded confirmation, inspected the revised source and the refreshed
`system-settings-light-320.png`, `system-settings-dark-1440.png`,
`system-setting-editor-light-320.png`,
`system-setting-editor-dark-1440.png`, `system-settings-conflict-vi.png` and
`system-settings-uncertain-vi.png`, dated around 16:31 local time. Desktop and
mobile remain coherent. The changed Refresh position remains clear; both Edit
actions still appear in the first viewport. The larger close target does not
visibly collide with the settings title or recovery content.

The revised browser script contains the requested authority-refresh, retained
work, close-target and mobile-name assertions. The implementer reports its final
20 scenario groups passing with no page errors or horizontal overflow, plus
validate/build and admin/sticker regression passes. Additional pinned-deletion
and poll-dialog regressions were reported after the shared close adjustment.
These commands were not independently rerun during this scoring pass. The
remaining live integration, persistence and whole-app limits in section 4 still
apply.

The correction batch matches the concrete remedies without reopening the visual
direction. No further source changes or recaptures are requested for this scoped
finish verdict.
