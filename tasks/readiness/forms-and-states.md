# Nối — mẫu xử lý và tiêu chí form

## Phiếu xử lý một vấn đề

```text
ID / mức ưu tiên:
Người dùng / tác vụ / route:
Điều kiện ban đầu, account và quyền:
Bước tái hiện:
Kết quả hiện tại:
Kết quả đúng theo product/policy:
Bằng chứng: file:line / test / request / screenshot:
Nguyên nhân; dữ liệu gốc và projection liên quan:
Cách sửa; module chịu trách nhiệm:
Concurrency / retry / idempotency / stale-response:
Form và copy VI/EN khi pending/success/error:
Contract/schema thay đổi; migration nếu có:
Test trước sửa → sau sửa; lệnh và kết quả:
Live verification / phần chưa kiểm chứng:
File đã đổi; cách rollback code/data nếu cần:
Trạng thái: cần kiểm tra | đã tái hiện | đang sửa | đạt automated | đạt live:
```

## Quy tắc form dùng toàn app

| Trạng thái | Hành vi cần có |
|---|---|
| Loading | Giữ cấu trúc; không dựng form rỗng rồi cho Save đè dữ liệu server |
| Pristine | Giá trị server đã tải; Save disabled nếu không có thay đổi |
| Editing | Draft riêng; label/help/limit rõ; lỗi gắn đúng field |
| Submitting | Một lệnh; nút có loading; ngăn double submit; giữ draft |
| Saved | Dùng response canonical; feedback tại form; không thêm toast thường lệ |
| Validation error | Giữ dữ liệu; focus field đầu sai; hướng dẫn sửa VI/EN |
| Forbidden | Nêu quyền đã thay đổi; không tự logout người vẫn có session hợp lệ |
| Conflict | Hiện bản ghi đã thay đổi; tải bản mới có chủ đích, không silent retry ghi đè |
| Unavailable/offline | Giữ draft; Retry rõ; trạng thái không bị đổi thành “chưa có dữ liệu” |
| Closing | Escape/close/focus return; cảnh báo mất draft khi có thay đổi đáng kể |

Nếu cho phép tiếp tục edit trong khi request đang chạy, response chỉ đánh dấu
snapshot đã submit là saved. Dữ liệu người dùng nhập thêm sau submit vẫn dirty.
Nếu form khóa trong lúc submit, phải khóa nhất quán tất cả field liên quan.
Hủy UI request không chứng minh mutation đã bị hủy ở server; sau reconnect phải
đọc lại kết quả canonical trước khi cho gửi lại mutation không idempotent.

## Form ưu tiên

| Form | Nội dung chính | Phần nâng cao | Kết quả/ngoại lệ thực tế |
|---|---|---|---|
| Login / Google | Credential hoặc Google; vị trí quay lại | Link tài khoản ở settings sau reauthentication | Sai credential, provider tắt, network, account suspended khác nhau |
| Tạo phòng | Tên, loại phòng, visibility | Join policy, capacity khi contract cho phép | Tạo xong mở phòng thật; giữ form khi thất bại |
| Tạo lời mời | Phòng, join policy | Tên link, thời hạn, số lượt | Preview/link canonical; expired/revoked/banned/full rõ |
| Duyệt tham gia | Người xin, phòng, trạng thái | Reason, quyết định | Pending/processing/final; không gửi thông báo thành công trước kết quả nhất quán |
| Composer | Nội dung, gửi, reply/edit context | Attachment, poll, mention qua menu | Pending/failed/retry cùng command ID; không mất draft |
| Poll | Câu hỏi, lựa chọn | Multiple/anonymous/deadline | Validate min/max, deadline tương lai; nút vote/close có pending riêng |
| Appearance | Preview, palette, bubble style | Custom image/overlay | Preview phản ánh dữ liệu đang edit; Save/Cancel/Reset rõ phạm vi |
| Notifications | Inbox level, room overrides | Quiet hours/timezone/channels | Channel chưa có provider disabled + lý do; Save chỉ ghi field contract |
| Admin sanction | Đối tượng, hành động, lý do | Scope, thời hạn | Confirmation nói rõ tác động; server kiểm quyền và bảo vệ owner |

## Route/state matrix

Mọi hàng cần VI/EN, keyboard và light/dark. Product cần auth/capability thật;
HTTP fixture chỉ là contract proof. Mobile: 320/768px; desktop: 1024/1440px.

| Route/surface | Người dùng cần làm được | State đặc thù bắt buộc |
|---|---|---|
| `/` | Hiểu app, xem công nghệ, mở app/đăng nhập | Theme, scroll header, technology keyboard/touch, reduced-motion |
| `/about` | Hiểu tác giả/sản phẩm và chuyển sang trải nghiệm | Link thật, responsive composition, copy không claim capability chưa có |
| `/help` | Tìm cách thực hiện tác vụ | Disclosure keyboard, hướng dẫn đúng menu/capability |
| `/privacy`, `/terms` | Đọc chính sách áp dụng thực tế | Prose contrast, anchor/focus, nội dung phù hợp lưu trữ/provider thật |
| `/login`, `/register` | Đăng nhập/đăng ký và quay lại tác vụ | Credential error, offline, Google unavailable/setup/link required |
| `/join/[token]` | Xem lời mời và xin/tham gia | Guest, pending, processing, member, banned, full, expired, revoked, failed |
| `/app` sidebar | Tìm/mở phòng và lịch sử | Loading, empty, error, cursor, unread, room đổi trong lúc fetch |
| Conversation | Đọc/gửi/reply/edit và tương tác | Own/other/deleted/pending/failed; permission lost; reconnect |
| Room details/manager | Thành viên, policy, mời và quản trị phòng | Owner/member/manager; ban/kick; cursor; conflict |
| Search dialog | Tìm tin trong phòng đang có quyền | Empty query/results, error, indexing lag, filters, pagination |
| `/friends` | Tìm người, request/cancel/accept/block, mở DM | Incoming/outgoing/blocked, concurrency, empty/error |
| `/communities` | Tìm cộng đồng và tham gia đúng policy | Public results, pending join, banned/full/archive, cursor/filter |
| `/profile` | Xem/sửa thông tin đúng người | Own/other, upload unavailable, validation, save failed |
| `/settings` + modal | Sửa profile/theme/language/notification/account | Draft/save/reset; channel unavailable; reports/connected identities |
| `/admin` | Rooms/users/roles/reports/sanctions/audit | Unauthenticated/403/503; từng permission; paging; mutation/error/retry |
| Call overlay | Nhận/từ chối/kết thúc cuộc gọi | Permission denied, device unavailable, disconnected, media provider |
| Notification popover | Đọc/đánh dấu/mở đích | Unread, removed target, cursor, realtime duplicate, offline |
| `/403`, 404, error/loading | Hiểu sự cố và có đường quay lại | Accessible title, Retry đúng cấp, không redirect loop |

## Nguyên tắc visual và tương tác

Public được thay composition/section khi cải thiện trải nghiệm; đánh giá bằng
khả năng hiểu và thao tác. Trong app, ưu tiên đọc, tìm, gửi, phục hồi. Một trang
không cần nhiều lớp chỉ vì ở mobile: list → detail → một tác vụ tập trung là đủ
cho hầu hết luồng; menu chứa hành động thứ cấp.

Modal chỉ có một header/footer và vùng cuộn hợp lý; tránh border của footer
trùng với border section. Primitive sở hữu focus/portal/Escape; feature sở hữu
draft và mutation. Màu brand không thay thế semantic state. Toast không che
composer, không phát lại theo mọi render/reconnect.

Screenshot cần gắn route, kích thước, locale, global theme, room theme, state,
nguồn dữ liệu (live/fixture) và action đã kiểm chứng. Không dùng dữ liệu mẫu
trong production để lấp empty state.
