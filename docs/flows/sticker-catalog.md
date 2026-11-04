# Sticker catalog — reads and admin commands

Approved scope: [feature expansion](../../tasks/feature-expansion-spec.md). S1/S2 backend contracts and the admin editor are implemented; user picker/chat sending/rendering remain separate unfinished slices. Design rationale: [ADR 0014](../adr/0014-atomic-sticker-catalog-commands.md).

Members only select and send from published packs. Creating, uploading, editing, ordering and removing packs or individual stickers belongs exclusively to global application administration (`SYSTEM_OPERATE`), never room administration. Removal means deactivation from the picker, not erasing artwork referenced by existing messages.

## Authority and access paths

- `sticker_catalog_by_pack` is canonical authority: one pack partition owns static metadata/revision, sticker state, ordered positions, immutable commands and pending audit export.
- `sticker_pack_directory` discovers IDs in the `GLOBAL` partition. It is not authority for availability or metadata.
- ORDER rows discover `(position, entry_id)` within that same partition; reads hydrate STICKER authority. Reordering atomically moves the ordering entry with the state and command journal.
- `sticker_identity_by_id` is an immutable discovery pointer for single-ID lookup. Missing authority is not a usable sticker. These tables replace the initial unused three sticker tables in the fresh schema; no legacy fallback.
- Both page queries use explicit `LIMIT` (maximum 51 including lookahead). Point hydration reads at most 50 packs or stickers and associated images per request. There are bounded per-item reads; live latency/load remains unmeasured.
- Cursor advances from the last scanned pointer, not the last visible item. Empty pages can have `hasNext=true`; consumers must follow `nextCursor` until exhausted. No snapshot isolation: concurrently changing catalogs should be refreshed.

## Routes

| Route | Access | Visibility |
|---|---|---|
| `GET /api/sticker-packs` | Authenticated | Active packs |
| `GET /api/sticker-packs/{packId}/stickers` | Authenticated | Active pack/stickers, available raster images |
| `GET /api/conversations/{conversationId}/messages/{messageId}/sticker?bucket=…` | Current conversation member | Artwork from a nondeleted STICKER message, even when catalog is inactive; unavailable image is null |
| `GET /api/admin/sticker-packs` | Global `SYSTEM_OPERATE` | Includes inactive packs |
| `GET /api/admin/sticker-packs/{packId}` | Global `SYSTEM_OPERATE` | Current metadata/revision; retains coverAssetId when cover image is unavailable |
| `GET /api/admin/sticker-packs/{packId}/stickers` | Global `SYSTEM_OPERATE` | Includes inactive stickers; unavailable images are null |
| `GET /api/admin/sticker-packs/{packId}/stickers/{stickerId}` | Global `SYSTEM_OPERATE` | Current sticker and matching packRevision for comparison; 409 if pack changes between bounded reads |
| `POST /api/admin/sticker-packs` | Global `SYSTEM_OPERATE` | Create inactive pack |
| `PUT /api/admin/sticker-packs/{packId}` | Global `SYSTEM_OPERATE` | Edit/activate/deactivate with expected pack revision |
| `POST /api/admin/sticker-packs/{packId}/stickers` | Global `SYSTEM_OPERATE` | Create owned artwork with expected pack revision |
| `PUT /api/admin/sticker-packs/{packId}/stickers/{stickerId}` | Global `SYSTEM_OPERATE` | Rename/order/activate/deactivate; artwork identity immutable |

Actor comes from security context; callers cannot enable admin mode or select another actor via query parameters. All successful responses are `no-store`. Page size defaults to 25, accepts 1–50; invalid limits/cursors fail with 400. Inactive packs are 404 on user routes. Permission checks run before admin repository queries.

An available image means an existing, non-deleted `READY` media asset with positive dimensions, supported raster MIME, HTTPS URL without user credentials, and no known infected/rejected result. `PENDING` scanning/moderation is **not** a clean verdict. Activation requires explicit human artwork review confirmation, not automatic content detection.

## Command and media rules

Client generates a UUID `commandId` once per submitted body. Create commands also contain client-generated pack/sticker IDs. After a timeout, retry the exact same body and IDs. The service checks global permission, actor and SHA-256 request fingerprint before returning a stored result. Changing the request requires a new command ID. Do not automatically resend with a new ID after an uncertain response.

Edits include `expectedRevision` of the pack, including sticker edits. A stale revision is 409, not force-save. Successful mutations commit state, ordering, immutable command and pending audit in a single conditional partition batch. Replays return the original snapshot; refresh catalog data after success. `auditPending=true` means state committed but durable audit export is still pending. The worker reuses the original event ID/month and removes pending work only after audit persistence.

New artwork must belong to the acting admin, be READY raster up to 2MB and 1024px, and meet the URL/status checks above. Existing artwork cannot be replaced under the same sticker ID: make a new sticker for a different image. Pack cover is optional. Deactivation preserves identities/artwork and works even when an old image is unavailable.

Artwork used by commands is conservatively retained through `media_assets_by_id.retention_locked`. Retention and the READY→DELETING claim use the same asset authority, so deletion cannot race publication. Confirmed provider deletion is required before DELETED; an interrupted DELETING operation can retry. A failed catalog CAS can leave a retained asset; no unsafe automatic release is implemented.

## Sticker messages and retained artwork

Use the existing canonical message command: `messageType=STICKER`, `stickerId`, empty `content`, `contentFormat=PLAIN`, no attachment or poll. Other message types cannot carry stickerId. Sticker messages cannot be edited into captions or image URLs; delete and send another sticker instead. Catalog validation uses bounded identity/authority/asset reads; the member does not need ownership of the admin-uploaded artwork. No arbitrary image URL or client-supplied sticker metadata is accepted.

Conversation permission, archive and chat policy checks still run. A read-only lookup checks the existing actor/clientMessageId claim and request fingerprint before catalog validation: a committed exact retry returns the original redacted message and repairs its bucket pointer, without another save or notification. An unmatched payload is 409. A reservation without a committed message must still pass current availability checks; it cannot bypass deactivation. Normal new claim allocation remains conditional and handles competing requests by loading the original identity.

Claim/message authority reads and message writes use LOCAL_QUORUM; claim LWT uses LOCAL_SERIAL. These are local-datacenter guarantees, not a global cross-partition transaction. Publication changes after a successful availability check do not retroactively cancel a send already in flight. Live replica/crash behavior remains a separate gate.

Historical artwork is addressed by authorized conversation/bucket/message identity, not a freely supplied sticker ID. Deleted/non-sticker messages are 404; lost conversation membership is 403 before catalog lookup. The response exposes only stickerId/name/image, not admin revision/status. Pack or sticker deactivation does not remove history. Known rejected/infected/deleted/unavailable artwork is null. Public provider URL storage already used by this app is unchanged; no-store does not turn a previously disclosed provider URL into revocable private storage.

## Remaining UI and runtime gates

There is intentionally no seeded catalog or fabricated artwork. The fresh database returns an empty catalog until real admin commands populate it. The global admin workspace includes metadata, cover/artwork upload, order/availability, manual review and hide confirmations. Retry/conflict recovery is inline, without success toasts. Browser fixtures are isolated test data, not an application catalog.

S3 still has broader draft-navigation/recovery acceptance and live gates. S4 backend validation/replay and historical artwork API are implemented. S5 now has a member-only inline pack/artwork shelf, explicit cursor pagination, shared message sends and historical rendering. Sending a sticker preserves the text/file draft; failed messages retry with their original identity. Confirmation clears only the matching stored send attempt, including explicit retries, so a later intentional identical send receives a new identity. Sticker messages do not offer edit/copy controls.

Historical images load through the conversation-authorized route when their message enters the viewport; requests abort on identity/session change or unmount. Null artwork and 403/404 render unavailable; transient request/image failures offer contextual retry. No catalog lookup bypass is used for history. The room-info panel stays on demand below 1024px to preserve chat width.

Message/mention notification metadata includes the canonical `messageType`. A sticker notification stores the non-empty preview `Sticker`; frontend copy renders `Đã gửi sticker.` / `Sent a sticker.` from structured type, preserving the sender name and user-authored TEXT content. If the server redacts a preview to an empty body, frontend keeps it empty rather than reconstructing it from metadata. Email templates remain generic and bilingual; no private message or artwork is added to email.

Controlled Chromium checks cover selection, filtered empty pages with actionable VI/EN copy, interrupted send/retry, subsequent identical intentional send, retained draft, unavailable/error history, Escape/focus and four-width themes. Pack changes abort old requests and ignore stale responses; load-more controls disable while pending. Cursor tracking rejects both immediate repeats and multi-step cycles, is cleared on fetch-scope change, and preserves the failed cursor for explicit retry. These protections apply to pack and artwork lists through the same member hook.

Localized notification previews have backend/pure-model tests and controlled notification-drawer browser coverage in both languages. Actual realtime delivery remains separate. Live Cassandra conditional batches, crash recovery, realtime, catalog performance and real Cloudinary IO remain unverified on this host. Unit/schema/browser fixtures do not replace those runtime gates.

The schema file targets a fresh database. `CREATE TABLE IF NOT EXISTS` does not alter existing tables or convert previous sticker authority. Start with the current fresh schema on the new installation; do not delete a populated database to enable this feature. Legacy-data migration is outside the approved scope.
