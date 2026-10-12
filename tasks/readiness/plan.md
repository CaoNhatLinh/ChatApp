# Nối — kế hoạch hoàn thiện sản phẩm

Ngày lập: 2026-09-12. Phạm vi: `chat-service` và `chatapp_frontend` trong ChatApp.
Không áp dụng cho Skipli. Đây là kế hoạch thực thi; các mục chưa có bằng chứng
nghiệm thu trong `todo.md` vẫn đang mở.

## Đích đến

Một người dùng có thể đăng nhập, kết bạn, tham gia đúng phòng, trò chuyện,
rời phòng và quản lý thông báo mà không mất dữ liệu, bị đăng xuất do lỗi mạng,
hoặc nhận phản hồi thành công khi thao tác chưa được lưu. Người quản trị có
thể điều hành toàn app với quyền, lý do, lịch sử và trạng thái xử lý rõ ràng.

Tài liệu gốc: `PRODUCT.md`, `chatapp_frontend/DESIGN.md`,
`docs/FEATURE_INVENTORY.md`, `docs/api/openapi.yaml`, `docs/api/asyncapi.yaml`.
Hai file `tasks/ui-art-direction-plan.md`, `tasks/ui-art-direction-todo.md`
không tồn tại tại thời điểm khảo sát. Các `tasks/plan.md`, `tasks/todo.md`
cũ đang bị xóa trong working tree; bộ này dùng thư mục riêng để giữ nguyên
những thay đổi đang có.

## Cách xử lý một vấn đề

1. Ghi tình huống người dùng, dữ liệu đầu vào và kết quả đúng.
2. Lần theo UI → API → quyền/policy → dữ liệu → event → UI cập nhật.
3. Xác minh lỗi bằng code và ca tái hiện; ghi mức tin cậy nếu chưa chạy được.
4. Viết kiểm thử hồi quy cho lỗi dữ liệu, quyền, concurrency hoặc mất phiên.
5. Sửa tại module chịu trách nhiệm; chỉ tách file khi làm rõ trách nhiệm.
6. Kiểm tra thành công, thất bại, thử lại, đổi phòng/tài khoản, tải lại trang.
7. Ghi file, lệnh kiểm tra, kết quả và phần chưa chứng minh vào `todo.md`.

Mỗi lát phải đi hết một luồng backend–frontend. Không đánh dấu xong cả
capability chỉ vì một test unit hoặc một modal đã chạy.

## Kiến trúc lựa chọn

- Giữ backend modular monolith. Các package nghiệp vụ chịu trách nhiệm rõ:
  auth, user, conversation, invite, message, poll, notification, moderation,
  admin. Controller nhận/kiểm tra request; service điều phối; policy quyết định
  quyền và điều kiện; repository sở hữu truy vấn Cassandra.
- Tách phần còn lại của `CanonicalCqlStore` theo quyền sở hữu dữ liệu:
  conversation/membership trước, community directory/join sau. Tránh một
  repository cho từng bảng và các wrapper chỉ chuyển tiếp lời gọi.
- Cassandra là dữ liệu gốc; Redis là trạng thái tạm; Kafka chuyển event;
  Elasticsearch là projection có thể xây lại. Không đổi cơ sở dữ liệu trong
  một đợt chỉnh UI. Các lệnh nhiều partition phải có cách phục hồi được kiểm thử.
- Invite/approval, refresh và gửi tin nhắn cần trạng thái chuyển tiếp rõ,
  idempotency, điều kiện cập nhật và cơ chế ngăn worker cũ ghi sau takeover.
  Có lease chưa chứng minh được tính đúng của toàn bộ thao tác.
- REST và STOMP cùng gọi policy/use case. UI đọc capability để trình bày;
  backend vẫn xác thực quyền tại lệnh ghi và khi đọc dữ liệu nhạy cảm.
- Frontend giữ `app` cho route, `route-pages` cho composition, `features`
  cho hành vi, `widgets` cho bố cục chat, `shared` cho primitive hạ tầng.
  Chuyển các tab admin ra `features/admin`; giữ trang admin làm composition.
- Phân biệt server state, draft và UI state. Draft không bị thay bằng phản hồi
  cũ. Server state chỉ cập nhật sau response/event hợp lệ, optimistic state
  phải có reconciliation và khả năng retry với cùng command ID.
- Không thêm thư viện hoặc nâng major chỉ vì mới. Đánh giá dependency theo
  nhu cầu, maintenance, license, bundle và migration guide chính thức tại lúc
  thực hiện. Stack hiện có đã có Radix, motion và virtualization.

## Thứ tự triển khai và nghiệm thu

### 0. Baseline và bộ điều khiển kiểm tra

Lập route/state matrix, lưu test baseline, xác định runtime/provider khả dụng.
Sửa scripts gốc đang trả exit 0 dù không build/dev app. Tạo mẫu xử lý trong
`forms-and-states.md`; dùng chung để đánh giá mọi form.

Nghiệm thu: lệnh gốc thực sự chạy frontend/backend đã khai báo; thiếu runtime
phải có kết quả rõ; kết quả fixture và live nằm ở hai cột khác nhau.

### 1. Phiên đăng nhập và danh tính

1A. Thu hẹp catch refresh: lỗi nghiệp vụ của request replay không được xóa
phiên; refresh timeout/503 không được coi là credential sai. Test request
403/409/429/500, lỗi mạng, nhiều 401 đồng thời và refresh bị từ chối thật.

1B. Hợp nhất single-flight refresh giữa khởi tạo auth và HTTP retry. Thêm
trạng thái khởi tạo tạm lỗi với Retry; ngăn response cũ khôi phục user sau logout
hoặc sau đổi tài khoản. Kiểm tra cookie, hint, logout đa tab và redirect `from`.

1C. Kiểm tra LOCAL/Google linking và đăng ký gián đoạn. Claim username/email
phải xác định được owner và khôi phục khi process chết; kiểm thử collision,
replay, user bị suspend, token sai project/expired/unverified và cấu hình tắt.

Nghiệm thu: hai tài khoản không chia sẻ draft/cache/session; retry không tạo
hai user; Google và LOCAL dùng cùng quyền và session lifecycle của Nối.

### 2. Thành viên, invite và moderation

2A. Viết test concurrency cho approval lease: manager A chậm, B takeover,
A tiếp tục. Completion, decision, membership và notification phải thống nhất;
không chỉ thêm điều kiện vào câu ghi trạng thái cuối.

2B. Kiểm tra reserve/release invite, repair manager queue, cursor nhiều
request cùng thời điểm, maxUses, expiry, revoke và room archive giữa thao tác.
Lưu ý `JoinRequestService.list` đang sort timeuuid qua độ chính xác millisecond;
cần kiểm chứng thứ tự toàn phần phù hợp cursor Cassandra.

2C. Ma trận ban/kick/leave/rejoin: ban chặn mọi đường vào; kick cho phép quay
lại chỉ khi policy cho phép; owner không tự rời khi chưa chuyển quyền; capacity
và ownership được bảo vệ khi hai lệnh chạy đồng thời. Thu hồi quyền realtime
và search sau ban/leave, không chỉ ẩn item trên UI.

Nghiệm thu: một request có một quyết định cuối hợp lệ; retry không ăn thêm
lượt; manager queue và người gửi thấy cùng trạng thái sau tải lại.

### 3. Tin nhắn và realtime

3A. Send/retry với cùng client message ID, payload khác phải conflict; giữ
draft khi mạng lỗi; server đã lưu nhưng response mất không được nhân đôi tin.

3B. Edit/delete/reply/reaction/pin/mention: quyền ở server; tombstone không
lộ nội dung; reply tới tin xóa có trạng thái rõ; event cũ không phục hồi dữ
liệu đã xóa. Kiểm tra cursor đổi bucket và load lịch sử đồng thời tin mới.

3C. Reconnect hai thiết bị: snapshot và event reconciliation, read/unread,
typing TTL, presence, revoked subscription. Quy định delivered/read đúng
contract; không suy ra đã đọc chỉ vì socket đang kết nối.

3D. Poll và attachment: double vote, close đồng thời vote, upload lỗi/cancel,
quota, quyền đọc media và cleanup upload chưa gửi. Call chỉ bật capability
đã có signalling/media/provider thực tế.

Nghiệm thu: hai browser thật và reload cho cùng lịch sử, reaction, read state;
ngắt mạng/worker có kịch bản phục hồi và bằng chứng persistence.

### 4. Cài đặt và admin

4A. Notification precedence: global → room default → personal override,
mentions, mute/DND, quiet hours qua ngày và timezone. Save draft không ghi đè
chỉnh sửa vừa nhập; phân biệt inbox với push/email provider.

4B. Appearance: global light/dark khác room customization; portal modal,
popover, tooltip, toast phải cùng context phù hợp. Preview dùng cùng renderer
với chat; Cancel hoàn nguyên; Save thất bại giữ draft; Reset có phạm vi rõ.

4C. Admin: audit từng use case overview/rooms/users/roles/reports/sanctions/
audit/session/device. Query có limit/cursor; 403 là thiếu quyền, 503 là dịch
vụ lỗi, không hiển thị thành danh sách trống. Lệnh nhạy cảm có lý do và kết quả
được lưu; double submit và stale data không âm thầm ghi đè.

4D. Tách `AdminPage.tsx` theo tab/use case và `CanonicalCqlStore` theo capability
trong các thay đổi behavior-preserving riêng. Architecture test chặn domain
service gọi Kafka/STOMP client trực tiếp và vòng import mới.

Nghiệm thu: room admin không vào global admin; mobile admin dùng shell riêng;
thao tác vẫn truy cập được khi bảng đổi sang list/detail ở màn hình nhỏ.

### 5. Giao diện và nội dung

- Đích accessibility: WCAG 2.2 AA. Kiểm tra contrast, focus không bị che,
  kích thước mục tiêu và keyboard theo tiêu chí phù hợp; test tự động chỉ
  là một phần của đánh giá, không phải chứng nhận đạt toàn bộ WCAG.
- Tinh chỉnh hệ Signal Relay bằng nhiệm vụ người dùng: public biểu cảm hơn,
  chat yên và dễ đọc, admin tối ưu quét/so sánh dữ liệu. Thay bố cục khi giúp
  nhiệm vụ; không làm mọi trang thành cùng một dãy card.
- Cùng semantic token cho canvas/surface/text/border/focus/disabled. Cam cho
  thương hiệu và hành động; success/warning/error có ý nghĩa riêng; màu logo
  công nghệ đúng nhận diện. Room palette không ép mọi theme thành cam.
- Modal dùng `Dialog`/`ModalShell`; chỉ một vùng cuộn chính. Mobile giữ một
  tác vụ chính; detail/back cho nội dung dài, hạn chế modal chồng modal.
- Loading phản ánh đúng layout. Empty/error/pending/forbidden khác nhau.
  Nút chỉ xuất hiện nếu có hành động thật; unavailable ghi rõ lý do.
- Copy VI/EN: ngắn, cụ thể. Ví dụ “Chưa lưu được. Thử lại” thay cho câu quảng
  cáo về độ tin cậy. Success routine nằm trong form; toast cho sự kiện cần
  chú ý ngoài khu vực đang thao tác, không lặp trên mỗi retry.
- Scroll/motion dùng để dẫn mắt tới thay đổi trạng thái. Keyboard, touch,
  reduced-motion vẫn thực hiện đầy đủ tác vụ. Header public giữ visible khi cuộn.
- Sửa tech showcase theo dependency thật (Cassandra, không PostgreSQL).
  Giữ BrandWord và Kamling/GitHub; kiểm tra logo trên cả hai nền.

Nghiệm thu: 320/768/1024/1440px × VI/EN × light/dark; bổ sung custom-room
theme cho chat/modal. Không overflow, text chìm, form mất focus, nút không tên.
Đối chiếu screenshot trước/sau cho login, chat, poll, invite, settings, admin,
landing. Chỉ có screenshot chưa chứng minh tương tác đã đúng.

### 6. Release gate

Clean install/build; schema từ rỗng và migration từ phiên bản đang dùng;
Cassandra/Redis/Kafka/Elasticsearch thật; hai user và một operator; đăng
nhập → kết bạn → vào phòng → gửi/reply/react → reconnect → moderation → audit.
Kiểm thử outbox retry, duplicate delivery, worker restart và projection repair.

Theo dõi latency/errors/retry depth bằng dữ liệu đo được. Lấy baseline p95 cho
send/history/search trước khi chọn tối ưu; tránh index, cache hoặc memo hóa
không có bằng chứng cần thiết. Release không đạt nếu còn lỗi quyền, mất dữ
liệu hoặc mutation không phục hồi được.

## Trạng thái môi trường khảo sát

Java 20 có trên host; Maven wrapper chạy được. Frontend type-check/lint chạy
được. Chưa có listener trên 3000/3001/8084/9042/6379/9092/9200 lúc khảo sát;
`docker` không có trên PATH. Firebase, Cloudinary, TURN và credential không
được coi là live-verified chỉ vì có file cấu hình. Kết quả hiện hành được ghi
ở `review.md`; không lấy số test cũ trong tài liệu làm số test của đợt này.

## Nguồn kỹ thuật đã đối chiếu

- [React — useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore):
  đăng ký browser state và cleanup subscription, dùng cho OS theme.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): tiêu chí accessibility cho vòng UI.
- [Cassandra — CQL data manipulation](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/dml.html):
  đối chiếu conditional writes và phạm vi batch khi thiết kế approval recovery.
  Trước khi triển khai CQL phải kiểm tra tương thích đúng Cassandra 4.1 của repo.
