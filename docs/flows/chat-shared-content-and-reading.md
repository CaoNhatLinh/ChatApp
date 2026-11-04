# Shared content, reading and appearance

## Canonical sources

The shared-content API reads existing message bucket metadata, messages,
message attachment references and active media assets. No new table, provider,
Elasticsearch query or client-only archive is introduced. Images/files use the
asset repository's URL and metadata, not caller-supplied attachment thumbnails.
Links are extracted from message text (maximum 20000 characters); no URL preview
is fetched by the server. Only absolute HTTP(S) URLs without embedded credentials
are returned. This is not a malicious-link classifier.

Each request checks current conversation membership. Deleted messages, blocked
senders and deleted/not-ready/missing assets are excluded. Source lookup repeats
membership/visibility checks and opens the current source message in the library
dialog. It deliberately does not claim to load an arbitrary deep surrounding
history through the old twenty-page message-search jump.

## Pagination

GET `/api/conversations/{id}/shared-content?kind=IMAGES|FILES|LINKS&cursor=...`
returns `content`, `nextCursor`, `hasNext`, with no invented total count.

- Metadata reads at most 17 rows: all 16 shards of the newest eligible hour and
  one row to detect an older hour. It never advances to an older hour midway
  through the first hour's shards.
- Each shard reads at most 21 messages. Candidates are merged by Cassandra
  timeuuid order; at most 20 candidates are examined before continuation.
- A nonempty page belongs to one source message. Attachments are read in bounded
  pages of 25 raw references, continuing by attachment UUID even if filtering
  excludes every reference. No attachment count is silently truncated.
- Link pages return that source message's safe deduplicated URLs. Source content
  length bounds extraction. No cross-message total or external preview is claimed.
- Cursors bind actor, conversation and kind; malformed/cross-scope continuation
  is rejected. Cursor encoding is not authorization; membership is checked again.
- Empty pages can continue. The client scans at most five empty pages per action
  and then retains a visible continuation button. Query/tab/room changes abort
  stale requests; retry starts a fresh scope and authorization failure clears data.

This is a bounded archive traversal, not a materialized media index. Long text-only
histories may need several continuation actions. Latency at production scale has
not been profiled. Asset URLs already disclosed by a public storage provider are
not retroactively revoked by filtering this API. The current asset model has no
trusted persisted thumbnail URL, so image previews lazy-load the actual image;
thumbnail generation/provider lifecycle remains separate work.

## Read position

GET `/api/conversations/{id}/read-state` exposes only the caller's canonical
membership `lastReadMessageId`, `lastReadAt`, `joinedAt`. It does not write a read
receipt. The entry marker remains stable for the current visit, even after an ack.
Comparison uses full timeuuid timestamp/tie ordering, not millisecond dates or
unread badge counts. If the boundary precedes loaded history, the UI explicitly
says unread messages remain above rather than inventing a boundary at row one.

Selecting a room or receiving a WebSocket message no longer acknowledges reading.
The history must be at its end and the document visible. Only persisted visible
messages, excluding blocked senders, advance the pointer. A later message arriving
during an in-flight acknowledgment schedules another check. Failures remain inline
and retryable, without a toast. Moving past your own latest message advances the
pointer without adding a false self-read receipt or emitting a peer read event.

Unread projection repair clears only a summary covered by the acknowledged ID and
uses a conditional update against that exact summary. It reads two exact pinned/
unpinned clustering keys at the canonical activity timestamp, not every room in a
user partition. New messages restart counts when the prior summary is covered by
the member pointer. Sending alone no longer clears earlier unread messages.
Directory filtering suppresses stale nonzero counts when the canonical pointer
covers the projected latest message. The client preserves messages newer than the
acknowledged snapshot rather than unconditionally resetting its badge to zero.

Cassandra projection moves are not an atomic transaction with message delivery and
read CAS. Concurrent projection movement/crash recovery and multiple real clients
still require the live infrastructure gate; tests do not establish linearizable
exact badge counts under all interleavings. The unread divider uses the canonical
pointer, independently of this derived count.

## Theme and save semantics

The persisted `system` theme means follow the app's resolved light/dark mode.
New preferences default to it. Existing explicit presets remain explicit; no old
data is silently rewritten. Room overrides take precedence over the default.
Room history owns its foreground/card/border/muted colors, so an explicit dark
room remains readable inside a light shell and vice versa. Custom backgrounds use
a dark overlay/metadata mode; absent local overlay treatment defaults to strong.
Dialogs outside room history follow the app theme.

Appearance saves await the canonical API before reporting success. Theme and
background are sent in one room write rather than competing writes. Default
bubble and room preferences are separate resources: if the first succeeds and the
second fails, the successful part is reflected locally, the unsaved draft remains,
and retry does not fake an all-or-nothing transaction. No theme-save toast is added.
Saving under a changed user scope cannot update the new user's local settings.

No dependency was added: existing React, Radix Dialog, Tailwind and browser APIs
cover these interactions. See `tasks/chat-ux-verification-2026-10-20.md` for evidence
and the distinction between controlled acceptance and live Cassandra/provider QA.

## Direct reply reading panel

Source quotes and message actions open the exact parent conversation/bucket/ID
through the bounded thread endpoint, not a scan of cached history. The panel is
right-docked on desktop and one full-height mobile layer. Replies have explicit
cursor continuation and refresh; source deletion disables new replies, and
403/404 clears displayed content. A separate text draft retains the same command
on uncertain retry; the existing main composer remains available for rich sends.
Closing a dirty draft asks before discarding and restores main-composer focus.
While the thread covers the main timeline, new main messages are not marked read
behind it. Closing resumes the visible-timeline acknowledgment policy.

The thread reading plane follows app surface/text tokens even with a custom room
image; bubbles retain room appearance. See
`tasks/thread-ui-verification-2026-10-20.md` for controlled evidence and open gates.

## Deliberate forwarding and private source reading

The message menu prepares an authorized source snapshot, then asks for a joined
destination through server-backed directory search/paging and explicit send.
Changing the query clears a prior selection so a hidden recipient cannot receive
the message accidentally. Once an attempt starts, its destination and payload are
frozen; uncertain retry reuses the same clientMessageId. Closing an uncertain
attempt warns that its in-memory retry state will be lost. It is not an offline
or reload-safe queue. Feedback is inline and the main composer draft survives.

The public forwarded marker opens the authorized immediate-source point endpoint,
not a cached-history scan. Unavailable/error/focus revalidation clears old content;
source library navigation uses the actual source room. Private source keys do not
appear in public message payloads. Existing destination copies are not retracted
when source access changes; no immediate remote revocation push is claimed.
Forward and library overlays pause covered-main-timeline read acknowledgment.
Dialogs follow opaque app tokens; room bubbles keep their chosen appearance.

See `tasks/forward-ui-verification-2026-10-20.md` for controlled evidence and open
live Cassandra, crash-recovery, two-client and provider gates.
