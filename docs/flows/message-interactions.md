# FLOW-MESSAGE-002 — refresh-safe message interactions

Linked feature: `ID-MESSAGE-002`. Actors are an authenticated conversation
member and, for pinning, a member with `MESSAGE_PIN`. The postcondition is that
the current page and other live sessions converge on the same canonical state.

```mermaid
sequenceDiagram
    participant U as User
    participant N as Next.js client
    participant S as Spring API
    participant C as Cassandra authority
    participant P as Bucket projections
    participant W as STOMP
    U->>N: Open or refresh a room
    N->>S: GET bounded message cursor page
    S->>C: Read bounded canonical messages
    S->>P: Read reactions + latest-read for page IDs per represented bucket
    S-->>N: MessagePage(content, cursor, interactions)
    N-->>U: Render messages, reaction badges, pin and seen state
    U->>N: React or toggle pin
    N->>S: Bucket-scoped command
    S->>C: Authorize and mutate authority
    S->>P: Idempotently update projection when applicable
    S-->>N: Success / updated canonical message
    S->>W: Publish idempotent interaction event
    W-->>N: Converge other live sessions
```

```mermaid
flowchart TD
    A[Bounded message page] --> B[Group page IDs by message bucket]
    B --> C[One reaction projection query per represented bucket]
    B --> D[One read-summary query per represented bucket]
    C --> E[Aggregate count and current-actor state]
    D --> F[Select latestReadAt]
    E --> G[Return interactions keyed by messageId]
    F --> G
    G --> H[Render only available compact state]
    H --> I{Command fails?}
    I -- Yes --> J[Keep prior UI and show actionable error]
    I -- No --> K[Apply canonical response or STOMP event]
```

Deleted messages suppress reaction controls and badges. Missing interaction
rows mean no reaction or seen state; the client does not invent values. A
projection-write failure fails the command, and replay repairs the idempotent
reaction projection. Permission errors preserve the prior UI. Verification is
`CanonicalBackendServiceMessageTest`, the full Java suite and
`test:e2e:message-interactions`.
