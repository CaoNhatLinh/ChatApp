# Security model

- Explicit auth allow-list: register/login/refresh/logout, health/public invite,
  websocket handshake; `/auth/me` and product data require authentication.
- Access JWTs default to 15 minutes. Refresh tokens are random opaque values,
  hashed at rest, rotated on use, and revoked with a Cassandra conditional update.
- Refresh cookies are HttpOnly, SameSite=Lax, scoped to `/api/auth`, and
  `AUTH_COOKIE_SECURE=true` is required behind HTTPS.
- Access JWTs exist only in frontend memory. `novachat_session=1` is a readable,
  non-authorizing session hint that avoids refresh requests for anonymous users;
  the backend never treats it as authentication or authorization evidence.
- Unsent message text is device-local product data, never authorization state.
  Browser storage keys are separated by authenticated user and conversation,
  retain at most 50 drafts for 30 days, accept only the current strict schema,
  and are cleared per room only after a successful send. Attachments and edit
  content are not persisted. Users should still treat a shared unlocked browser
  profile as access to their local data; server-side encrypted draft sync is not
  implemented.
- HTTP CORS and STOMP origins are configuration-driven (`CORS_ALLOWED_ORIGIN_PATTERNS`
  and `WEBSOCKET_ALLOWED_ORIGIN_PATTERNS`); production deployments must replace
  the localhost defaults with an explicit allow-list.
- Actuator health is public for readiness probes; other actuator endpoints require
  `SYSTEM_OPERATE` or the global `APP_ADMIN`/`SUPER_ADMIN` authority. The
  canonical app-role model has no `ROLE_ADMIN` path.
- Membership and conversation permissions are checked before reads/mutations;
  STOMP conversation topics are checked by `StompAuthenticationInterceptor`.
- Admin pages never infer privilege from a decoded JWT: `/api/admin/overview`
  and every role mutation enforce server-side `AppPermission`, with reason,
  actor and before/after values recorded through the canonical event recorder.
  The built-in `APP_ADMIN` grant includes global room, report, audit and bounded
  analytics access;
  `SESSION_REVOKE` protects operator session/device invalidation; room-local roles
  cannot substitute for it.
- Report resolution and APP/CONVERSATION sanctions require `REPORT_MANAGE`,
  reject self-targeting, validate target existence and reason text, and append
  immutable audit/outbox events. APP BAN/SUSPEND also updates account status so
  the login gate and per-request JWT/STOMP account-status checks enforce the
  sanction, including already-issued access tokens. An APP `WARNING` is
  audit-only; APP `BAN`/`MUTE`/`SUSPEND` are send-blocking and timed expiry
  is processed by a bounded UTC-day scheduler with conditional status claims;
  overlapping sanctions are preserved and failed side effects remain retryable.
- User content is not used as an instruction source. Uploads are configuration-
  gated and must be malware-scanned before becoming READY.

Remaining hardening: production CSP/HSTS/security headers, dependency audit
triage (the current frontend install reports six high-severity advisories), and a
real two-account authorization test against Cassandra.
