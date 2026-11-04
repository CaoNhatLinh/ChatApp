# Reply source/index — controlled verification, 2026-10-20

## Scope and outcome

T1 foundation only, not a completed thread feature. New replies carry the exact
parent message ID and bucket, confined to the current conversation. The backend
resolves the actual parent sender. The client no longer supplies that sender.

Membership/send permission, archived-room and chat policy checks precede source
lookup. Invalid/partial source keys fail validation. Missing/deleted/blocked
sources share an unavailable response. Exact committed retries are checked before
mutable source availability, and repair the deterministic reply projection.
Changing the parent bucket changes the message request fingerprint.

## Implementation files and reasons

- `canonical/message/MessageReplyPolicy.java`: source-key validation and one exact,
  current-room lookup; no history scans or inferred bucket.
- `canonical/dto/CanonicalApiContracts.java`, `canonical/model/CqlCanonicalRecords.java`:
  input bucket replaces untrusted sender; stored/output bucket is retained.
- `canonical/message/MessageService.java`: resolve sender before new allocation,
  preserve source in storage/realtime and repair the projection on committed retry.
- `canonical/message/MessageRepository.java`, `CassandraMessageRepository.java`:
  message and parent index share a logged batch at LOCAL_QUORUM. Projection identity
  uses persisted child creation time and message ID, so retry does not allocate
  another reply row. Existing non-reply writes keep their single statement path.
- `canonical/message/PublicMessageView.java`: deleted public messages redact the
  parent bucket as well as other retained references.
- `chat_app_complete.cql`, `docs/api/openapi.yaml`: canonical fresh schema/contract.
  No host database was changed and no legacy constructor/DTO alias was added.
- Frontend `messenger.types.ts`, `messenger.api.ts`, `useMessenger.ts`,
  `MessageInput.tsx`, `ChatWindow.tsx`: full key survives text/sticker/GIF send,
  mapping, optimistic failure and explicit retry. Send-attempt hashing includes it.
- `MessageItem.tsx`: server-confirmed reply reference remains visible without
  inventing source text or a sender name. Existing VI/EN source action is reused.
- Tests using `CanonicalMessage` constructors were mechanically updated for the
  added stored field; no compatibility overload masks missing data.

Paths above under `canonical/` are relative to
`chat-service/src/main/java/com/chatapp/chat_service/`; frontend files stay in their
existing messenger/widget directories.

## Verification observed

- JDK20 `./mvnw.cmd -q test`: exit0; 397 tests in 81 default suites, no failures,
  errors or skips. The opt-in Cassandra IT is excluded from that count.
- Focused reply-policy/service/repository/GIF/public-redaction suite: exit0.
  Covers invalid keys, missing/deleted/blocked sources, actual sender, realtime key,
  committed retry, fingerprint conflict, logged-batch shape and deterministic repair.
- Frontend `npm run validate`: exit0 (TypeScript and ESLint).
- `npm run build`: exit0, all 17 routes generated/compiled.
- `node scripts/gif-message-flow-smoke.mjs`: 15 controlled adapter/callback groups,
  including source mapping/send and failed optimistic retention.
- `node scripts/message-send-attempt-smoke.mjs`: 19 controlled storage checks.
- `node scripts/sticker-send-flow-smoke.mjs`: 4 controlled callback groups.
- `npm run test:i18n:copy`: 1170 scanned keys; missing `[]`.
- Production Chromium `message-interactions-smoke.mjs`: reply/send/source jump,
  VI/EN, mention, read-receipt continuation, reaction and pin/unpin; exit0 with no
  unexpected console errors or failed requests. Canonical HTTP is intercepted.
- Production Chromium `chat-workspace-ux-smoke.mjs`: 39 controlled checks plus
  320/768/1024/1440 light/dark matrix; exit0. Dialog contrast measured17.19/17.56.

Screenshots in `chatapp_frontend/artifacts/ui-audit/current/`:
`reply-confirmed-desktop.png`, `reply-confirmed-mobile.png`,
`message-reply-desktop.png`, `message-reply-mobile.png`.
Confirmed mobile screenshot was visually inspected at320px. The initial capture
caught the sidebar's closing transition; the test now waits for its actual bounds
before capturing, rather than masking the sidebar. The fixture uses the canonical
system theme instead of forcing a dark room under a light app.

## Deliberate limits / next work

- User deferred installing Docker. No live Cassandra/provider/two-client test is
  reported as passed. A sixth opt-in `ChatReadCassandraIT` scenario now covers
  actual reply batch round-trip and repeated projection repair, but remains unrun.
- Logged batch is durable replay, not cross-partition isolation or proof of all
  message side effects being crash-safe. Concurrent source deletion after validation
  is not fenced by this batch. Attachments, notifications and other projections
  have their own recovery requirements.
- T2 paged thread query and T3 thread panel/source point rendering are still open.
  The existing source jump remains a bounded history navigation, not a new exact
  point-source viewer. No fake thread list is assembled from cached messages.
- Extended composer races, pending-message actions, revocation, custom-theme and
  live realtime acceptance remain open; these checks do not complete the roadmap.

No provider requests, tunnels, live email, credential edits, database resets,
commits or pushes were performed for this slice.
