# Nối product contract

## Purpose

Nối is a privacy-conscious, real-time conversation product. People can
discover users, establish explicit friendships, start direct or group rooms,
exchange durable messages and attachments, and receive presence and
notification feedback without losing history on refresh.

## Primary users and outcomes

- A signed-in member can find a person, send/accept/reject/block a friendship,
  open a DM, and report abusive users or messages.
- A room member can send, edit, delete, react to, pin, read, and page through
  messages with an idempotent client message ID.
- A member can track submitted reports from Settings → Báo cáo của tôi.
- A global operator can use the protected `/admin` workspace to inspect health,
  browse bounded all-room projections, moderate room policy, archive/restore
  rooms, manage global user status and app roles, resolve reports, apply
  sanctions, and inspect audit events. Room-local roles never grant this access.

## Release boundaries

Email delivery, social OAuth, MFA enrollment, production push providers, and a
reviewed production STUN/TURN provider require external credentials and are
tracked as externally blocked. Native 1–1 WebRTC is implemented; group/SFU
calls and provider-backed NAT traversal are not enabled. None of these
boundaries are represented as mock-success behavior.

## Source of truth

The existing route copy, schema, API contracts, and controllers define the
working product brief. Stable feature status and acceptance evidence live in
[`FEATURE_INVENTORY.md`](./FEATURE_INVENTORY.md) and
[`TRACEABILITY_MATRIX.md`](./TRACEABILITY_MATRIX.md).
