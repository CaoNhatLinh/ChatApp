# Presence and large-directory flow

Stable flows: `FLOW-REALTIME-001`, `FLOW-DIRECTORY-001`  
Linked capabilities: `ID-REALTIME-001`, `ID-ROOM-002`, `ID-MESSAGE-001`

## Outcome and boundary

The application keeps two concerns separate:

- the member or conversation directory is durable, permission-scoped data read
  from Cassandra in bounded cursor pages;
- presence is short-lived Redis state delivered as an authorized STOMP event
  stream only for rows near the viewport.

This is a near-real-time snapshot, not proof of a person's physical activity.
The UI therefore renders no offline claim while a target has no authoritative
snapshot. A stored `INVISIBLE` preference is exposed to other users as
`OFFLINE`; it is never exposed as `INVISIBLE`.

## FLOW-REALTIME-001 — observe presence

Actors: authenticated watcher, observed friend or room member, browser STOMP
session, Spring node, Redis.  
Trigger: a rendered user row enters the viewport margin or the active view
changes.  
Preconditions: the watcher has an authenticated STOMP session and either an
accepted friendship or membership in the supplied conversation scope.  
Postcondition: the browser has the latest authorized public snapshot for only
the currently tracked targets; leaving the viewport releases the active scope
or transfers the target to another still-rendered authorized scope.

```mermaid
sequenceDiagram
  participant UI as Browser row
  participant PM as PresenceManager / tracker
  participant WS as Spring STOMP node
  participant DB as Cassandra authorization data
  participant R as Redis presence + Pub/Sub

  UI->>PM: Row enters 160 px viewport margin
  PM->>WS: /app/presence.subscribe (unique IDs, optional conversationId)
  WS->>DB: Verify watcher and every target are friends or room members
  alt unauthorized target or scope
    DB-->>WS: Not visible
    WS-->>PM: Reject command
    PM-->>UI: Keep presence unknown; show no guessed offline state
  else authorized and within 200 targets/session
    WS->>R: Read target snapshot and active session set
    R-->>WS: Public snapshot
    WS-->>PM: /user/queue/presence
    PM-->>UI: Render compact status
  end
  UI->>PM: Row leaves viewport margin
  PM->>WS: /app/presence.unsubscribe
  WS->>WS: Remove target from this STOMP session
```

The client owns one active authorization scope per target user. If the same
person is visible as both a friend and a room member, reference counts are kept
per scope but only one server subscription is active. When that active view
leaves, the tracker unsubscribes the old scope, clears the cached snapshot to
`unknown`, and subscribes through another still-rendered scope. This prevents a
snapshot authorized by a vanished view from silently surviving under a
different UI context.

### Heartbeat, multi-device aggregation and expiry

```mermaid
sequenceDiagram
  participant B as Active browser session
  participant N1 as Spring node A
  participant R as Redis
  participant N2 as Spring node B
  participant W as Authorized watchers

  B->>N1: /app/heartbeat + bounded device description
  N1->>R: Refresh session score and 70 s snapshot TTL
  N1->>R: Publish only when public online/status changes
  R-->>N1: Presence Pub/Sub event
  R-->>N2: Presence Pub/Sub event
  N1-->>W: Fan out to local subscribed sessions
  N2-->>W: Fan out to local subscribed sessions
  loop every 10 s while a target has subscribers
    N1->>R: Remove expired session scores and recompute aggregate
    N2->>R: Remove expired session scores and recompute aggregate
    N1-->>W: Send offline/status change when aggregate changed
    N2-->>W: Send offline/status change when aggregate changed
  end
```

One active session keeps the aggregate online. Explicit logout removes only the
current STOMP session; the user becomes offline only after all sessions are
gone. Disconnect cleanup removes watcher subscriptions and the disconnected
actor's session. A reconnect must subscribe again and may request
`/app/presence.batch` for bounded resynchronization.

```mermaid
stateDiagram-v2
  [*] --> Unknown: row not subscribed or no snapshot yet
  Unknown --> KnownOnline: authorized ONLINE/AWAY/DND snapshot
  Unknown --> KnownOffline: authorized OFFLINE snapshot
  KnownOnline --> KnownOffline: all sessions expire/logout
  KnownOffline --> KnownOnline: valid heartbeat
  KnownOnline --> Unknown: row leaves viewport or session disconnects
  KnownOffline --> Unknown: row leaves viewport or session disconnects
```

Failure and recovery rules:

- malformed events are rejected and never converted into a display status;
- Redis or STOMP loss leaves the last snapshot stale until reconnect, while the
  global network banner communicates connectivity loss;
- reconnect performs bounded subscription/batch synchronization rather than
  downloading a global presence list;
- leaving the final tracked scope deletes that user's cached snapshot, so a
  later row cannot briefly display stale online/offline state before its new
  subscription response;
- arbitrary UUID presence probing is forbidden;
- membership or friendship revocation after a successful subscription is not
  yet pushed into the subscription set immediately; cleanup currently occurs
  on unwatch/disconnect, so revocation-driven invalidation remains an explicit
  security hardening item.

Observability and evidence: correlation `requestId`/`traceId` fields are carried
by commands; logs omit user payloads. `PresenceServiceTest` covers fan-out,
expiry, aggregation and authorization. Frontend validation covers strict event
normalization. Live Redis multi-node reconnect and revocation invalidation are
not yet verified.

Rejected alternative: querying Cassandra again for every subscriber on every
presence event would fail closed after revocation, but it turns one popular
user's status change into an unbounded read burst. The selected future design
is a distributed access-revocation signal that removes affected local
subscriptions on every Spring node and neutralizes the relevant client scope.

## FLOW-DIRECTORY-001 — browse a large room or conversation list

Actors: authenticated member, browser list, Spring API, Cassandra.  
Trigger: initial directory open, or a bounded scroll sentinel entering the
lower viewport margin.  
Preconditions: the actor is authorized for the requested directory.  
Postcondition: exactly one additional cursor page is appended without replacing
already rendered rows or subscribing presence for off-screen users.

```mermaid
flowchart TD
  A[Open room members or conversation sidebar] --> B[Request first bounded page]
  B --> C{Authorized and page valid?}
  C -- no --> D[Keep prior data and show retryable error]
  C -- yes --> E[Render compact rows]
  E --> F[Observe presence only near viewport]
  E --> G{List overflows and sentinel is near?}
  G -- no --> H[Do not fetch another page]
  G -- yes --> I{Request already in flight?}
  I -- yes --> H
  I -- no --> J[Request opaque/UUID cursor page]
  J --> K{View generation still current?}
  K -- no --> L[Discard stale response]
  K -- yes --> M[Deduplicate IDs and append page]
  M --> E
```

Room members default to 100 rows per request and the server clamps the limit to
1–500. The cursor is the last authorized member UUID in Cassandra clustering
order. Conversation sidebar pages contain 30 rows and use the server's opaque
projection cursor. The automatic sentinel runs only when the list actually
overflows; a localized manual load-more action remains as recovery when the
observer is unavailable or the page is short. Neither surface drains every
page on mount.

Security and consistency rules:

- the server checks room membership before returning any member page;
- clients treat cursors as opaque except for the documented member UUID cursor;
- an in-flight guard prevents observer/button duplicate requests;
- room generation guards discard a late member page after navigation;
- presence subscription and durable directory loading remain independent;
- unknown presence is neutral, and only visible rows create ephemeral tracking
  cost.

Evidence: `test:e2e:room-management` proves scroll-triggered member pagination,
stale-room protection, bounded layout, and the sidebar's real second-page HTTP
request with the opaque server cursor. Frontend validation covers the shared
cursor/in-flight implementation. Clean Cassandra ordering/load evidence and a
virtualized extreme-directory benchmark remain pending.
