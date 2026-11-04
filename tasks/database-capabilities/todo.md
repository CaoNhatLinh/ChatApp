# Execution checklist

Only mark complete after verification; backend foundation is not a finished user-facing feature.

- [x] Own join requests: index writes, authenticated paginated API, regression tests.
- [x] Own join requests: bilingual user UI, fixture browser smoke at four widths in light/dark.
- [ ] Own join requests: live datastore and crash/restart evidence, durable reconciliation after incomplete writes.
- [ ] Own join requests: privacy-safe room-name snapshots instead of technical room IDs.
- [ ] Sticker administration and catalog.
- [ ] Sticker send validation, composer picker and durable rendering.
- [ ] Server theme catalog and appearance integration.
- [ ] Reply thread indexing, authorization and UI.
- [ ] Forward provenance indexing and privacy-safe UI.
- [ ] Durable call state, participant/history UI and lifecycle tests.
- [ ] Image thumbnail processing and asset lifecycle integration.
- [ ] Typed global settings with audit and concurrency guards.
- [x] Email provider selected: Resend.
- [x] Resend local API key in ignored backend environment; sending disabled until recipient configured.
- [x] Email queue/ledger, leased worker, stable idempotency payload, retry, signed webhook and suppression unit tests.
- [x] Runtime email availability/consent and quiet-hours UI; bilingual fixture smoke in light/dark at four widths.
- [ ] Resend verified sender/domain, real test recipient and public signed webhook configured and live-tested.
- [ ] Real Cassandra batch/claim/crash integration, multi-instance rate-limit coordination and ledger retention.
- [ ] Delivery history UI and operational review/recovery for quarantined jobs.
- [ ] Push provider selected and configured.
- [ ] Moderation policy supplied.
- [ ] Moderation result persistence, review and enforcement UI.
- [ ] Full tests, frontend build and live Cassandra/browser integration proof.
