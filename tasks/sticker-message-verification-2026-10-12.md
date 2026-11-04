# Sticker messages — backend evidence (2026-10-12)

Previous goal turn made verified progress on admin catalog/editor. This turn implements S4 backend; S5 frontend and the full feature-expansion goal are not declared complete.

## Changed code and reasons

- `canonical/message/MessageStickerPolicy.java`: separate ID-only payload rules from current catalog validation. No catalog-manager role or upload ownership requirement is imposed on members sending approved shared artwork.
- `canonical/sticker/StickerCatalogService.java`: bounded sendability checks reuse the canonical image safety projection; historical lookup ignores catalog availability but does not invent missing artwork.
- `canonical/message/MessageRepository.java`, `CassandraMessageRepository.java`: non-mutating claim lookup, quorum authority reads/writes and local-serial claim. Claim creation no longer repeats its initial read; failed CAS reloads the original identity.
- `canonical/message/MessageService.java`: real policy integration before allocation; committed matching replay precedes catalog revalidation. Sticker ID already participates in the full request fingerprint and message/realtime payload. No new duplicate send pipeline.
- `canonical/sticker/StickerMessageService.java`, `StickerMessageController.java`: message-authorized historical artwork read, no-store, inactive artwork retained and deleted/non-sticker message withheld.
- `docs/contracts/canonical-api.yaml`, `docs/api/openapi.yaml`, `docs/flows/sticker-catalog.md`: new route and tightened ID-only send rules recorded; no schema migration or compatibility path added.

## Tests

- New `MessageStickerPolicyTest`: ID-only payload, missing identity, client image URL/caption, non-PLAIN content, poll collision and cross-type sticker smuggling.
- `MessageServiceTest`: real sticker policy wired; unavailable catalog fails before claim/write; positive canonical save/realtime; exact committed replay bypasses removed catalog without another write; changed-payload claim rejected; unfinished reservation revalidates; room permission precedes catalog access; sticker edit cannot inject arbitrary content/image URL.
- New `MessageRequestFingerprintTest`: identical sticker/request stable, different sticker different fingerprint.
- New `CassandraMessageClaimTest`: bounded read cannot allocate, room+fingerprint matching, quorum/serial settings and failed-claim collision returns original bucket/id.
- `StickerCatalogServiceTest`: shared ready artwork allowed, missing/inactive pack/sticker/unavailable file refused, retained inactive historical artwork still readable and unavailable image explicit.
- New `StickerMessageServiceTest`, `StickerMessageControllerTest`: actor from security context, exact message reference, forbidden/deleted/non-sticker privacy, JSON response/no-store and canonical 403.

Initial policy test failed before implementation as expected. The first new HTTP tests failed because they omitted `Accept: application/json`; corrected the test requests to the app's JSON contract, without changing production serialization or suppressing assertions.

Targeted runs passed. Final full JDK20 `./mvnw.cmd -q test` passed with **343 tests / 70 suites, zero failures/errors/skips**, including the claim-read optimization and edit bypass regression. Counts were read from the final Surefire XML reports after process exit0. `git diff --check` passed (existing SecurityConfig CRLF warning only). No frontend files changed in this backend slice; prior frontend validate/build results are not presented as new sticker-picker evidence.

Five-axis source review: global admin catalog mutations remain unchanged, sending/history use conversation permission, no image URL accepted from sender, no new authority/schema or full scans, no new external dependency, no new feature logic in CanonicalCqlStore. The edit bypass found during review was fixed and covered. Provider URL privacy and cross-partition race limits below are explicit, not claimed solved. The optional incremental-skill definition-of-done appendix was absent on this host; repository tests/contracts and explicit plan acceptance were used instead.

## Boundaries and outstanding gates

- Docker command is not available, and the standard Docker executable path is absent on this host. No live Cassandra, replica race, process crash or provider IO was exercised. Mockito/query-binding tests are not database integration.
- Retention uses already implemented immutable catalog artwork and media retention lock; broader asset references/cleanup jobs remain M2 work.
- Availability is checked before accepting a new write, not atomically transacted across catalog and message partitions. Concurrent deactivation does not retroactively revoke an in-flight validated send.
- Historical API requires current message access. Existing public-provider URL storage is unchanged; it is not private revocable file serving.
- Member picker, browser send attempts, historical image rendering, notification copy and live two-user realtime checks remain S5. Threads/forwards/calls/settings/email/moderation remain in the original checklist.

## Official framework sources consulted

Project dependencies: Spring Boot3.5.3, managed Spring Framework6.2.8, Cassandra driver4.19.0, Java20 (pom and local managed BOM inspected).

- [Spring MVC6.2 request mapping](https://docs.spring.io/spring-framework/reference/6.2/web/webmvc/mvc-controller/ann-requestmapping.html): explicit GET mapping, path variables and controller contract. Online docs currently show the later6.2 maintenance patch; code compiles/tests against the repository's6.2.8 dependencies.
- [Apache Cassandra Java Driver4.19 statements](https://apache.github.io/cassandra-java-driver/4.19.0/core/statements/): immutable bound statements and normal/serial consistency attributes; returned configured instances are passed to execute, not discarded.
