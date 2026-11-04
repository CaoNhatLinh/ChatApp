# Nối — mở rộng chat, media và vận hành

Ngày: 2026-10-12. Trạng thái: người dùng đã duyệt kế hoạch và các thay đổi schema cần thiết (“oke duyệt”). Đang triển khai theo từng lát; xem checklist và báo cáo kiểm tra để biết phần đã hoàn tất.

## Mục tiêu và lựa chọn đã xác nhận

- Người dùng chỉ chọn bộ và chọn/gửi/xem sticker trong chat. Tạo bộ, tải hình, thêm/sửa/sắp xếp/gỡ sticker và bộ sticker chỉ thuộc admin quản trị toàn ứng dụng (`SYSTEM_OPERATE`), không thuộc quản trị phòng hay người dùng thường.
- GIF dùng GIPHY trực tiếp từ trình duyệt. Người dùng đã đồng ý web API key hiển thị trên client; không dùng proxy backend trái điều kiện provider.
- Thread trả lời và nguồn chuyển tiếp có phân quyền, phân trang thật, xử lý tin gốc bị xóa hoặc mất quyền.
- Lịch sử cuộc gọi, người tham gia, gọi nhỡ; không coi signaling là bằng chứng media đã kết nối.
- Thumbnail ảnh thực và vòng đời asset; không xóa file vẫn được sử dụng ở tin nhắn hoặc catalog.
- Cài đặt toàn cục có kiểu dữ liệu, audit và kiểm tra revision.
- Lịch sử email và xử lý lỗi an toàn. **Push để sau**, theo lựa chọn mới nhất của người dùng.
- Kiểm duyệt nội dung 18+ và lừa đảo: **gắn cờ để admin duyệt, không tự khóa tài khoản**. Dịch vụ/model phát hiện, định nghĩa chi tiết và quyền chuyển nội dung sang dịch vụ ngoài chưa được chọn. Không giả lập detector bằng vài từ khóa.

## Baseline từ code

Backend: Spring Boot 3.5.3, Java 20, Cassandra canonical. Frontend: Next.js App Router, React, TypeScript và các primitive sẵn có. Không chuyển sang database khác hoặc tạo API compatibility.

- Tại thời điểm khảo sát có ba bảng sticker chưa có consumer quản lý hoặc access path liệt kê bộ. Khi triển khai S2, chúng được thay bằng aggregate cùng partition và identity/directory index để CAS trạng thái/thứ tự/nhật ký nguyên tử; xem `docs/adr/0014-atomic-sticker-catalog-commands.md`. Không duy trì hai nguồn authority.
- `MessageSendRequest`/message đã có trường sticker/reply/forward, nhưng `MessageRepository` chưa có truy vấn thread/source-forward. `sendMessage` hiện sao chép metadata reply/forward: cần xác minh nguồn ở server, không tin sender/source do client khai.
- `CallController` hiện authorize và phát signaling, không ghi lịch sử/claim cuộc gọi.
- Upload Cloudinary có URL thumbnail 320px; chưa ghi `media_thumbnails_by_asset`, chưa có quy trình reference/cleanup bền vững. Cloudinary phải được cấu hình thật để kiểm tra provider.
- `system_settings_by_key` hiện thiếu revision; không dùng timestamp làm phiên bản chống ghi đè.
- Resend có worker/ledger/webhook. Local `.env` đã bật test cho một email allowlisted; webhook công khai/signing secret và datastore thực chưa được kiểm chứng. Không đưa địa chỉ/key cá nhân vào tài liệu theo dõi.

## Route/state matrix

| Surface | Trạng thái phải có | Hành động |
| --- | --- | --- |
| `/admin`, sticker catalog | forbidden, loading, empty, ready, stale revision, invalid asset, save error | tạo/sửa bộ, thêm/sắp xếp/ngừng sticker, xác nhận ngừng bộ |
| `/app`, sticker picker | loading, empty catalog, ready, inactive sticker, send pending/error | chọn bộ, trang tiếp, preview, gửi qua idempotency chuẩn |
| `/app`, GIF tab riêng | unconfigured, loading, ready, search empty, rate-limited, provider unavailable | tìm kiếm/phân trang, preview, gửi; attribution GIPHY |
| `/app`, thread panel | loading, parent unavailable/deleted, ready, forbidden, refresh/page error | mở thread, gửi reply, phân trang, đóng/quay lại |
| `/app`, forwarded message | source accessible, unavailable/deleted, forbidden | xem nguồn chỉ khi có quyền; không lộ tên/nội dung phòng nguồn trái phép |
| `/app`, call history/detail | loading, empty, ringing, joined, ended, declined, cancelled, missed, failed | phân trang lịch sử, xem participants, gọi lại khi capability cho phép |
| Media preview/upload | upload pending/error, processing, ready, unavailable/deleted | hủy upload, preview derivative, retry có kiểm soát |
| `/admin`, global settings | forbidden, loading, draft, saved, revision conflict, validation error | sửa allowlist key có kiểu, save/reload, xem audit; không hiện secret |
| `/settings`, email history | disabled/unconfigured, loading, empty, queued, sent, delivered, failed, review required | phân trang lịch sử của mình, xem lỗi đã làm sạch; không lộ địa chỉ khác |
| `/admin`, email review | forbidden, loading, empty, pending, claimed, resolved, conflict | kiểm tra uncertain delivery; không resend mù sau cửa sổ idempotency |
| `/admin`, moderation review | detector unavailable, loading, empty, flagged, reviewing, resolved, conflict | admin duyệt/cập nhật quyết định có reason/audit; không khóa tự động |

UI giữ design system Signal Relay; advanced actions trong panel/menu/dialog, VI/EN, keyboard, light/dark/custom-room và reduced motion. Hai file `tasks/ui-art-direction-{plan,todo}.md` được nhắc trước đây không hiện có trong workspace; dùng `PRODUCT.md`, `chatapp_frontend/DESIGN.md` và matrix này, không dựng nội dung tham chiếu giả.

## Contract và quy tắc dữ liệu

1. Sticker gửi bằng ID; backend kiểm tra bộ/sticker active và asset tồn tại, hợp lệ. Ngừng catalog chỉ chặn gửi mới, không phá lịch sử. Catalog có thứ tự/cursor đầy đủ và revision cho sửa đồng thời.
2. GIF lưu định danh `provider + providerGifId`, không nhận URL tùy ý rồi tải từ server. Frontend lấy rendition từ GIPHY theo điều kiện provider; không lưu cache/copy URL media khi chưa được cho phép. ID không còn tồn tại phải có trạng thái unavailable. Không trộn GIF provider vào grid sticker nội bộ.
3. Reply mang khóa nguồn đủ conversation/bucket/id. Server xác minh nguồn cùng room, tìm sender thật, không tin `replyToSenderId`. Projection chỉ để truy vấn; hydration đọc message authority. Retry repair index, không tạo message khác. Cursor gồm tất cả clustering keys.
4. Forward kiểm tra quyền nguồn và đích; server tạo snapshot hợp lệ, không cho client mạo nhận nguồn. Metadata/source-link chỉ trả khi actor hiện tại có quyền; tin gốc bị xóa phải có tombstone/unavailable. Không tiết lộ danh sách phòng đích của các forward cho người không có quyền ở phòng đó.
5. Call có authority lookup/claim, phiên bản/fencing, timeout và participant-state transitions. Missed chỉ cho bên nhận khi chưa chấp nhận trước timeout; không đánh đồng cancel/decline/failed. Lịch sử sau reconnect dựa trên server state. Không lưu SDP/ICE hay nội dung audio/video vào lịch sử/audit.
6. Thumbnail có kích thước/variant thực, trạng thái processing/ready/failed; kiểm tra MIME/bytes, giới hạn kích thước decode. Asset đang được tham chiếu không bị cleanup. Ghi ý định xóa bền vững trước IO; retry provider delete và ledger update phải hội tụ. Không tự xóa data/volume cũ.
7. Global settings chỉ một allowlist key có kiểu/bounds và consumer thực; không arbitrary JSON config editor, secret hoặc quyền. CAS theo revision, audit before/after/reason gắn với mutation và recovery; 409 không được ghi projection/audit thành công giả.
8. Email history dùng index phân trang theo user/month, hydration ledger; trạng thái API accepted khác delivered. User chỉ xem của mình; admin review cần permission riêng. Uncertain/expired idempotency không có nút resend vô điều kiện. Retry ghi lại reason/actor/revision.
9. Detector moderation mặc định chưa khả dụng đến khi chọn và cấu hình provider/rule thật. Kết quả có policy/detector version, evidence vừa đủ, review index và human decision. Không invent score, không tự khóa, không xuất nội dung chat sang dịch vụ ngoài khi chưa được đồng ý.

Schema hiện tại cần thêm access path có chủ đích: directory sticker, call lookup/claims/expiry và history nếu cần; reference/deletion jobs cho asset; revision global settings; email review/history; moderation queue. Cột/PK cuối cùng phải được chốt cùng các consumer trong từng lát. **Các bổ sung cần thiết đã được duyệt; chỉ thêm cùng contract, consumer và test tương ứng.** Không dùng `ALLOW FILTERING`, full-table scan, hoặc `.all()` không giới hạn để né thiếu index.

## Cấu trúc và code style

Backend capability: `canonical/sticker`, `canonical/message`, `canonical/call`, `canonical/media`, `canonical/settings`, `canonical/email`, `canonical/moderation`. Controller → service/policy → repository; Cassandra implementation nằm cùng capability. Không thêm nghiệp vụ mới vào god repository `CanonicalCqlStore`.

Frontend đặt feature API/types/components/hooks trong `src/features/{messenger,calls,settings,...}` theo convention đang có, route chỉ compose. Tránh tên generic `helpers`, `manager`, `common` cho nghiệp vụ mới.

Ví dụ dự kiến: `StickerPackService.update(actorId, packId, expectedRevision, request)`; repository trả kết quả CAS, service kiểm tra quyền/validate và trả conflict theo error contract hiện có. Không triển khai framework generic repository/event bus mới chỉ cho vài capability.

## Commands và nghiệm thu

```powershell
# repo root
npm run validate
npm run build
./scripts/test-local-schema.ps1
git diff --check

# chat-service, Java 20
./mvnw.cmd -q test

# chatapp_frontend
npm run test:i18n:copy
```

JUnit/Mockito tests bên cạnh các capability; contract/controller và policy tests trước khi tích hợp. Browser Playwright dùng fixture để kiểm tra UI/HTTP contract và capture 320/768/1024/1440 sáng/tối; riêng datastore/IO/realtime phải có integration evidence thật. Fixture không chứng minh runtime provider.

Nghiệm thu từng lát: chức năng chính + authorization + empty/loading/error/disabled/retry + regression tests + OpenAPI/AsyncAPI/traceability + bằng chứng. Không đánh dấu toàn bộ roadmap xong bằng test unit. Docker/Cassandra hiện chưa có bằng chứng chạy trên host này.

## Boundaries

- Always: giữ thay đổi hiện có; một canonical contract; chỉ dùng asset/data thật; kiểm tra quyền và bounded queries; nghiệm thu từng lát.
- Ask first: schema/access-path bổ sung, dependency/provider/billing mới, chuyển private content sang detector ngoài, public tunnel, xóa dữ liệu hoặc volume.
- Never: commit secret, dùng GIPHY backend proxy trái điều kiện, giả lập detector/delivery/media-connected, tự sanction từ kết quả tự động, xóa catalog phá lịch sử.

## Còn cần xác nhận

- Duyệt `tasks/plan.md`, bao gồm các additions schema cần thiết trước khi triển khai.
- GIPHY web key do người dùng tạo/cấu hình tại máy; production key/quota do provider cấp.
- Chọn dịch vụ/model hoặc quy tắc thực để phát hiện 18+/lừa đảo; thống nhất phạm vi text/image/link và quyền xử lý nội dung ngoài hệ thống. Chỉ review-only đã được xác nhận, chưa có detector.
- Ngrok/public webhook/signing secret, Cloudinary và live database là runtime gates riêng; không coi việc lên kế hoạch là đã cấu hình chúng.

## Nguồn chính thức

[GIPHY API/attribution và prohibited proxy/cache practices](https://developers.giphy.com/docs/api/). Web key là credential cho tích hợp phía client, không dùng lại credential backend. [Tenor đã sunset API ngày 30-06-2026](https://support.google.com/tenor/answer/10455265?hl=en), nên không chọn cho tích hợp mới. [Firebase FCM web setup](https://firebase.google.com/docs/cloud-messaging/web/get-started) là tham khảo cho đợt sau, push hiện ngoài phạm vi triển khai.
