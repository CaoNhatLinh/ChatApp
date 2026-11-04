# Resend implementation evidence — 2026-10-12

## Delivered code, not live provider proof

Notification emails have a durable queue, immutable provider request, leased CAS claims, bounded retries and signed webhook delivery updates. Bounce/complaint/suppression blocks later sends. Provider IO runs outside the chat request path. Email is disabled locally until the test recipient is configured. New local/Google users and missing preferences default email consent to off.

Settings follows the authenticated channel capability: Email is editable only for an eligible allowlisted account; quiet hours affect email; unavailable push/desktop/sound remain explicitly unavailable. No fabricated delivery success or extra success toasts were added.

## Changed files and reasons

### Backend

All paths below are under `chat-service/src/main/java/com/chatapp/chat_service/` unless stated otherwise.

- `canonical/email/ResendSettings.java`: validate credentials, sender/recipient allowlist, link origin and webhook secret; no client-side secret.
- `canonical/email/ResendEmailClient.java`: bounded HTTP timeout/body, stable idempotency key and retryable/permanent provider outcomes.
- `canonical/email/NotificationEmailTemplate.java`: immutable bilingual plain-text request, correlation tags, no private chat content.
- `canonical/email/EmailDeliveryRepository.java`, `CassandraEmailDeliveryRepository.java`: bounded shard pagination, existing ledger, CAS revisions, suppression and current room membership checks.
- `canonical/email/NotificationEmailWorker.java`: source visibility deferral, consent/access checks, quiet hours, claim/retry/quarantine and webhook race protection.
- `canonical/email/ResendSignatureVerifier.java`, `ResendWebhookController.java`: raw-body Svix verification, payload bounds, identity/recipient checks, monotonic replay-safe delivery updates.
- `canonical/email/EmailCapabilityController.java`: private no-store channel availability endpoint without exposing credentials.
- `canonical/notification/NotificationRepository.java`, `CassandraNotificationRepository.java`: exact notification lookup and logged inbox/outbox pointer write.
- `canonical/notification/NotificationService.java`, `NotificationSettingsPolicy.java`: validate paired quiet hours and default email off.
- `canonical/auth/AuthService.java`, `GoogleAuthService.java`: default email off for new accounts.
- `security/config/SecurityConfig.java`: only the exact signed webhook path is public; other notification routes remain authenticated.
- `chat-service/src/main/resources/application.properties`, `chat-service/.env.example`: disabled-by-default provider configuration and escaped Vietnamese sender for Java-properties decoding.
- Ignored `chat-service/.env`: supplied server key stored locally, sending still disabled; secret is not included in this report or Git.

### Canonical schema

- `chat_app_complete.cql`: five delivery ledger columns and two tables (`email_jobs_by_shard`, `email_suppressions_by_address`). No legacy data reset or historical migration is performed.
- `scripts/test-local-schema.ps1`, `InfrastructureManifestTest.java`: expected canonical manifest now 80 tables / 689 columns / two UDTs.

### Frontend

- `features/notifications/api/notifications.api.ts`: typed availability contract.
- `features/notifications/components/NotificationSettingsPanel.tsx`: fetch settings/capabilities together, actual email availability and quiet-hour controls, saving/error states.
- `shared/i18n/resources.ts`: Vietnamese/English explanations for email test availability and quiet hours.
- `scripts/notification-settings-smoke.mjs`: enabled/disabled capability fixtures, keyboard interaction, saved payload assertions and light/dark captures at four widths.

### Tests and documentation

- New `canonical/email/{NotificationEmailWorker,ResendEmailClient,ResendSettings,ResendSignatureVerifier,ResendWebhookController}Test.java`: claim/retry/consent/suppression/init-race/shard fairness, official Svix vector, malformed/tampered/stale payloads, webhook races, recipient/provider mismatch and configuration encoding.
- Existing auth, notification policy/service and manifest tests: email default consent, quiet-hour validation and schema expectations.
- `docs/api/openapi.yaml`: channel availability and webhook paths/errors.
- `docs/adr/0013-resend-notification-delivery.md`: consistency boundaries and provider idempotency limits.
- `docs/flows/resend-email.md`: test sender, local variables, ngrok exposure warning, webhook events/secret, verification and production prerequisites.
- `tasks/database-capabilities/{plan,todo}.md`: implemented slices separated from external/runtime gates.

## Verification

- Java 20 `chat-service/mvnw.cmd -q test`: passed, 272 tests across 57 suites, zero failures/errors/skips, including the final consent regression. No Cassandra or provider is contacted by these mocked/unit tests.
- Root `npm run validate`: passed type-check and lint.
- Root `npm run build`: passed, 17 routes.
- Frontend `npm run test:i18n:copy`: 1124 checked keys, none missing.
- `notification-settings-smoke.mjs`: dark/email available and light/email unavailable passed; 320/768/1024/1440 widths, no horizontal document overflow, no console errors or failed requests. Provider API responses are fixtures, not backend integration evidence.
- Canonical schema guard: passed, 80 tables / 689 columns / two UDTs. Static guard is not live CQL execution.
- OpenAPI YAML parsed using existing `js-yaml` dependency; both email paths present. Initial `yaml` module attempt was unavailable, not an API defect.
- `git diff --check`: passed; `.env` is Git-ignored.
- Initial tests caught an outdated table count and a missing test matcher import; both fixed before the final regression run. Initial browser click on a visually hidden checkbox was replaced with keyboard focus/Space, which tests the supported interaction directly.

Screenshots (fixtures): `chatapp_frontend/artifacts/ui-audit/current/settings-notifications-{light,dark}-{320,768,1024,1440}.png`. Desktop dark and mobile light were visually inspected; contrast and email unavailable copy are readable. The full-page mobile capture includes the viewport-fixed navigation; it is not evidence of a mid-document navigation layout.

## Explicit remaining gates

No real email was sent, no ngrok tunnel was opened and no Resend dashboard webhook was registered. The user's Resend-account recipient address, public HTTPS endpoint and local webhook signing secret are still missing. An owned verified sender domain is required for unrestricted provider delivery; Nối's recipient ownership checks also need completion before removing its allowlist.

Docker/Cassandra are unavailable on this host, so actual prepared statements, batch replay, multi-process leases and crash recovery still need live integration proof. Delivery history/admin recovery UI, monitoring, retention and fleet-wide rate coordination remain unchecked in the TODO. Push provider and automatic moderation are unrelated and still unconfigured.

Existing own-join-request changes from the prior slice are preserved. No commit or push was performed in this turn.
