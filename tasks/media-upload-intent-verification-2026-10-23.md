# Recoverable media upload — controlled backend evidence

Date: 2026-10-23. Contract: `tasks/media-upload-intent-contract.md`;
decision: `docs/adr/0030-recoverable-media-upload-authority.md`.

## Implemented

Both existing multipart upload routes accept an optional owner-scoped UUID
uploadId, deriving stable asset/attachment IDs and a full provider key. After
bounded admission the service conditionally claims frozen PENDING authority
before provider IO. Mismatched same-ID input conflicts; a missing ID starts a
separate operation, never content-based deduplication.

Cloudinary uses explicit resource_type and overwrite=false. A conditional
same-row PENDING-to-READY write stores the original and typed winning receipt,
preserving retention/scan/moderation/deletion authority. Replay reads that
receipt, not a losing worker's candidate, and repairs thumbnail projections.
Once READY is confirmed, lost acknowledgements/projection writes can retry
without another upload. Owner-only no-store inspection performs no provider IO
or projection repair. Unavailable/deleting/deleted/quarantined states cannot
replay as successful READY.

Original URLs must match the configured shared Cloudinary tenant, HTTPS host,
resource type, upload path and exact full public_id. Optional version prefixes
and image/video extensions are accepted; raw keys keep their exact extension.
Wrong tenant/type/asset, transforms, userinfo, extra paths, query/fragment,
malformed URLs and noncanonical ports are rejected. Persisted READY receipts
are checked again before replay/inspection. Custom/private CDN URLs are not
configured or supported by this policy; they require deliberate future changes.

## Evidence

- Initial full backend run: 849 tests, one failure in
  `CloudinaryMediaThumbnailsTest.differentTenantTypeOrAssetUrlCannotBecomeReadyDespiteMatchingPublicId`.
  Matching public_id alone admitted a different original URL. New URL policy
  and upload/receipt validation close that previously pending RED gap.
- Final `./mvnw.cmd -q test` exit 0: 866 tests / 137 fresh suites, no failures,
  errors or skips. The stale October 20 failing Cassandra IT XML is not counted.
  Docker integration profile was not enabled.
- Current focused counts: upload service 8, thumbnail service 10, intent 11,
  original URL 15, upload HTTP/OpenAPI 7. Full suite also covers repository
  CAS/binding/consistency, retention, thumbnails and deletion.
- Intent tests cover failed claim, same-ID replay/mismatch, provider failure,
  winning concurrent completion, deletion before replay, owner inspection and
  bad persisted URL rejection. Interrupted projection now uses an actual 2x3
  PNG with three UNAVAILABLE outcomes, not a raw file with no thumbnail rows.
  It verifies repair from the same winning receipt with one provider upload.
- Cloudinary mocks have real SDK cloud_name=test configuration and derive URLs
  from the requested public_id; all provider upload IO remains mocked.

## Still open

Client-retained IDs and uncertain-upload reconciliation across reload, durable
pending discovery, automatic provider/orphan/deletion workers, reference
lifecycle UI and live provider/Cassandra/concurrent/crash acceptance remain
open. PENDING retry may need the same bytes resent. This is not a durable
file-byte outbox, guaranteed crash recovery, malware scan or 18+/scam detector.
No live IO, Docker probe, data reset or credential change occurred.

Sources:
[Cloudinary duplicate prevention](https://cloudinary.com/documentation/upload_images#avoiding_duplicate_uploads),
[original URL structure](https://cloudinary.com/documentation/image_transformations#transformation_url_structure),
[Cassandra conditional DML](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html).
