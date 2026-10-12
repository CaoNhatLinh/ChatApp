# Nối — review hệ thống, dữ liệu và UI

Ngày: 2026-10-03. Phạm vi: ChatApp, không phải Skipli.

## Kết luận

Chưa nên coi hệ thống là production-safe. Build và các kiểm thử hiện có đạt phần lớn, nhưng còn lỗi ở quyền realtime, bảo mật nội dung đã xóa, khôi phục thao tác nhiều bước, thứ tự event và contract frontend/backend. Ưu tiên sửa những điểm này trước khi tiếp tục trang trí UI hoặc chia thêm thư mục.

Đây là review, **không phải đợt triển khai sửa lỗi**. Không thay đổi production source. Các kịch bản race/crash bên dưới được suy ra từ thứ tự thao tác và điều kiện ghi trong code; chưa tái hiện bằng Cassandra/Kafka đang chạy.

## Phương pháp và giới hạn

- Inventory 426 source files: 167 Java backend, 259 frontend. Tìm kiếm toàn phạm vi, đọc sâu các luồng chính và đối chiếu controller/service/repository/store/UI/tests. Không khẳng định đã đọc từng dòng của cả 426 file.
- Đối chiếu PRODUCT.md, chatapp_frontend/DESIGN.md, tasks/readiness/plan.md, tasks/readiness/todo.md và tài liệu kiến trúc/flow liên quan.
- Hai đường dẫn UI plan/todo cũ được nhắc trong brief không còn tồn tại ở đường dẫn đó; dùng tài liệu readiness hiện tại, không tự suy ra mọi việc đã hoàn tất.
- Workspace có nhiều thay đổi sẵn. Không reset, xóa hoặc gộp các thay đổi đó.
- Máy không có listener backend 8084 hoặc datastore 9042/6379/9092/9200 trong lần kiểm tra; Docker không có trên PATH. Không chạy được end-to-end với hạ tầng thật.
- Browser capability smoke dùng API fixtures. Chúng kiểm tra giao diện/transport/state với phản hồi kiểm soát, **không chứng minh nghiệp vụ backend hoặc giao dịch Cassandra đúng**.
- P1: cần xử lý trước khi đưa vào vận hành; P2: lỗi chức năng/consistency/UX cần sửa trong đợt hardening; P3: cải thiện tổ chức và thiết kế.

## Ma trận phạm vi

| Nhóm | Đã kiểm tra | Còn cần xác nhận với runtime thật |
| --- | --- | --- |
| Auth/session/Google | Luồng trao đổi token, claim identity, tạo user, session lifecycle, transport tests | OAuth thật, concurrent registration, credential deployment, thu hồi socket |
| Conversation/DM/membership | Tạo phòng, DM pair, quyền thành viên, ban/kick/archive, projection | Race archive/join, membership counters, khôi phục tạo phòng dở dang |
| Invite/community/approval | Token/recipient state, hạn dùng, pagination, claim/lease, UI join | Crash checkpoints, lease takeover và stale worker, ban/join tranh chấp |
| Message/composer | HTTP send, optimistic state, draft/retry, edit/delete/reply/forward/mentions | Mất phản hồi sau commit, side-effect recovery, tombstone và attachment authorization |
| Reaction/read/pin/search | UI interactions, read pointer, search projection/filter | Concurrent read, event đảo thứ tự, pin projection, cursor cùng millisecond |
| Poll | Tạo/vote/unvote/close và browser flow | Duplicate create, poll/message publication ordering, live unvote |
| Notification/settings | List/count/read, realtime parser, preferences save, availability | >200 records, join decision notification, delivery thực tế |
| Admin/moderation | Route riêng, quyền, commands, policy/role/sanction/audit | Các audit event ban/community, revocation realtime, data lớn |
| UI/public/auth | Primitives/portal layers/theme, 40 route-layout checks, light/dark technology section | Full keyboard/screen-reader audit, toàn bộ custom themes, Google sign-in thật |
| Data/outbox/media | Schema/migrations/query boundaries, event publisher/projector, upload metadata | Restart/replay/rebuild, backlog dài ngày, quotas và private asset access |

## Phát hiện ưu tiên

### R01 — P1: client STOMP có thể gửi trực tiếp vào destination của broker

**Bằng chứng:** `realtime/StompAuthenticationInterceptor.java:46–53` chỉ xử lý CONNECT và SUBSCRIBE. `realtime/WebSocketConfig.java:35` bật simple broker `/topic`, `/queue`. Không thấy SEND allowlist hoặc authorization khác bảo vệ broker destinations trong cấu hình đã kiểm tra.

**Ảnh hưởng:** client đã kết nối có thể SEND tới topic hội thoại thay vì qua application handler; payload có thể xuất hiện như server event mà không đi qua kiểm tra nghiệp vụ/quyền gửi.

**Sửa:** deny client SEND tới `/topic`, `/queue`, `/user`; chỉ cho phép các `/app` commands đã định nghĩa, có principal và validation. SUBSCRIBE cũng cần allowlist chính xác. Test bằng STOMP client độc lập, không chỉ bằng React UI.

### R02 — P1: quyền bị thu hồi nhưng subscription đang mở vẫn còn

**Bằng chứng:** interceptor kiểm tra membership tại SUBSCRIBE (`:87–89`) và account status tại CONNECT (`:66–69`). `canonical/messaging/StompRealtimePublisher.java:24` phát tới topic chung. Không thấy cơ chế đóng/revalidate subscription khi ban, kick, leave hoặc suspend.

**Ảnh hưởng:** người đã subscribe có thể tiếp tục nhận sự kiện sau khi không còn quyền vào phòng/tài khoản. HTTP bị chặn không đủ để bảo vệ kênh realtime.

**Sửa:** cơ chế thu hồi quyền socket có hiệu lực trên các instance hoặc fanout tới recipients được kiểm tra quyền. Test hai phiên: subscribe → ban/kick/suspend → gửi tin; phiên bị thu hồi không được nhận payload.

### R03 — P1: API/revisions/events vẫn chứa nội dung tin đã xóa

**Bằng chứng:** `canonical/message/CassandraMessageRepository.java:194` cập nhật tombstone nhưng không xóa content; mapping `:460` vẫn trả content. `MessageService.java:328`, `:342` trả records; `:484` cho thành viên xem revisions. Repository `:357` lưu content cũ trong revision DELETE. Event publication `MessageService.java:631` vẫn dùng content của record.

**Ảnh hưởng:** UI có thể ghi “tin đã xóa”, nhưng response hoặc revision vẫn tiết lộ nội dung. Đây không phải vấn đề chỉ sửa CSS/render.

**Sửa:** public tombstone DTO/event phải redact content và dữ liệu liên quan. Nếu cần retention phục vụ điều tra, giữ đường đọc riêng cho admin có quyền/audit. Kiểm tra list/get/revisions/reply preview/search/realtime, không chỉ bubble.

### R04 — P1: lease approval chưa chặn stale attempt thực hiện side effects

**Bằng chứng:** `canonical/invite/JoinRequestService.java:155–181` và `:241–263` thêm membership, repair projections, gửi notification trước bước finish. `CassandraInviteRepository.java:156–160` finish chỉ so status APPROVING và resolved_by, không so attempt token/lease. `:303–327` cho owner hiện tại tiếp tục claim.

**Ảnh hưởng:** worker cũ sau takeover vẫn có thể chạy membership/notification rồi mới gặp conflict. Hai retry cùng manager cũng không được phân biệt bằng attempt identity. Lease đã tồn tại, nhưng chưa bảo vệ toàn bộ thao tác.

**Sửa:** resolution command có attempt/fencing identity; side effects phải idempotent và ràng buộc quyết định có thẩm quyền. Test worker A pause → lease expired → B takeover → A resume, cùng với hai request đồng thời của A. Không chỉ thêm lease check ở cuối.

### R05 — P1: retry gửi tin không khôi phục được write nhiều bước

**Bằng chứng:** `canonical/message/MessageService.java:155–159` thấy message tồn tại thì return sau saveBucket. Message được lưu ở `:193`, attachments ở `:196`, events/notifications chỉ trong nhánh `initialClaim.claimed()` ở `:207–217`.

**Ảnh hưởng:** chết sau primary write nhưng trước attachments/outbox để lại tin thiếu dữ liệu/projections; retry trả thành công mà không repair. Nếu claim client ID thành công rồi chết trước write message, retry có thể ghi message nhưng bỏ events vì không còn initial claim.

**Sửa:** durable send command/stage tracking hoặc reconciliation bảo đảm hoàn tất từng side effect theo cùng client ID. Test crash ở mỗi checkpoint, xác nhận không mất attachment, index, inbox hoặc notification và không nhân đôi tin.

### R06 — P1: DM pair có thể bị khóa vào conversation chưa tạo xong

**Bằng chứng:** `canonical/service/ConversationService.java:124` claim DM pair trước kiểm tra target active ở `:140–143`. Conversation primary lưu ở `:191`, roles/membership sau đó ở `:227`; đường existing conversation `:115–122` trả sớm.

**Ảnh hưởng:** request với target không hợp lệ có thể giữ claim rồi thất bại; lần sau gặp pair trỏ tới conversation không có thật. Crash giữa primary và membership cũng tạo phòng tồn tại nhưng thiếu quyền, retry không repair.

**Sửa:** validate trước claim; creation state và recovery idempotent cho pair/room/roles/members. Không xóa pair đang thuộc worker khác một cách mù quáng.

### R07 — P1: concurrent Google registration có thể ghi đè user cùng identity

**Bằng chứng:** `canonical/auth/GoogleAuthService.java:150–178` hai request có thể cùng nhận subject owner khi user chưa tồn tại rồi claim username/email riêng và cùng save. `canonical/user/CassandraUserRepository.java:49–56` là INSERT không điều kiện; `:124–139` ghi primary và directory qua bước riêng. Đường linked user (`GoogleAuthService.java:72–75`) không repair directory bị thiếu.

**Ảnh hưởng:** username lookup có thể không khớp primary user; request chậm có thể ghi lại profile/status/security fields. Lỗi giữa primary/directory không tự được hoàn tất chỉ bằng login retry.

**Sửa:** registration command có payload cố định, create-if-absent primary và completion state/projection recovery. Test hai request cùng Google UID với username khác nhau; fail directory rồi retry; không cho registration retry ghi đè account đã hoàn tất.

### R08 — P1: outbox cũ hơn lookback không được retry

**Bằng chứng:** `canonical/messaging/CassandraOutboxPublisher.java:29` mặc định 24 giờ, `:33` giới hạn 168; vòng `:40` chỉ đọc các partition gần hiện tại. Không có persistent oldest-pending checkpoint. Budget cũng giảm khi publish thất bại.

**Ảnh hưởng:** outage/backlog dài hơn cửa sổ làm event pending bị bỏ lại vĩnh viễn. Tải mới liên tục cũng có thể làm event cũ khó được xử lý.

**Sửa:** pending partition registry/checkpoint và retry scheduling có backoff; oldest pending vẫn được xử lý sau restart. Tăng lookback chỉ giảm xác suất, không giải quyết cơ chế. Test outage >24 giờ và recovery dưới tải.

### R09 — P1: event cũ có thể làm search hiện lại tin đã xóa

**Bằng chứng:** `canonical/search/MessageSearchProjector.java:30–57` ghi đè document với SEND/EDIT/DELETE mà không kiểm tra revision/version. `MessageService.java:539–561` event payload không có ordering version. Search dựa vào projection isDeleted, không revalidate nội dung theo primary trước khi trả.

**Ảnh hưởng:** SEND/EDIT retry sau DELETE có thể reset deleted=false và content cũ. Đây là rủi ro privacy, không chỉ index chậm.

**Sửa:** canonical event version và conditional/external-version projection writes; replay/rebuild có cùng ordering rule. Test SEND → DELETE → replay SEND và EDIT out-of-order.

### R10 — P2: send UI bỏ qua kết quả HTTP thành công

**Bằng chứng:** `chatapp_frontend/src/features/messenger/model/useMessenger.ts:519` await sendMessageHttp nhưng không dùng canonical message trả về, rồi xóa pending attempt. `message.slice.ts:32–39` vẫn có heuristic sender/content/type/time dù event có clientMessageId.

**Ảnh hưởng:** mất STOMP event làm optimistic tin mắc ở sending dù server đã lưu; hai tin giống nhau có thể reconcile nhầm nếu event đến đảo thứ tự. Action cần messageBucket/ID thật không sẵn sàng.

**Sửa:** upsert authoritative HTTP result theo clientMessageId; realtime merge idempotent/version-aware. Không fallback content matching khi contract đã có identity.

### R11 — P2: pending send storage chưa có lifecycle đáng tin cậy

**Bằng chứng:** `features/messenger/model/messageSendAttempt.ts:13` parse có thể throw; prepare đọc record đó. `:49` remove thất bại chỉ warn. Pending attempt nằm sessionStorage trong khi draft có thể tồn tại lâu hơn tab.

**Ảnh hưởng:** corrupt record chặn gửi; xóa storage thất bại có thể tái dùng ID của tin đã gửi cho lần gửi mới cùng nội dung. Đóng tab sau server commit/mất response có thể mất attempt ID và gửi lại thành tin mới. Upload retry đổi asset cũng đổi fingerprint.

**Sửa:** phân biệt pending/confirmed attempt, xử lý storage errors và recovery UX rõ ràng. Test corrupted storage, remove failure, tab restart và attachment retry; không chỉ happy-path prepare/complete.

### R12 — P2: notification pagination/count/read-all bị cắt dữ liệu

**Bằng chứng:** `canonical/notification/NotificationService.java:35–47` fetch đúng (page+1)*pageSize rồi tính hasNext từ danh sách đã bị cắt; page đầu đủ limit vẫn báo không còn trang. `:50` unread và `:68` markAllRead giới hạn 200 records. findMonth tìm lại nhiều partition/records cho từng mutation.

**Ảnh hưởng:** không đọc được trang kế tiếp qua hasNext; unread count thấp hơn thật; “đọc tất cả” phát MARK_ALL_READ dù còn unread ngoài giới hạn. Nhiều query lặp khi bulk mutation.

**Sửa:** cursor month/id, fetch limit+1, unread counter có reconciliation và bulk operation có semantics đầy đủ/retention rõ ràng. Test >200 notifications, ranh giới tháng và notification cũ.

### R13 — P2: notification duyệt/từ chối join bị realtime parser bỏ qua

**Bằng chứng:** backend `NotificationService.java:207–225` tạo JOIN_REQUEST_APPROVED/DECLINED. Frontend `features/notifications/model/notification.store.ts:61–76` và union trong notifications.api không chứa hai type này.

**Ảnh hưởng:** sự kiện backend hợp lệ bị discard; người xin tham gia không thấy cập nhật/badge ngay. HTTP response được type assertion nên không cung cấp bảo đảm contract tương đương. Title/body backend còn viết trực tiếp bằng tiếng Việt.

**Sửa:** canonical enum/schema và mapping VI/EN đầy đủ; test exact backend event payload, không chỉ MESSAGE fixtures.

### R14 — P2: UI approval ẩn request APPROVING; async kết quả có thể lẫn phòng

**Bằng chứng:** `features/messenger/components/chat/InviteManager.tsx:171` chỉ giữ status PENDING. Refresh có identity guard nhưng các create/load-more/revoke/resolve callbacks sau await không có bảo vệ tương đương cho room identity.

**Ảnh hưởng:** request đang claim dở không có UI resume/takeover; chuyển phòng khi action chưa xong có thể đưa kết quả của phòng cũ vào panel mới.

**Sửa:** state APPROVING với owner/lease/decision và capability thật; identity guard/cancellation nhất quán ở mọi async mutation. Backend lease có rồi không đồng nghĩa UX khôi phục đã có.

### R15 — P2: audit event hợp lệ có thể làm admin lỗi render

**Bằng chứng:** `route-pages/AdminPage.tsx:101–163` mapping thiếu MEMBER_BAN, MEMBER_UNBAN, COMMUNITY_JOIN, COMMUNITY_JOIN_REQUEST và throw khi không có label; gọi ở audit render `:1027`. Backend phát các action đó trong ConversationBanService/CommunityService.

**Ảnh hưởng:** một event từ ban/community xuất hiện trong audit có thể làm khu vực admin không render, mặc dù action hoàn toàn canonical.

**Sửa:** enum + exhaustive label mapping song ngữ đối chiếu backend; test toàn bộ canonical audit actions. Không dùng compatibility fallback che thiếu contract.

### R16 — P2: appearance báo lưu thành công trước server và có thể mất thay đổi

**Bằng chứng:** `widgets/chat-window/components/RoomThemePanel.tsx:37–43` callbacks return void; handleSave `:190–213` gọi rồi success/onSaved. `features/settings/model/useRoomThemeState.ts` commit local trước HTTP, sync fire-and-forget. Theme/background có thể phát các PUT snapshots riêng.

**Ảnh hưởng:** modal đóng và UI báo đã lưu khi request chưa thành công. Responses/writes đảo thứ tự có thể mất một phần theme/background. Không có draft giữ lại để retry/rollback rõ ràng.

**Sửa:** một async save use case cho draft, await authoritative response, pending state, inline error, giữ draft nếu thất bại. Kiểm thử timeout, server error và hai save đảo thứ tự.

### R17 — P2: archive và entry membership vẫn có cửa sổ race

**Bằng chứng:** entry kiểm tra conversation trước membership claim; admin archive ghi is_deleted ở conversation primary (`canonical/admin/AdminConversationDirectoryRepository.java:55`). `ConversationMembershipService.java:70` kiểm tra ban; `CanonicalCqlStore.java:618–637` admission CAS chỉ bảo vệ counter/member, không dùng chung admission epoch với archive.

**Ảnh hưởng:** archive diễn ra giữa check và claim vẫn có thể có thành viên mới được thêm. Code hiện tại **đã có archive pre-check**, không còn lỗi “không kiểm tra archive” của review cũ.

**Sửa:** shared authoritative admission state/epoch hoặc protocol phối hợp archive và join; test concurrency cho direct invite, approval và manual community join.

### R18 — P2: read pointer và history ordering chưa monotonic theo full timeuuid

**Bằng chứng:** `canonical/message/MessageService.java:420–435` so Uuids.unixTimestamp (millisecond); repository read update không CAS. History sort cũng dùng timestamp/millisecond trong khi CQL cursor dùng full timeuuid.

**Ảnh hưởng:** hai ID khác nhau trong cùng millisecond có thể bị coi đã đọc; request cũ hoàn tất sau request mới có thể ghi lùi pointer. Equal-time ordering cần test vì có thể khác ordering của cursor.

**Sửa:** total order theo full timeuuid và monotonic conditional update. Test same-millisecond IDs, concurrent reads và multi-shard pagination.

### R19 — P2: send/attachment input chưa được bảo vệ bằng canonical invariants

**Bằng chứng:** message-send DTO chỉ có một phần constraints, nested attachments không đầy đủ @Valid. `MessageService.java:90–107` không có content cap tương đương edit; reply/source references được lưu mà không đủ kiểm chứng. `CassandraMessageRepository.java:249–264` lưu metadata asset/storage từ request mà không resolve asset ownership/readiness từ canonical media record.

**Ảnh hưởng:** client không cần dùng composer chuẩn để đưa metadata/reference không hợp lệ hoặc payload quá lớn vào hệ thống. Validation ở UI không thay thế backend.

**Sửa:** giới hạn content/list/metadata tại DTO và domain; backend derive attachment metadata từ assetId đã kiểm tra; xác minh reply/forward source scope/quyền; tách server-generated SYSTEM/POLL khỏi free-form client send nếu semantics yêu cầu.

**Media riêng:** Cloudinary validation dùng declared content type; cần content verification, quota/abuse controls và quyết định privacy của public delivery URLs. Không khẳng định đã có private asset contract hay tự thêm signed URL API trong review này.

### R20 — P2: poll creation có thể reset aggregate; unvote thiếu live publish

**Bằng chứng:** `canonical/poll/PollService.java:61` gửi message trước lưu poll (`:80`). `CassandraPollRepository.java:121–135` initialize counts/version/is_closed không conditional. Hai create cùng client ID có thể cùng đi qua existing check. removeVote (`PollService.java:115–120`) trả view mà không publish aggregate như vote.

**Ảnh hưởng:** POLL message được quan sát trước poll sẵn sàng; retry/create cạnh tranh có thể ghi lại aggregate đã có vote/close; người khác không cập nhật ngay khi unvote.

**Sửa:** creation claim + immutable payload + create-if-absent aggregate, publish only ready, reconcile message/poll; publish sau unvote. Test concurrent create và delayed retry sau khi đã vote/close.

### R21 — P2: pin/unpin không được cập nhật vào search projection

**Bằng chứng:** MessageService phát MESSAGE_PIN/MESSAGE_UNPIN nhưng `MessageSearchProjector.java:30` chỉ nhận SEND/EDIT/DELETE.

**Ảnh hưởng:** search filter pinned không phản ánh thao tác ghim/gỡ, dù panel pin có thể đúng.

**Sửa:** bổ sung canonical pin projection events và versioning cùng R09; test pin → search pinned → unpin → search.

### R22 — P2: layer tokens không nhất quán làm portal UI nằm dưới modal

**Bằng chứng:** `shared/ui/Dialog.tsx:22/40` z-index 130/131; DropdownMenu 50; Tooltip token 100; AppToaster container 90.

**Ảnh hưởng:** tooltip/dropdown portal trong dialog và error toast có thể bị overlay che hoặc nằm sau content. Các smoke hiện tại chưa chứng minh nested portal interaction/focus đúng.

**Sửa:** một layer scale cho shell/menu/dialog/child popover/tooltip/notification; kiểm tra portal container và focus. Form errors ưu tiên inline, tránh phụ thuộc toast sau modal.

### R23 — P2: foreground accent trong light theme có contrast thấp

**Bằng chứng runtime:** lấy computed CSS tokens trên production preview, chuyển OKLCH qua canvas RGB và tính relative luminance. Primary/background light ~3.34:1; warning/background ~1.53:1. Dark tương ứng ~7.13:1 và ~11.60:1; muted foreground đạt ~7.86 light/~9.47 dark. Đây là đo token cặp màu, không phải full accessibility certification.

**Ảnh hưởng:** các đoạn chữ nhỏ/link dùng text-primary trên nền light chưa đạt mục tiêu 4.5:1 cho normal text; warning icon/text còn yếu hơn. Không thể kết luận dark/light toàn app đúng chỉ vì brand hoặc một screenshot đúng.

**Sửa:** tách brand accent khỏi readable action/semantic foreground, kiểm tra trên từng surface. Giữ màu logo công nghệ; đừng đổi mọi thứ sang cam hoặc làm tối tất cả asset để chữa contrast.

### R24 — P2: browser fixtures đang không khớp canonical messageBucket

**Bằng chứng:** kết quả smoke delete/edit/interactions dùng bucket kiểu `2026-08-30T12:00:00Z`, trong khi controller yêu cầu `yyyy-MM-dd-HH:shard` bằng regex tương ứng.

**Ảnh hưởng:** test browser có thể pass request mà backend thật từ chối. Không phải bằng chứng production mapper đang gửi sai bucket; là khoảng trống trong contract verification.

**Sửa:** fixtures sinh từ canonical schemas/real response, test consumer contracts và ít nhất một live backend flow. Thêm negative tests cho invalid bucket/payload/event enum.

## Cấu trúc dữ liệu và consistency

### Điểm hợp lý

- Cassandra primary/projections phân biệt với Redis ephemeral, Kafka domain delivery và Elasticsearch search. Không dùng search làm primary write store.
- Messages có hourly/sharded buckets và bucket directory; một số directory/member lists đã có cursor thực, không còn chỉ mở thêm phần dữ liệu đã tải.
- Invite recipient/usage đã có conditional same-partition operation; expiry/maxUses được tính khi map availability. Approval có lease/takeover và projection repair. Không lặp lại các nhận định cũ rằng những phần này hoàn toàn chưa có.
- Poll aggregate có conditional updates ở vote/close; anonymous poll event dùng aggregate thay vì lộ actor votes.
- Schema và 17 migration files có sẵn. Không kết luận thiếu migrations.

### Chưa đủ

- Ghi Cassandra + projections + outbox không phải một transaction xuyên partition. “Có outbox” chưa làm domain write crash-safe; cần explicit durable operation/reconciliation cho R04–R08/R20.
- Event schema cần aggregate identity, full version và idempotency semantics nhất quán. At-least-once Kafka yêu cầu projector xử lý duplicate/out-of-order, không chỉ JSON parse được.
- Message history có thể scan tới 256 buckets, mỗi bucket đọc limit+1 tuần tự cho một trang nhỏ. Cần bounded traversal/k-way merge theo full ordering, đo bằng query count và p95 thực; chưa có benchmark để gán con số latency.
- Các sender/user partitions như client-message-id lookup, replies/mentions cần retention hoặc growth budget rõ ràng. Không tự thêm TTL làm mất idempotency trước khi xác định retry horizon.
- Notification bulk mutation có repeated lookup queries; cần giữ partition key trong cursor/view hoặc direct index thay vì tìm lại từng ID.
- Migrations mang tên mô tả, chưa thấy version ledger/order enforcement đủ để chứng minh upgrade reproducible. Cần chạy clean bootstrap, upgrade từ snapshot và projection rebuild; không chỉ đọc schema cuối cùng.
- Membership count, inbox summaries, search và admin directories cần reconciliation jobs/invariants có kiểm thử, không coi projection divergence là lỗi chỉ ở UI.

## Kiến trúc và thư mục

Backend hiện là **modular monolith**: controllers → services/policies → capability repositories; Cassandra implementation riêng, adapters cho realtime/search/media. Đây là hướng phù hợp với dự án; chưa cần microservices, full CQRS hay event sourcing chỉ để trông “chuẩn”.

Đã tiến bộ so với god service/repository cũ, nhưng vẫn có điểm cần làm:

- CanonicalCqlStore còn 1.097 dòng và 15 main-source files phụ thuộc. Tách tiếp theo capability/consistency boundary, không chia mỗi query thành một interface riêng.
- `canonical/service` còn gom nhiều capability trong khi message/invite/poll/user đã có package riêng. Di chuyển theo business boundary và cập nhật dependency tests sau khi sửa correctness.
- Service vừa orchestration, event construction và mapping/projection updates làm recovery khó theo dõi. Tách command lifecycle rõ ràng, giữ invariants ở domain/policy, không thêm wrapper vô nghĩa.
- AdminPage 1.163 dòng, useMessenger 808, ConversationService 708, MessageService 657: đây là dấu hiệu nhiều trách nhiệm, không phải tự thân lỗi chỉ vì dài. Chia theo use case/state ownership trước, tránh nhiều hook gọi vòng nhau.
- Frontend có app/routes, route-pages, features, widgets, shared khá dễ hiểu. Tuy nhiên `shared/hooks/useUserSearch.ts:1–5` import APIs/store từ features: lower layer phụ thuộc higher layer. Chuyển hook về capability phù hợp hoặc inject typed port.
- AppPageShell/PublicPageShell có re-export facades trùng đường dẫn. Chuẩn hóa import path sau khi inventory consumers; không xóa chỉ vì nhìn thấy file nhỏ.
- Một số dependency chưa thấy src imports: @reduxjs/toolkit, @tanstack/react-virtual, lodash.debounce, use-debounce, react-dropzone. Chỉ là **candidates**: kiểm tra scripts/config/dynamic imports toàn repo trước khi gỡ. react-virtuoso có sử dụng ở RoomMemberDirectory.
- Quy tắc dependency và canonical enums/contracts nên được enforce bằng lint/architecture tests; không chỉ ghi trong README.

## Design system / design style

Điểm đã có: shared BrandWord/BrandText và SVG, primitives dùng chung, semantic OKLCH tokens, public/editorial style khác product UI, ModalShell/Dialog có thể tái sử dụng. Poll modal hiện dùng semantic surface; không có cơ sở kết luận mọi modal chưa hỗ trợ theme chỉ từ ảnh cũ.

Điểm cần cải thiện:

1. R22/R23: sửa layer scale và foreground tokens trước khi làm motion mới.
2. index.css 2.119 dòng, nhiều component/page overrides; radius/elevation/spacing đang có cả tokens và ad-hoc values. Chốt ownership: tokens → primitives → capability composition, tránh specificity sửa chỗ này hỏng chỗ khác.
3. Theme toàn app và theme riêng phòng là hai scope khác nhau. Room background tối không tự động có nghĩa global dialog phải tối. Cần UX/spec rõ modal nào theo app, modal nào theo room; kiểm tra portal inheritance theo scope đó.
4. Appearance preview và actual bubble renderer cần dùng cùng rules/primitives để preset nhìn khác thật, không chỉ khác thumbnail. Custom mode cần kiểm chứng contrast và persisted draft, không tự nhận full coverage từ fixture save.
5. Toast nên dành cho kết quả bên ngoài form hoặc thông báo cần chú ý; validation/save error đặt inline. Không làm silent failures để giảm số toast.
6. Public UI đã đọc được ở captures được kiểm tra. Technology section vẫn là list/inspector, mobile logos nhỏ; câu “Bên phải…” sai khi inspector xuống dưới. Đây là P3 copy/composition, không phải lý do rewrite backend hoặc thêm library hàng loạt.
7. Các controls push/email/desktop/sound/quiet hours chưa có delivery runtime được hiển thị disabled/explanation: đó là trạng thái trung thực, **không đánh dấu capability đã hoàn tất**.
8. Cần kiểm tra dark/light trên semantic success/warning/error, hover/focus/disabled, nested dialogs và custom room palette. Reduced-motion cần xác nhận với người bật OS preference; public screenshots không đủ.

## Kiểm tra đã chạy trong đợt review này

| Lệnh / nhóm | Kết quả | Giới hạn |
| --- | --- | --- |
| Frontend `npm run validate` | PASS type-check và ESLint | Không chứng minh contract/runtime |
| Frontend `npm run build` | PASS production Next build, 17 pages | Không có live backend |
| Backend `mvnw.cmd test -q` với Java 20 | PASS: 198 tests, 42 suites, 0 failure/error/skipped | Không phải clean integration run với datastore thật |
| `node scripts/api-session-smoke.mjs` | PASS 19 checks | Controlled transport |
| `node scripts/auth-lifecycle-smoke.mjs` | PASS 7 checks | Không có Google OAuth thật |
| `node scripts/message-send-attempt-smoke.mjs` | PASS 12 checks | Thiếu các lifecycle cases R11 |
| `node scripts/locale-copy-smoke.mjs` | PASS 1.118 keys, missing [] | Không đánh giá toàn bộ độ tự nhiên của câu |
| `node scripts/error-copy-smoke.mjs` | PASS 6 guarded checks, violations [] | Không chứng minh mọi backend error đã localization |
| admin-route, poll-flow, notification-settings, invite-join, room-management, community-discovery, contacts-locale, profile-locale | PASS browser fixtures | Không kiểm chứng live DB/concurrency/delivery |
| message-draft, message-delete, message-edit, message-interactions, search-filter | PASS browser fixtures | R24: fixture bucket mismatch |
| `node scripts/public-theme-smoke.mjs` | PASS: 8 layouts (light/dark × 320/768/1024/1440), 2 OS theme changes, errors [] | Technology/public scope, không toàn bộ product UI |
| `node scripts/ui-quality-smoke.mjs` | EXIT 1: 40 layouts có status 200, không overflow/unnamed controls/unlabeled fields; 10 console + request failures | `/api/auth/providers` tại 8084 connection refused trên login/register; không kết luận full smoke pass |

Production preview chạy riêng ở 127.0.0.1:3100 cho các smoke. Poll-flow có 503 được fixture chủ động tạo để kiểm retry; không nhầm với unexpected server failure.

Captures mới trong `chatapp_frontend/artifacts/readiness/technology-{light,dark}-{320,768,1024,1440}.png`; đã xem dark 320 và light 1440. Các browser scripts có thể cập nhật review artifacts của chúng; không phải thay đổi implementation.

Không chạy trong đợt này: Google provider thật, full live backend/browser E2E, presence/network/room-create riêng, load test, multi-instance revoke, crash injection, migration upgrade/rebuild, screen-reader audit. Không đánh dấu những phần đó đã đạt.

## Thứ tự khắc phục và tiêu chí hoàn thành

### Đợt 1 — quyền và privacy

- R01/R02: broker SEND/SUBSCRIBE authorization + active-session revocation.
- R03/R09: redacted public tombstones và versioned search projections.
- Hoàn thành khi negative tests bằng client trực tiếp và live two-session test chứng minh không nhận/đọc nội dung sau revoke/delete.

### Đợt 2 — consistency và recovery

- R04–R08, R17, R20: command lifecycle, lease fencing, idempotent recovery, durable backlog traversal.
- Chốt schema/upgrade path trước khi sửa repository implementations.
- Hoàn thành khi crash ở từng checkpoint, takeover và duplicate/out-of-order retry không mất dữ liệu hoặc đổi quyết định nghiệp vụ.

### Đợt 3 — contract và user-visible correctness

- R10–R16, R18/R19/R21/R24: canonical HTTP reconciliation, notifications/cursors, approval recovery UI, audit enums, async appearance save, full UUID ordering và validated references.
- Hoàn thành khi fixtures đúng schemas, consumer tests và ít nhất một live E2E cho từng capability.

### Đợt 4 — tổ chức và design system

- Capability packages/dependency boundaries; chia orchestration/component theo state ownership; gỡ dependency chỉ khi chứng minh không dùng.
- R22/R23 và theme scope, interactive states, mobile navigation/dialog layers, copy tự nhiên VI/EN.
- Hoàn thành khi 320/768/1024/1440, app light/dark/custom room theme, keyboard/focus/escape/reduced-motion đều được kiểm chứng; capability chưa có runtime vẫn nêu rõ unavailable.

Không chọn một “design pattern mới nhất” thay cho correctness. Pattern nên giúp bảo vệ quyền, consistency boundary, recovery và khả năng hiểu code. Mọi checkbox hoàn thành phải có test/runtime evidence tương ứng.
