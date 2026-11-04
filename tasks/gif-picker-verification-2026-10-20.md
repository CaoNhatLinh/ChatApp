# GIF composer picker —2026-10-20

## Outcome and scope

The content menu now opens a dedicated GIPHY picker. Blank web key shows a clear
unconfigured state and performs no provider request. Configured picker supports
exact-query search, explicit paging, preview playback, image failure recovery,
selection through the existing canonical send path and inline send failure.
Text/file drafts are not consumed. G1/G2 code and scoped controlled acceptance
have progressed; live Cassandra/provider/two-client gates and the overall
feature-expansion roadmap remain incomplete.

## Files changed in this slice

- `features/gifs/model/useGiphySearch.ts`: query/locale-scoped page state,
  abort cleanup, stale visibility suppression, synchronous busy guard, bounded
  forward offsets and same-offset retry. No sorting/filtering/deduplication of
  provider results and no durable media cache.
- `features/gifs/components/GifPicker.tsx`: separate provider shelf, exact query
  debounce300ms/50-character input, privacy disclosure, manual pages, static
  previews by default with explicit playback, existing attribution and VI/EN
  unconfigured/loading/empty/quota/error/send feedback.
- `features/gifs/components/GifSearchResult.tsx`: per-item preview error/retry,
  disabled blind selection, retained result position and focus restoration.
- `messenger/components/MessageInput/MessageInput.tsx`: canonical GIF send with
  reply context and untouched draft; mutually exclusive GIF/sticker/emoji shelves.
- `MessageInput/components/MessageInputToolbar.tsx`: content-menu entry and
  pending panel callback opened after menu focus-scope closure (GIF/sticker/poll).
  No document-level Escape listener or magic focus timeout.
- `shared/i18n/resources.ts`, `package.json`, `scripts/gif-picker-smoke.mjs`:
  copy, reproducible browser command and regressions.
- `DESIGN.md`, `docs/flows/giphy-gifs.md`, `tasks/todo.md`, this report and prior
  checkpoint pointer: current interaction contract and exact remaining gates.

All frontend paths above are inside `chatapp_frontend/src` unless explicitly a
script/document. No backend/schema/dependency/lockfile/local env changed here.

## Bugs observed and repaired

The initial browser test could not find the menu entry. The first picker build
then failed the unconfigured Escape/focus case: Radix menu teardown stole or
trapped the newly mounted panel's focus. Merely suppressing return-focus was not
sufficient. The final code records the selected panel callback and opens it only
from menu-close autofocus handling, after its scope closes. The direct focus
assertion and Escape now pass without manually focusing the picker in the test.

Another failure followed preview retry: removing its focused retry button left
focus on the document, so Escape did not reach the shelf. Per-result state owns
a selection ref and restores focus after retry. The test asserts that exact
button is active before pressing Escape. Fixed without global keyboard capture.

## Executed checks

- Final `npm run validate && npm run build`: exit0, TypeScript/full lint and17
  routes. Process-local fixture-key builds were replaced with a normal build;
  no env file was edited. The final normal build's unconfigured test passed.
- Configured `test:e2e:gifs-picker` with process-local
  `NEXT_PUBLIC_GIPHY_API_KEY=fixture-web-key`, `SMOKE_GIPHY_CONFIGURED=1`:
  exit0,17 grouped Chromium checks, all GIPHY/Nối/artwork routes controlled.
  Covers still/default and explicit preview playback, pagination, rapid clicks
  issuing one pending page request,503 page retry at the same offset, debounce,
  actual old request cancellation and late-response suppression,429/retry, empty
  search, uncertain send and same-ID retry, new-ID subsequent identical send,
  preserved draft, broken preview/disabled choice/retry focus, Escape and EN
  picker/privacy copy. Does not exercise a live backend/provider/realtime client.
- Normal `test:e2e:gifs-picker`: exit0,3 groups, VI/EN unconfigured state, zero
  provider requests, actual entry focus and Escape return to composer.
- Final normal-build regressions: `test:e2e:chat-ux`39 groups + eight responsive
  theme entries; `test:e2e:stickers-member`26 groups; `test:e2e:polls` exit0,
  create retry identity/vote/remove/close/mobile checks. Poll emits expected503
  failure logs; no unexpected console errors. Browser fixture checks do not prove
  clean production network/console or live signaling.
- `test:gifs:api`23, `test:gifs:message-flow`9: pass. `test:i18n:copy`1170 scanned
  keys, none missing. Backend source unchanged since388-test run, not rerun.
- `git diff --check`: exit0, existing CRLF conversion warnings only.

## Visual evidence

Eight current files at
`chatapp_frontend/artifacts/ui-audit/current/gif-picker-{light,dark}-{320,768,1024,1440}.png`.
Shelf containment/no document overflow asserted for each. Dark320 inspected
directly. Labels, room, search and SVG artwork are controlled fixture data, not
a fake app catalog or actual user/provider content. Screenshots do not prove
real animated frames, all custom themes or every accessibility criterion.

Frontend/React/incremental/TDD guidance kept fetching separate from presentation,
effects tied to scope, result error state local and feedback inline. Self-review,
not an independent-agent/provider approval. No live provider API request, secret
read, Docker install, public tunnel, commit/push or unrelated worktree cleanup.
The owned temporary3117 server is stopped after verification;3116 is untouched.

## Remaining acceptance

Real GIPHY key/quota/production approval, live Cassandra writes/claims and two
clients through actual realtime; extended custom-room/revocation/latency/timeout
and composer race acceptance. The user deferred Docker. Push remains deferred;
no moderation detector is implied by rating=g. Next approved scope remains
thread/reply validation/index/UI, forward provenance, calls/media/settings/email
and moderation, plus remaining sticker/admin gates in the main todo.
