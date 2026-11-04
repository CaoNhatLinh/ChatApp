# Database-backed capabilities

Started: 2026-10-12. Scope: the 13 previously unused canonical tables, not every conceivable feature.

## Rules

- Keep canonical authorities; secondary tables are query projections, not competing state machines.
- No fake delivery, generated sample catalogs, or automatic moderation without configured policy.
- Implement in vertical slices with authorization, bounded pagination, API contract, bilingual UI and tests.
- Never publish private-room reply/forward provenance to unauthorized users.
- Live Cassandra and browser evidence are required before claiming production readiness.

## Sequence and acceptance

### Route/state matrix

| Surface | Read states | Actions / constraints |
| --- | --- | --- |
| `/communities`, own requests disclosure | collapsed, loading, empty, ready, unavailable, partial refresh failure | refresh, cursor page, open approved room; preserve prior rows on fetch failure |
| `/app`, sticker picker / thread panel / call history | loading, empty, available, inactive/deleted, forbidden | browse/send, page thread/history; room access always checked server-side |
| `/settings`, server theme catalog | loading, empty, draft, preview, save pending/error | preview/cancel/save; renderer must support published presets |
| `/admin`, catalogs/settings/moderation | permission denied, loading, empty, ready, stale write, error | validated writes, audit, confirmations; room roles cannot grant global access |
| Notification delivery settings | unconfigured, disabled, consented, queued, accepted by provider, delivered/failed | no fake delivery success; provider acceptance and delivery are distinct |

1. Own join requests: write invite/community indexes; authenticated user can page only their own requests; read current authoritative status, no invite token exposed. Verify pagination ties, identity isolation and stale projection handling.
2. Sticker catalog: operator manages packs and validated accessible assets; users browse active packs, send and render stickers; deactivation prevents new sends but preserves history. Verify permissions, media ownership, retries and empty states.
3. Server theme catalog: publish supported renderer presets and previews; save/preview/cancel room preferences consistently. Metadata alone cannot define an arbitrary renderer. Verify light/dark and disabled themes.
4. Reply threads: maintain parent index through send/delete and repair; authorized, paginated thread view. Verify deleted parents, membership changes and idempotent sends.
5. Forward provenance: maintain source index with source/target access checks; privacy-safe bounded lookup. Verify cross-room disclosure and deletion.
6. Call history: persist lifecycle using fenced transitions; participant history, missed/end states, reconnect and timeout. Existing signalling alone is not proof of participation or media connection. Verify two-client race/disconnect and TURN capability gating.
7. Thumbnails: generate actual image derivatives from verified assets, authorize access and clean up with parent. Verify malformed media, failed jobs and deletion; video processing requires a configured runtime.
8. Global settings: define a small typed allowlist, permission checks, audit and versioned updates; no arbitrary configuration editor. Verify concurrency and invalid settings.
9. Notification delivery: provider adapters, durable delivery records, idempotent retry and channel consent. Blocked pending provider choice/configuration; never equate inbox creation with successful external delivery.
10. Moderation results: policy-versioned decisions, operator review, appeal/visibility semantics. Blocked pending policy; no automatic sanctions based on an unspecified rule.

## Dependencies and limits

The current schema is not sufficient for every safe workflow: catalog enumeration, delivery retry queues, call lookup/claims and versioned settings may need deliberate canonical additions. Do not use full-table scans or ALLOW FILTERING to pretend these access paths exist.

Email provider: Resend (chosen by the user). The local key is configured in an ignored file with sending disabled. Queue/ledger, signed webhook and channel controls are implemented; actual test recipient, sender/domain, public webhook URL and signing secret are still needed for live delivery proof. See `docs/flows/resend-email.md`. Push provider and moderation policy have not been supplied. Credentials must stay outside tracked files. Docker/Cassandra live verification is currently unavailable on this host.
