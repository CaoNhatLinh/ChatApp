# Prompt triển khai UI Nối — Signal Relay

Bạn đang làm việc trên một ứng dụng chat realtime tên **Nối**. Đây là project cá
nhân dùng để rèn kỹ năng xây sản phẩm frontend/backend thật, không phải một
landing page SaaS mẫu. Hãy redesign và hoàn thiện **toàn bộ UI app**, không chỉ
trang chủ.

## Nguyên tắc bắt buộc

- Đọc `PRODUCT.md`, `chatapp_frontend/DESIGN.md`, `tasks/ui-art-direction-plan.md`
  và `tasks/ui-art-direction-todo.md` trước khi sửa code.
- Ảnh tham khảo chỉ dùng để hiểu cảm giác và bố cục; không sao chép text,
  placeholder hay dữ liệu giả trong ảnh.
- Không xử lý data/code legacy, dead code, fallback rác hoặc compatibility cũ.
  Chỉ dùng contract canonical đang có trong repo.
- Không tạo UI giả vờ đã có tính năng backend. Nếu một capability chưa có
  contract/runtime thật, giữ trạng thái rõ ràng là chưa khả dụng.

## Hướng nghệ thuật: Signal Relay

Ba từ: **ấm, chính xác, có nhịp**. Nối là những tín hiệu nhỏ truyền qua không
gian rồi hội tụ khi người dùng hành động.

- Public pages: art-directed, typography mạnh, một hình ảnh chủ đạo, nền/canvas
  tín hiệu có chủ đích, copy ngắn và tự nhiên.
- Product UI: nền ink xanh và surface phân lớp, yên tĩnh như Linear/Discord ở
  mức tin cậy nhưng có dấu ấn riêng ở selection, live state, loading và empty
  state.
- Accent cam chỉ dành cho action, active, live và brand; không tô mọi thứ.
- Không gradient text, không card lồng card, không viền dày, không bo tròn quá
  mức, không pattern grid, không icon rải đều, không motion trang trí vô nghĩa,
  không hàng loạt eyebrow viết hoa.
- Từ “Nối” phải dùng component brand riêng có thể tái sử dụng. Wordmark/mark,
  signal ornament và empty-state art dùng chung, không vẽ lại từng page.

## Phạm vi cần kiểm tra và làm

1. Token màu OKLCH, typography, spacing, radius, elevation, semantic states.
2. Brand primitives, signal assets/SVG và reduced-motion.
3. Button, Input, Select, Textarea, Card, SurfacePanel, Dialog, Badge, Tooltip,
   Skeleton, Toast.
4. App shell: desktop rail, global header, notification, sidebar room list,
   profile footer, mobile bottom navigation.
5. Chat: room list, conversation header, messages, composer, reaction/reply,
   mention, poll, attachment, invite, presence, unread, member/profile/room
   panels và search message.
6. Settings/admin: theme preview + draft/save, roles, policy, moderation,
   tables, confirmation, loading/error/empty states.
7. Public/auth: home, about, help, privacy, terms, login, register, not-found,
   forbidden và loading.
8. Bilingual Vietnamese/English cho tất cả label, modal, toast, error và empty
   state; câu ngắn, đúng ngữ pháp, dễ hiểu.

## Quy tắc thực thi

- Lập route/state matrix trước khi chỉnh layout.
- Làm theo lát nhỏ: token → primitive → app shell → chat → settings/admin →
  public/auth → hardening.
- Sau mỗi lát chạy type-check, lint, build hoặc browser smoke tương ứng.
- Kiểm tra 320/768/1024/1440px, light/dark và custom room theme.
- Advanced actions phải nằm trong menu/panel/modal khi cần; không hiện toàn bộ
  tính năng trên màn hình chính.
- Mỗi button có default, hover, focus, active, disabled, loading. Mỗi modal có
  close, escape, focus và destructive confirmation nếu cần.
- Không dùng chữ hoặc số giả để lấp chỗ trống. Empty state phải hướng dẫn hành
  động kế tiếp bằng dữ liệu/capability thật.

## Kết quả cần trả về

- Code production-ready trong repo, không chỉ mockup.
- Danh sách file đã thay đổi và lý do.
- Screenshot desktop/mobile cho các trạng thái quan trọng.
- Các lệnh kiểm tra đã chạy và kết quả.
- Những capability còn blocked phải ghi rõ, không đánh dấu hoàn tất giả.
