# Canonical pin protocol — 2026-10-23

## Implemented path

An authorized member reads the full pin snapshot. Commands carry the observed
decimal-string revision, bounded/parsed through Long on the backend. A changed
desired value with stale revision conflicts; already-desired values return the
current state without duplicate events. The response includes canonical message
content and the immutable full pin snapshot. Missing post-commit message data is
an explicit conflict, not HTTP200 with a null message.

Realtime uses the same full snapshot. The frontend validates scope, int64 string,
five-entry bound and duplicate IDs, compares via BigInt, and applies only newer
state. Accepted snapshots govern later history/live message flags. Entry and
reconnect refresh state; leave aborts pending reads. Commands use the currently
observed revision, with no hidden pre-write refresh/replay. Missing state has
VI/EN guidance instead of a fabricated version. Search receives an independent
pinRevision and its script compares pin/content versions independently.

## Files/reasons

Backend paths are below `chat-service/src/main/java/com/chatapp/chat_service/`:

- `canonical/message/{MessageRepository,CassandraMessagePins,CassandraMessageRepository}.java`:
  immutable pin state/change results, snapshot reads and strict expected-version
  intent semantics; remove the old boolean-only mutation contract.
- `canonical/message/{MessageService,PublicMessageView}.java`: authorize snapshot
  reads, parse expected version, publish only changes, copy the correct pin flag
  into the public result and publish full snapshots/independent search version.
- `canonical/controller/CanonicalMessageController.java`: no-store GET and
  validated required JSON mutation bodies with full-state responses.
- `canonical/dto/CanonicalApiContracts.java`: canonical pin request/reference/
  snapshot/mutation DTOs. Revision remains a decimal string at the wire boundary.
- `canonical/search/{MessageSearchDocument,MessageSearchProjector,MessageSearchWriterImpl}.java`:
  explicit Long mapping, required pin-event revision and separate atomic guard.
- Backend tests `MessagePinHttpContractTest`, `MessagePinSlotRepositoryTest`,
  `MessageServiceTest`, `MessageSearchProjectorTest`, `ChatReadCassandraIT` and
  `MessageSearchProjectionIT`: canonical route/body/JSON, stale intent, no-op,
  exact versions, changed repository contract and compile-only real-engine cases.

Frontend paths are below `chatapp_frontend/`:

- `src/features/messenger/api/messenger.api.ts`: strict pin parser/read/command/
  acknowledgement, required observed revision and no unused unpin shortcut.
- `src/features/messenger/types/messenger.types.ts`: typed full snapshot.
- `src/features/messenger/model/{message-pin-state,message.slice,messenger.store.types,conversation.slice,useMessenger}.ts`:
  versioned room state, history/live pin derivation, reset/entry/reconnect cleanup,
  full realtime handling and observed-intent command capture. Old partial pin
  action updater is removed.
- `src/features/messenger/constants/messengerCopy.ts` and `src/shared/i18n/resources.ts`:
  short VI/EN missing-state guidance.
- `scripts/{message-pin-api,message-revision-order,message-interactions,chat-workspace-ux}-smoke.mjs`:
  canonical command fixtures, strict boundary/order tests and actual UI regression.
- `docs/api/{openapi,asyncapi}.yaml`, ADR0027 and checklist/test/traceability:
  one required canonical contract, no legacy fallback.

## Checks observed

- Default process-local JDK20 `./mvnw.cmd -q test`: **770 tests,124 fresh suites,
  0 failures/errors/skips**, reports filtered after2026-10-23T06:43:55Z. A prior
  run caught a membership-test fixture that globally stubbed every user as a
  member; it was corrected explicitly and the whole suite rerun successfully.
- `npm run validate` and `npm run build`: pass on final frontend source.
- `message-pin-api-smoke.mjs`:6 controlled groups; `message-revision-order-smoke.mjs`:
  18 actual-store groups including revisions beyond Number's exact range,
  snapshot-before-history and delayed PIN after newer UNPIN.
- Sticker message adapter3, GIF15, directory20 and locale-copy1247 keys pass.
- Final production Chromium interactions: pin POST expected0, unpin DELETE
  expected1, reload, locale, reaction, mention/reply and receipt pagination pass;
  no reported console/request failures. Screenshot fixtures were captured under
  `chatapp_frontend/artifacts/ui-audit/current/` (reply/reaction desktop/mobile).
- Workspace browser: extended to42 groups, including real controlled STOMP
  PIN10→UNPIN11→delayed PIN10, plus320/768/1024/1440 light/dark and room overrides.
  One initial combined browser run timed out in the existing slow-read-ack step;
  an isolated run passed without weakening the assertion. The final rebuilt-source
  sequential repeat also passed42 groups across all eight theme/width cases.

No browser test uses real Cassandra/broker/provider data. The optional IT cases
compile but were **not executed** while Docker remains deferred.

## Remaining gates

Separate message-flag projection reads/repair, deleted-pin slot cleanup, durable
publication/replay, lost-event recovery and real Cassandra/Elasticsearch/broker/
two-client/crash/performance acceptance remain open. Initial pin lookup failure
currently gives action-time guidance to reopen the conversation, not a dedicated
retry panel. No new CQL/dependency/env/provider change in this increment; prior
fresh-bootstrap schema requirements remain. No commit/push/reset was performed.
