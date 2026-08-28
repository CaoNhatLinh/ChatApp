# ADR 0002: Opaque rotating refresh sessions

Status: Accepted

## Decision

Issue a random `tokenId.secret` refresh value in an HttpOnly cookie, store only a
SHA-256 hash, rotate on refresh, and revoke the old token with a Cassandra
conditional update. Access JWTs are short-lived and never stored in cookies.

## Consequences

XSS cannot directly read the refresh value; replay after rotation is rejected.
Cross-partition writes are intentionally retriable and require operational repair
monitoring. Production must enable Secure cookies and HTTPS.
