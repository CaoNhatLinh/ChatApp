# 0013 — Durable Resend notification delivery

Date: 2026-10-12. Status: accepted for limited recipient testing; external runtime validation pending.

## Context

Creating an inbox notification does not prove external delivery. Provider IO must not block chat requests. Cassandra does not offer a transaction across inbox, job and provider state; process crashes and duplicate webhooks must be recoverable without silently double-sending.

## Decision

Use `canonical/email` for configuration, provider client, immutable template, worker, ledger repository and signed webhook receiver. Keep the inbox authority in the notification capability. A small logged batch writes the notification and queue pointer together; bounded, paginated shards avoid full-table scans. Extend the existing delivery ledger with immutable request, retry/lease fields and a CAS revision. Email uses the reserved zero device UUID because it is a user-level channel.

Claim with a lease before IO, retry with the same payload and idempotency key, and stop before provider idempotency expiration. Provider acceptance is `SENT`; only a signed callback proves `DELIVERED`. Webhook CAS updates are monotonic and may win before the send response. Persist suppression before acknowledging adverse events.

Until local email ownership verification is implemented, sending is disabled by default and requires an explicit recipient allowlist. No private chat content is exported. The authenticated channel endpoint lets UI show the actual capability rather than an enabled-looking placeholder.

## Consequences and limits

Two canonical tables and five ledger columns are added. Existing installed databases need deliberate schema upgrades; this change does not reset data. The worker depends on current room membership and consent, not only the original notification snapshot. A missing source row is retried until the bounded review window ends.

Provider-side idempotency is bounded, not a promise of perpetual exactly-once delivery. Multi-instance rate-limit coordination, retention, operational review, real datastore crash tests and delivery-history UI remain explicit follow-up work. Webhook and API secrets are separate server-side credentials.

See [setup and recovery runbook](../flows/resend-email.md).
