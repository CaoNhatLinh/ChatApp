# ADR 0012: Firebase verifies Google identity; Nối owns the account session

## Status

Accepted

## Date

2026-09-08

## Context

Nối already owns canonical users, account status, application roles, access
JWTs and rotating refresh sessions. Adding Google sign-in must not introduce a
second user store or let a client-selected email decide account ownership.

## Decision

- Firebase Authentication is an optional identity verifier for the Google
  provider. It does not replace the Nối session or authorization model.
- The browser sends a fresh Firebase ID token to Spring. The backend verifies
  signature, project, revocation, verified email, `google.com` as the actual
  sign-in provider, and `auth_time` where recent proof is required.
- External identities are keyed by provider and Firebase UID. Email is profile
  data, never the durable identity key.
- A known identity receives the same Nối access JWT and rotating refresh cookie
  as local login. A new identity must finish the canonical username/display-name
  step before a session is issued.
- An existing LOCAL account is never merged by matching email. Linking requires
  an authenticated Nối session, the current local password, a recent Google
  proof, and an exact normalized-email match.
- Google-only accounts keep a null password hash. Local password login rejects
  them safely without invoking the password encoder.
- The provider is disabled by default and advertised through
  `GET /api/auth/providers`. The UI stays hidden/unavailable until both backend
  and browser configuration are complete.
- Firebase browser persistence is session-only and is cleared after exchange;
  Nối remains the only source of an application login session.

## Consequences

- Bans, suspension, roles and logout continue to be enforced by Nối regardless
  of the Google account state.
- Firebase credentials stay server-side through Application Default
  Credentials; only Firebase's documented public web configuration reaches the
  browser.
- Existing LOCAL accounts preserve their user ID, password, rooms and messages
  after linking.
- Durable crash recovery for first-time account creation and live Firebase /
  Cassandra integration evidence remain release gates. The feature flag must
  stay off in production until those gates are complete.
