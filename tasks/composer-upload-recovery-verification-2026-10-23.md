# Composer upload reuse and confirmation cleanup — 2026-10-23

## Implemented behavior

The actor/room-keyed composer now retains confirmed upload metadata in memory by
the actual selected File object. Repeating Send after message failure reuses those
assets and therefore the original message fingerprint/clientMessageId. It does
not upload the same confirmed selection again or reconstruct another message ID.
Changing the command remains a new intent under the incumbent fingerprint policy.

Uploads are resolved one file at a time through the existing single-upload API.
If a later file fails, earlier confirmed results remain cached and retry resumes
the missing file. The message is not sent with only the successful subset.
This deliberately avoids the ambiguous partial outcome of the existing sequential
multi-upload endpoint; it trades extra HTTP round trips for confirmed per-file
progress. It does not make provider IO exactly-once or crash-safe.

A local onPrepared lifecycle callback records the canonical command ID before
optimistic insertion/HTTP. This callback is not part of the backend request, hash
or pendingSend DTO. Recovery observes only the actor's matching canonical
confirmation in the original room. It releases the matching cached files and
removes just those File objects from the selection. Text/reply are cleared only
when the draft revision and edit/reply context still match. New text and newly
selected File objects survive another message's confirmation.

Removed selections release cached results and abort their pending request.
Unmount disposes the cache, aborts outstanding client HTTP and prevents a departed
composer from subsequently sending or clearing a new room's draft. The caller is
already keyed by actor and conversation in ChatWindow. Nothing is shared globally
or persisted to local/session storage as file contents, URLs or command text.
An edit confirmation also avoids closing an editor whose draft changed in flight.

## Changed files and purpose

Existing dirty changes were preserved; the full Git diff of an existing file is
not attributed to this increment.

- `chatapp_frontend/src/features/messenger/model/composerUploadCache.ts`:
  per-instance confirmed/pending upload cache, exact per-file response cardinality,
  detached metadata, concurrent request reuse, explicit release/disposal/fencing.
- `chatapp_frontend/src/features/messenger/hooks/useComposerSendRecovery.ts`:
  mount scope, revision/context guard, command preparation and confirmation-driven
  file/draft cleanup. This keeps lifecycle bookkeeping out of the large composer.
- `chatapp_frontend/src/features/messenger/components/MessageInput/MessageInput.tsx`:
  cache-backed sending and change tracking; removes obsolete partial-upload-success
  branches; intentional cancellation is quiet; confirmation does selective cleanup.
- `chatapp_frontend/src/features/messenger/model/useMessenger.ts` and
  `types/messenger.types.ts`: named MessageSendOptions and local-only onPrepared
  callback; optional AbortSignal propagation through uploadMessageFiles.
- `chatapp_frontend/src/features/messenger/api/messenger.api.ts`:
  upload AbortSignal reaches both canonical single/multiple HTTP adapters.
- `chatapp_frontend/scripts/composer-upload-cache-smoke.mjs`:
  seven controlled production-model groups for reuse, detached facts, release,
  partial failure, concurrent calls/disposal, protocol rejection and scope isolation.
- `chatapp_frontend/scripts/attachment-metadata-smoke.mjs`: verifies cancellation
  reaches the actual production HTTP adapter; existing metadata/retry checks retained.
- `chatapp_frontend/scripts/attachment-browser-smoke.mjs`: five explicit modes:
  composer retry, bubble retry, newer draft, partial upload and leave-during-upload.
  No force-click, fake DOM hiding or real provider connection.
- `chatapp_frontend/scripts/message-edit-smoke.mjs`: connected SockJS/STOMP,
  empty incoming-call page and canonical device fixtures for an independent edit
  regression. Product offline-call layout was not silently changed by this fixture.
- `chatapp_frontend/package.json`: `test:attachments:upload-cache` command.
- Checklist, message-draft flow, testing and traceability documentation: scoped
  acceptance and explicit remaining work.

No backend/schema/dependency/credential/environment file, provider setup, database,
commit or push was changed. No Docker probe or real upload/delete was performed.

## Executed verification

- Initial new-cache test failed with missing production module (ENOENT), then
  passed after implementation. Source inspection, not an invented old-browser
  result, established the incumbent unconditional re-upload.
- An intermediate newer-draft browser test reproduced an already-confirmed file
  remaining selected (1 instead of0). Cleanup was corrected from all-or-nothing
  revision handling to per-file removal plus revision-protected text/reply cleanup.
- Initial lint found an unbound method and callback dependency warnings; named
  stable callbacks/arrow functions resolved them. Final validate/build pass.
- A room-switch fixture initially omitted canonical interaction-page fields and
  produced an error; corrected before final positive cancellation acceptance.

| Command | Actual result |
| --- | --- |
| `npm run test:attachments:upload-cache` | 7 controlled model groups pass |
| `npm run test:attachments:metadata` | 7 adapter/optimistic groups pass, including real AbortSignal config propagation |
| `npm run validate` (root) | Final TypeScript/lint pass after cleanup changes |
| `npm run build` (root) | Final Next16.3.3 production build/type compilation/static page generation pass |
| `npm run lint` | Additional final pass after the last test-script edits |
| `ATTACHMENT_RETRY_MODE=composer npm run test:e2e:attachments` | 5 groups:1 upload,2 identical message posts, cleared confirmed selection |
| `ATTACHMENT_RETRY_MODE=bubble npm run test:e2e:attachments` | 5 groups:1 upload,2 identical posts, keyboard retry and confirmation cleanup |
| `ATTACHMENT_RETRY_MODE=new-draft npm run test:e2e:attachments` | 5 groups: old command unchanged; old file removed, new file/text retained |
| `ATTACHMENT_RETRY_MODE=partial-upload npm run test:e2e:attachments` | 5 groups:3 upload attempts for two files,1 full message post; first file not uploaded twice |
| `ATTACHMENT_RETRY_MODE=leave-upload npm run test:e2e:attachments` | 3 groups:1 pending upload, observed net::ERR_ABORTED,0 message posts after room switch |
| `npm run test:e2e:message-drafts` | Pass: same-ID text retry across reload, account isolation, draft cleanup, no collected errors/request failures |
| `npm run test:e2e:message-edit` | Final pass: exact PUT/bucket/content, revision read, preserved unrelated draft; no collected errors/request failures |
| `npm run test:e2e:chat-ux` | 39 groups and full light/dark width matrix/custom-room theme regressions pass |
| `npm run test:gifs:message-flow` | 15 groups pass |
| `npm run test:stickers:send-flow` | 4 groups pass |
| `npm run test:messages:send-attempt` | 19 groups pass |
| `npm run test:i18n:copy` | 1239 keys checked, no missing keys |

Shell invocations set the listed mode and SMOKE_BASE_URL process-locally in
PowerShell. Browser modes ran against the owned production server at
127.0.0.1:3117 with intercepted HTTP/device/SockJS/STOMP/Cloudinary fixture IO.
The four completed-send modes each verify 320/768/1024/1440 in both themes,
actual fixture image decoding, keyboard retry where applicable and no unexpected
errors/warnings/failed requests. Cancellation verifies a deliberately aborted
client request, not a provider rollback. Backend703/schema84/714/2 are preceding
evidence, not rerun claims for this frontend-only increment.

The owned test server was stopped after all browser commands; a read-only port
check confirmed no listener remained on3117. No unrelated process was terminated.

## Captures and review

32 final images:
`chatapp_frontend/.impeccable/review/attachment-recovery-{composer|bubble|new-draft|partial-upload}-{light|dark}-{320|768|1024|1440}.png`.
Bubble dark320 and final newer-draft light1440 were visually inspected; fixtures
use a decoded1px PNG, not a provider image-quality/design approval. Old preliminary
captures are not final acceptance evidence.

Correctness: exact confirmed metadata and command identity, no partial sends,
new-draft protection, no old-room post after client cancellation. Architecture:
capability-local cache/hook, existing request fingerprint, no new generic outbox or
global cache. Security: actor/room ownership, no persistent private file/command
copy, no provider-delete compensation. Performance: selected File objects are not
copied into new byte buffers; confirmed/removed selections are released. Per-file
HTTP is sequential and bounded by the ten-file composer limit. Live upload latency
and heap/load behavior remain unmeasured.

## Remaining issues and gates

- Cache and selected File recovery do not survive unmount/reload. No durable
  upload intent, provider reconciliation, asset reference/deletion/orphan worker
  or historical/incoming media hydration has been completed by this increment.
- An upload whose provider success was not confirmed to the client is still
  ambiguous. Retrying it may orphan provider data; client AbortSignal does not
  cancel provider processing or establish deletion. M2 must resolve this durably.
- The edit regression initially failed because the disconnected incoming-call
  feedback overlay intercepted Save changes on desktop. A connected fixture makes
  edit semantics independently testable; the real offline overlay/composer overlap
  remains an explicit UX defect, not a silently fixed or waived production state.
- Live Cloudinary/Cassandra/broker/two-client/crash acceptance remains open. Docker
  is still deferred by the user. Do not mark the media parent/full goal complete.
