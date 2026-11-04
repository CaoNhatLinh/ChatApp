# Message attachment read boundary — 2026-10-23

## Delivered increment

Recipients and reloaded history now resolve attachment availability through a
member-authorized message read, rather than relying on the sender's optimistic
array. See ADR0022. No database schema/provider/dependency/config changes.

The read checks membership before message/asset access; missing/deleted messages
and blocked senders cannot reveal attachments. Each row is READY or UNAVAILABLE;
only active READY assets with matching provider/key expose original HTTPS URLs.
Thumbnails come from confirmed persisted SMALL variants, not old client metadata.
Reads are no-store and bounded at 1–50 plus one sentinel; continuation uses the
last returned attachment ID. Storage errors are never an empty success.

The member UI loads when visible, offers inline retry/load-more, avoids loading
spoiler artwork before reveal, and renders explicit missing-access/unavailable
states. Broken images expose a file link and retry; image/video/audio/file
renderers use the server read model. Video/audio provider playback and native
decode acceptance remain unverified. Confirmed sender messages use this reader
too; only unconfirmed local sends use upload metadata directly.

## Changed files and purpose

Backend paths relative to `chat-service/src`:

- `main/java/com/chatapp/chat_service/canonical/message/MessageAttachmentReader.java`:
  capability-local bounded authorization/reference/asset hydration.
- `main/java/com/chatapp/chat_service/canonical/controller/MessageAttachmentController.java`:
  authenticated actor, HTTP bindings, no-store.
- `main/java/com/chatapp/chat_service/canonical/message/MessageService.java`:
  stop publishing the raw out-of-order attachment event; persist references as before.
- `test/java/com/chatapp/chat_service/canonical/message/MessageAttachment{Reader,Controller}Test.java`:
  authorization ordering, privacy, metadata origin, unavailable states, continuation,
  failures, binding/JSON/OpenAPI and limits.

Frontend paths relative to `chatapp_frontend`:

- `src/features/messenger/api/message-attachments.api.ts`: typed, scoped HTTP page
  validation, HTTPS/no-credential links, continuation and abort/no-store.
- `src/features/messenger/components/chat/MessageAttachments.tsx`: focused visible
  read/presentation states, scoped request disposal, spoiler and image retry.
- `src/features/messenger/components/chat/MessageItem.tsx`: reuse attachment surface
  instead of duplicating inline media rendering.
- `src/features/messenger/api/messenger.api.ts`, `types/messenger.types.ts` under
  that feature: retain the canonical hasAttachments flag in the display model.
- `src/features/messenger/model/{useMessenger.ts,message.slice.ts,messenger.store.types.ts}`:
  remove obsolete raw attachment subscription/mutator. Message commands unchanged.
- `src/shared/i18n/resources.ts`: concise VI/EN states.
- `scripts/message-attachments-{api,browser}-smoke.mjs`, `package.json`: read tests.
- `scripts/attachment-browser-smoke.mjs`: sender regression fixture now supplies
  the real attachment read contract after confirmation, not an optimistic-only pass.
- `docs/api/{openapi,asyncapi}.yaml`, ADR0022, TODO/testing/traceability and this report:
  single read contract and removal of obsolete event.

## Verification actually run

- Reader test first failed compilation before the production reader existed.
- Targeted Maven reader/controller: **13 tests pass**. A controller test initially
  failed due to restubbing a throwing Mockito method; corrected to doThrow, without
  bypassing the endpoint assertion.
- `./mvnw.cmd -q test` on the final backend production source: **715 tests pass**.
  One subsequent new limits test passed in the targeted run; current fresh XML
  reports aggregate **716 tests/115 suites**, no failures/errors/skips. This is a
  full run plus the changed targeted suite, not a second full 716-test run.
  Old Cassandra IT reports from another date are excluded.
- `npm run validate` and final `npm run build`: pass. Final lint after browser test
  edits: pass. No remaining component lint warnings.
- `npm run test:attachments:read-api`: **7 grouped checks pass**, including wrong
  scope, invalid URLs/metadata, duplicates, cursor protocol, invalid keys and errors.
- `npm run test:e2e:attachments-read`: **18 groups pass**, 11 message attachment
  reads; received history, reload, controlled 503/retry, unavailable, spoiler
  no-preload, pagination, image404/retry, forbidden and actual canonical
  MESSAGE_SEND frame. Eight ready-state width/theme captures, plus error,
  unavailable and spoiler captures. No collected unexpected console/runtime or
  non-abort request failures. The first realtime fixture attempt used its previous
  socket; fixed to wait for the current page's socket/subscription before delivery.
- `test:e2e:attachments`: bubble5 (one upload/two exact posts), partial-upload5
  (three uploads/one complete post), new-draft5 (new draft/file preserved) pass.
- `test:e2e:threads`:19; `test:e2e:chat-ux`:39 pass, four widths/light-dark and
  custom room overrides in the workspace regression.
- Metadata7, upload-cache7, realtime subscriptions11, send-attempt19, forward API23
  pass. Locale scan1246 keys, missing [].
- `git diff --check`: pass, incumbent CRLF notices only.

Java uses process-local JDK20. Browser uses an owned production Next server3117,
isolated Chromium and controlled canonical HTTP/STOMP/provider image bytes. No
live Cassandra, broker, Cloudinary, credentials or real user messages are involved.

## Captures

`chatapp_frontend/.impeccable/review/message-attachment-read-{light|dark}-{320|768|1024|1440}.png`

Additional `message-attachment-read-{error|unavailable|spoiler}-light-1440.png` in
the same directory. Captures wait for message ancestor opacity to finish painting.
Dark320 received state and light1440 error were visually inspected. The decoded
image is a controlled 1px PNG, not an art/provider-thumbnail quality proof.

## Review / remaining work

Capability-local service and UI, no generic framework/outbox. Membership and
message visibility precede asset URLs; blocked/deleted paths do not read assets.
Errors retain factual distinction from missing assets. Request lifetime is local
and aborted, identities/session are part of the component key; private file views
are not put into localStorage. Production reads remain point-in-time, not atomic
with a concurrent ban/delete. Already known public provider URLs cannot be revoked
by this API. Re-evaluation occurs on remount/read, not continuous asset push updates.

M2 durable pre-provider upload intents, message/reference crash repair, deletion
jobs and orphan reconciliation remain open. M3 still needs full media states and
real image/video/audio/file/provider/performance/accessibility acceptance, stronger
cross-session late-response tests and actual datastore/two-client/crash gates.
Docker remains deferred by the user. No commit/push and no claim that the overall
roadmap is finished.
