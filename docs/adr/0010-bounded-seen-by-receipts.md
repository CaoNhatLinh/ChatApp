# ADR 0010: Bounded seen-by receipt pages

- Status: Accepted
- Date: 2026-08-30

## Context

The message interaction page intentionally exposes only `latestReadAt`. The
explicit read-receipt endpoint previously returned every reader in one
Cassandra partition and returned only opaque IDs, while the frontend showed a
timestamp toast instead of a usable seen-by list. A large community room could
therefore create an unbounded response and force the client to make separate
profile requests.

## Decision

`GET /api/conversations/{conversationId}/messages/{messageId}/read-receipts`
returns `MessageReadReceiptPage`:

```json
{
  "content": [
    {
      "readerId": "...",
      "username": "reader",
      "displayName": "Reader",
      "avatarUrl": null,
      "readAt": "2026-08-30T12:08:00Z"
    }
  ],
  "nextCursor": "...",
  "hasNext": true
}
```

The request accepts `limit` (1–50, default 25) and an optional UUID cursor.
The Cassandra query reads at most `limit + 1` clustering rows and uses the
reader UUID as the cursor. Profile fields are fetched in one partition-key
`IN` query and never include email, password, tokens, or other private fields.
The caller must be a current conversation member and the message must exist in
the requested bucket.

The frontend opens a modal only after the user selects the existing “Đã xem”
state. It renders the exact profile fields returned by the API, supports
loading/error/retry/load-more states, and uses the existing default avatar only
when the API explicitly has no avatar URL. It does not fabricate names or
request one profile per reader.

## Alternatives considered

- Returning the existing unbounded list: rejected because response size grows
  with room membership and violates bounded Cassandra access patterns.
- Fetching a profile for each reader: rejected because it creates an N+1
  request/query pattern and increases latency.
- Showing raw reader UUIDs in the UI: rejected because IDs are not a useful
  identity label and would expose implementation details.
- Adding all receipts to `MessagePage.interactions`: rejected because the
  history page must remain bounded to its message cursor; detailed receipts
  belong to the explicit message action.

## Consequences

- Seen-by UI is refresh-safe and progressive instead of a transient toast.
- Each page has a hard upper bound and a stable cursor.
- A profile missing from the authoritative user table remains a receipt with
  its ID and timestamp; the UI uses the neutral “Thành viên” label rather than
  inventing identity data.
- Live Cassandra contention and multi-instance proof remain release gates.
