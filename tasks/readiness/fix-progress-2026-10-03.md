# Readiness fixes — 2026-10-03

Source: `tasks/code-review-2026-10-03.md`. This is an implementation ledger, not a claim of production readiness. Existing unrelated workspace changes are preserved.

## Implemented boundaries

| Finding | Current status | Evidence / remaining scope |
| --- | --- | --- |
| R01 | Implemented | Exact STOMP command/subscription allowlist, authenticated account and membership checks; interceptor tests. |
| R02 | Implemented boundary; runtime pending | Outbound authorization rechecks account/token/membership before transport delivery. Live broker and throughput verification remain. |
| R03 | Partial | Public message/revisions/history/event payloads redacted; search and notification reads consult primary state. Inbox retained last-message projection and older queued events still need attention. |
| R04 | Open | Approval fencing/recovery. |
| R05 | Open | Durable send recovery across multi-step writes. |
| R06 | Partial | Invalid DM targets validated before pair claim; tested. Crash recovery and partially created room repair remain. |
| R07 | Open | Concurrent Google registration consistency. |
| R08 | Open | Durable outbox discovery beyond time window; cannot fix by increasing lookback alone. |
| R09 | Partial | Search response excludes deleted/missing primary records and reads current content. Projection version ordering remains. |
| R10 | Partial | HTTP acknowledgement reconciles by clientMessageId; no content heuristic; deleted message cannot be restored by older acknowledgement/update. Full event version ordering remains. |
| R11 | Open | Pending storage lifecycle. |
| R12 | Open | Notification pagination/count/read-all semantics. |
| R13 | Implemented; live delivery pending | Approval/decline types accepted by frontend parser and displayed in Vietnamese/English from structured type, without translating user-authored content; regression test. Real broker delivery remains unverified. |
| R14 | Open | APPROVING state visibility and stale room callback. |
| R15 | Partial | Four missing audit labels added; browser exercised all four. Exhaustive canonical mapping remains. |
| R16 | Open | Appearance save concurrency / premature success. |
| R17 | Open | Archive/join race. |
| R18 | Implemented pointer boundary; integration pending | Full Cassandra-compatible timeuuid comparator used for history ties/read ordering. Membership pointer CAS retries lost races and checks joined_at to avoid recreating removed membership. Equal-pointer retry repairs receipt batch. Live Cassandra and crash reconciliation after pointer advances beyond an unrepaired receipt remain unverified. |
| R19 | Partial | Content bounds plus upload owner/READY/deleted-state and canonical metadata validation before message identity claim. Nested reply/forward/sticker/poll references, thumbnail provenance and upload/delete race remain. |
| R20 | Partial | Unvote realtime fixed. Metadata and aggregate initialization now use independent IF NOT EXISTS writes; retry repairs missing aggregate without resetting votes/closure. Message is still published before poll initialization; command recovery and creation projection/close race remain. |
| R21 | Implemented event path; replay pending | Pin/unpin record complete message projection payloads and the search projector accepts both event types. Reordered event protection still belongs to R09; previously missed pin events require index rebuild. |
| R22 | Implemented tokens; verification pending | Dialog overlay/dialog/menu/tooltip/toast share ordered layer tokens; static regression. Nested focus/runtime still requires fresh browser verification. |
| R23 | Open | Light-theme semantic color contrast. |
| R24 | Partial | Five fixture bucket shapes corrected; browser flows pass. Contract-generated fixtures remain. |

## Checks completed

- Backend full Maven suite (`./mvnw.cmd test -q`): 212 tests passed, zero failures/errors/skips, including pin/unpin projection and service payload verification. Expected broker/Cloudinary warnings originate from negative tests, not live integration.
- Frontend `npm run validate` and `npm run build`: passed with the latest layer, tombstone and localized notification changes.
- `node scripts/message-reconciliation-smoke.mjs`, `join-notification-smoke.mjs`, `primitive-layers-smoke.mjs`: 7 assertions each passed.
- Regression scripts: acknowledgement identity/tombstone, approval notification parser, primitive layer ordering. Tests first reproduced incorrect identity matching, dropped join notifications and missing menu layer.
- Playwright fixture-backed browser smoke: admin audit and draft acknowledgement without STOMP rerun on latest production build; message delete/edit/interactions/search also passed earlier. No unexpected console/request errors. Admin mobile screenshot: `chatapp_frontend/artifacts/admin-operations.png`.
- Live Cassandra/Redis/Kafka/Elasticsearch/backend and real Google OAuth flow have not been exercised in this environment. Fixture browser tests do not validate backend integration or crash recovery.

## Organization

- New `PublicMessageView` centralizes public tombstone redaction without erasing retained moderation records.
- Outbound STOMP delivery guard is separated from channel configuration and shares canonical authorization with inbound checks.
- No schema migration, legacy data deletion or compatibility workaround was introduced.
- Read-pointer ordering follows the full timestamp and signed-byte tie-break in [Apache Cassandra AbstractTimeUUIDType](https://raw.githubusercontent.com/apache/cassandra/trunk/src/java/org/apache/cassandra/db/marshal/AbstractTimeUUIDType.java), not millisecond rounding or Java UUID natural order.

## Changed files by purpose

Backend paths below are relative to `chat-service/src/main/java/com/chatapp/chat_service/`:

- `realtime/StompAuthenticationInterceptor.java`, `StompOutboundAuthorizationInterceptor.java`, `WebSocketConfig.java`: command/delivery authorization and canonical UUID Principal routing.
- `canonical/message/PublicMessageView.java`, `MessageService.java`: public deletion redaction, content bounds and message projection events.
- `canonical/dto/CanonicalApiContracts.java`: message DTO content constraints.
- `canonical/poll/PollService.java`: publish aggregate after unvote.
- `canonical/search/MessageSearchService.java`, `MessageSearchProjector.java`: primary-state verification and pin events.
- `canonical/service/ConversationService.java`: validate DM targets before claiming pair.
- `canonical/notification/NotificationService.java`: suppress deleted/missing message preview on reads.
- Backend tests: `realtime/StompAuthenticationInterceptorTest.java`, `canonical/message/PublicMessageViewTest.java`, `MessageServiceTest.java`, `canonical/search/MessageSearchServiceTest.java`, `MessageSearchProjectorTest.java`, `canonical/service/ConversationServiceTest.java`, `canonical/notification/NotificationServiceTest.java` under the matching test source root.

Frontend paths below are relative to `chatapp_frontend/`:

- `src/features/messenger/model/message.slice.ts`, `conversation.slice.ts`, `useMessenger.ts`: acknowledgement identity, tombstone safety and HTTP-confirmed send status.
- `src/features/notifications/api/notifications.api.ts`, `model/notification.store.ts`, `model/notification-copy.ts`, `components/notification/NotificationList.tsx`: join decision parsing and bilingual presentation.
- `src/route-pages/AdminPage.tsx`, `src/shared/i18n/resources.ts`: canonical audit labels.
- `src/index.css`, `src/shared/ui/Dialog.tsx`, `DropdownMenu.tsx`, `AppToaster.tsx`: shared overlay layer ordering.
- `scripts/message-reconciliation-smoke.mjs`, `join-notification-smoke.mjs`, `primitive-layers-smoke.mjs`: production-boundary regression tests.
- `scripts/admin-route-smoke.mjs`: audit event browser coverage.
- `scripts/message-delete-smoke.mjs`, `message-edit-smoke.mjs`, `message-interactions-smoke.mjs`, `message-draft-smoke.mjs`, `search-filter-smoke.mjs`: canonical bucket fixtures and send acknowledgement assertion.

The listed edits belong to this fix pass; they do not inventory unrelated pre-existing workspace changes.

Owned production preview was stopped after browser verification. No deployment or production data mutation was performed.

## Continuation: read ordering, uploads and poll creation

- Added `canonical/message/MessageOrder.java` and `CassandraReadPointer.java`; updated `MessageRepository`, `CassandraMessageRepository` and `MessageService` to use conditional membership updates outside the receipt batch. No new CQL table is required.
- Added `canonical/message/MessageAttachmentPolicy.java`, wired into MessageService, to reject another user's/deleted/not-ready upload or forged metadata before acquiring message identity.
- Changed `canonical/poll/CassandraPollRepository.java` to conditional primary and aggregate inserts outside cross-partition batches. `PollService` repairs existing metadata on retry before accessing aggregate. The repository create contract now explicitly states idempotent repair semantics.
- Added `MessageOrderTest`, `CassandraReadPointerTest`, `MessageAttachmentPolicyTest`, `CassandraPollRepositoryTest`, `PollServiceRecoveryTest`; expanded `MessageServiceTest` for sub-millisecond read events and validation before claim.
- Targeted read/asset tests passed. Poll recovery exposed an old test that assumed no repository create call on retry; the assertion now requires idempotent repair while preserving existing vote totals. Final `./mvnw.cmd test -q`: 225 tests passed, zero failures/errors/skips. `git diff --check` also passed.
- No frontend code changed in this continuation; the prior frontend build/browser results are not presented as new integration verification.
- The upload policy deliberately requires ownership. Canonical forwarding support must authorize source-room assets explicitly rather than weakening this policy to accept any known asset ID.

## Next required work

Durable recovery/fencing (R04–R08), primary inbox projection privacy, notification contract semantics, read-pointer CAS, assets/reference authorization and poll retry consistency require dedicated integration tests and, where needed, reviewed schema migrations. Do not mark these complete based on unit tests for the implemented boundaries.
