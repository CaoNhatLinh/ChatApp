# GIF provider integration (in progress)

## Current boundary

The approved provider is GIPHY, called directly from the browser. The client
transport is implemented in `src/features/gifs/api/giphy.api.ts`. Backend typed
GIF send/persistence/HTTP/realtime identity is implemented. Frontend typed data
flow, history rendering and the composer picker are implemented. The picker
shows unconfigured state without a web key; with a key it searches GIPHY directly
and sends typed provider identity through the existing message path. Controlled
browser acceptance is not live database/provider delivery acceptance.

`createGiphyClient(webKey)` exposes `list({ query, offset, locale, signal })` and
`get(providerGifId, signal)`. This is not Nối's authenticated Axios client: cookies,
Bearer/session/device credentials and conversation IDs are never added. No call
runs at import time. Do not call this adapter from an SSR route or backend proxy.

## Provider contract

- Empty search uses trending. Nonempty search preserves exactly the entered
  query, including accents, spacing and special characters. Maximum50 characters;
  VI/EN search language. No query enhancement or translation.
- Request24 items. Trending offsets0–499; search0–4999. Continuation advances by
  validated returned count, stops for empty pages, total exhaustion or provider
  offset cap. Missing optional total count is supported. UI must retain query
  scope and cancel old requests; these UI checks are not implemented yet.
- Results retain provider order and entries. Invalid entries fail the page,
  rather than silently filtering/reordering it. Missing renditions stay null for
  an unavailable preview, not a fabricated URL or dropped result.
- HTTPS media URLs must belong to GIPHY domains, without credentials/ports.
  Accepted URLs stay byte-for-byte unchanged. Dimensions are bounded positive
  integers; point lookup must return the requested provider ID. No HTML rendering.
- Fetch uses omitted credentials, no referrer and no-store. No browser durable
  storage, server proxy, media copying or URL cache is implemented. Only transient
  response values are returned to the future UI.
- Errors distinguish UNCONFIGURED, INVALID_INPUT, RATE_LIMITED, UNAVAILABLE and
  INVALID_RESPONSE. Provider payloads/network error text are not exposed as UI
  messages; cancellation retains AbortError. A missing ID returns null, including
  a provider metadata404 carried by HTTP200.
- `rating=g` is an explicit conservative provider query parameter. This is not
  a content detector or a promise that Nối's18+/scam moderation is implemented.

## Configuration and remaining delivery

`NEXT_PUBLIC_GIPHY_API_KEY` is documented, empty, in `.env.example`. It is public
Web integration configuration; never use Resend/Firebase Admin credentials here.
No actual local env/secret was read or modified. Provider key/quota/production
approval remains the owner's setup step; don't request private credentials.

The dedicated GIPHY grid has keyboard handling, query privacy copy,
quota/unconfigured/empty/error/retry, stale cancellation and controlled four-width
light/dark acceptance. Do not mix the internal sticker catalog into this grid.

## Canonical message contract (backend implemented)

POST `/api/conversations/{id}/messages` uses the existing authenticated actor,
membership, archive/chat policy and clientMessageId claim. Its GIF payload is:

```json
{
  "clientMessageId": "caller-generated UUID",
  "messageType": "GIF",
  "content": "",
  "contentFormat": "PLAIN",
  "gif": { "provider": "GIPHY", "providerGifId": "provider-ID" }
}
```

GIF identity is included in the canonical request fingerprint. GIF requires this
object, exact GIPHY provider,1–128 alphanumeric/underscore/hyphen ID, empty PLAIN
content and no sticker/poll/attachments. Non-GIF types reject a supplied gif.
Invalid payload cannot allocate a message claim. A changed GIF on an existing
claim conflicts; committed replay returns the same message without another write
or provider lookup. GIF cannot be edited into text; delete/send another message.

The canonical record and HTTP/realtime mapping expose the same `gif` object.
Public deletion redacts it to null. Notification preview is the nonempty `GIF`
with canonical messageType, not an artwork URL. CQL persists only `gif_provider`
and `gif_id` in the existing message table. No URL/asset/provider body is copied.
The approved fresh `chat_app_complete.cql` contains these columns; `CREATE TABLE
IF NOT EXISTS` does not upgrade an existing installation. This project targets
the user's fresh database, not a legacy-data compatibility layer.

The backend validates identity syntax, not GIPHY existence/rating/availability:
it never calls/proxies the provider. The future client renderer must resolve the
ID directly and show removed/restricted/unconfigured media as unavailable. Do
not put provider URLs into message text or attachment rows to bypass this
contract. Frontend typed send attempts, optimistic/HTTP/WS/history mapping and
failed-message retry now carry the reference. Controlled picker-to-HTTP/retry
browser tests cover uncertain send, same-ID explicit retry and new-ID subsequent
identical send. These do not replace live DB/provider/realtime checks.

## History renderer (controlled acceptance)

MessageGif resolves only the canonical provider ID, only after its confirmed
message enters the viewport and an authenticated viewer exists. Missing web key
does not contact GIPHY. Identity/actor/room change or unmount aborts lookup and
suppresses stale responses. Deleted/blocked-hidden message branches do not mount
the renderer. Provider URL remains transient React state, never message/cache
content. No provider URL is reconstructed from the ID.

Normal motion can play the returned rendition and has a pause control. Reduced
motion starts with the returned still, and explicit play is available. If no
still is available while paused, show a neutral placeholder, not an animated
fallback. Unconfigured, removed, transient failure and rate-limit states stay
inline. GIF copy/edit actions are omitted. Structured notification/body preview
uses VI/EN without translating user-authored text or rebuilding redacted content.

GiphyAttribution reuses the official static mark on a black backplate so it stays
legible independently of app/room theme; no recoloring or decorative animation.
Asset source and hash: `docs/brand/giphy-attribution.md`. Final provider
production approval remains separate. Verification:
`tasks/gif-frontend-verification-2026-10-20.md`.

## Composer picker

The content menu opens GIF, sticker or poll after its own focus scope closes;
it must not steal the new panel's focus. GIF/sticker/emoji shelves are mutually
exclusive. Escape/close returns to the composer. Changing room/session unmounts
the composer and aborts its transient provider queries.

Exact queries debounce300ms, with a50-character input limit. Old results are
hidden while a new query settles; query/locale changes abort old IO and scope
the visible page. Pagination uses returned offsets, a synchronous busy guard,
same-offset explicit retry and no client sorting/filtering/deduplication. Static
previews are the default, with explicit play/pause of previews. Missing/broken
images retain their result position, disable blind selection and offer retry;
recovering an image returns focus to its GIF choice. Advanced playback state
does not leak into the canonical message payload.

Selecting a GIF uses only provider/id and leaves the text/file draft intact.
Sending disables conflicting controls; HTTP failures leave the canonical failed
message available for same-client-ID retry. No automatic success toast or guessed
provider availability. Search terms go only to GIPHY, not message/draft text.
Evidence: `tasks/gif-picker-verification-2026-10-20.md`.

## Source checks2026-10-20

The [official API docs](https://developers.giphy.com/docs/api/) specify direct
client requests, no proxy/cache, unchanged media URLs, provider order, paging,
metadata responses, and visible attribution. The
[language/rating docs](https://developers.giphy.com/docs/optional-settings/)
include Vietnamese. Tests use controlled fetch only; no provider API call or
production-key validation has taken place.

Verification command: `npm run test:gifs:api`. Evidence and outstanding gates:
`tasks/giphy-foundation-verification-2026-10-20.md` and `tasks/todo.md`.
