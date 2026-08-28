# NovaChat product contract

## Purpose

NovaChat is a privacy-conscious, real-time conversation product: people discover
other users, establish explicit friendships, start direct or group conversations,
exchange durable messages and attachments, and receive presence/notification
feedback without losing history on refresh.

## Primary users and outcomes

- A signed-in member can find a person, send/accept/reject/block a friendship,
  open a DM, and see the same conversation from another authenticated session.
- A conversation member can send, edit, delete, react to, pin, read, and page
  through messages using an idempotent client message id.
- A member can understand connection state, unread work, mentions, invites, and
  poll results without relying on color alone.
- Operators can audit changes and rebuild projections from durable events.
- A global operator can manage the application from `/admin`: inspect runtime
  capabilities, browse all indexed rooms by bounded month, moderate room policy,
  archive/restore rooms, inspect users, and manage app-level account status and
  roles. Room-local roles never grant this access.

## Non-goals for this release

Email delivery, social OAuth providers, MFA enrollment, push-provider delivery,
and a production WebRTC media provider are explicitly outside the local release
unless an external provider is configured. They remain visible as unresolved
capabilities rather than mocked as complete.

## Product assumptions

No separate product brief was supplied. The existing NovaChat `DESIGN.md`, route
copy, schema, and implemented controllers are treated as the authoritative
working brief; any conflict must be recorded as an ADR before implementation.

## Definition of done

Every user-facing capability has a canonical route/command, authorization and
error states, durable or explicitly ephemeral storage semantics, automated tests,
and a browser/integration evidence record. See `docs/TRACEABILITY_MATRIX.md`.
