# Admin report inbox — controlled UX verification

Date:2026-10-23. Contract: `tasks/admin-report-inbox-contract.md`. Scope is the
report list/detail/decision path and its separate sanction target handoff,
not whole-admin or whole-app completion.

## Changed behavior

- Replaced report UUID/card/action walls with a bounded day/status/search list
  and selected detail. Shared theme tokens and Lucide target symbols identify
  user/message/conversation; no invented profiles, photos or evidence preview.
  At1024px+ both panes show; below1024px Back restores search focus. Identifiers
  are behind native disclosure. Unknown reason codes stay honest raw text.
- Each decision owns its frozen report/day/creation key/current status, intended
  next status, reason and result code. It no longer borrows the sanction form's
  reason/code. A protected-focus dialog is the explicit confirmation. Intent
  labels use verbs, not premature “Resolved” success claims. Terminal entries
  are read-only and IN_REVIEW is offered only for OPEN.
- Close/Escape keeps a memory-only draft with Resume. Replacing/discarding asks
  explicitly. Workspace switches retain it; app-owned Back asks before leaving;
  native unload protection is registered only while draft/busy. Busy Escape,
  repeated submission and exit cannot start another operation. Actor changes
  fence response application. Success clears only the exact returned identity.
- Errors retain the draft. Network/5xx/404/409 or inconsistent responses block
  blind resubmission; reload checks the original queue without inventing a
  success result. No automatic retry or durable command recovery is claimed.
- Selecting a report target only pre-fills the separate sanction tool. Explicit
  confirmation now precedes applying a sanction. Changing target clears history
  and fences late selected-user sanction reads. No report decision automatically
  sanctions a user, fetches private message content or changes a room.

## Evidence

- Model began RED because the new module did not exist. Current decision,
  loaded-search and label model:25 assertions pass, including the review's RED
  English `scams` and accent-free Vietnamese `lua dao` visible-label regressions.
- `npm run validate` and production build pass (17 routes), final BUILD_ID
  `dwpT0OuT_A191OhK3EWcw`. No UI source changed after that build.
- Production-browser report suite:14 groups,26 captures, two explicit fixture
  report writes, zero sanction side effects. Includes eight width/theme cases,
  separate reasons, native/app-owned exit, interrupted draft resume/discard,
  held-write repeated click/Escape, unknown result freeze, read failure/retry,
  late-day response, read-only terminal/English and late old-target history.
  Manifest: `chatapp_frontend/artifacts/ui-audit/current/admin-reports-report.json`.
- Zero unexpected page/console/request failures or warnings. Deliberate503 and
  500 console errors and one500 application warning remain recorded.
- Full admin controlled mutation regression passes: policy/archive/restore,
  report resolution, explicit warning/revoke, role/status/session/device and
  audit CSV. No overflow, unnamed controls, unlabeled fields or unexpected
  network/console errors in that script.
- Existing visual room-image/workbench regression:18 groups /36 captures pass.
  Settings regression:30 groups, eight theme/width cases, clean/draft/uncertain
  exits, eight fixture writes and five commits pass. Its expected409/lost-response/
  403 paths are not reported as clean happy-path traffic.
- Scoped Impeccable detector ran once on the three new report components and
  AdminPage: output `[]`, exit0. It is not a global CSS/design audit. No new
  dependency, image asset, provider IO, backend/schema or Git change here.

## Harness and review boundaries

First browser run completed assertions but rejected an incomplete synthetic
device response; fixture metadata was corrected to the real typed shape.
Initial admin regression used its default3100 instead of the owned3117 server;
the rerun used explicit SMOKE_BASE_URL and passed.

Fresh review rejected three misnamed list captures, not the UI: closing the
discard confirmation retained Radix aria-hidden briefly, so an immediate role
lookup skipped Back. The harness now awaits confirmation removal and visible
list/search before capture, then refreshes the full26-capture set. Initial
invalid evidence carries no fidelity approval; the subsequent full review and
its precise scope are in `tasks/admin-report-inbox-finish-review-2026-10-23.md`.
That full valid review requested visible-label search, removal of target-type
eyebrow hierarchy and design persistence. Search now consumes the same localized
reason/target labels rendered by the list; target metadata is beside status
below the heading, not above it. The final verdict scores those three fixes
only, not a new whole-admin audit.

Final verdict: `ship` at that three-fix scoring scope. Reviewer reopened all26
final captures, accepted their validity and scored all three findings resolved.
DESIGN/sidecar now persist the built pattern and limits. Model25, final browser14
and strengthened admin mutation regression pass against the final production
bundle. The owned3117 preview server was stopped after testing; no commit/push.

This is controlled transport/browser evidence, not real Cassandra, multi-manager
concurrency, audit crash recovery, provider or whole-admin accessibility proof.
The existing backend still locates a report by scanning at most200 status/day
projection rows, moves status projections without a conditional authority CAS,
and records audit after transition. These limitations need backend work; the UI
does not make them atomic or production-safe. Native reload protection does not
persist a draft across reload/crash or guard all browser Back/Forward routes.
Docker remains deferred; no live data, credentials, Skipli or Git history changed.
