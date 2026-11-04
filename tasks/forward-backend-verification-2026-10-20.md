# F1 forward backend — verification, 2026-10-20

## Scope

Implemented approved forward provenance foundation: verified source snapshot,
private source keys, deterministic index/attachment repair and actor-authorized
source point read. Frontend data mapping follows the new public boolean. F2
forward target chooser/send/source panel and live Cassandra/two-client/crash
acceptance remain open. This is not whole-roadmap completion.

## Changes and reasons

- `canonical/message/MessageForwardPolicy.java`: complete source key, membership,
  deleted/block checks, exact snapshot and bounded attachment authority match.
  Malformed or unavailable source fails before identity allocation. Changed
  content cannot be attributed to an unrelated source. Missing attachment rows
  conflict rather than silently producing an empty copy.
- `MessageService.java`: resolves policy before claim, materializes verified source
  content, retains immediate source internally, forbids editing attributed copies
  and repairs source projections/forward attachments on exact committed retry.
  The existing claim/fingerprint remains the single command authority.
- `MessageAttachmentPolicy.java`: source-verified forwards can reuse a ready,
  active asset after exact metadata checks. Ordinary upload sends remain
  owner-only; caller cannot skip source verification through HTTP.
- `CassandraMessageRepository.java`, `MessageRepository.java`: message+forward
  index logged batch at LOCAL_QUORUM and deterministic same-ID repair. Renamed
  `repairReplyProjection` to `repairSourceProjections` for its actual expanded
  responsibility, updating all callers/tests without a compatibility alias.
- `CqlCanonicalRecords.java`: source keys remain internal record data but Jackson
  excludes them from all public serialization; only `forwarded` is exposed.
  Manual shared STOMP payloads likewise contain no source keys.
- `MessageForwardSourceService.java`, `MessageForwardSourceController.java`:
  destination-keyed `GET .../messages/{messageId}/forward-source?bucket=...`.
  Destination membership precedes lookups; stored provenance resolves the source.
  Each read rechecks source membership and block/deletion state. Inaccessible,
  missing, deleted or blocked source returns the same unavailable shape, with no
  source room/bucket/message/profile/name. Accessible source is one immediate
  current message; its own private chain is not serialized.
- Frontend `features/messenger/api/messenger.api.ts`: uses the public boolean,
  not private-room-key inference; deleted messages have no forwarded affordance.
- Unit/query-binding/MVC/serialization tests in the message capability, updated
  Cassandra IT method references, and frontend adapter regression assertions.
- OpenAPI, AsyncAPI, canonical endpoint manifest, ADR0016 and
  `tasks/forward-contract.md`: contract, tradeoffs and privacy boundaries.

Backend paths above are relative to
`chat-service/src/main/java/com/chatapp/chat_service/`. Other pre-existing dirty
files are preserved and are not attributed to this slice. No schema, dependency,
secret, external provider, database volume, commit or push was changed.

## Recovery semantics and limits

An exact committed retry returns the stored destination before checking mutable
source state, repairs its deterministic source index and restores forward
attachment rows from the fingerprint-matched authorized request. An uncommitted
snapshot is revalidated and conflicts after source edits rather than silently
changing body. Forwarded content is immutable; deleting/resending is separate.

The existing `message_forwards_by_source_message` table now has a write consumer;
there is intentionally no public reverse-target enumeration endpoint. Logged
batch and exact retry repair are not cross-partition isolation, guaranteed event
delivery after every process kill, automatic background reconciliation or tested
live crash recovery. Those remain explicit acceptance gates.

Copied destination content remains shared there after source deletion/revocation;
only source navigation becomes unavailable. No retroactive copy retraction is
promised. POLL/SYSTEM forwarding lacks a copy runtime and is rejected explicitly.
At most50 source attachments are supported, with bounded51-row authority lookup.

## Verification

- RED: policy/source-service tests failed compilation before implementation.
- RED: serialization test showed missing public marker before the privacy fix.
- RED: frontend mapper failed when given only the canonical public marker.
- RED: source with hasAttachments=true but no attachment rows was wrongly accepted;
  regression assertion failed before the guard.
- GREEN: Java20 `./mvnw.cmd -q test` exit0;427 tests across87 default suites,
  failures=0/errors=0/skipped=0 (opt-in IT XML excluded from these totals).
- GREEN: `npm run test:gifs:message-flow`:15 controlled groups including new
  forwarded/deleted/private-key-inference assertions; `npm run validate`: exit0,
  no ESLint warnings; `npm run build`: exit0, all17 routes generated.
- GREEN: OpenAPI/AsyncAPI/canonical-manifest YAML parses using existing js-yaml;
  `git diff --check` has no whitespace errors (pre-existing line-ending notices
  are not converted into source rewrites).
- Standalone MVC test proves binding/current-actor forwarding and serialized
  available/unavailable shape, not live JWT/backend/datastore execution.
- No UI layout changed in this slice, so no new visual screenshot is claimed.

## Review

Self-review across correctness, readability, architecture, security and bounded
IO: one capability-owned policy, existing claim/fingerprint reused, no new god
repository logic, exact source authorization before allocation, no recursive
source leaks, explicit unavailable states and bounded attachment access. Review
found and fixed the incomplete-source-attachment case. Independent visual-review
claims from the preceding thread slice do not apply to this backend change.

F2 needs real forward selection/send and source-view UI against this contract,
keyboard/VI/EN/error/retry/theme browser verification. Docker installation remains
deferred; do not relabel fixture/unit results as live acceptance.
