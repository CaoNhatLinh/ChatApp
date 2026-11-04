# Member conversation directory

Nối is personal/community chat, not a sales inbox. Sidebar filters and quick opening
share GET /api/conversations with optional q and filter=ALL|UNREAD|PINNED.

ConversationBrowseService owns this read capability. ConversationService retains
conversation commands/policy, not a second copy of directory pagination. The user
projection partition supplies ordering and unread/pin state. Each candidate is
checked against current canonical membership before becoming a result. DM peer
resolution returns only public identity fields, never email or credentials.

Pages scan10-100 projection rows (frontend30). Name and peer username/display-name
matching is case/accent insensitive. It does not depend on Elasticsearch and does
not search message content. Existing room message search keeps its separate API
and runtime dependency.

Continuations bind caller, normalized query and filter. Changing any of them
requires restarting at the first page. Tokens are opaque positions, not signed
authorization: authorization always comes from the current authenticated caller
and membership. No client may parse them. Raw-row continuation is captured before
missing conversation records or filters are discarded. Consequently empty content
can have hasNext=true; both clients preserve a continuation action and never call
such a page an exhausted search. Paging is not a transactionally frozen snapshot:
activity and pin changes can reorder rows; clients deduplicate IDs and restart
after their own pin commands.

Projection continuation follows the schema's mixed clustering order explicitly:
`is_pinned DESC, last_activity_at DESC, conversation_id ASC`. Within the cursor's
pin group, first read the same timestamp with `conversation_id > cursorId`, then
read strictly older timestamps using only the remaining row budget. Exhausting
the pinned group fills the remaining budget from the unpinned head. At most three
bounded projection reads serve a continuation; no `ALLOW FILTERING`, full
partition sort or schema change is used. The extra lookahead row is not consumed
into the next cursor. Missing canonical rooms still advance the raw cursor.

This avoids relying on a single tuple inequality to express oppositely ordered
columns. See [Cassandra CQL range restrictions](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/dml.html#the-where-clause).
Query-binding tests cover ties, remaining capacity, pin transition and exhaustion;
the opt-in `ChatReadCassandraIT` checks14 actual persisted rooms across two-row
pages. That live test remains unexecuted until Docker is available.

The default sidebar uses the existing realtime-updated cache. Queries and filters
use the server directory. Ctrl/Cmd+K works inside the chat workspace, with a
visible trigger, dialog focus/Escape, keyboard selection and cursor continuation.
A selected remote room is hoisted into the canonical client store before opening,
so it need not have appeared on the initial cached page. Pin failures remain next
to their row rather than generating an additional toast.

Cancellation and in-flight guards prevent stale query writes and rapid duplicate
page requests. Explicit failures retain a retry path. No complete room counts,
CRM labels, personal archive or favorites are inferred from the loaded page.

Verification and remaining live/performance/accessibility gates:
tasks/chat-ux-verification-2026-10-20.md and tasks/chat-ux-upgrade.md.
