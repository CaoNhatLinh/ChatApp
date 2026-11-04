# Admin visual affordances — 2026-10-23

Request: useful visual content and effects in the actual admin UI, not more
prose, repeated boxes or decorative rules. This increment changes Overview,
application settings and sticker browsing; it does not change backend policy.

## Acceptance

- Overview shows recognizable room imagery from returned `avatarUrl` values,
  with a contained monogram fallback. Selecting a room opens its real detail.
  Report previews use localized reasons and actionable rows, not raw SPAM text.
- Saved settings have a community-shaped visual preview. Its access and
  capacity controls open the corresponding real editor by keyboard/touch,
  restore focus to that trigger, and never save by themselves. Unsaved values
  never masquerade as saved policy. Remove the ornamental Play/Pause action.
- Sticker covers lead browsing at a useful size; selected inventory remains
  the real editable pack. Below1024px, selection/Create focuses that editor;
  Back restores its trigger and reopening the same mounted editor keeps its
  draft. Do not invent artwork, members or aggregate totals.
- Keep existing draft, confirmation, permission, uncertain-save and audit
  behavior. Sparse data remains sparse; errors never become empty successes.
- Test VI/EN, light/dark, 320/768/1024/1440, keyboard focus, reduced motion,
  corrupt/absent images and the existing settings/report/room flows.

Implementation order: settings interaction and verification; overview/sticker
composition and verification; production browser matrix; bounded fresh finish
review and design documentation. No live provider/database mutation, new
dependency, commit or push is part of this increment.
