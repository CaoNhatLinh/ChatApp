# Nối — checklist thực thi

Ngày bắt đầu: 2026-09-12. `[x]` chỉ là phạm vi của đúng dòng đó.
`review.md` lưu bằng chứng; `forms-and-states.md` là chuẩn nghiệm thu UI/form.

## Baseline

- [x] Xác nhận phạm vi Nối backend + frontend; đọc product/design và inventory.
- [x] Khảo sát route, module, scripts và working tree đang thay đổi.
- [x] Lập kế hoạch, route/state matrix và mẫu xử lý lỗi.
- [x] Frontend baseline: `npm run validate` đạt.
- [x] Backend baseline sạch: Java 20 `mvnw.cmd clean test`; 187 tests, 0 failure/error/skipped.
- [x] Frontend production build đạt; browser public theme đạt 8 layout.
- [ ] Auth/deep-link smoke sạch: đang lỗi `/auth/providers` vì backend 8084 không chạy.
- [x] Root scripts dev/build/validate/session-test delegate frontend; backend chạy riêng.

## Lát 1 — session và public accuracy

- [x] AUTH-01: test tái hiện request replay 403/500 làm mất phiên; sửa phạm vi catch.
- [x] AUTH-02: interceptor refresh 503/network/429 giữ phiên để retry; 401/403 từ chối thật kết thúc phiên.
- [x] AUTH-03: test concurrent 401 qua interceptor dùng một refresh; tối đa một replay/request.
- [x] COPY-01: tech showcase dùng đúng tên và mark Cassandra.
- [x] THEME-02: browser regression OS light/dark thay đổi khi preference=system.
- [x] Targeted regression + validate (0 warning/error) + production build cho lát này.

## Lát 2 — session lifecycle đầy đủ

- [x] AUTH-04: khởi tạo lỗi tạm thời có Retry, không tự coi là logout; logout thắng response cũ (automated + browser fixture).
- [x] AUTH-05a: init và interceptor dùng chung một refresh trong cùng tab/generation; regression đạt.
- [ ] AUTH-05b: phối hợp refresh/logout đa tab và cookie rotation trên backend thật.
- [ ] AUTH-06: Google registration crash recovery/uniqueness/linking/account suspension.
  - [x] Giữ reservation sau khi bắt đầu ghi user mà chưa rõ kết quả; kiểm tra ACTIVE trước sửa settings.
  - [ ] Hoàn thiện concurrent registration, sửa projection và process-kill recovery trên Cassandra thật.
- [ ] Live LOCAL/Google session + cookie/CORS trên backend thật.

## Lát 3 — quyền vào phòng

- [ ] JOIN-01: lease có fencing; manager cũ không được hoàn tất/đổi membership sau takeover.
  - [x] Finish CAS kiểm tra owner/status; xung đột trả 409, không ghi projection sau CAS thất bại.
  - [ ] Fencing theo từng attempt/lease cho membership và các side effect (owner guard chưa đủ).
- [ ] JOIN-02: quyết định approve/decline không mâu thuẫn khi retry/takeover.
  - [x] Takeover giữ nguyên decision đã claim, có điều kiện CAS ở cả invite và community.
  - [ ] Kiểm thử concurrent side effects và terminal outcome trên datastore thật.
- [ ] JOIN-03: reserve/release use crash cases; queue repair; expiry/revoke/archive.
- [x] JOIN-04a: merge theo timestamp 100ns + Cassandra signed-byte tie-break; regression sang trang cùng millisecond.
- [ ] JOIN-04b: kiểm tra dữ liệu thật, va chạm toàn bộ requestedAt giữa nguồn và cursor đủ clustering key.
- [ ] ROOM-01: ban/kick/leave/owner transfer/capacity với lệnh đồng thời.
- [ ] ROOM-02: thu hồi HTTP/STOMP/search access sau ban/leave/role change.
- [ ] Live multi-user/process-restart proof.

## Lát 4 — chat

- [ ] MSG-01: send idempotency và retry sau mất response, draft/account isolation.
  - [x] Bản ghi mã + hash lần gửi theo tab/user/room; test logic giữ mã qua reload, đổi mã khi payload đổi.
  - [x] Browser regression build mới: retry qua reload giữ clientMessageId; không mất draft khi lỗi, clear khi thành công.
  - [ ] Pending-send bền vững khi đóng tab/file upload/realtime reconciliation.
- [ ] MSG-02: edit/delete/reply/forward/reaction/pin/mention authorization và event order.
- [ ] MSG-03: cursor qua bucket, unread/read reconciliation sau reconnect.
- [ ] POLL-01: vote/close concurrency, ẩn danh, multiple answers, validation.
- [ ] MEDIA-01: upload cancel/error, quyền đọc, quota/cleanup, provider unavailable.
- [ ] RT-01: presence/typing expiry, scope invalidation, reconnect hai thiết bị.
- [ ] CALL-01: permission/signalling/end/disconnect, TURN gating và browser media proof.

## Lát 5 — settings, admin và cấu trúc

- [ ] NOTIFY-01: precedence/quiet-hours/timezone; inbox khác channel delivery.
- [ ] FORM-01: notification/theme/profile draft/save/error/retry theo mẫu form.
- [ ] THEME-01: global theme/room theme/portal; preview = renderer thật; cancel/reset.
- [ ] ADMIN-01: ma trận app permissions cho từng API/control, audit reason và stale state.
- [ ] ADMIN-02: table/list loading/error/empty/cursor và mobile list/detail.
- [ ] ARCH-01: tách AdminPage theo use case, kiểm thử trước/sau.
- [ ] ARCH-02: tách conversation/membership khỏi CanonicalCqlStore và chuyển consumer.
- [ ] ARCH-03: tách community projection/join; xóa facade chỉ khi hết consumer.
- [ ] ARCH-04: rà dead code/dependencies/import cycles; mỗi mục xóa phải có bằng chứng.

## Lát 6 — UI/UX toàn app

- [ ] UI-01: hoàn thành mọi hàng trong route/state matrix.
- [ ] UI-02: light/dark/custom-room, focus/keyboard/reduced-motion và VI/EN.
- [ ] UI-03: public bố cục/copy/scroll interaction; brand Nối/Kamling đúng nền.
- [ ] UI-04: modal/drawer/menu/dropdown/toast dùng primitive, không mất context.
- [ ] UI-05: capture 320/768/1024/1440px, review contrast và tương tác thật.

## Release

- [ ] Cassandra/Redis/Kafka/Elasticsearch sẵn sàng; migration fresh/upgrade chạy thật.
- [ ] Live hai member + operator, reload/reconnect/restart và audit thống nhất.
- [ ] Đo baseline latency/query/render rồi tối ưu theo số liệu.
- [ ] Mọi P1 xử lý và kiểm chứng; provider chưa cấu hình có capability unavailable.
- [ ] Cập nhật inventory/traceability từ bằng chứng cuối; không đánh dấu toàn app hoàn tất khi còn gate mở.
