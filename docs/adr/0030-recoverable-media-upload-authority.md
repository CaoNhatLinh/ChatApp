# ADR0030 — Durable upload identity and winning receipt

Status: accepted controlled backend implementation; live and client gates open.
Date:2026-10-23.

## Context

Upload generated a new random asset ID on every call and only wrote Cassandra
after provider success. Lost provider/local acknowledgements could create
duplicate objects. Replaying an unconditional original+thumbnail insert would
also reset history retention or resurrect a concurrently deleting asset.

## Decision

Use a client-retained optional UUID uploadId scoped to the authenticated owner.
Domain-separated deterministic UUIDs identify the asset and attachment; a full
Cloudinary public_id contains only the owner/asset identity and a canonical raw
extension. Different intents and owners stay separate even for equal bytes.
Missing IDs mean new operations, not content-based deduplication.

After admission/preflight, INSERT IF NOT EXISTS a PENDING asset with frozen
name/MIME/actual size/SHA256/provider key and a millisecond creation timestamp.
No provider operation is permitted after a failed or unconfirmed claim. Retry
checks that frozen input before IO. Use deterministic public_id, overwrite=false
and explicit resource_type, as described by
[Cloudinary's upload duplicate prevention](https://cloudinary.com/documentation/upload_images#avoiding_duplicate_uploads)
and [Upload API naming rules](https://cloudinary.com/documentation/image_upload_api_reference#upload_optional_parameters).
Image eager outcomes retain their existing validation and honest availability.

Complete original metadata and upload_receipt JSON with one same-row conditional
PENDING→READY update. The CAS fences owner/checksum/deletion, never rewrites
retention, scan or moderation state. All conditional media operations and their
authority reads use LOCAL_QUORUM/LOCAL_SERIAL. Timestamp precision matches CQL.
This follows [Cassandra4.1 conditional DML](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html).

Every worker reads the winning stored receipt rather than returning its own
candidate. Receipt identity and frozen metadata must match current READY state.
Original URLs must also match the configured shared Cloudinary tenant, HTTPS
host, resource type and exact original public_id path, both before READY and
on receipt replay/inspection. Transformed/custom-CDN URLs are not original
receipts under the current configuration. See
[Cloudinary URL structure](https://cloudinary.com/documentation/image_transformations#transformation_url_structure).
An interrupted acknowledgement or thumbnail projection write can retry without
provider upload. Thumbnail rows are replayable projections; their write no
longer reinserts the original asset. Existing message/history retention still
permanently fences provider deletion. DELETING/DELETED/QUARANTINED never replay
as READY. Owner-only no-store GET by uploadId exposes actual state/receipt with
no provider or repair operation.

## Consequences and remaining work

The existing fresh-bootstrap asset table adds upload_receipt text (84 tables,
721 columns); no table or data migration/reset is executed. Stored JSON is typed
and validated, not an arbitrary event or secret configuration blob. Source asset
creation and receipt are atomic within one CQL row; thumbnail projection reads
are not isolated with it and missing rows remain honest unavailable metadata.

The two existing POST routes remain usable without IDs. The message composer
retains the upload ID by account, conversation and file fingerprint in the
current tab. After reload, reselecting the same file (bytes, name and MIME) checks
the existing intent. READY reuses the confirmed attachment. A missing or PENDING
intent uses the original ID on POST. A denial or unavailable terminal state stops
the attempt. The composer identifies the affected file inline and keeps the
message draft. After a confirmed DELETED state, the member can explicitly
reset the upload and send again. Removing a DELETING or QUARANTINED file keeps
its known upload ID for reselection in that tab. Other explicit removals and
confirmed messages release the local ID. File bytes and names are not stored
in session storage.

After an HTTP 403 or 409 rejects a prepared message, the next composer send
revalidates any locally cached upload receipts for that attempt. It keeps the
same receipt when the server confirms the same READY asset and attachment.
An unavailable result stops the send before another message or upload request.

The backend registers the exact asset, owner and upload IDs in
`media_upload_recovery_by_shard` before claiming the upload or calling
Cloudinary. A bounded worker advances through one of 16 shards per tick. It
repairs thumbnails from the validated winning READY receipt before removing its
pointer. A failed projection repair leaves the pointer for another pass. Missing
authority may be a claim in flight, so the worker keeps its pointer. Existing
uploads without a pointer are registered if the client resubmits them.

New provider uploads include a versioned HMAC in Cloudinary contextual metadata.
It binds the exact storage key, size and frozen checksum using the configured
Cloudinary API secret. With `CLOUDINARY_RECOVER_PENDING=true`, the worker may
query Cloudinary for an exact public ID after its claim has aged two minutes.
The response must contain the matching proof, delivery type, resource type,
size and valid original URL. The worker then conditionally records the receipt
and repairs from the winning result. Image variants without confirmed derivative
metadata are reported unavailable. The provider lookup trusts the configured
Cloudinary tenant to retain the original object and its context.

Provider lookup is disabled by default and capped at one attempt per worker tick
per instance when enabled. Check the deployment's shared Admin API quota before
enabling it. Missing resources, legacy resources without proof, key rotation
and provider errors leave the intent pending. This lookup uses the Cloudinary
[Admin API](https://cloudinary.com/documentation/admin_api#get_resources) and
[contextual metadata](https://cloudinary.com/documentation/contextual_metadata).

The canonical bootstrap creates the recovery table for new installations. Apply
its additive CREATE TABLE statement before upgrading a running datastore.
An owner-requested deletion writes a separate pointer in
`media_deletion_recovery_by_shard` before attempting the conditional
`READY → DELETING` claim. The claim still requires an unlocked asset. With
`CLOUDINARY_RECOVER_DELETIONS=true`, the worker retries only a matching owner
and asset already in `DELETING`, at most one provider attempt per tick per
instance. The provider call uses the exact stored public ID, resource type and
`upload` delivery type. A confirmed deletion or already absent resource lets
the worker conditionally persist the first `DELETED` timestamp. Other results
retain the work. [Cloudinary destroy API](https://cloudinary.com/documentation/image_upload_api_reference#destroy_by_public_id)

The deletion worker is disabled by default. An existing installation needs the
additive deletion recovery table before upgrading. Old deleting assets without
a pointer are registered when the owner retries the deletion. Discovery does
not automatically promote a READY asset to DELETING, including when an
interrupted or rejected claim left a pointer.

New ordinary and forwarded messages take the same per-asset conditional
retention lock as stickers before committing the message. If deletion claims
the asset first, the send fails before the message write. A lock taken before
an interrupted send is conservative and stays set. Existing message records
require reference backfill before unlocked legacy assets can be considered
for automatic cleanup. New room backgrounds uploaded through Nối retain an
owned READY image and save its asset ID with the canonical URL. Existing
URL-only clients preserve the current asset ID when saving the same URL.
New URL-only writes for profile avatars, room avatars and backgrounds recognize
the configured Cloudinary shared-CDN image namespace, including transformed
URLs that resolve to the same asset key. The referenced image must be READY
and its retention claim must succeed before the preference or avatar is
saved. A room avatar supplied by asset ID must be an owned READY image, and
its canonical URL is persisted. External URLs remain supported. Unrecognized
aliases and references written before these protections are not backfilled by
this check, so an unlocked READY row alone still does not prove an orphan.

New uploads from the message composer explicitly request `COMPOSER`. The first
successful claim freezes that purpose and the worker discovers its key through
`media_orphan_candidates_by_shard`. Generic uploads and older unmarked uploads
stay outside this cleanup policy. A composer retry can recover a legacy intent
without changing its purpose.

Set `CLOUDINARY_CLEAN_COMPOSER_ORPHANS=true` with
`CLOUDINARY_RECOVER_DELETIONS=true` to enable automatic cleanup after deploying
the reference protection to all writers. The grace period is measured from the
original upload claim and defaults to seven days. Set
`CLOUDINARY_COMPOSER_ORPHAN_GRACE_DAYS` from 1 through 365 to change it. Cleanup
first registers deletion work and then conditionally changes an old,
unretained COMPOSER asset from READY to DELETING. Pending or missing authority
remains discoverable. The existing deletion worker performs provider deletion.

An existing installation needs the additive orphan candidate table from the
bootstrap and `ALTER TABLE media_assets_by_id ADD upload_purpose text` before
upgrading. The asset ID and its deletion tombstone are retained. Live provider
verification, legacy reference backfill and retention policy for historical
records remain M2/M3.

Failed message bubbles retain the original upload intent IDs in local message
state. After HTTP 403 or 409 on a send with attachments, the bubble retry
inspects those same intents before replay. The server must confirm READY with
matching asset and attachment IDs for each original attachment. Terminal
receipts stop replay, and unknown or inconsistent receipts leave the action
available for another check. This path never uploads files or rewrites the
original message command. An ambiguous send error such as HTTP 503 can still
replay the original command without inspecting receipts.
Room or actor changes cancel an in-progress check. If the confirmed message
already exists locally for the same sender and client message ID, the bubble
skips replay. A late send response cannot update a newer sign-in session.

Cloudinary overwrite=false behavior, quotas and real response metadata require
live provider acceptance; no IO/cost was performed by the controlled tests.
Docker/Cassandra/crash/two-client gates remain deferred, not proved by mocks.

Supersedes ADR0021's original+thumbnail logged-write decision for new uploads;
its synchronous derivative generation and outcome validation still apply.
Contract: `tasks/media-upload-intent-contract.md`. Verification is recorded in
`tasks/media-upload-intent-verification-2026-10-23.md`.
