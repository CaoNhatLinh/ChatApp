# GIF frontend data flow and history —2026-10-20

This is the pre-picker checkpoint. The subsequent composer implementation and
its newer acceptance evidence are in `tasks/gif-picker-verification-2026-10-20.md`;
that follow-up supersedes picker-pending statements, not the earlier test results.

## Delivered slice and limits

Typed provider identity now survives message HTTP/history/WS mapping, optimistic
send and explicit failed-message retry. The existing send-attempt payload hash
includes the nested reference without storing GIF IDs/URLs in per-tab records.
GIF messages render through viewport-lazy direct GIPHY lookup with cancellation,
play/pause, reduced-motion still, unavailable/error/quota/unconfigured states and
official static attribution. The picker/composer selection action is still
pending: this is not complete GIF send UI or live integration acceptance.

## Files and reasons

- `features/messenger/types/messenger.types.ts`, `api/messenger.api.ts`: GIF type
  and canonical gif reference in send/read/history mapping, no media URL fields.
- `model/useMessenger.ts`, `widgets/chat-window/ChatWindow.tsx`: allow empty-content
  GIF only with identity; optimistic/request/retry preserve it and use existing
  send-attempt correlation. No alternate send transport or URL-as-text shortcut.
- `features/gifs/api/giphy.client.ts`: configured provider instance, no import-time
  IO; blank public key stays unavailable. Actual local env was not read/edited.
- `features/gifs/components/MessageGif.tsx`, `GiphyAttribution.tsx`,
  `messenger/components/chat/MessageItem.tsx`: direct authorized-history reference
  rendering, pause/reduced-motion, failed/missing/unconfigured states; omit copy
  and edit. Lookup aborts on identity/session/room/unmount; no persistent media cache.
- `features/notifications/model/notification-copy.ts`,
  `messenger/utils/conversation-preview.ts`, `constants/messengerCopy.ts`,
  `shared/i18n/resources.ts`: readable GIF previews/search type and VI/EN labels;
  do not regenerate empty redacted bodies or translate literal user text GIF.
- `public/giphy-powered-by.png`, `docs/brand/giphy-attribution.md`: unmodified
  provider-published static attribution with source/hash. This static-branding
  archive download was performed; no live provider API request was performed.
- `scripts/gif-message-flow-smoke.mjs`, `gif-history-smoke.mjs`,
  `message-send-attempt-smoke.mjs`, `notification-copy-smoke.mjs`, `package.json`:
  executable regression coverage. Docs/flows/todo record partial acceptance.

## Observed verification

Initial mapping test failed because gif was undefined. The browser unconfigured
case failed before MessageGif existed. GIF notification test failed before the
structured-type copy branch. A test fixture incorrectly required attachments
to be an array rather than accepting the canonical optional/absent value; that
assertion was corrected, not the production contract.

- `test:gifs:message-flow`:9 groups, actual adapter + TypeScript-AST-extracted
  production callback with controlled store/HTTP. Preserved send/hash/optimistic/
  acknowledgment/retry IDs; failures remain retryable; no provider URL payload.
- `test:messages:send-attempt`:17 groups, actual WebCrypto + controlled tab storage;
  reload/different GIF identity and hash-only storage verified.
- `test:notifications:copy`:12; `test:gifs:api`:23; sticker send-flow4: pass.
- `npm run validate`: exit0, TypeScript/full lint. Subsequent test-script-only
  additions received scoped ESLint, exit0. Final `npm run build`: exit0,17 routes.
- `test:i18n:copy`:1160 scanned keys, none missing. This static scanner does not
  enumerate every conditional label; dynamic labels have explicit resource entries.
- Normal build `test:e2e:gifs-history`:2 groups, VI/EN unconfigured copy, zero
  GIPHY requests. Repeated after final normal build to prove fixture key removed.
- A separate build with process-local `NEXT_PUBLIC_GIPHY_API_KEY=fixture-web-key`
  ran8 controlled Chromium history groups: still for reduced motion, explicit
  play/pause unchanged URLs, official attribution, no edit/copy, error/retry,
  missing ID and deleted message without provider fetch. GIPHY/API/artwork routes
  intercepted; no real key/provider/DB. No env file was modified.
- Captured all320/768/1024/1440 light/dark states; image containment and document
  overflow assertions pass. Eight `chat-gif-{light,dark}-{width}.png` files in
  `chatapp_frontend/artifacts/ui-audit/current`. Artwork is a controlled SVG fixture,
  not a production GIF catalog. Dark320 capture inspected directly.
- Final normal build regression: chat UX39 + eight theme/width entries, sticker
  member26, no browser `pageerror`. No full live console/latency claim.
- `git diff --check`: exit0, pre-existing CRLF warnings only. Backend unchanged
  since its388-test successful run, not rerun just for reassurance.

Frontend/React/TDD guidance kept effects tied to primitive identity, media URLs
out of durable state and error copy inline. Self-review, not an independent-agent
review. No additional dependency, backend/provider secret, tunnel, database reset
or commit/push. The temporary fixture-key build was replaced by a normal build.

## Still open

G1 dedicated picker/query privacy/debounce/cancel/paging/selection/send; actual
picker-to-send/retry/realtime acceptance; live Cassandra/provider key/quota,
revocation/stale-source stress, custom-room/error/reduced-motion extended matrix
and complete roadmap. Static attribution extraction and a green fixture test
are not provider production approval. Docker remains deferred by user choice.
