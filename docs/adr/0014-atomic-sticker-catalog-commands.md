# ADR 0014 — Atomic sticker catalog commands

Status: accepted within the user-approved feature expansion. Date: 2026-10-12.

## Context

The initial S1 read foundation retained three unused sticker authority/order tables. Adding revision CAS, command replay and durable audit to separate partitions would leave gaps between state, ordering and audit writes. A regular logged batch does not provide cross-partition conditional transaction isolation. Conditional batches must target one partition and table: [Apache Cassandra CQL documentation](https://apache.googlesource.com/cassandra/+/c38c0da45cd4e5db6b55442c81974e798fcbe2f0/doc/modules/cassandra/pages/developing/cql/dml.adoc).

The user targets a fresh canonical database, not legacy compatibility. No old sticker data or migration was requested. This decision supersedes the read-only proposal's assumption of three separate sticker authority tables; it does not add parallel authority or fallback code.

## Decision

- `sticker_catalog_by_pack` owns one pack aggregate. Static pack metadata/revision, PACK marker, STICKER authority, ORDER entries, immutable COMMAND records and PENDING audit work all share `sticker_pack_id`.
- All mutations use a same-partition conditional batch. A pack revision serializes edits within the pack; `COMMAND IF NOT EXISTS` separately fences command-ID reuse. Changing order atomically deletes the old ordering entry and inserts the new one. Identical-order edits do not delete/reinsert a row at one timestamp.
- A command stores actor, exact-request fingerprint, resulting snapshot and a stable audit event ID/month. Replay rechecks permission and actor/fingerprint; it returns the original result without another mutation. After CAS failure, the service checks for an already committed matching command before returning 409. A timeout may still require retry with the same command ID.
- `sticker_pack_directory` and immutable `sticker_identity_by_id` pointers are registered before CAS. A crash can leave an empty discovery pointer, but cannot hide a committed aggregate. Reads always hydrate authority; missing authority is not a valid sticker.
- Audit export upserts the original event, then conditionally marks COMMAND exported and removes PENDING in one aggregate batch. Crash/replay repeats the same audit key, not a new event. The scheduled worker visits bounded pages of actual pending work and rotates packs, including after failures, rather than scanning all command history.
- Catalog repository reads/writes use LOCAL_QUORUM and LWT LOCAL_SERIAL; deployment must use a suitable local replication factor and matching data center configuration.
- New artwork must be an owned READY raster asset with HTTPS URL, real positive dimensions up to 1024px and size up to 2MB, without known infected/rejected state. Activating artwork requires explicit human review confirmation; this is not automatic moderation.
- `media_assets_by_id.retention_locked` permanently protects referenced artwork for historical rendering. Retention and deletion claim compete on the same asset authority. Deletion changes READY to DELETING before provider IO; a retained asset cannot be destroyed. Provider confirmation is required before DELETED. An interrupted DELETING operation can be retried.

## Consequences and limits

Three initial unused tables (`sticker_packs_by_id`, `stickers_by_id`, `stickers_by_pack`) are removed from the fresh schema, replaced by the aggregate and identity index. Existing installations cannot obtain this schema by rerunning CREATE IF NOT EXISTS; legacy migration is not implemented.

Edits to different stickers in the same pack can conflict; the UI must reload the catalog and keep the user's draft rather than force-write. Command results are historical snapshots, so UI consumers refresh after saving. Journaling increases partition size with catalog administration history; high-volume administration may later require an explicit archive/retention policy without sacrificing the replay window. Catalog pages are not snapshots during concurrent edits.

Retention is conservative: if asset retention succeeds but catalog CAS loses, the image remains protected. This can consume storage but cannot break chat history; automatic release needs proven reference accounting in the planned media-lifecycle work. Never silently remove retention to clean up a failed command.

Only system-global SYSTEM_OPERATE grants management. Room roles do not. No hard-delete catalog command is provided. Packs are created inactive; deactivation preserves sticker identities and artwork. Push remains deferred and this work neither contacts a detector nor exports chat content.

Unit/HTTP/query-binding/schema tests cannot prove live Cassandra conditional batch semantics, process-crash recovery or provider deletion. Those runtime gates remain explicit until tested against actual services.
