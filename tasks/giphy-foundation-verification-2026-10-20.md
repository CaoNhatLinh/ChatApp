# GIPHY transport foundation —2026-10-20

G1 is partially implemented, not delivered end-to-end. G2 has not been started.
Scope: direct browser provider transport and its error/validation contract.

This is the initial transport checkpoint. Subsequent backend work is recorded in
`tasks/gif-message-backend-verification-2026-10-20.md`; its status supersedes the
G2-not-started statement here, without changing this earlier test evidence.

## Changes

- `chatapp_frontend/src/features/gifs/api/giphy.api.ts`: typed list/point lookup,
  exact query and provider ordering, bounded offsets/counts, HTTPS provider
  rendition validation without URL rewriting, nullable unavailable rendition/ID,
  cancel/error semantics and omitted app credentials. No provider cache/proxy.
- `chatapp_frontend/scripts/giphy-api-smoke.mjs`:23 grouped checks against the
  actual transpiled production module with controlled fetch; no actual API key
  or provider request. Malformed data fails explicitly rather than being dropped.
- `chatapp_frontend/package.json`: `test:gifs:api` command.
- `chatapp_frontend/.env.example`: empty public Web key name only; no local env
  or backend secret modified. No dependency or lockfile change.
- `docs/flows/giphy-gifs.md`, `tasks/todo.md`: source-derived contract and exact
  remaining picker/message/runtime boundaries.

## Executed verification

- Initial adapter test exited1 because the module did not exist.
- First23-case extension failed on provider metadata404 with HTTP200. Corrected
  this unavailable-ID path and sanitized network failures; ordinary cancellation
  still propagates instead of becoming a misleading provider error.
- `npm run test:gifs:api`: exit0,23 groups. Covers encoding/VI query, correct
  provider host, omitted credentials/no-store/abort, unchanged rendition URL,
  order, dimensions, continuation/end/caps, input rejection before IO, blank key,
  HTTP401/403/429/503, metadata errors, malformed pagination/ID/host/credentials/
  dimension, point-ID mismatch, HTTP and metadata missing-ID, unavailable rendition,
  network error redaction and invalid JSON.
- `npm run validate`: exit0, TypeScript and full ESLint.
- `npm run build`: exit0, Next16.3.3,17 routes.
- `git diff --check`: exit0, existing CRLF warnings only.

Self-review covered type/error boundaries, no app credential propagation,
provider identity/media URL validation, provider ordering/no copying, and bounded
page allocation. Interface/incremental/TDD guidance kept this separate from an
unimplemented backend capability. Not an independent review or security audit.

## Not claimed

No picker, attribution asset, composer send, backend GIF schema/fingerprint,
realtime/history integration, actual provider quota/key/availability, live
browser provider IO, UI screenshots or production release. No new UI was shown,
so the last sticker/chat screenshots do not represent this feature. The prior
backend378-test run is unchanged, not rerun for this browser-transport-only slice.
No commit/push, tunnel, provider call, Docker installation or app DB change.

Next: implement dedicated picker with genuine states and canonical typed GIF
message flow before enabling send; execute their own API/UI/live acceptance.
