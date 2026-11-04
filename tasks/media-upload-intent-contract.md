# Recoverable media upload authority

Scope: pre-provider durable upload identity and exact completed replay. Preserve
the existing signed upload endpoints and response; accept an optional UUID
`uploadId` request parameter for callers that retain retry identity. A missing
ID starts a new intent, never deduplicates unrelated uploads by content alone.
Owner+uploadId derive distinct stable asset/attachment IDs and a provider key.
The next client increment must supply/reuse IDs; this is not reload-safe UI yet.

After bounded bytes/image preflight, claim PENDING media_assets_by_id before
provider IO. Bind owner, filename, MIME, actual size, SHA256, provider key and
created time. Same ID with changed content/metadata conflicts before provider IO.
Failed/ambiguous claim must not call provider. No TTL may silently release the
identity. PENDING is not a usable attachment or successful upload.

Use the existing Cloudinary2.4 SDK with deterministic full public_id,
overwrite=false and explicit resource_type. Existing provider data must match
the requested identity/type and existing media validation. IOException leaves
PENDING; retry same bytes/ID uses the same provider key, not a new random asset.

Complete asset metadata and an immutable typed JSON receipt in one conditional
PENDING-to-READY update, LOCAL_QUORUM/LOCAL_SERIAL. Do not reset retention locks,
scan/moderation state, deletion or a concurrent winner. Thumbnail rows are a
repairable projection of the winning receipt. A projection error is not success;
retry repairs from the stored receipt without provider upload or a new command.
READY replay reads current authority, never resurrects DELETING/DELETED or
QUARANTINED assets. Return stable attachment identity and original receipt.

Owner-scoped no-store inspection by uploadId distinguishes PENDING from READY
and unavailable/deleted state without provider IO, cross-user disclosure or
invented success. The receipt is written only by this new protocol; invalid or
missing receipt for one of its READY intents fails closed.

Required checks: admission before claim, claim before provider, claim failure,
same-ID mismatched bytes/metadata, provider failure/restart replay, same-key
overwrite=false, raw keys with canonical extension, metadata validation, exact
ready replay, interrupted projection repair, concurrent winner/deletion and
unchanged retention; actual CQL bindings/CAS/consistency and MVC/JSON contract.

Remaining M2/M3: client ID lifetime/reload recovery, durable pending discovery
and automatic provider reconciliation/orphan/deletion jobs, lifecycle UI and
real Cassandra/provider/concurrent/crash acceptance. Docker/provider IO remain
deferred; no live data or credentials are read or changed by this increment.
