# Admin report inbox and decisions

Continue the user's admin UX replacement: compact visual recognition and usable
actions, not UUID walls and hidden reasons. Operate-mode local extension.

- Read the existing status/day queue (at most50), show source bounds, search
  loaded results only, skeleton/error/retry/empty states, compact target icons,
  localized known reasons and honest raw unknown codes. Do not invent profiles,
  avatars, evidence previews or global totals. Report text is untrusted text.
- Desktop list/detail; below1024px one pane, explicit Back and focus return.
  Technical IDs and extra metadata live in native disclosures.
- Each report decision has its own frozen report identity, next status, reason
  and resolution code. Never use the sanction form's fields. Terminal reports
  are read-only; only OPEN can enter IN_REVIEW. Keep the server's exact request
  identity/currentStatus/day/createdAtKey and existing REPORT_MANAGE authority.
- An explicitly named protected-focus decision dialog is the confirmation.
  Required reason and terminal result code sit beside the action. Dismiss uses
  destructive treatment. Busy controls prevent repeated/scope-changing writes.
  No automatic retry, claimed idempotency or automatic account punishment.
- Close/Escape preserves a memory-only draft and exposes Resume; replacing it
  requires explicit discard. Workspace changes retain it. Native reload and
  application Back warn; busy exit is blocked. Current queue membership/status
  is checked again before submission. Read/write failures stay errors and keep
  draft, with reload instead of fabricated success. No reload/crash durability.
- Sanctions remain a separate explicit tool. Selecting a report target only
  sets the target; it does not imply a ban or a resolved report. No audited
  message content is fetched without an explicit authorized investigation.
- Verify model invariants, real browser layout/interactions at320/768/1024/1440
  in both themes, English, keyboard/focus, separate reasons, late/error reads,
  busy/repeated click, draft resume/discard/exit and exact mutation payloads.
  Preserve admin mutation/settings/room-image regressions. No Docker/provider IO.

The existing backend report transition spans status projections; this UX change
does not establish atomic concurrent claims or crash-safe audit publication.
Those are separate correctness work, not certified by a fixture queue.
