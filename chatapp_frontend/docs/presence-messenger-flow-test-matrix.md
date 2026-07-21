# Flow Test Matrix: Presence + Messenger

Mục tiêu: khóa lại các luồng đã chạm và đảm bảo không còn orphan flow sau khi sửa status-sync.

## Endpoints (chuẩn cho luồng hiện tại)
- Client gửi cập nhật trạng thái: `"/app/online-status"`
- WebSocket subscribe trạng thái của người theo dõi: `"/user/queue/presence"`
- WebSocket nhận sync kết quả status-sync và lỗi: `"/user/queue/presence-sync"`
- WebSocket nhận batch presence (reconnect): `"/user/queue/presence-batch"`
- Luồng `/topic/presence` không phải destination hiện tại trong flow này.

## 1) `rate-limit + retry` (presence)
1. Đăng nhập 1 phiên bản frontend, gọi `setStatus` nhanh liên tiếp > 5 lần/30s.
2. Kỳ vọng nhận `RATE_LIMIT_ERROR` trên `presence-sync`.
3. Kỳ vọng UI rollback đúng request vừa lỗi (không rollback request mới hơn).
4. Kỳ vọng sau `retryAfterSeconds`, hệ thống thử gửi lại request đó một lần.
5. Kỳ vọng chỉ retry khi trạng thái vẫn chưa đổi do user.

## 2) `reconnect 2-3 lần liên tiếp`
1. Mở 2 tab, giữ 1 tab online.
2. Thực hiện disconnect/reconnect mạng liên tục 2–3 lần (hoặc tắt/mở WS bằng devtools).
3. Quan sát log: chỉ gọi subscribe `/user/queue/presence`, `/user/queue/presence-sync` 1 lần mỗi destination (không nhân đôi callback).
4. Quan sát sau mỗi reconnect: gửi heartbeat + resync + tracking partner vẫn hoạt động.
5. Kỳ vọng không có status rollback do response của request cũ bị đè (requestId mismatch).

## 3) Chuyển/switch conversation khi có message mới
1. Mở conversation A và B, A đang hoạt động.
2. Ở client khác gửi 1 tin mới vào B.
3. Kỳ vọng B được hoisted đúng quy tắc pin:
   - pin: luôn ở đầu
   - chưa pin: nằm ngay sau khối pinned
4. Kỳ vọng unread của B tăng thêm theo tin thực tế chưa đọc.
5. Mở B sau đó: unread reset về `0`, tin cuối đúng bản ghi mới nhất.

## 4) `pinned + new message` ordering
1. Tạo 1 pinned + 1 unpinned có thời gian hoạt động tương tự.
2. Gửi tin mới vào pinned và unpinned.
3. Kỳ vọng pinned luôn đứng đầu danh sách dù tin mới đến unpinned có `lastActivityAt` mới hơn.
4. Kỳ vọng tin mới nhất của each conversation hiển thị `lastMessage` cập nhật chính xác.

## 5) Trường hợp thông tin presence/device
1. Đảm bảo payload heartbeat gửi `deviceInfo`.
2. Truyền presence nhiều phiên/devices, kiểm tra `status-sync` có requestId/traceId.
3. Kỳ vọng requestId được dùng để ignore response stale (không rollback nhầm request trước).

## 6) Ghi chú triển khai đã sửa
- `PresenceStore` lưu `pendingStatusRequestId` + `pendingStatusDesired`.
- `setMyStatus`/`setMyStatusFromServer`/`rollbackMyStatus` theo `requestId`.
- `PresenceManager` idempotent khi subscribe trên reconnect.
- `/app/online-status` lỗi giờ có khả năng trả kèm `requestId/traceId` khi có thể.

## Kế hoạch kiểm tra CI (nếu có)
- Build + type-check FE sau khi đổi code.
- Smoke flow manual theo matrix theo từng môi trường (local, QA).