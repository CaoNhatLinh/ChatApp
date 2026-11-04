# Authoritative pin reads and empty search continuation

## Scope

Message point, bucket and paged history reads, thread parent/replies, shared
content source and forwarded source now derive `isPinned` from the canonical
conversation pin snapshot. Membership/block/deletion checks remain in place.
Each returned page uses at most one pin-state lookup, not one per message.
Unchanged messages retain identity; tombstones remain redacted.

Search no longer prefilters candidates using Elasticsearch `isPinned`, which
could discard valid results after delayed projection. It validates each current
message and filters pin status using one authoritative snapshot per candidate
page. Cursor progression remains based on raw candidates. Therefore an empty
visible page can have `nextCursor`; the dialog now explains this in VI/EN and
offers continuation. Mobile search content aligns at the top rather than
stretching its header across the viewport. OpenAPI documents this page contract.

## Files and reasons

- Backend `canonical/message/{MessageService,PublicMessageView,MessageThreadService,SharedContentService,MessageForwardSourceService}.java`: authority-backed public views without per-row pin lookups.
- Backend `canonical/search/MessageSearchService.java`: authoritative pin filter and preserved raw candidate cursor.
- Corresponding service tests plus `ChatReadHttpSecurityTest`: explicit canonical state fixtures, stale true/false projection coverage, source-room authority and bounded lookup assertions.
- Frontend `MessageSearchDialog.tsx`, i18n resources and `search-filter-smoke.mjs`: accessible empty-page continuation, mobile alignment and production browser regression.
- OpenAPI, ADR0027 and task/test/traceability documents: contract and limits.

## Observed checks

- Old-source regression tests failed on stale projected pin flags; new source passes.
- Full default backend suite: **774 tests, 124 fresh XML suites, zero failures,
  errors or skips**, filtered after 2026-10-23T07:03:32Z. No stale IT XML counted.
- Final frontend `npm run validate` (type-check/lint) and `npm run build`: pass.
- Final production interaction regression: pin/unpin observed revisions 0/1,
  reactions, receipt pagination, mention and reply pass without reported console
  or request errors. A mistyped script filename initially failed before running
  that regression; the existing `message-interactions-smoke.mjs` then passed.
- Production Chromium search baseline: one request, result selection closes
  dialog, no reported console/request errors.
- Empty-page Chromium: first page empty with cursor; Enter on continuation
  requests `candidate-page-2`, displays/selects its result. All 320/768/1024/1440
  light/dark cases fit horizontally. Eight screenshots under
  `chatapp_frontend/artifacts/ui-audit/current/search-empty-continuation-*.png`.
- Test-development failures retained: old build had no continuation button;
  initial theme assertion incorrectly expected `data-theme=light` (the provider
  removes that attribute in light mode). Corrected harness, not production theme.

## Not proven or completed

Browser data is controlled; no real Cassandra/Elasticsearch/broker/provider was
used. Docker is explicitly deferred by the user. Stored `messages.is_pinned`
repair, mutation-response projection flags, deleted pin-slot cleanup, durable
publication/replay and live concurrency/crash acceptance remain open. Bounded
search can need several continuations; no unbounded scan-until-match was added.
No CQL, dependency, environment, provider, commit or push change in this increment.
