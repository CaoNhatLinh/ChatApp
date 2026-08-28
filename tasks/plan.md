# Implementation Plan: NovaChat Canonical Production Rebuild

## 1. Outcome

Hoàn thiện NovaChat end-to-end trên một contract duy nhất từ `chat_app_complete.cql` tới Spring Boot và React. Kiến trúc bắt buộc giữ đủ sáu thành phần: Spring Boot, Cassandra, Kafka, Redis, Cloudinary và Elasticsearch. Runtime chỉ sử dụng schema, API và event contract canonical; legacy data/code/compatibility không thuộc phạm vi xử lý.

Kết quả cuối phải chạy được bằng Docker, có API/WebSocket thật, frontend dùng đúng contract, có test tự động và chứng minh được các giới hạn/permission/log/audit mà sản phẩm yêu cầu.

## 2. Current Baseline And Guardrails

### Baseline đã kiểm tra

- `chat_app_complete.cql` có 2 UDT và 78 bảng/query projection cho identity, social, room, message, media, poll, invite, notification, moderation, audit, call, outbox và analytics.
- Spring dependencies và Compose manifests cho Cassandra, Redis, Kafka, Elasticsearch, WebSocket và Cloudinary đã được thêm, nhưng Docker chưa có trong `PATH` nên clean-stack chưa được xác minh.
- Backend canonical hiện có 96 production source và 73 test cases pass khi chạy JDK 20; clean-stack integration vẫn chưa có. JDK mặc định của host là 17 và không chạy được class test Java 20.
- Frontend `npm run validate`, Next production build và public/deep-link Playwright smoke đều pass không warning lint; build vẫn có hai chunk vượt 500 kB.
- Các lệch REST/STOMP trọng yếu đã được canonicalize cho conversation create/list, bucketed history, reaction/read/revision, room pin, user profile/search, notification, presence và global admin.
- Playwright smoke đã có cho public/deep-link và unauthenticated redirect; authenticated multi-account E2E vẫn chưa có bằng chứng.
- Inventory và phân loại chi tiết nằm tại `tasks/function-audit.md`.

### Quy tắc chống xoá nhầm

1. Không xoá Kafka, Redis, Cloudinary, Elasticsearch, Cassandra, Spring WebSocket/STOMP hoặc tính năng frontend tương ứng.
2. Không dùng thao tác xoá hàng loạt. Trước khi xoá một file phải có bảng thay thế canonical, code thay thế, test tương ứng và kiểm tra bằng `rg` rằng không còn consumer hợp lệ.
3. Không xoá các field media chi tiết. `attachment_ref`, `storage_provider`, `storage_key`, `public_id`, URL phân phối, `thumbnail_url`, MIME, size, checksum, dimensions và lifecycle vẫn là contract; `media_assets` là aggregate metadata, không phải lý do làm mất snapshot attachment.
4. Không gộp `conversation_roles_by_conversation` vào member. Room không phải DM được tạo custom role, màu, thứ tự và permission; member chỉ giữ tập `role_ids`.
5. Không dùng Cassandra scan, `ALLOW FILTERING`, offset pagination hoặc partition không giới hạn. Mọi query mới phải bắt đầu từ access pattern.
6. Không ghi binary media vào Cassandra; Cloudinary lưu object, Cassandra lưu authoritative metadata/snapshot.

## 3. Architecture Decisions

| Component | Trách nhiệm production | Không được dùng làm |
| --- | --- | --- |
| Cassandra 4.1 | Source of truth cho user, room, membership/RBAC, message, poll, invite, preference, moderation, audit, outbox và query projections | Full-text search, transient typing/presence, binary storage |
| Kafka | Durable domain-event bus; outbox publisher; consumers cho search, notification, analytics và integration | Source of truth của message; request/reply đồng bộ bắt buộc |
| Redis | Presence, typing TTL, distributed rate limit/slow mode, cache, idempotency ngắn hạn và fan-out giữa Spring instances | Dữ liệu nghiệp vụ duy nhất, audit hoặc lịch sử vĩnh viễn |
| Elasticsearch | Projection cho search room/message có filter và ranking; rebuild được từ Cassandra/Kafka | Authoritative authorization hoặc write store |
| Cloudinary | Upload/download image, video, audio, file; transformation/thumbnail; signed upload/delete/webhook | Lưu role, message hoặc permission |
| Spring Boot | Validation, authentication, authorization, orchestration, CQL repositories, outbox, REST/STOMP/WebRTC signaling | Để controller query DB trực tiếp |
| React | UI, optimistic state có reconcile, private visual preferences, invite/admin flows | Tự quyết permission hoặc tin dữ liệu cache là authoritative |

### Luồng ghi chuẩn

`REST/STOMP command -> validate -> app RBAC + room RBAC -> ban/mute/chat-mode/slow-mode -> Cassandra authoritative write + projections + room event + audit + outbox -> response -> outbox publisher -> Kafka -> realtime/search/notification/analytics consumers`.

Cassandra không có multi-partition transaction. Mỗi command phải có idempotency key, trạng thái operation/outbox và consumer idempotency để retry/converge an toàn. LWT chỉ dùng cho uniqueness, claim pin slot, invite usage và ownership invariants; không dùng LWT cho mọi message.

### Quyền và notification precedence

- App RBAC: `SUPER_ADMIN`, `APP_ADMIN`, `TRUST_SAFETY`, `SUPPORT`, `ANALYST`,
  `AUDITOR`, `USER` và permission bounded do backend định nghĩa.
- Room RBAC: owner + system/custom roles theo room; DM không có role-management.
- Permission hiệu lực là union của role IDs, sau đó áp dụng owner protection, ban/sanction và room policy.
- Notification quyết định theo thứ tự: system safety override -> device capability -> global user setting -> per-room user override -> room default do owner đặt -> mention/reply/DM/event class -> quiet hours -> dedupe/throttle.
- Owner chỉ được giảm mức notification mặc định của room; không được bật lại một loại mà user đã tắt.

## 4. Dependency Graph

```text
CQL/access-pattern review
  -> shared Java/TypeScript contracts
  -> Docker + Spring integration baseline
  -> identity/app RBAC
  -> room/membership/custom RBAC
  -> messages + projections + outbox
       -> Redis realtime/presence/rate limit
       -> Kafka durable consumers
       -> Elasticsearch search
       -> Cloudinary attachment lifecycle
       -> notification delivery
  -> polls/moderation/invites/calls/admin
  -> frontend vertical slices
  -> integration/E2E/load/security verification
```

## 5. Implementation Phases And Tasks

Mỗi task đánh số dưới đây là một vertical delivery slice. Trước khi code, executor phải tách slice thành các commit/subtask S hoặc M, mỗi subtask tối đa khoảng 5 file production cùng test trực tiếp; thứ tự chuẩn là contract -> repository -> command/query service -> REST/STOMP adapter -> frontend consumer -> verification. Không tạo một commit "implement all" xuyên nhiều subsystem.

## Recovery Gate: Restore a trustworthy baseline

Gate này phải hoàn tất trước khi tiếp tục mở rộng feature surface.

### Task R.1: Restore backend compilation and run the existing tests

Sửa friendship projection/type mapping bị dở dang, bổ sung regression tests trực tiếp và chạy toàn bộ Maven suite với JDK 20.

**Acceptance criteria:** Maven compile pass; 11 test classes thực sự chạy; friend list/request/block mapping không dùng placeholder hoặc scan.

### Task R.2: Freeze the canonical HTTP/STOMP contract

Tạo machine-readable OpenAPI/event contract cho các vertical slice đang tồn tại và quyết định một endpoint duy nhất cho mỗi operation; backend là authority, frontend adapter theo contract đã chốt.

**Acceptance criteria:** Không còn route song song trong một slice; contract drift test chạy trong CI; cursor/bucket/error envelope rõ ràng.

### Task R.3: Reconnect the minimum viable vertical flow

Ưu tiên auth -> user lookup -> friend -> DM create/list -> bucketed send/history -> realtime receive/read. Sửa frontend/backend cùng một slice và thêm contract/integration test trước khi chuyển slice.

**Acceptance criteria:** Hai tài khoản có thể đăng ký/đăng nhập, tìm và kết bạn, mở DM, gửi/nhận/đọc tin, reload vẫn thấy đúng lịch sử và room ordering.

### Task R.4: Establish automated clean-stack evidence

Thêm Playwright multi-account harness và Testcontainers/Compose verification. Nếu máy chạy agent chưa có Docker, chuẩn bị scripts/CI và ghi rõ bước xác minh còn blocked thay vì đánh dấu pass.

**Acceptance criteria:** Không có checkbox E2E không kèm test file/log; schema apply hai lần; backend integration, frontend build và browser flow chạy từ state sạch.

### Recovery checkpoint

- Backend compile/test pass.
- Frontend type-check/lint/build pass không có warning có khả năng gây lỗi runtime.
- Contract mismatch trong `tasks/function-audit.md` được xử lý cho minimum viable flow.
- Clean-stack E2E có bằng chứng hoặc được ghi rõ là blocked bởi Docker, không báo hoàn tất giả.

## Phase 0: Freeze Contract And Recover The Stack

### Task 0.1: Protect the canonical rebuild

**Description:** Lưu inventory capability và module canonical; mọi deletion phải có test contract/runtime chứng minh trước khi xoá.

**Acceptance criteria:**

- Có capability matrix bao phủ backend, frontend, CQL, Docker và documents.
- Mọi integration bắt buộc có owner, target module và verification command.
- Không có file nghiệp vụ nào bị xoá thêm trong task này.

**Verification:** Review `git diff --name-status` và capability matrix.

**Dependencies:** None.

### Task 0.2: Audit and freeze `chat_app_complete.cql`

**Description:** Review 68 bảng theo access pattern, partition growth, clustering order, TTL/retention, LWT và field semantics; chỉ sửa khi có query hoặc invariant cụ thể.

**Acceptance criteria:**

- Mỗi API/query có table + full partition key + cursor strategy.
- Media giữ cả `attachment_ref` snapshot và `media_assets` lifecycle metadata.
- Custom room roles, max-3 room pins, max-5 message pins, outbox/audit và search projection inputs đều có storage contract rõ.

**Verification:** CQL parse bằng Cassandra 4.1 `cqlsh`; script tạo schema chạy hai lần không lỗi.

**Dependencies:** 0.1.

### Task 0.3: Restore mandatory Spring dependencies and configuration

**Description:** Bổ sung Spring WebSocket, Data Redis, Spring Kafka, Spring Data Elasticsearch, Cloudinary SDK, validation, observability và testcontainers tương thích Spring Boot 3.5/Java 20.

**Acceptance criteria:**

- `pom.xml` có đủ dependency, version management nhất quán và không có duplicate client.
- Configuration dùng environment variables, secret không commit và mỗi integration có enable/health policy.
- Ứng dụng khởi động fail-fast cho Cassandra; dependency projection có readiness/degraded-mode đúng thiết kế.

**Verification:** Maven dependency tree và Spring context smoke test.

**Dependencies:** 0.2.

### Task 0.4: Build the complete Docker development stack

**Description:** Chuẩn hoá Compose gồm Cassandra 4.1, schema-init job, Redis, Kafka, Elasticsearch và backend dependencies/healthchecks.

**Acceptance criteria:**

- `docker compose up -d` tạo đủ Cassandra, Redis, Kafka và Elasticsearch ở trạng thái healthy.
- Schema-init thật sự chạy `chat_app_complete.cql`; không dựa vào thư mục init mà Cassandra image không tự thực thi.
- Volume/network/port/env được khai báo một lần, có profile cho observability UI nếu cần.

**Verification:** `docker compose config`, health probes và query kiểm tra keyspace/table/topic/index.

**Dependencies:** 0.3.

### Checkpoint 0

- Backend Spring context chạy với đầy đủ integration.
- Canonical CQL apply idempotently trên Cassandra sạch.
- Không có integration bắt buộc nào bị loại khỏi POM, Compose hoặc architecture docs.

## Phase 1: Shared Contracts, Identity And App Administration

### Task 1.1: Define canonical shared types and error contract

**Description:** Tách UUID/time/bucket/cursor/enums/request-response/event envelope thành type rõ ràng; đồng bộ camelCase REST và UPPER_SNAKE enums với TypeScript.

**Acceptance criteria:**

- Không dùng string tuỳ ý cho message type, room type, status, permission hoặc notification level.
- Error envelope có HTTP status, machine code, message, field errors, correlationId và timestamp.
- OpenAPI contract sinh được và frontend types có kiểm tra drift.

**Verification:** Contract/unit tests và TypeScript type-check.

**Dependencies:** Checkpoint 0.

### Task 1.2: Implement authentication, sessions and identity

**Description:** Register/login/refresh/logout/profile/device flow dùng các bảng lookup canonical và password/JWT/refresh-token rotation an toàn.

**Acceptance criteria:**

- Username/email/external identity uniqueness retry-safe; refresh token chỉ lưu hash và revoke/rotate được.
- JWT principal có userId, app roles/permissions; disabled/locked/sanctioned user bị chặn đúng.
- Audit không ghi password, raw token hoặc mobile push token.

**Verification:** Auth integration tests gồm duplicate, expired, revoke và concurrent refresh.

**Dependencies:** 1.1.

### Task 1.3: Implement app-wide RBAC and admin user controls

**Description:** Quản lý app roles tách biệt hoàn toàn với room roles; cung cấp API ban/suspend/restore/role assignment có reason và audit.

**Acceptance criteria:**

- USER không gọi được app-admin API; SUPER_ADMIN protections không thể bị bypass.
- Mọi role/sanction mutation có before/after, actor, reason, correlationId và outbox event.
- Admin listing dùng query projection/cursor, không scan Cassandra.

**Verification:** Permission matrix tests theo từng app role.

**Dependencies:** 1.2.

### Checkpoint 1

- Auth + app RBAC chạy end-to-end từ Cassandra tới REST.
- Security tests và audit assertions đều pass.

## Phase 2: Conversations, Membership And Custom Room RBAC

### Task 2.1: Create DM, group, private channel and community channel

**Description:** Implement room creation với validation, DM pair idempotency, visibility/join policy, owner/system roles và projections cho room discovery/user list.

**Acceptance criteria:**

- DM giữa cùng cặp user không bị tạo trùng khi concurrent retry.
- Private channel không xuất hiện trong community search; community channel search/join được theo policy.
- Room non-DM tạo owner/system roles và membership projections nhất quán.

**Verification:** Cassandra integration tests và API contract tests cho bốn room types.

**Dependencies:** Checkpoint 1.

### Task 2.2: Implement room list, last message and automatic ordering

**Description:** Xây `conversations_by_user` projection chứa last-message summary, unread state và activity ordering; cập nhật idempotently sau message/system event.

**Acceptance criteria:**

- Tin nhắn mới đẩy room lên đầu với last message chính xác cho mọi member được phép thấy.
- Edit/delete không làm sai thứ tự; deleted last message có preview/status theo contract.
- Cursor pagination ổn định, không mất/trùng room khi activity thay đổi giữa hai page.

**Verification:** Multi-user ordering integration test và frontend list test.

**Dependencies:** 2.1.

### Task 2.3: Implement personal room pins with a hard limit of three

**Description:** Dùng ba slot LWT theo user; pinned section tách khỏi activity sort nhưng unpinned rooms vẫn sort theo tin mới.

**Acceptance criteria:**

- Concurrent pin thứ tư trả `409 LIMIT_EXCEEDED` và không tạo orphan projection.
- Pin/unpin/reorder retry-safe; mỗi user thấy pin riêng.
- Pin không làm thay đổi pin hoặc room ordering cá nhân của user khác.

**Verification:** Concurrency integration test cho 3 slot.

**Dependencies:** 2.2.

### Task 2.4: Implement custom room roles and permission evaluation

**Description:** CRUD role theo conversation với name, color, position, permissions; member có nhiều role; owner/system role có protection.

**Acceptance criteria:**

- DM từ chối role-management; non-DM cho phép custom role theo permission.
- Permission hiệu lực là union role IDs, cache Redis có version/invalidation và Cassandra vẫn authoritative.
- Không xoá role đang dùng nếu chưa có replace/remove strategy; owner role không thể xoá/chuyển trái invariant.

**Verification:** Role CRUD, color, union, cache invalidation và privilege-escalation tests.

**Dependencies:** 2.1.

### Task 2.5: Implement member lifecycle and ownership transfer

**Description:** Join/add/invite/approve, assign/remove/yield role, kick, leave và ownership transfer với system message + room event + audit.

**Acceptance criteria:**

- Owner không thể leave khi chưa transfer hoặc xử lý room theo policy.
- Kick/ban/role change kiểm tra hierarchy và không cho actor tự nâng quyền trái phép.
- Mọi action hiển thị cần thiết trong message history và đồng thời có structured room/audit record.

**Verification:** State-transition tests và two-user/three-role E2E.

**Dependencies:** 2.4.

### Checkpoint 2

- Create/search/join/list/pin room hoạt động.
- App RBAC và room RBAC không bị trộn.
- Toàn bộ membership mutation có system message + room log + audit/outbox.

## Phase 3: Messaging, Media And Realtime

### Task 3.1: Implement idempotent bucketed message send

**Description:** Send text/emoji/sticker/system message bằng `client_message_id`, shared bucket policy và projections; backend cấp messageId/time authoritative.

**Acceptance criteria:**

- Retry cùng `(senderId, clientMessageId)` trả cùng message, không insert duplicate.
- Query history luôn có conversationId + bucket + cursor; bucket traversal bounded.
- Message write cập nhật room list, unread/read watermark, audit/room event theo event class và outbox.

**Verification:** Retry/concurrency/bucket-boundary integration tests.

**Dependencies:** Checkpoint 2.

### Task 3.2: Implement reply, mention, reaction and read state

**Description:** Reply snapshot + replied sender, mention projections, one reaction per user/emoji policy, aggregate counts và read watermark/optional seen-by.

**Acceptance criteria:**

- Reply/mention target phải thuộc message/room hợp lệ và không lộ deleted/private content.
- Reaction add/change/remove retry-safe và aggregate có reconciliation path.
- Mention/reply/unread/read events tạo notification đúng preference.

**Verification:** Message interaction integration tests và realtime reconciliation tests.

**Dependencies:** 3.1.

### Task 3.3: Implement edit, soft delete, revision and max-five message pins

**Description:** Author/moderator permissions, edit window, tombstone, revision history và năm slot pin LWT.

**Acceptance criteria:**

- Edit/delete/pin/unpin tạo system/room/audit/outbox records theo policy.
- Pin thứ sáu concurrent trả `409 LIMIT_EXCEEDED`; unpin giải phóng đúng slot.
- Delete giữ referential safety cho reply/audit/search và kích hoạt media retention policy.

**Verification:** Permission, revision, tombstone và pin concurrency tests.

**Dependencies:** 3.2.

### Task 3.4: Implement Cloudinary media lifecycle without losing detail

**Description:** Backend ký upload, validate type/size/checksum, verify webhook, persist asset + attachment snapshot, generate transformations/thumbnails và controlled delete.

**Acceptance criteria:**

- Cassandra giữ `attachment_ref`, `storage_provider`, `storage_key/public_id`, secure URL, resource type, MIME, bytes, checksum, dimensions/duration và `thumbnail_url` khi phù hợp.
- Client không giữ Cloudinary secret; upload completion chỉ trusted sau signature/webhook verification.
- Delete message không xoá object dùng chung; cleanup worker dùng reference/lifecycle state và audit.

**Verification:** Mock Cloudinary contract tests, webhook signature tests và media E2E.

**Dependencies:** 3.1.

### Task 3.5: Restore WebSocket/STOMP realtime and Redis ephemeral state

**Description:** JWT handshake, authorized subscriptions, event envelope, typing/presence TTL, multi-device sessions và cross-instance Redis Pub/Sub.

**Acceptance criteria:**

- Client không subscribe room/user queue trái quyền; reconnect lấy snapshot rồi resume event stream.
- Typing tự hết hạn, presence đúng multi-tab/multi-device và không ghi Cassandra mỗi heartbeat.
- Redis outage không làm mất authoritative message; realtime có retry/resync rõ ràng.

**Verification:** WebSocket integration test hai instance + Redis, reconnect và authorization tests.

**Dependencies:** 3.1.

### Task 3.6: Implement Redis rate limits, slow mode and room chat modes

**Description:** Atomic distributed limiter theo user/room, per-user override có duration, room slow-mode, `EVERYONE`, `ADMINS_ONLY`, `LOCKED` command policy.

**Acceptance criteria:**

- Ví dụ cooldown 5 phút hoạt động trên nhiều backend instance và trả `retryAfter` chính xác.
- Chat lock chỉ chặn send/edit theo policy; vote, leave và action được phép vẫn hoạt động.
- Administrator thay policy phải có expiry, reason, system message, audit/outbox và cache invalidation.

**Verification:** Redis atomic/concurrency/clock-boundary tests và permission E2E.

**Dependencies:** 3.5.

### Checkpoint 3

- Hai user chat realtime được với text/reply/reaction/media/edit/delete/read/pin.
- Room tự lên đầu và last message đúng.
- Redis/Kafka/Cloudinary không thay Cassandra làm source of truth.

## Phase 4: Kafka, Search, Poll, Moderation And Invitations

### Task 4.1: Implement the Cassandra outbox and Kafka pipeline

**Description:** Outbox claim/publish/retry/dead-letter, versioned topics, partition keys và idempotent consumers cho search/notification/analytics.

**Acceptance criteria:**

- Message/business transaction thành công nhưng Kafka tạm down vẫn được publish lại.
- Event ordering giữ theo aggregate key; consumer dedupe theo eventId/version.
- Có lag, retry, failure metrics và replay/rebuild procedure.

**Verification:** Kafka/Testcontainers failure-recovery and duplicate-delivery tests.

**Dependencies:** 3.1.

### Task 4.2: Implement authorized Elasticsearch projections and search

**Description:** Index room/message documents từ Kafka; search text plus sender, replied user, mentioned user, attachment presence/type, message type, date range và room scope.

**Acceptance criteria:**

- Search luôn kiểm tra membership/visibility ở Spring; Elasticsearch không tự quyết authorization.
- Edit/delete/member removal cập nhật hoặc ẩn result đúng; indexing retry idempotent.
- Có index template/mapping/alias/version, rebuild và zero-downtime reindex command.

**Verification:** Search filter matrix, access-control leakage test và reindex test.

**Dependencies:** 4.1.

### Task 4.3: Implement polls as first-class messages

**Description:** Create/open/close vote, single/multiple choice, anonymous visibility, deadline, change-vote policy và aggregate counts.

**Acceptance criteria:**

- Vote concurrent/idempotent, không vượt option/deadline/policy.
- Chat locked user vẫn vote nếu poll/room policy cho phép.
- Create/close/vote có message/room/audit/outbox records theo mức hiển thị phù hợp.

**Verification:** Poll concurrency and policy tests plus UI E2E.

**Dependencies:** 3.1, 4.1.

### Task 4.4: Implement moderation, ban, timed mute and language audit

**Description:** Room ban/mute, app sanction, reports, bounded timed-expiry worker,
configurable text moderation adapter/library, evidence/result retention và manual review.

**Acceptance criteria:**

- Ban/mute có start/end/reason/actor/status; expiry hiệu lực không cần destructive delete.
- Moderation result lưu rule/version/score/categories/action, không thay message âm thầm.
- False-positive review/appeal và admin override đều có immutable audit trail.

**Verification:** Policy boundary and expiry unit tests are present; live
multi-instance expiry, evasion samples, language classifier, appeal and moderator
audit integration tests remain.

**Dependencies:** 2.5, 3.6, 4.1.

### Task 4.5: Implement invite links, QR and join landing flow

**Description:** Token bảo mật; QR chỉ encode canonical invite URL; expiry/max uses/approval; accept/decline; list/revoke; join-attempt analytics.

**Acceptance criteria:**

- Valid/expired/revoked/limit-reached/not-found/already-member states có machine code và UI tương ứng.
- Concurrent last-use claim không vượt max; cùng user/link không join hai lần.
- Owner/manager xem creator, createdAt, expiry, use count, joiners; revoke vĩnh viễn làm URL/QR cũ vô hiệu.

**Verification:** Link state/concurrency/security tests, QR decode test và browser E2E gồm paste URL trong app.

**Dependencies:** 2.5, 4.1.

### Checkpoint 4

- Kafka durable pipeline phục hồi được sau outage.
- Search không rò rỉ room/message.
- Poll, moderation và invite/QR hoàn chỉnh từ DB tới UI contract.

## Phase 5: Notifications, Personalization And Calls

### Task 5.1: Implement Discord-like notification policy

**Description:** Global/per-room/default settings, all/mentions/replies/DM/none, mute until, quiet hours, desktop/mobile channel và owner room defaults.

**Acceptance criteria:**

- Precedence được implement một lần trong policy service và có decision reason.
- User có thể giảm/tắt ở nhiều mức; owner default không override lựa chọn riêng của user.
- Suppressed notification không gửi push nhưng vẫn có thể giữ inbox event theo policy.

**Verification:** Truth-table unit tests cho toàn bộ precedence combinations.

**Dependencies:** 4.1.

### Task 5.2: Implement web/mobile delivery workers

**Description:** Kafka consumer tạo inbox notification, WebSocket fan-out, web push/mobile provider adapter, delivery attempt, dedupe, retry và invalid token handling.

**Acceptance criteria:**

- Một event không tạo duplicate notification/push khi Kafka redelivery.
- Token được mã hoá/masked, revoke theo device và không xuất hiện trong logs.
- Delivery status/attempt/error category quan sát được cho support/admin.

**Verification:** Provider contract tests bằng test doubles cô lập (chỉ test, không chạy trong production), retry/DLQ test và multi-device E2E.

**Dependencies:** 5.1.

### Task 5.3: Implement private user chat appearance

**Description:** Theme/background/bubble style IDs lấy từ source-controlled registries; preference sync theo user/per-room; optional uploaded background dùng Cloudinary.

**Acceptance criteria:**

- Setting chỉ thay UI mà chính user đó nhìn thấy; không đổi UI của người đối diện.
- DB lưu stable theme/style IDs và background asset reference, không lưu arbitrary executable CSS.
- Missing/deprecated IDs are rejected at the canonical boundary; background upload tuân media security/lifecycle.

**Verification:** Cross-account privacy test, canonical validation unit test và visual browser test.

**Dependencies:** 3.4.

### Task 5.4: Implement authorized 1–1 WebRTC signaling and call records

**Description:** Authorized direct-call signaling, call/member state, join/leave/end, native browser SDP/ICE, configured ICE servers, reconnect và call metadata/audit. Group/SFU media topology không nằm trong contract hiện tại và phải được triển khai như một provider riêng khi có hạ tầng được phê duyệt.

**Acceptance criteria:**

- Chỉ hai peer của một DM hợp lệ được start/join signaling/call; ban/kick/revoke có hiệu lực.
- Cassandra chỉ lưu metadata, participant timing và outcome; không lưu media/signaling secrets.
- Không quảng bá group mesh như production path; group/SFU bị tắt cho tới khi có provider contract, capacity và kiểm thử độc lập.

**Verification:** Signaling authorization tests, two-client browser E2E với camera/mic thật và call record assertions; hiện còn pending do thiếu stack/live media.

**Dependencies:** 3.5, 4.1.

### Checkpoint 5

- Notification precedence và delivery đa thiết bị được chứng minh bằng test.
- Theme/background là private per-user đúng yêu cầu.
- Voice/video 1–1 có signaling, authorization và persisted metadata; group/SFU là gap có chủ đích, không có UI giả.

## Phase 6: Integrated Global Admin, Analytics And Operations

### Task 6.1: Build admin information architecture and permission scopes

**Description:** Tạo protected global-admin routes trong các project hiện tại với dashboard, users, rooms, moderation, reports, invites, messages/audit, notifications, media, system health và settings; chỉ tách project khi có boundary vận hành/compliance độc lập.

**Current implementation direction:** Không tách project ở thời điểm hiện tại.
`chatapp_frontend` cung cấp protected `/admin`; `chat-service` cung cấp
`/api/admin/**` với server-side app permissions. Foundation hiện có capability
overview, health, bounded monthly all-room directory, room policy/archive,
global user status, app-role and bounded session/device management, monthly audit
timeline, report/sanction actions and a bounded daily analytics panel. Message
investigation/export, long-range analytics/SLO and the remaining operations tabs
tiếp tục theo các task 6.2–6.4.

**Acceptance criteria:**

- Mỗi trang/action có app permission cụ thể; analyst read-only, support bị giới hạn dữ liệu nhạy cảm.
- Dangerous actions có reason, confirmation, optional four-eyes rule và immutable audit.
- PII/token/media access có masking và access log.

**Verification:** Admin route/API permission matrix và privacy tests.

**Dependencies:** 1.3, Checkpoint 5.

### Task 6.2: Implement operational dashboards and BA metrics

**Description:** Dashboard gồm DAU/WAU/MAU, new/retained/churned users, messages/active room, delivery latency/failure, search latency/zero-result, moderation rate, invite conversion, call success/duration và infrastructure SLOs.

**Acceptance criteria:**

- Metric có definition, grain, timezone, numerator/denominator, freshness và owner.
- Cassandra operational aggregates bounded; Kafka feeds warehouse/OLAP for ad-hoc/long-range analytics.
- Filters gồm time range, room type, platform, geography an toàn, user cohort và moderation category khi có quyền.

**Verification:** Seeded analytics reconciliation tests và dashboard query performance tests.

**Dependencies:** 4.1, 6.1.

### Task 6.3: Implement admin actions and investigation workflow

**Description:** Search user/room/event, inspect timeline, handle report, sanction/unban/unmute, lock/slow room, revoke invite/device/session, reindex/replay và export bounded audit.

**Acceptance criteria:**

- Admin thấy actor/action/resource/before-after/reason/outcome/correlation/event chain.
- Action retry-safe, permissioned và không sửa/xoá immutable audit.
- Export có scope/expiry/watermark và audit; không cho unbounded Cassandra export.

**Verification:** Investigation scenario E2E and privilege escalation tests.

**Dependencies:** 6.1, 6.2.

### Task 6.4: Add observability, health, backup and runbooks

**Description:** Structured logs, correlation IDs, metrics/traces, health/readiness, Kafka lag/DLQ, Redis/ES/Cloudinary state, Cassandra repair/backup và incident runbooks.

**Acceptance criteria:**

- Có SLI/SLO cho send latency, realtime delivery, search freshness, push delivery và error rates.
- Health phân biệt required Cassandra với degradable search/push; không báo healthy giả.
- Restore/reindex/replay/key rotation/data retention procedures được thử nghiệm.

**Verification:** Failure injection cho từng dependency và documented recovery drill.

**Dependencies:** 6.3.

## Phase 7: Frontend Contract Migration And Final Verification

### Task 7.1: Enforce canonical frontend API/types

**Description:** Generate/adapt clients theo OpenAPI, xoá endpoint/type cũ chỉ sau khi vertical slice mới pass; chuẩn hoá cursor/error/realtime handling.

**Acceptance criteria:**

- Không còn API path hoặc enum lệch backend canonical.
- Optimistic sends dùng `clientMessageId` và reconcile messageId/time authoritative.
- Mỗi client/type tồn tại đều trỏ trực tiếp vào contract canonical và có contract test.

**Verification:** Type-check, lint, production build và canonical API contract tests; không dùng mock-success trong runtime.

**Dependencies:** Backend slice tương ứng từ Phase 1-6.

### Task 7.2: Complete all user-facing states and accessibility

**Description:** Loading/empty/error/offline/reconnect/forbidden/expired/revoked/limit states; keyboard/screen reader/responsive/mobile-web behavior cho chat, search, poll, invite, settings và calls.

**Acceptance criteria:**

- Mọi machine error code quan trọng có UI action phù hợp, không chỉ toast chung chung.
- Chat list/window/search/invite/admin đạt keyboard navigation và semantic labels.
- Long lists dùng virtualization/cursor và không block UI khi realtime burst.

**Verification:** Browser tests, accessibility scan và responsive visual review.

**Dependencies:** 7.1.

### Task 7.3: Build the production E2E suite

**Description:** Playwright multi-account flows trên complete Docker stack và failure scenarios cho integrations.

**Acceptance criteria:**

- E2E bao phủ auth, four room types, ordering, 3/5 pins, custom roles, message/media/search/poll/moderation/invite/notification/theme/call/admin.
- Test chứng minh chat lock vẫn cho vote/leave, invite revoked không dùng lại và private theme không leak.
- Kafka/Redis/ES/Cloudinary failure/recovery không mất authoritative Cassandra state.

**Verification:** Suite chạy ổn định từ clean volumes với sandbox/test provider được đánh dấu rõ cho external services; production path không chứa mock/fallback.

**Dependencies:** 7.2.

### Task 7.4: Security, performance and release gate

**Description:** Threat model, dependency scan, authorization fuzzing, load test hot rooms/search/realtime, Cassandra partition review và release checklist.

**Acceptance criteria:**

- Không có cross-room data leak, IDOR, unsafe upload, token leak hoặc privilege escalation mức high/critical.
- Load targets/SLO được ghi rõ và p95/p99 đạt hoặc có approved capacity plan.
- Clean deployment, rollback, backup restore, reindex và Kafka replay đều được diễn tập.

**Verification:** Security/load reports và signed Definition of Done.

**Dependencies:** 7.3.

## 6. Project-Wide Definition Of Done

Một task chỉ được đánh dấu hoàn tất khi:

- Code production + unit/contract/integration test đã có; không dùng placeholder/in-memory fake trong runtime path.
- Không query Cassandra sai partition key, không `ALLOW FILTERING`, không offset pagination.
- Write mutation có validation, authorization, idempotency, audit/room event/outbox theo matrix.
- REST/OpenAPI/TypeScript/WebSocket event contract đồng bộ.
- Health, metrics, structured error và correlation ID đủ để vận hành.
- `mvn test`, frontend `type-check`, `lint`, `build` và test liên quan đều pass.
- Docker clean-start verification pass và tài liệu/runbook được cập nhật.
- `git diff` đã được review để xác nhận không xoá nhầm integration/feature/file chưa có replacement.

## 7. Feature-To-Phase Coverage

| Requirement | Owning tasks |
| --- | --- |
| Last message + auto sort room | 2.2, 3.1 |
| Pin room max 3 / message max 5 | 2.3, 3.3 |
| Search room/message và filter đầy đủ | 2.1, 4.2 |
| Poll | 4.3 |
| App roles + custom conversation roles/color | 1.3, 2.4 |
| Transfer role/owner, delete role, kick, leave | 2.4, 2.5 |
| System message + room log + audit | 2.5, 3.1-3.3, 4.3-4.5 |
| Ban, mute timed, per-user cooldown, room chat lock | 3.6, 4.4 |
| Message/edit/delete/emoji/sticker/reaction/reply/mention | 3.1-3.3 |
| Detailed attachments + Cloudinary | 3.4 |
| Private background/chat UI | 5.3 |
| Typing/presence/realtime | 3.5 |
| 1–1 voice/video WebRTC | 5.4 |
| Group voice/video via SFU provider | External provider contract (blocked until approved) |
| Language violation audit | 4.4 |
| Discord-like web/mobile notifications | 5.1, 5.2 |
| Private/community channels | 2.1 |
| Invite link/QR lifecycle and landing UI | 4.5 |
| Admin project/dashboard/BA analytics/actions | 6.1-6.4 |
| Kafka/Redis/ES integration consistency | 0.3-0.4, 3.5-3.6, 4.1-4.2 |

## 8. Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Worktree đang có rất nhiều deletion | Critical | Capability matrix, deletion gate, review name-status mỗi checkpoint; restore/rewrite theo module nhỏ |
| CQL nhiều projection và multi-partition writes | High | Idempotent command state, outbox, repair/reconciliation workers, deterministic retry |
| Cassandra hot/unbounded partitions | High | Time+hash buckets, bounded page sizes, partition metrics và load tests sớm |
| Search authorization leak | Critical | Spring authorization before/after ES, membership/visibility projection, leakage tests |
| Kafka duplicate/out-of-order delivery | High | Aggregate partition key, event version, consumer inbox/dedupe và replay-safe handlers |
| Redis outage or split brain | Medium | Redis chỉ ephemeral; Cassandra authoritative; resync snapshot và fail policy rõ |
| Cloudinary orphan/leaked uploads | High | Signed upload, webhook verification, lifecycle state, reference-safe cleanup |
| Group WebRTC requires a scalable media provider | High | Keep group/SFU out of the canonical surface until an approved provider contract, capacity plan and browser test exist |
| Admin dashboard scans Cassandra | High | Pre-aggregated operational tables + Kafka to OLAP; bounded filters only |
| Scope quá lớn dẫn tới code giả hoàn tất | Critical | Vertical slices, checkpoint gates, no checkbox without automated evidence |

## 9. Execution Order

Thực hiện tuần tự theo checkpoint 0 -> 1 -> 2 -> 3. Sau khi event contract/outbox ở 4.1 ổn định, 4.2-4.5 có thể triển khai độc lập nhưng merge theo contract version. Phase 5 phụ thuộc các domain events tương ứng. Admin và frontend chỉ dùng canonical slice đã có contract test pass. Phase 7 là release gate, không phải đợt sửa lỗi lớn cuối cùng.
