# Resend notification email

Implemented on 2026-10-12. This sends notification emails, not Firebase verification emails or password resets. Email, browser notifications and the in-app inbox are separate channels. Push and automatic moderation are not enabled by this integration.

## Local configuration

Sending defaults to disabled (`EMAIL_ENABLED=false`). Set the provider API key in the ignored `chat-service/.env` or in the runtime environment. Replace any key previously shared outside that environment before enabling delivery.

Start the backend from `chat-service`, where Spring imports `.env`. Use the repository's local startup workflow for Cassandra, Redis and the application. Apply the current `chat_app_complete.cql` to a **fresh** database; see `docs/SCHEMA_CONSOLIDATION.md` for the current manifest count. Merely re-running `CREATE TABLE IF NOT EXISTS` does not add columns to an existing table. Do not delete a populated database to enable email.

## 1. Enable a limited send test

Without a verified sender domain, Resend's `onboarding@resend.dev` sender can send real test emails only to the email address associated with your Resend account. Obtain that address before enabling the worker. Nối also requires an explicit recipient allowlist: local account email ownership is not yet verified, so unrestricted delivery is deliberately unavailable.

Edit `chat-service/.env` locally:

```ini
EMAIL_ENABLED=true
EMAIL_FROM=N\u1ed1i <onboarding@resend.dev>
EMAIL_ALLOWED_RECIPIENTS=your-resend-account-email@example.com
RESEND_API_KEY=your-local-key
RESEND_WEBHOOK_SECRET=
EMAIL_POLL_DELAY_MS=1000
APP_PUBLIC_BASE_URL=http://localhost:3000
```

Replace the two placeholders; never commit the file. In this imported Java-properties file, `N\u1ed1i` decodes to `Nối` without corrupting Vietnamese characters. When setting an actual OS environment variable instead of editing this file, use the normal Unicode text `Nối`. Restart the backend. Sign in to a Nối account whose email matches the allowlist, open Settings → Notifications and enable Email. The availability endpoint is authenticated and checks the backend configuration, active user, allowlist and durable suppression. A generic new-notification email is queued only for notifications created while the provider is enabled; enabling it does not backfill the inbox.

New local/Google accounts and missing preferences default Email to off. Use another account to create a real notification (for example a mention). The recipient must still have room access, email consent, an applicable notification level, and an unread notification. Quiet hours defer email; they do not hide in-app notifications. A successful provider API call means `SENT`, **not** `DELIVERED`.

## 2. Register the signed webhook

The receiver is already implemented:

```text
POST https://YOUR-PUBLIC-HOST/api/webhooks/resend
```

Local backend port: 8084. If you choose ngrok, install/sign in using its official setup, then run the following **yourself after deciding to expose this local backend**:

```powershell
ngrok http 8084
```

This exposes the entire service on that port, not just the webhook route. Keep application authentication enabled, do not tunnel Cassandra/Redis, avoid sharing the address, and stop ngrok after testing. A tunnel is a development tool, not a production hostname. No tunnel is automatically started by the app or by this setup.

In Resend → Webhooks → Add webhook, enter the HTTPS forwarding URL with `/api/webhooks/resend`. Select:

- `email.sent`
- `email.delivery_delayed`
- `email.delivered`
- `email.failed`
- `email.bounced`
- `email.complained`
- `email.suppressed`

Copy that webhook's **signing secret** (`whsec_…`) into local `RESEND_WEBHOOK_SECRET` and restart the backend. It is different from `RESEND_API_KEY`. Do not enable open/click tracking just to test delivery. When the tunnel hostname changes, update the registered endpoint. Keep a signing secret configured even if sending is later disabled, so late delivery events can still be processed.

Generic dashboard samples without Nối correlation tags are acknowledged but do not fabricate a delivery record. To prove persistence, send an actual notification and inspect its matching webhook delivery in Resend. A 204 for an unrelated sample alone is not end-to-end proof.

## Delivery and recovery rules

- A logged Cassandra batch writes the inbox notification plus its queue pointer. It is durable, not cross-partition atomic visibility; a temporarily missing notification is deferred.
- Sixteen bounded queue shards use clustering-key pagination. Deferred jobs do not permanently block newer jobs.
- The ledger stores the immutable plain-text request before sending. A revision-guarded CAS claims a 60-second lease; losing workers do not send. Retries reuse the exact payload and idempotency key.
- Backoff handles timeouts, network uncertainty, 408/429/5xx and concurrent-idempotency 409. Permanent errors stop automatically. Retry exhaustion (10 attempts or a 20-hour job window) becomes `REVIEW_REQUIRED`; it is not blindly resent after Resend's 24-hour idempotency retention.
- `SENT`, `DELAYED`, `DELIVERED`, `FAILED`, `BOUNCED`, `COMPLAINED`, `SUPPRESSED` are provider states. `SKIPPED` and `REVIEW_REQUIRED` are local terminal states. `DELIVERED` is recorded only from a verified webhook.
- Webhook verification uses the untouched raw body, Svix HMAC, constant-time comparison and five-minute timestamp tolerance. Oversized bodies fail. Missing persistence or CAS contention returns a retryable HTTP error instead of acknowledging lost work.
- Duplicate/out-of-order events cannot regress delivery state. A webhook arriving before the API response cannot be overwritten by that response.
- A verified late provider event can resolve `REVIEW_REQUIRED` when it matches the original persisted request. The worker still treats that state as terminal for sending. When the retry window expires before any ledger row exists, the worker inserts a terminal record directly and respects any competing worker's active lease.
- Bounce/complaint/suppression persists a hashed-address suppression before completing the ledger update. Replay repairs this sequence; subsequent jobs to that address stop. No automatic unsuppression is provided.
- Email contains no chat text, sender/room names, attachments or invitation tokens. The persisted request necessarily contains the recipient address; restrict datastore access and define retention before production. It links to `/app`, not private message content.

## Member delivery history

Open Settings → Notifications → Email delivery history and select a UTC month. History remains available after turning email off and shows only records for the signed-in account. “Handed to email provider” means the provider accepted the request. Delivery is confirmed separately by a verified webhook.

`GET /api/notifications/email-history` returns the notification ID, delivery state and available timestamps. The history depends on both the retained notification and its email delivery record. Follow the returned cursor whenever `hasNext` is true, including when the current page contains no email records.

## Operator lookup

Open the member history item's **Lookup details** to find its account ID, UTC storage month and notification ID. An operator with `SYSTEM_OPERATE` can look up the exact record using those three values. The response contains status, attempt count and timestamps. It excludes the recipient address, message body, provider identifier and raw failure details. Treat `REVIEW_REQUIRED` as a signal for investigation. The lookup itself does not requeue email.

The review queue is grouped by the UTC day when the job was created. A job may reach its retry limit on a later day. The worker registers its exact key before transitioning the ledger, so a crash or failed index write leaves a replayable job. The API checks current ledger state, and a page can have a continuation even when all its candidates are now resolved.

New installations create the candidate index from `chat_app_complete.cql`. On existing installations, apply the additive `CREATE TABLE IF NOT EXISTS email_review_candidates_by_day` statement before deploying the backend. An older review record whose job pointer was already removed is available by exact lookup. Existing review records with a remaining job pointer are indexed when the worker revisits them.

After investigating an uncertain result, an operator can close the review with a short reason. The original delivery status remains visible and the record leaves the review queue. One conditional update records the command, operator, reason and time on the existing ledger row. Replaying the same normalized command returns the original timestamp. A different decision or a provider update that wins first results in a conflict. A subsequent verified provider event can still update delivery state while preserving the review receipt.

If the UI cannot confirm a save, retry from the open lookup to reuse its command. After leaving the lookup or reloading the page, look up the same delivery to check its current status and closure time before acting again.

Existing deployments also need the four additive ledger columns from the canonical schema before deploying this backend. Apply this statement once to an existing ledger that lacks all four columns.

```sql
ALTER TABLE notification_deliveries_by_notification ADD (
  review_command_id uuid,
  reviewed_by uuid,
  review_reason text,
  reviewed_at timestamp
);
```

## What remains before production

- Verified sender domain and DNS SPF/DKIM setup. A domain does not provide a public webhook URL; those are separate requirements.
- Verification of recipient email ownership before removing the allowlist.
- Real Cassandra integration, two-worker claim/crash recovery and provider delivery/bounce/replay tests.
- Public stable HTTPS endpoint, secret rotation, monitoring and bounded ledger retention.
- Retention for review candidates and operator receipts, plus live review-queue and disposition verification.
- Provider rate-limit coordination across many backend instances; current worker caps its own requests, not the entire deployment.

## Sources

[Send Email API](https://resend.com/docs/api-reference/emails/send-email), [idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys), [webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests), [Svix manual verification](https://docs.svix.com/receiving/verifying-payloads/how-manual), [event types](https://resend.com/docs/webhooks/event-types), [test sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
