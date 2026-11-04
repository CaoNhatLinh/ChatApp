# Admin room identity images — controlled verification

Date: 2026-10-23. This extends the historical admin visual-workbench record.
Scope is room identity data and its overview/list/detail portrait and viewer,
not whole-admin or whole-app completion.

## Delivered

- Existing admin summaries gain optional nullable `avatarUrl`, read from
  `conversations_by_id.avatar_url`. No new table, image projection or artwork.
  Monthly reads stay capped at 200 server-side, current UI 100. Only indexed IDs
  are hydrated, in groups of at most 32, preserving order. Missing image/row is
  null; failed image reads fail the list rather than fabricate absence.
- Detail/policy/archive copies preserve the image. ROOM_READ stays ahead of
  repository access and existing ROOM_MODERATE commands are unchanged. List/
  detail GETs are no-store; this does not revoke public image URLs/CDN caching.
- Shared `AdminRoomPortrait` reserves space, keeps a monogram during loading or
  image failure, uses lazy decoding/no referrer, and resets after URL changes.
- Explicit native image button opens the protected-focus shared modal, with
  token-based light/dark plane, contained image, loading and inline error/Retry.
  Escape/close returns focus. Opening/closing never drops a room policy draft.
- New summary uses OpenAPI 3.1 string/null unions. Parsed YAML tests cover the
  additive image, list/member bounds and no-store headers alongside MVC tests.

## Evidence

- Repository 6, HTTP/OpenAPI 4 and service 4 tests pass (14 total). Repository
  checks cover indexed-only hydration, order, 32-ID batches, 200 cap, empty/
  missing data, error propagation and copies. This is a controlled CQL harness,
  not a real Cassandra execution or performance benchmark. HTTP runs actual
  controller/service/advice/Jackson with controlled auth/storage, not full JWT.
- Final `./mvnw.cmd -q test`: exit 0, 866 tests in 137 fresh suites, 0 failures,
  errors or skips, JDK 20. Reports refreshed 18:21:55–18:22:25 local time. The
  stale failing October 20 `ChatReadCassandraIT` XML is excluded from these
  totals. Docker integration profile was not enabled.
- `npm run validate`: exit 0 (TypeScript and ESLint). Production bundle
  BUILD_ID `T0fdoYlsWuZuSN4beKt7Z` successfully served by Next at port 3117;
  no UI source changed after that build.
- `node scripts/admin-visual-workbench-smoke.mjs`: exit 0, 18 controlled groups,
  36 captures at 320/768/1024/1440px in light/dark. List/detail/viewer each have
  all eight combinations. Manifest:
  `chatapp_frontend/artifacts/ui-audit/current/admin-visual-report.json`.
- Available/missing/corrupt/replaced-image recovery, keyboard viewer/focus,
  draft preservation, single-pane Back, stale/error reads, filters, day select/
  reset, user portraits, reduced motion and English labels are covered.
  Zero unexpected page/console/request failures or warnings. Three deliberate
  HTTP 500 errors and their three application warnings remain recorded.
- Fresh reviewer opened all 36 captures and accepted validity. Its initial
  sole required fix is stale DESIGN guidance; final scoring is recorded in
  `tasks/admin-room-image-finish-review-2026-10-23.md`. No new shipping raster
  or second detector pass was introduced in this extension.

## Corrections / limits

The viewer bounds test first measured its opening animation mid-flight. It now
awaits finite animations before reading bounds, without ignoring real overflow.
Explicit `p-4` was added because ModalShell's shared `p-0` otherwise overrides
component padding. Skeleton's containing status owns its accessible label;
Skeleton does not accept a role prop. A new parsed-schema assertion exposed
3.0-style nullable syntax in the new 3.1 summary; it is now corrected. A test-only
AssertJ wildcard compilation issue was fixed before recording that RED assertion.

Browser data/images are explicitly synthetic, reusing the existing default
avatar only to prove rendering. No fixture is shipped as room photography.
No live Cassandra/provider, two-client, crash/restart, CDN revocation,
performance or whole-admin accessibility acceptance. Docker remains deferred.
No migrations, secrets, Git history, provider or Skipli changed here.

Sources: canonical schema/write path;
[Cassandra SELECT](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html#select),
[OpenAPI 3.1 schema dialect](https://spec.openapis.org/oas/v3.1.0.html#schema-object).
The 32-ID cap is an application bound, not measured production optimization.
