# Sticker member data/send foundation — 2026-10-12

Scope: S5 foundation only. Members use published packs; catalog mutations remain global-admin-only. No member upload/editor added.

## Changes

- `chatapp_frontend/src/features/messenger/types/messenger.types.ts`: sticker identity in message model and send request.
- `chatapp_frontend/src/features/messenger/api/messenger.api.ts`: preserve identity in history/realtime/HTTP acknowledgements and include it in send payload. No client artwork URL/caption added.
- `chatapp_frontend/src/features/messenger/model/useMessenger.ts`: permit an ID-bearing sticker with empty text, include its identity in retry fingerprint and optimistic message. Existing send/acknowledgement/failure flow remains shared.
- `chatapp_frontend/src/features/stickers/api/stickers.api.ts`: typed historical artwork read keyed by conversation, message and canonical bucket; pass cancellation signal; propagate membership failures rather than bypassing through public catalog.
- `chatapp_frontend/scripts/sticker-message-api-smoke.mjs`, `sticker-send-flow-smoke.mjs`: controlled production adapter and production callback tests. The callback is extracted with TypeScript AST; these checks do not mount React or prove browser interaction.
- `chatapp_frontend/scripts/sticker-api-smoke.mjs`, `message-send-attempt-smoke.mjs`: historical null artwork, encoded path, bucket/signal, forbidden propagation, exact sticker retry after reload and different sticker identity.
- `chatapp_frontend/package.json`: executable commands for new checks.

## Evidence

Tests were run failing first: canonical mapping dropped sticker ID; historical artwork adapter was absent; hook ignored empty-content sticker. After implementation:

- `npm run test:stickers:api`: exit 0, 13 reported checks.
- `npm run test:stickers:message-api`: exit 0, 3 reported concepts.
- `npm run test:stickers:send-flow`: exit 0, 3 reported concepts including transport failure retaining attempt identity.
- `npm run test:messages:send-attempt`: exit 0, 14 reported checks.
- `npm run validate`: exit 0 (TypeScript and ESLint).
- `npm run build`: exit 0, Next.js 16.3.3, 17 routes generated.
- `git diff --check`: exit 0; existing CRLF conversion warnings, no whitespace errors.

## Not yet achieved

Member pack picker, image rendering/loading/unavailable states, edit-action suppression, browser/realtime integration and notification preview work remain S5. No visual layout changed here, so no new screenshot is claimed. Controlled transport tests are not live Cassandra/provider checks. Global feature expansion remains incomplete; no commit/push performed in this slice.
