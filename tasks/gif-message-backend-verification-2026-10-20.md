# Canonical GIF message backend —2026-10-20

## Scope delivered

Typed `gif: { provider, providerGifId }` is supported by the existing canonical
message send/read/history record, idempotency fingerprint, Cassandra message
repository and realtime event. Only GIPHY identity is accepted. Media URL is never
part of this payload; backend does not call GIPHY. A syntactically accepted ID is
not proof the provider still serves it. Frontend send/renderer/picker is pending.

## Files and decisions

- `canonical/model/CqlCanonicalRecords.java`, `canonical/dto/CanonicalApiContracts.java`:
  one typed GifReference in request/record. Existing Java call sites updated to
  the single canonical constructor; no legacy overload or dual payload contract.
- `canonical/message/MessageGifPolicy.java`: pure shape policy before claim;
  GIF requires exact provider, bounded ID, empty PLAIN content, no mixed
  sticker/poll/attachments. Other message types reject a gif object.
- `MessageService.java`: existing room permission/archive/chat policy retained,
  pass identity to persisted record and realtime event, readable GIF notification,
  prevent text editing of GIF. Existing fingerprint mapper includes the new
  structured field, so a changed ID cannot reuse an existing message claim.
- `CassandraMessageRepository.java`, root `chat_app_complete.cql`: two columns
  `gif_provider`/`gif_id` in the existing table, exact save bindings and read
  hydration. No additional table/index, media cache, full scan or god-repository
  business logic. This is the approved fresh schema, not an upgrade of an existing
  database; IF NOT EXISTS cannot add columns to an already-created old table.
- `PublicMessageView.java`: delete tombstones clear gif together with other
  retained references, including replay/source paths that reuse this canonical
  redactor.
- `canonical/poll/PollService.java` and existing test fixtures: null gif on
  non-GIF constructors; fixture updates were mechanical, not compatibility code.
- OpenAPI/AsyncAPI, `docs/flows/giphy-gifs.md`, live test documentation and todo:
  exact typed shape, scope, schema and remaining frontend/runtime work.

## Observed tests

The initial policy test failed to compile before GifReference existed. Policy
tests cover positive GIPHY identity, missing/wrong provider, URL/traversal/oversize
IDs, hidden GIF on non-GIF types, mixed text and fingerprint distinction.

Service tests cover write/realtime identity and nonempty notification metadata,
committed replay without another write, changed-claim conflict, invalid ID before
claim allocation and room-permission denial before repository IO. Redaction test
contains retained GIF identity and checks it is absent from the public tombstone.

Repository binding/hydration test initially failed because its mock omitted
`setConsistencyLevel` chaining, not because production hydration lost the value.
After fixing that fixture, it checks actual prepared save arguments and typed
row mapping, including a non-GIF null reference. It is not CQL execution.

MVC test uses actual canonical controller and production Jackson mapper with
mocked service/security-helper boundaries: POST parses nested identity and passes
the current actor,201/read200 serialize the same shape. It does not prove a full
running server, session refresh or live persistence.

- JDK20 `./mvnw.cmd -q test`: observed exit0;388 tests/79 suites,
  zero failures/errors/skips. Separate old failed ChatReadCassandraIT report is
  retained and excluded from default-unit totals.
- OpenAPI and AsyncAPI parse with existing js-yaml; new send/reference schema
  present. `git diff --check`: exit0, existing CRLF warnings only.
- Live Cassandra IT now has a fifth scenario for actual GIF columns, repository
  round trip and authorized source lookup. Compiled, not executed; Docker was
  explicitly deferred by user. No live gate checked off.

Self-review: preserves existing actor/idempotency ownership, no provider IO or
secrets, no URL persistence, bounded validation, canonical deletion redaction.
API/interface and incremental guidance kept transport and backend changes
separate; this is not an independent security review.

## Still required

Dedicated picker/attribution; frontend typed send attempts, retries, optimistic/
HTTP/WS/cache/history mapping; direct provider renderer with unavailable and
reduced-motion states; localized previews; browser matrix and real DB/provider/
two-client acceptance. No new UI or screenshot is claimed for this backend slice.
Frontend source was unchanged, so the successful prior build was not rerun.
No service installed, provider call, secret read, commit/push or database reset.
