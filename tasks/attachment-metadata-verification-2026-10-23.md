# Attachment metadata and exact-command retry — 2026-10-23

## Result and reproduced failures

The upload adapter discarded width/height/durationMs; the send serializer also
omitted them, although backend asset validation compares those exact fields.
A failing test against the actual transpiled production upload adapter reproduced
`undefined` instead of width1280 before the fix. Frontend Attachment now carries
these facts through upload, optimistic state and send. Missing values serialize
as null rather than fabricated dimensions/duration; known zero duration survives.

The backend previously accepted arbitrary thumbnailUrl alongside otherwise valid
asset metadata. A new real-policy test failed because no exception was raised.
The shared attachment policy now accepts a supplied thumbnail only if it exactly
matches a READY variant read under the same asset key. Owner/ready/source metadata
checks happen first. Null thumbnail needs no extra read; blank, missing, failed,
unavailable and wrong READY URLs do not qualify. Database failure remains failure,
not an empty list or success. The source-verified forward path has the same check;
this does not replace the separate source authorization prerequisite.

The first browser test additionally found retry payload drift: the original
composer send included mentionedUserIds=[], but bubble retry omitted that field.
Source inspection confirmed the same callback drops non-empty mentions and the
mentionEveryone flag. The backend fingerprints the complete MessageSendRequest;
this is not safely interchangeable with a reconstructed display-only message.
A failing optimistic callback test established the missing command snapshot.

Unconfirmed local messages now retain pendingSend, a copied in-memory command
snapshot with original clientMessageId, room, attachments, mention and reply/GIF/
sticker fields. Arrays/attachment records/GIF identity are detached from caller
inputs before asynchronous fingerprinting; displayed attachment records are also
separate. Bubble retry uses that command only in its original room. No random-ID
fallback or guessing from history is retained. The button requires the local
snapshot and callback. HTTP confirmation discards the snapshot. It is not a new
backend field, persisted outbox, sessionStorage copy of text/URLs, or reload replay.

## Changes in this increment

Existing dirty edits in these files were preserved; this is not a claim that their
entire Git diff belongs to this increment.

- `chatapp_frontend/src/features/messenger/types/messenger.types.ts`: optional
  source dimensions/duration and local-only pendingSend type.
- `chatapp_frontend/src/features/messenger/api/messenger.api.ts`: exact numeric
  metadata upload/send mapping; nullable upload thumbnail normalized to absent UI
  value rather than an invented URL. No additional fetch/provider dependency.
- `chatapp_frontend/src/features/messenger/model/useMessenger.ts`: capture original
  command before asynchronous work, preserve it on failure, clear after confirmation.
- `chatapp_frontend/src/widgets/chat-window/ChatWindow.tsx`: retry the recorded
  command, including mentions, instead of reconstructing it with a new ID fallback.
- `chatapp_frontend/src/features/messenger/components/chat/MessageItem.tsx`: do not
  offer an executable retry without the local command and handler; no style/layout
  rewrite or new copy.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/message/MessageAttachmentPolicy.java`:
  asset-scoped confirmed-thumbnail validation after authorization/metadata matching.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/message/MessageAttachmentPolicyTest.java`:
  six new tests, ten total; exact/missing dimensions and duration, normal/forward
  READY match, rejection states, null/blank semantics, access order and store failure.
- `chatapp_frontend/scripts/attachment-metadata-smoke.mjs`: seven controlled
  production-adapter/callback groups for image/video/audio/zero/null/multiple files,
  retry, local snapshot isolation and no snapshot leakage into HTTP JSON.
- `chatapp_frontend/scripts/attachment-browser-smoke.mjs`: production Chromium
  upload → controlled503 → keyboard bubble retry; exact body/ID/asset preservation,
  one upload/two sends, actual image decode, eight viewport/theme checks/captures.
- `chatapp_frontend/scripts/gif-message-flow-smoke.mjs`: assertions compare GIF
  identity values where snapshots intentionally detach caller objects. Missing or
  changed provider IDs still fail; this is not weakening identity validation.
- `chatapp_frontend/package.json`: explicit metadata and attachment browser commands.
- `docs/api/openapi.yaml`: exact attachment schema and READY-thumbnail/retry rule.
- Checklist, testing, traceability and message-draft flow documentation: scoped
  result and remaining boundaries.

No schema, credentials, environment files, dependency/provider setup, database or
Git commits/pushes were changed. No real provider IO or Docker probes were made.

## Executed evidence

Backend commands use process-local Java20; frontend tests use Node22.21.1 and the
installed TypeScript/Playwright. The app was built with Next16.3.3. The final owned
production server ran only at 127.0.0.1:3117 and was stopped after testing.

| Command | Observed result |
| --- | --- |
| `npm run test:attachments:metadata` | Initially failed at lost width, later at missing local command; final7 groups pass |
| `./mvnw.cmd -q -Dtest=MessageAttachmentPolicyTest test` | Initially1 failure for accepted forged thumbnail; after fix passes |
| `./mvnw.cmd -q -Dtest=MessageAttachmentPolicyTest,MessageForwardPolicyTest test` | Pass |
| `./mvnw.cmd -q test` | 703 tests /113 fresh suites, zero failures/errors/skips |
| `./mvnw.cmd -q -Dtest=MediaThumbnailControllerTest test` | Additional4 pass after OpenAPI doc changes; parses entire YAML |
| `npm run validate` (root) | Type-check and lint pass |
| `npm run build` (root) | Final production build/type compilation/static generation pass after retry changes |
| `npm run test:e2e:attachments` | Final4 controlled groups; one upload/two message posts; exact body; keyboard retry; real image decode; eight theme/width configurations; zero warnings/errors/failed requests |
| `npm run test:e2e:chat-ux` | 39 groups, four widths/both themes and custom-room overrides pass |
| `npm run test:e2e:threads` | 19 groups, eight configurations pass |
| `npm run test:e2e:message-drafts` | Pass, same-ID retry after reload for text drafts, account isolation, invalid-draft cleanup, mobile bounds; zero collected errors/request failures |
| `npm run test:gifs:message-flow` | 15 groups pass; intentional snapshot copy required replacing reference-equality assertions with identity-value assertions |
| `npm run test:stickers:send-flow` | 4 groups pass |
| `npm run test:messages:send-attempt` | 19 groups pass, existing per-tab hash-only storage |
| `npm run test:forwards:api` | 23 groups pass |
| `npm run test:i18n:copy` | 1239 keys checked, no missing keys |
| `git diff --check` | Pass, incumbent CRLF notices only |

Full backend reports were aggregated from the run beginning
`2026-10-23T07:31:11+07:00`. The old 2026-10-20 ChatReadCassandraIT error report is
historical, excluded and not deleted or counted as newly passing. The schema is
unchanged this turn; the preceding84/714/2 static result is historical, not newly
claimed database verification.

Browser testing uses isolated Playwright because Chrome DevTools MCP is not
available here. HTTP, device registration, SockJS/STOMP and the Cloudinary fixture
asset are intercepted. An initial invalid device fixture produced a warning; it
was corrected to the actual device DTO before the final zero-warning run. The
deliberate503 and its handled send errors are expected fault injection, not an
unexplained production network failure.

## Captures and review

Final captures are in `chatapp_frontend/.impeccable/review/`:
`attachment-metadata-{light|dark}-{320|768|1024|1440}.png`. Light1440 and dark320
were visually inspected. The visible image is a controlled decoded1px PNG, not
proof of real provider rendering quality or a media-art redesign. Earlier
desktop/mobile filenames are preliminary captures, not final acceptance evidence.

Review: preserve server facts rather than infer dimensions; keep command identity
separate from rendered state; authenticate before thumbnail reads; no fallback URL,
new idempotency ID, provider call or unbounded thumbnail scan. UI uses the incumbent
keyboard-accessible button and semantic theme tokens. No layout/color redesign was
needed for the retry guard. The existing versioned session store still saves only
a fingerprint/ID, not another persistent copy of private message/attachment content.

## Still open

- This is controlled upload/send/bubble-retry acceptance, not live Cassandra,
  actual upload/generation, two clients, broker replay or restart/crash safety.
- pendingSend is deliberately memory-only. Reload does not recover selected File
  objects or a complete attachment outbox.
- Composer-level repeat Send after failure still re-uploads selected files; safe
  reuse of uploaded batches, draft-aware cleanup after bubble retry and cancellation
  need the following M2/M3 increment. Captures still show the retained selected-file
  chip after bubble success; this has not been declared completed UX.
- Incoming attachment-event/history hydration also needs its own canonical media
  adapter/render verification; optimistic local success does not prove recipient
  or reload rendering.
- Durable provider pre-IO intent/reference/deletion/orphan recovery, thumbnail
  processing/retry UI and live provider output inspection remain open.

The media parent and full feature-expansion goal remain active/incomplete.
