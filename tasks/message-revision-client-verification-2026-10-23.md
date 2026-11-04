# Message revision reconciliation — frontend, 2026-10-23

## Delivered boundary

The canonical message adapter requires an integer revision from 0 to 2147483647.
Missing versions are errors, not silently synthesized zeroes. Optimistic local
messages and unversioned directory previews remain explicitly distinct.

Live messages, HTTP edit/delete responses and history pages share one content
merge policy. Older revisions cannot replace newer content or resurrect a loaded
tombstone. Equal-revision frames preserve known content while allowing send
acknowledgement metadata. Pin/reaction/poll/read state is independent of this
revision. History captures immutable message references before the request: a
non-racing history snapshot may refresh independent state, but a late response
cannot undo a local change made during that request. Head reads keep live arrivals;
pagination reconciles duplicate IDs instead of dropping newer duplicate snapshots.

Conversation previews use accepted message state, not a discarded stale frame.
Known versioned same-message previews survive unversioned directory/point reads.
Different-message chronology uses the shared canonical CQL timeuuid comparator,
also used by unread tracking. Explicit pin acknowledgement updates the separate
pin state; a content snapshot does not impersonate a pin command.

## Files and reasons

All frontend paths below are relative to `chatapp_frontend/`.

- `src/features/messenger/model/message-snapshot.ts`: shared content/history policy.
- `src/features/messenger/model/message-order.ts`: move the existing exact CQL
  comparator to the shared feature boundary; no duplicate sorting algorithm.
- `src/features/messenger/model/{message,conversation}.slice.ts`: apply accepted
  snapshots and preserve preview content/independent metadata.
- `src/features/messenger/model/{messenger.store.types,useMessenger}.ts`: history
  request baseline, explicit pin acknowledgement and realtime room-scope guard.
- `src/features/messenger/api/messenger.api.ts`: required canonical revision and
  validated typed pin acknowledgement.
- `src/features/messenger/types/messenger.types.ts`: distinguish optional local
  message/summary versions from the required network DTO version.
- `src/widgets/chat-window/model/{unread-boundary,useReadTracking}.ts`: consume
  the shared comparator.
- `scripts/message-revision-order-smoke.mjs`: regression tests against the actual
  store factories and adapter. Existing message fixture scripts explicitly adopt
  revision zero on creation and increment edit/delete responses, not a production
  missing-version fallback. `chat-unread-theme-smoke.mjs` loads the moved comparator.

## Evidence and limits

Actual-source controlled regression: 14 groups, including delayed SEND/edit,
deletion, history races, duplicate pagination, stale previews, same-millisecond
ordering and invalid/missing revision. This is not a real broker/database test.

Additional controlled adapter/model suites: sticker3, GIF15, attachment metadata7,
thread13, forward23, send-attempt19, sticker-send4, scroll-policy10, directory17,
unread/theme/shared-URL22 passed.

Final-source `npm run validate` (type-check and lint) and `npm run build` passed.
Production Chromium edit/delete and interaction flows passed with no reported
console/request failures; interaction coverage includes pin/unpin, reaction,
read-receipt pagination, mention and reply. Attachment read18 passed again at
320/768/1024/1440, light/dark. Final-source workspace39 also passed at all eight
theme/width combinations, including custom room overrides. Measured library body
contrast was 17.19 in light and 17.56 in dark. These figures describe this dialog,
not an audit of every app color. Screenshots from this run:
`chatapp_frontend/artifacts/ui-audit/current/chat-library-{light,dark}-{320,1440}.png`;
attachment captures: `chatapp_frontend/.impeccable/review/message-attachment-read-{light,dark}-{320,768,1024,1440}.png`.

Directory summaries are still unversioned projection reads. Preserving known
same-ID authority is conservative; it does not guarantee that every offline edit
is discoverable solely by refreshing the directory. Search projection ordering,
durable publication/completion, independent aggregate concurrency and real
two-client/restart acceptance remain separate open work. Docker-dependent tests
remain deferred at the user's request; no engine/provider setup was attempted.
