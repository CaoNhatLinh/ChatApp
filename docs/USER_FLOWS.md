# User flows

```mermaid
flowchart TD
  A[Landing] --> B{Authenticated?}
  B -- no --> C[Login/Register]
  C --> D[Short access token + HttpOnly refresh cookie]
  B -- yes --> E[Messenger shell]
  E --> F[Search user]
  F --> G[Friend request]
  G --> H[Accept / reject / block]
  H --> I[Create or resolve DM]
  I --> J[Send idempotent message]
  J --> K[Persist Cassandra + publish realtime]
  K --> L[Unread notification / read receipt]
  E --> M[Start 1–1 voice/video call]
  M --> N[Permission + native WebRTC offer/answer/ICE]
  N --> N2[Accept / decline / mute / camera / hang up]
  E --> O[Message menu: report abuse]
  O --> P[Choose reason + optional details]
  P --> Q[Persist bounded report + audit/outbox]
  Q --> R[Global operator reviews and resolves]
  E --> S[Open another user's profile]
  S --> T[Choose report profile + reason]
  T --> Q
```

Error exits: expired access token attempts one refresh; rejected refresh clears
the local session; a duplicate client message id returns the original message;
membership/permission failures are never hidden as empty success states. A
report cannot target the reporter's own account, and operator mutations require
an explicit audit reason.

## FLOW-ADMIN-001 — operator session/device control

Linked feature: `ID-ADMIN-001` (global admin workspace).

```mermaid
sequenceDiagram
  participant O as Global operator
  participant N as Next admin UI
  participant S as Spring admin API
  participant C as Cassandra
  O->>N: Select a user
  N->>S: GET /admin/users/{id}/sessions and /devices
  S->>S: Authenticate + require USER_READ
  S->>C: Read bounded user/device partitions
  C-->>S: Token metadata (never token hashes) + device state
  S-->>N: Inventory or explicit error
  O->>N: Revoke session/device with reason
  N->>S: DELETE /sessions/{tokenId} or /devices/{deviceId}
  S->>S: Require SESSION_REVOKE + validate reason
  S->>C: Conditional revoke/deactivate projection
  S->>C: Append immutable audit/outbox event
  S-->>N: 204 No Content
```

The inventory is bounded to the account partition. A device revoke uses a
conditional active-state update and revokes indexed refresh sessions for that
device; live multi-device Cassandra proof remains an integration gate.
