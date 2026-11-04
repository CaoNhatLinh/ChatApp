# Member sticker UI — implementation and scoped verification

## Follow-up2026-10-20 (supersedes corresponding pending checks below)

The member pack/artwork shelf now explains filtered empty pages while continuation
remains, in VI/EN, without falsely reporting an exhausted catalog. The shared
`useStickerPage` tracks returned continuation tokens within its fetch scope:
immediate repeats and multi-step cycles fail inline, load-more stops, and explicit
retry retains the failed page cursor. Scope changes reset token history. No API,
backend, schema, library dependency or catalog-management permission changed.

The browser test first failed because empty-page guidance was absent. After that
copy fix, it separately failed because cycle-a→cycle-b→cycle-a did not show an
error. Both regressions pass after the token-history guard. Existing request-abort,
stale-response, rapid double-click, same-cursor retry, notification-drawer VI/EN,
draft retention and canonical send-attempt checks were rerun, not assumed green.

Executed against the final production build:

- `npm run validate` and `npm run build`: exit0, TypeScript/full lint/17 routes.
- `SMOKE_BASE_URL=http://localhost:3117 node scripts/sticker-member-smoke.mjs`:
  exit0,26 grouped behavior checks, eight screenshots, no browser `pageerror`.
  Real Chromium with intercepted canonical HTTP/artwork, not live backend/WS.
  Widths320/768/1024/1440, light/dark; shelf/control containment and no document
  overflow. Delayed old-pack response is released after selecting another pack;
  actual browser cancellation is asserted and stale artwork stays absent.
- Adapter13, message-artwork adapter3, sticker-send-flow4 and notification-copy8
  controlled production checks: exit0.
- `npm run test:i18n:copy`: exit0,1159 keys, none missing.
- `git diff --check`: exit0, existing CRLF conversion warnings only.

Changed files: `StickerPicker.tsx` (actionable continuation-empty states),
`useStickerPage.ts` (cycle rejection), `shared/i18n/resources.ts` (VI/EN),
`scripts/sticker-member-smoke.mjs` (regressions), `docs/flows/sticker-catalog.md`,
`tasks/todo.md` and this evidence. The frontend/testing skill workflow kept the
fix scoped to existing controls and required observed red tests before fixes.
No provider calls, live DB changes, commit/push or independent-agent review.

The original broader custom-theme/reduced-motion/error snapshot and live
two-client/Cassandra/Cloudinary/crash gates are not closed by this follow-up.
The complete feature-expansion roadmap remains unfinished.

## Delivered behavior

Members choose published packs and stickers in an inline shelf opened from the composer content menu. There are no member upload/create/edit/remove controls. Packs/artwork follow the canonical opaque cursor, including filtered empty pages. Text/file drafts are retained when sending a sticker. Optimistic messages and retries retain sticker identity; a confirmed explicit retry clears its matching stored attempt, so an intentional subsequent identical send is new.

Historical artwork uses conversation/bucket/message authorization, loads only when visible, and cancels on unmount/session/identity change. Null or 403/404 artwork is unavailable; transient request/image errors offer retry. No history fallback through the public catalog. Sticker edit/copy actions are omitted. Below 1024px room info is an on-demand layer rather than compressing the chat column; composer/chat flex children use `min-w-0`.

## Files and purpose

- `chatapp_frontend/src/features/stickers/model/useStickerPage.ts`: bounded page loading, cursor continuation, cancellation, deduplication and inline retry state.
- `chatapp_frontend/src/features/stickers/components/StickerPicker.tsx`: member-only pack/artwork shelf and contextual loading/error/empty/send feedback.
- `chatapp_frontend/src/features/stickers/components/MessageSticker.tsx`: viewport-lazy authorized artwork and unavailable/error states.
- `chatapp_frontend/src/features/messenger/components/MessageInput/MessageInput.tsx`, `components/MessageInputToolbar.tsx`: entry action, canonical sticker send, draft preservation and focus restoration.
- `chatapp_frontend/src/features/messenger/components/chat/MessageItem.tsx`: history rendering; omit invalid edit/copy actions.
- `chatapp_frontend/src/features/messenger/model/useMessenger.ts`: clear matching stored send attempts after explicit confirmed retry as well as initial confirmation.
- `chatapp_frontend/src/widgets/chat-window/ChatWindow.tsx`: carry sticker ID in failed-message retry and correct narrow/tablet flex/panel behavior.
- `chatapp_frontend/src/shared/i18n/resources.ts`: Vietnamese/English copy.
- `chatapp_frontend/scripts/sticker-member-smoke.mjs`, `sticker-send-flow-smoke.mjs`, `package.json`: executable controlled browser/send checks.
- `tasks/sticker-member-surface-brief.md`, registered frontend surface brief, `docs/flows/sticker-catalog.md`, `tasks/todo.md`: direction, behavior and explicit remaining gates. DESIGN.md/sidecar documented separately by the scoped documenter.

## Commands and observed results

- `npm run test:e2e:stickers-member`: production Chromium, exit 0; 13 reported concepts, eight ready-state screenshots. Exact-ID retry, new-ID subsequent identical send, text draft, cursor continuation, no admin controls, history null/error/retry, Escape/focus, VI/EN and all four widths/themes. Bounds assertions include the shelf, close hit area, send gutter and readable shelf width; document overflow alone previously missed clipping.
- `npm run test:stickers:send-flow`: exit 0, four concepts. Test failed before the explicit-retry cleanup fix.
- `npm run test:messages:send-attempt`: exit 0, 14 checks including reload-safe sticker retry and different-sticker identity.
- `npm run test:stickers:api`: exit 0, 13 checks; `test:stickers:message-api`: exit 0, three concepts.
- `npm run validate`: exit 0 (TypeScript/ESLint), including final flex/breakpoint changes.
- `npm run build`: exit 0, Next.js 16.3.3, 17 routes.
- `npm run test:i18n:copy`: exit 0, 1,136 checked keys, none missing; run before the final flex-only corrections.
- `git diff --check`: exit 0; CRLF conversion warnings, no whitespace errors.
- Impeccable detector: once on the two new UI components, `[]`.

## Screenshot and review evidence

Eight files: `chatapp_frontend/artifacts/ui-audit/current/member-stickers-{light,dark}-{320,768,1024,1440}.png`. Desktop light1440/mobile dark320 also copied to `.impeccable/review/desktop.png` and `mobile.png`. Images show controlled fixture content; white artwork is a loaded 1×1 PNG fixture, not a production sticker pack. No catalog is seeded in the app.

Fresh finish reviewer returned `fix` for 320px clipping. After composer/chat flex constraints and the tablet info-panel breakpoint correction, its verdict was `ship`: the named mobile-containment fix is resolved; no material regression visible in the other captures. This is a verdict on that fix, not complete feature/backend approval. Initial captures during existing sidebar transitions were discarded and replaced with settled captures.

## Not complete

S5 notification previews, precise empty-page copy while a cursor remains, stale/aborted-response and rapid-pagination coverage, broader custom-theme/reduced-motion/error-state snapshots and actual two-client realtime/Cassandra/Cloudinary runtime gates remain. Browser/API responses were intercepted; WebSocket/provider/database IO is not proven. No claim of a clean live console or performance benchmark. S3 broader navigation/recovery gates and all other expansion slices remain tracked in todo. Owned verification servers stopped; no commit/push or provider calls performed.
