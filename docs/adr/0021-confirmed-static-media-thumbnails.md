# ADR 0021 — Provider-confirmed static media thumbnails

Status: accepted implementation under the approved feature-expansion schema scope.
Date: 2026-10-23.

## Context

The upload response previously constructed a 320px Cloudinary delivery URL without
generating or persisting the derivative. `media_thumbnails_by_asset` had no runtime
writer or outcome column. This could not establish thumbnail availability, actual
dimensions or generation failure. The preceding byte/header preflight is necessary
admission control but is not derivative generation or a full-image decoder.

## Decision

Use the existing Cloudinary Java SDK to request three synchronous eager variants:
SMALL 320, MEDIUM 768 and LARGE 1280 pixels per edge, crop=limit, PNG, page=1.
The original is unchanged; PNG/page=1 makes the derivative static, including for
animated originals. No new provider/dependency, webhook or background job is added.
The actual SDK requires `List<Transformation<?>>`, not REST's pipe-separated string
or a list of strings. An offline test of its real parameter builder verifies this.

Map eager outcomes by the exact requested transformation, never list order.
READY requires actual positive integral dimensions within the variant bounds and
a safe HTTPS URL for the same Cloudinary tenant/upload namespace and public ID,
with a PNG extension. Duplicate/absent/unrecognized/malformed/pending data becomes
UNAVAILABLE. Explicit provider failure becomes FAILED. Failed/unavailable records
have no URL/dimensions and no persisted raw provider error.

Extend the existing thumbnail table with `status text`; keep its asset/variant key.
Write the source asset and three outcome records in one four-statement logged
batch. Asset READY denotes a usable original, not three successful thumbnails.
Upload JSON adds `thumbnails`; the incumbent `thumbnailUrl` now points only to a
confirmed READY SMALL result, otherwise null. Do not synthesize a replacement URL.
This uses the existing contract rather than retaining a legacy URL-generator path.

Expose a no-store, authenticated owner inspection endpoint at
`GET /api/files/{assetId}/thumbnails`. It performs no provider IO or generation.
Non-image uploads have applicable=false/empty variants. Missing rows for an image
mean unavailable metadata, not proof of processing or readiness. Other users may
not use this owner endpoint; conversation-authorized history access is separate.

Use explicit resource types consistently for upload and deletion: image for the
image allowlist, video for video/audio, raw for other allowed files. In particular,
PDF is not accidentally uploaded with auto=image and later destroyed as raw.

## Alternatives

- Generated delivery URL only: rejected because it fabricates no evidence of
  availability or dimensions and cannot express generation outcomes.
- Eager async plus webhook: useful later, but would require authenticated provider
  callbacks, durable processing intents, leases and replay handling. Adding a fake
  PROCESSING state without those mechanisms would misrepresent the runtime.
- Local decoder/resizer: not chosen; it would add WebP/animated-image decode work
  and dependencies when the configured provider already supports derivatives.
- Separate outcome table: unnecessary; the existing asset/variant access path fits.

## Consequences and limits

An actual image upload now requests three eager transformations and waits for
provider processing. These consume provider resources/quota; no real IO, costs or
configuration changes were authorized/executed by this increment. Actual latency,
quality and account-specific transformation behavior remain a live acceptance gate.

A logged batch is not isolated cross-table reading or an atomic transaction with
Cloudinary. Crash/ambiguous failure after provider success but before local commit
can orphan the provider asset. There is no durable pre-IO intent, automatic retry,
or orphan repair yet. Those remain M2 rather than being claimed by M1.

This is not virus scanning or 18+/scam moderation. Original upload statuses for
those checks remain unchanged, not falsely CLEAN/APPROVED. No provider content is
sent to a new detector. Existing message attachment/reference validation and
historical recipient UI still require the next media-lifecycle increments.

Evidence: `tasks/media-thumbnail-verification-2026-10-23.md`. Docker/live provider
tests remain deferred/unverified; this is not full feature-expansion completion.
