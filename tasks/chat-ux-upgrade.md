# Nối personal and community chat UX upgrade

Approved 2026-10-20: fix all five review issue groups; implement conversation filters,
authorized image/file/link library, and Ctrl/Cmd+K quick conversation opening.
Reference: chat-ui-comparison-2026-10-20.md. Preserve Signal Relay, not CRM.

## Route/state acceptance matrix

| Surface | Required states and behavior |
|---|---|
| /app history | Initial load; own send; incoming while following; incoming while reading; typing without scrolling; prepended history; deleted/edited message; room switch; reduced motion; date/unread boundaries from authoritative read marker |
| /app information | Desktop genuinely collapses; mobile overlay exits/focus returns; common actions discoverable; management permission-scoped |
| /app conversation list | All/unread/pinned; remote query and bounded cursor pages; query+filter intersection; loading/error/retry/empty; stale response cancellation; pin doesn't select row; touch/keyboard |
| /app quick opener | Ctrl/Cmd+K; visible trigger; dialog focus/Escape; recent/default results; remote search/paging; keyboard selection; disabled/pending/error; no fake global message search |
| /app shared content | Images/files/links; conversation authorization; cursor paging; source-message jump; deleted content excluded; safe URLs; loading/error/retry/empty; membership loss |
| Appearance | Follow-app default; explicit room override preserved; light/dark and bubble metadata contrast; dialogs use correct theme; clear personal scope |

## Ordered slices

- [x] U1: Reading position, real panel close/focus, mobile search, readable message status, native list controls (controlled browser coverage; full theme/device gate remains U6).
- [x] U2: Canonical paginated conversation search/filter contract, backend implementation/tests, list and Ctrl/Cmd+K integration (controlled acceptance; live datastore and additional cancellation/error stress remain U6).
- [x] U3: Canonical authorized shared-content contract/query, images/files/links UI and authorized source-message view, controlled tests (live storage gate remains).
- [x] U4: Authoritative entry marker, viewport/visibility-aware acknowledgments, date/catch-up controls and projection repair; controlled regression coverage (live concurrency/crash gate remains).
- [x] U5: Persisted follow-app default, explicit custom overrides, room-scoped contrast and acknowledged draft/save; paired controlled theme verification.
- [ ] U6: Full frontend/backend checks, controlled browser acceptance 320/768/1024/1440 in both themes, live-infrastructure gates explicitly recorded; design finish review/documentation.
  - [x] Local frontend/backend checks, controlled browser matrix, screenshot inspection, review and documentation.
  - [x] Real MVC mappings and production JWT/security filter chain: eight controlled HTTP tests (repository/account boundaries mocked; not a live session-refresh test).
  - [ ] Live Cassandra/storage/security-session/two-client concurrency acceptance (Docker engine unavailable; user will install later). Opt-in executable gate: `docs/testing/chat-cassandra-acceptance.md`.

## Invariants

- Never infer complete archive/filter/search results from loaded messages or rooms.
- Never replace member-specific archive with global room archival, or pin with favorites.
- Reuse canonical repositories and membership authorization; no unrestricted search/media endpoints.
- No public provider calls, synthetic production content, secret output or unrelated cleanup.
- Keep existing uncommitted feature work intact. No commit/push without explicit request.
- A completed controlled test is not a live Cassandra/provider acceptance claim.

## U2 contract (implemented; live datastore gate pending)

Extend GET /api/conversations with q (name or DM peer username/display name,
maximum100 characters) and filter=ALL|UNREAD|PINNED. Both list and quick opener
use this member-scoped source, not the rooms currently cached in the client.
Each request scans a bounded page of the caller's existing projection partition;
filtering may yield empty content with hasNext=true. The continuation is based on
the last scanned row, never the last matching row. UI must retain a load-more path
and must not say the search is exhausted while continuation exists.
Verify current membership before returning a projected room. DM display/profile
data must be public summary fields only. Cursor scope binds actor/query/filter.
No Elasticsearch dependency for conversation-name search; no new global message
search claim. Existing room message search retains its own runtime gate.
