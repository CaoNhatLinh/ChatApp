# Nối — khảo sát và bằng chứng 2026-09-12

Đây là khảo sát mở đầu để lập kế hoạch, chưa phải kết luận đã review toàn bộ
code hay đã sẵn sàng production. Working tree có nhiều thay đổi và file chưa
tracked từ trước; không reset/restore chúng.

## Phát hiện có căn cứ

| ID | Mức | Bằng chứng | Tác động / hướng xử lý |
|---|---|---|---|
| AUTH-01 | P1 | `chatapp_frontend/src/shared/api/apiClient.ts`, catch bao cả `await this.instance(config)` sau refresh | Lỗi request nghiệp vụ bị hiểu là refresh thất bại và xóa phiên; thu hẹp catch, test replay failures |
| AUTH-02 | P1 | Cùng interceptor: mọi refresh rejection đều clear token/hint | Network/503 làm mất phiên local; chỉ credential rejection mới kết thúc phiên |
| AUTH-04 | P1 | `features/auth/model/auth.store.ts`, mọi init error đều clear token/hint; init promise không có session generation | Cần xác minh offline retry và logout thắng response cũ; xử lý trong lát session lifecycle |
| JOIN-01 | P1 | `canonical/invite/CassandraInviteRepository.java`: takeover có CAS nhưng `finishResolution` là UPDATE không điều kiện | Worker cũ có thể ghi sau takeover; phải fence cả workflow và giữ decision nhất quán, không chỉ CAS cuối |
| JOIN-04 | P2 cần tái hiện | `JoinRequestService.list` sort bằng `Uuids.unixTimestamp`, cursor là UUID | Cần test hai nguồn có timeuuid cùng millisecond trước khi kết luận pagination đúng |
| COPY-01 | P2 | `TechnologyRelay.tsx` hiển thị Spring Boot + PostgreSQL; backend pom/schema/architecture dùng Cassandra | Sửa tên/logo công nghệ theo runtime thật |
| TOOL-01 | P2 | Root `package.json`: dev/build chỉ echo, exit 0 | Có thể báo build thành công dù chưa build app; nối lệnh thật |
| THEME-02 | P2 | `ThemeProvider.tsx`: OS change gán lại cùng preference `system` | Browser đã tái hiện không đổi sang dark; dùng subscription browser state để render lại |
| ARCH-01 | P2 | AdminPage khoảng 1.100 dòng không rỗng; CanonicalCqlStore khoảng 1.027 | Hotspot cần tách theo trách nhiệm; số dòng là tín hiệu khảo sát, không đủ để kết luận toàn file sai |
| DOC-01 | P2 | Checklist art direction không có; docs có số test 158/165 và mô tả lease cũ | Lập checklist mới, dùng kết quả hiện hành; đồng bộ docs sau từng lát |

Các lỗi invite được nêu trong lịch sử hội thoại không được coi là vẫn còn
nguyên: code hiện đã chặn archive, có reservation batch, repair queue và lease.
Phải kiểm tra implementation hiện tại, đặc biệt fencing, compensation và
process interruption trên Cassandra thật.

## Baseline

- Frontend `npm run validate`: PASS (type-check + ESLint), trước chỉnh sửa đợt này.
- Backend Java 20 `mvnw.cmd test -q`: exit 0; reports có 187 tests / 40 suites,
  0 failures/errors/skipped. Chạy lại `clean test` để loại bỏ class/report cũ
  sau các file test đã bị xóa; chỉ lần clean được dùng làm release baseline.
- Chưa có frontend/backend/data-service listener ở các port mặc định đã khảo sát.
- Docker không có trên PATH. Live persistence/realtime và provider E2E vẫn mở.

## Phân loại bằng chứng

- Static: chỉ ra đường code/cấu trúc; có thể xác định lỗi nhưng không chứng minh vận hành.
- Automated: thực thi logic production với dependency test; không thay live integration.
- Browser fixture: chứng minh render/interaction và HTTP contract ở browser production build.
- Live: backend + datastore/provider thật, reload/reconnect và trạng thái persisted.

## Kết quả triển khai

### Lát đầu đã sửa và kiểm tra

- `apiClient.ts`: tách replay khỏi catch refresh; refresh network/429/503 giữ
  token/hint; chỉ refresh 401/403 mới kết thúc phiên. Replay 401 vẫn kết thúc
  phiên, không refresh vô hạn. API error của thao tác được giữ để form xử lý.
- `scripts/api-session-smoke.mjs`: thực thi interceptor production và Axios
  với transport test. Trước sửa: replay 403 xóa renewed token (FAIL).
  Sau sửa: 12 kịch bản PASS, gồm concurrent 401 dùng một refresh.
- `ThemeProvider.tsx`: subscribe OS theme bằng useSyncExternalStore; preference
  light/dark của người dùng vẫn ưu tiên cao hơn OS. Browser trước sửa timeout
  khi đổi light → dark trong mode system.
- `TechnologyRelay.tsx`: dùng tên và mark Cassandra thay PostgreSQL.
- Root `package.json`: dev/build/validate/session-test gọi frontend thật;
  README giải thích rõ backend phải khởi động/kiểm tra riêng.
- Frontend `package.json`: bổ sung hai lệnh session và public-theme regression.
- Các file kế hoạch/mẫu/state/review ở `tasks/readiness/`; giữ nguyên checklist
  cũ đang bị xóa, không khôi phục dữ liệu không rõ ý định.

Backend `clean test -q` với Java 20: PASS, 187 tests / 40 suites, không
failure/error/skipped. Không thay đổi backend production code trong lát này.
Google safe-return/contract check: 11 cases + 5 endpoints PASS; locale copy:
1.116 keys, không thiếu; error-copy: 6 guarded files, không violation.

Tại thời điểm kết thúc lát đầu, AUTH-04/05/06, JOIN-01 và các gate live vẫn mở.
Kết quả lifecycle tiếp theo được ghi riêng bên dưới.

### Kiểm tra cuối lát

| Lệnh / phạm vi | Kết quả |
|---|---|
| Root `npm run validate` | PASS, TypeScript + ESLint, 0 warning/error sau sửa |
| Root `npm run build` | PASS, production Next build, 17 pages generated |
| Root `npm run test:auth:session` | PASS, 12 kịch bản |
| Frontend `npm run test:auth:google` | PASS, 11 safe paths + 5 HTTP/OpenAPI endpoints; chưa login Firebase live |
| Frontend `npm run test:i18n:copy` | PASS, 1.116 keys, missing=[] |
| Frontend `npm run test:errors:copy` | PASS, 6 files, violations=[] |
| Frontend `npm run test:e2e:public-theme` | PASS, OS light→dark→light; 4 widths × 2 preferences; pointer/arrow-key selection; 0 console/page/request failure |
| Frontend `npm run test:e2e:smoke` | FAIL do môi trường: 3 request `/api/auth/providers` ở localhost:8084 bị connection refused; route trả 200 và protected route chuyển login |
| Java 20 `mvnw.cmd clean test -q` | PASS, 187 tests, 40 suites, 0 failure/error/skipped |
| Scoped `git diff --check` | PASS; Git có thông báo CRLF normalization README, không phải whitespace error |

Screenshot thực từ production public page, không fixture backend:
`chatapp_frontend/artifacts/readiness/technology-{light,dark}-{320,768,1024,1440}.png`.
Đã xem ảnh desktop dark và mobile light. Bộ này là bằng chứng cho technology
section và theme switch; không đại diện cho UI chat/admin/custom-room chưa
kiểm tra trong lát này. Header được giữ trong ảnh viewport như giao diện thật.

### File thay đổi trong lát này

| File | Lý do |
|---|---|
| `package.json`, `README.md` | Lệnh gốc thực sự delegate frontend; mô tả modular monolith/readiness đúng phạm vi |
| `chatapp_frontend/package.json` | Đăng ký session và public-theme regression commands |
| `chatapp_frontend/src/shared/api/apiClient.ts` | Phân biệt refresh/replay errors và transient/credential failure |
| `chatapp_frontend/src/app/providers/ThemeProvider.tsx` | Đồng bộ OS theme bằng subscription và cleanup |
| `chatapp_frontend/src/route-pages/shared/landing/TechnologyRelay.tsx` | Đúng tên/mark database đang dùng |
| `chatapp_frontend/scripts/api-session-smoke.mjs` | Regression cho session/replay/concurrent refresh |
| `chatapp_frontend/scripts/public-theme-smoke.mjs` | Regression browser + screenshot matrix |
| `tasks/readiness/plan.md`, `todo.md`, `forms-and-states.md`, `review.md` | Phạm vi, thứ tự thực thi, tiêu chí và kết quả có thể tiếp tục kiểm tra |

Mẫu plan từ skill planning-and-task-breakdown giúp chia việc thành lát có
nghiệm thu. Phạm vi catch của bản sửa session theo nguyên tắc consistency tại
`typescript-clean-code/references/error-handling/rules.md`, Rule 2. Không
nâng dependency hoặc thêm thư viện trong lát này.

## Lát 2 — auth lifecycle và UI khôi phục (2026-09-12)

Đã xử lý trong cùng tab; không tuyên bố giải quyết cookie race giữa nhiều tab.

| File (trong `chatapp_frontend/`) | Thay đổi |
|---|---|
| `src/shared/auth/access-token.ts` | Generation của phiên và SessionChangedError để vô hiệu hóa phản hồi của phiên cũ |
| `src/shared/api/apiClient.ts` | Chặn response/replay cũ; một refresh coordinator cho mỗi generation |
| `src/features/auth/api/auth.api.ts` | Init auth dùng chung coordinator thay vì refresh độc lập |
| `src/features/auth/model/auth.store.ts` | Phân biệt mất kết nối với bị từ chối; logout/login mới thắng kết quả bất đồng bộ cũ; cho phép Retry |
| `src/features/auth/ui/AuthSessionRecovery.tsx` | Màn hình phục hồi dùng token theme, nút Thử lại và liên kết Trợ giúp |
| `src/app/native/NativeRouteShell.tsx`, `src/app/admin/AdminEntry.tsx` | Hiện recovery tại route hiện tại, không redirect nhầm vì lỗi tạm thời |
| `src/app/providers/AuthProvider.tsx`, `src/app/router/guards/ProtectedRoute.tsx` | Truyền trạng thái unavailable, không ép login khi đang cần retry |
| `src/features/auth/hooks/useAuthCheck.ts` | Xóa hook logout theo JWT expiry đã bỏ qua khả năng refresh; consumer duy nhất đã chuyển sang lifecycle chung; có thể khôi phục từ Git |
| `src/shared/ui/Button.tsx` | Dùng Radix Slottable khi asChild; sửa React.Children.only gây crash cả trang với link button |
| `src/shared/i18n/resources.ts` | Hai câu recovery VI/EN ngắn, không toast |
| `scripts/api-session-smoke.mjs` | 19 ca interceptor/refresh: có cả stale success/401/403 và refresh response sau đổi phiên |
| `scripts/auth-lifecycle-smoke.mjs` | 7 ca Zustand: transient error/retry, delayed refresh/me, logout, login mới, dedupe, rejected session |
| `scripts/auth-recovery-browser-smoke.mjs`, `package.json` | Browser fixture và lệnh regression tái sử dụng |

Fail-first: lifecycle cũ xóa session hint khi init gặp 503. Browser cũng bắt
được lỗi React.Children.only của Button asChild trước khi sửa Slottable.

Kiểm tra đạt:

- `node scripts/api-session-smoke.mjs`: 19/19.
- `npm run test:auth:lifecycle`: 7/7.
- `npm run validate`: TypeScript và ESLint, exit 0.
- `npm run build`: PASS, 17 pages generated.
- `npm run test:e2e:notifications`: PASS, payload lưu đúng fixture contract,
  không console error/request failure.
- `npm run test:i18n:copy`: PASS, 1.118 keys, missing=[].
- `npm run test:e2e:auth-recovery`: 3 scenario trên production build;
  settings 320/light/VI, 1440/dark/EN; admin 320/dark/VI.
  Retry về đúng settings, Help mở được, không overflow, không page error,
  không request ngoài fixture; console chỉ có HTTP 503 chủ đích.

Screenshot đã xem trực tiếp:
`artifacts/readiness/session-recovery-light-320-vi.png`,
`artifacts/readiness/session-recovery-dark-1440-en.png`;
có thêm `artifacts/readiness/session-recovery-dark-320-admin.png`.

Còn mở: AUTH-05b đa tab/cookie, AUTH-06 Google crash recovery, toàn bộ JOIN
và các lát sau. Backend/datastore không chạy nên chưa có live session proof.
Generation guard không hủy được side effect hay Set-Cookie mà server đã gửi;
không thay thế server-side session/revocation consistency.

## Lát 3 — backend correctness và regression toàn luồng (2026-09-12)

### Thay đổi đã thực hiện

| File | Lý do |
|---|---|
| `chat-service/.../invite/JoinRequestService.java` | Merge queue bằng timestamp đầy đủ và signed-byte tie-break giống Cassandra; từ chối cursor không phải UUID v1 |
| `chat-service/.../invite/CassandraInviteRepository.java` | Không đổi decision khi takeover; finish CAS kiểm tra owner/status, trả Conflict thay vì ghi vô điều kiện |
| `chat-service/.../repository/CanonicalCqlStore.java` | Áp dụng cùng quy tắc cho community; CAS thất bại không sửa projection |
| `chat-service/.../auth/GoogleAuthService.java` | Không giải phóng unique reservations sau lần ghi user có kết quả không chắc chắn; kiểm tra account ACTIVE trước side effect settings |
| `chat-service/src/test/java/com/chatapp/chat_service/canonical/invite/JoinRequestServiceTest.java` | 3 regression phân trang và validation, cả 3 đã FAIL trước sửa |
| `chat-service/src/test/java/com/chatapp/chat_service/canonical/invite/JoinResolutionRepositoryTest.java` | 6 trường hợp cho hai repository: chặn đổi decision, tiếp quản cùng decision, finish bị từ chối; 4 negative cases đã FAIL trước sửa |
| `chat-service/src/test/java/com/chatapp/chat_service/canonical/auth/GoogleAuthServiceTest.java` | Thêm 2 regression save không rõ kết quả và suspended retry; cả 2 đã FAIL trước sửa |
| `chatapp_frontend/scripts/room-management-smoke.mjs` | Bỏ fixture array cũ, dùng CursorPage; kiểm tra network cursor thật và form tên/thời hạn/maxUses hiện tại |
| `docs/flows/invites-and-join-approval.md`, `tasks/readiness/todo.md` | Sửa mô tả sai về takeover; tách owner guard đã làm khỏi attempt fencing còn thiếu |

Maven Java 20 `./mvnw.cmd clean test -q`: **198 tests, 0 failures/errors/skipped**.
Tests repository dùng controlled driver responses và kiểm tra CQL condition;
không chứng minh Cassandra LWT ở runtime hay tính nguyên tử đa partition.

Frontend `npm run validate`: PASS. Không đổi frontend production code trong
lát này, nên dùng production build đã kiểm tra ở lát 2, không build lại chỉ vì
sửa fixture. Các lệnh browser sau PASS:

`test:e2e:admin`, `test:e2e:invites`, `test:e2e:communities`,
`test:e2e:room-management`, `test:e2e:polls`, `test:e2e:message-drafts`,
`test:e2e:message-delete`, `test:e2e:message-edit`, `test:e2e:message-interactions`,
`test:e2e:search`, `test:e2e:presence`, `test:e2e:contacts`, `test:e2e:profile`,
`test:e2e:room-create`, `test:e2e:notifications`, `test:e2e:network`.

Room-management ban đầu FAIL vì fixture trả mảng thay CursorPage và vẫn tìm
nút tạo 7 ngày đã bị thay bằng form linh hoạt. Sau đồng bộ fixture: PASS,
pagination thực sự gọi cursor, tạo invite gửi durationMinutes=1440,
maxUses=10, tên nhập; không console error/request failure. Không nới parser
production để nhận lại contract cũ.

Các regression khác PASS: auth Google 11 safe-return/5 endpoint contracts;
session 19; lifecycle 7; presence tracker 4; presence batcher 4; locale 1.118
keys missing=[]; error-copy 6 files violations=[].

### Giới hạn vẫn phải giải quyết

- Finish owner guard chưa phải fencing theo attempt: cùng actor có thể chạy
  hai lần; membership/notification có thể đã chạy trước CAS finish. JOIN-01/02
  vẫn mở, không được ghi là crash-safe.
- Cursor chỉ chứa requestedAt; va chạm UUID đầy đủ giữa hai nguồn vẫn cần
  composite cursor hoặc unified queue. Bản sửa giải quyết mất thứ tự do làm
  tròn millisecond, không tuyên bố giải quyết mọi kiểu collision.
- Google còn concurrent registration và directory projection repair. Giữ
  reservation sau save ambiguity ngăn giải phóng nhầm, chưa phải transaction.
- Draft smoke chứng minh giữ nội dung qua reload, chưa chứng minh giữ cùng
  clientMessageId qua reload sau response thất lạc; MSG-01 vẫn mở.
- Kiểm tra lại môi trường: localhost:8084 không lắng nghe; không có lệnh Docker.
  Không thực hiện live auth, migration, multi-user/restart, hoặc provider thật.

Skill incremental-implementation giữ mỗi thay đổi có fail-first regression;
typescript-clean-code/unit-tests Rule 2 và Rule 7 được dùng để sửa fixture
đúng contract và thêm assertion tự kiểm chứng, không bỏ qua lỗi để xanh test.

`test:e2e:ui-quality`: FAIL tổng thể do môi trường. 40 route/viewport checks
(8 trang × 320/390/768/1024/1440) đều HTTP 200, một h1, không overflow,
không unnamed controls/unlabeled fields/link thiếu href. Có 10 request
`http://localhost:8084/api/auth/providers` bị connection refused tại login/register.
Không đổi test để bỏ qua lỗi này. Bộ này không đo contrast, không thay thế
ma trận light/dark/custom-room hay kiểm thử người dùng thật.

Ảnh đã xem: `chatapp_frontend/artifacts/admin-operations.png` và
`chatapp_frontend/artifacts/room-management.png`; có thêm
`chatapp_frontend/artifacts/community-discovery.png`. Đây là ảnh mobile tại
trạng thái/scroll mà smoke test kết thúc, không phải nghiệm thu toàn bộ visual.
Admin full-page capture có sticky header giữa ảnh do scroll; cần capture
viewport/scroll rõ ràng trong đợt visual riêng, không suy ra lỗi layout từ
full-page screenshot này. Toast VI còn hiển thị sau khi test đổi locale EN là
thông báo đã tạo trước khi đổi ngôn ngữ, không phải payload dịch mới.

## Lát 4 — mã retry tin nhắn qua reload (2026-09-12)

Lỗi đã tái hiện: `message-draft-smoke` giữ được text sau HTTP 503/reload nhưng
request gửi lại mang clientMessageId mới. Assertion mã cũ=mã retry đã FAIL
trên build trước sửa. Backend hiện claim theo actor/clientMessageId và kiểm
tra fingerprint; không thể chống trùng nếu frontend cấp mã mới cho mỗi retry.

File thay đổi:

- `chatapp_frontend/src/features/messenger/model/messageSendAttempt.ts`: lưu
  mã UUID v4 + SHA-256 payload trong sessionStorage, khóa theo user/room.
  Không lưu thêm text, token hoặc attachment URL. Cùng payload chưa xác nhận
  dùng cùng mã; payload đổi tạo mã mới. Cleanup chỉ xóa đúng mã đã xác nhận.
- `chatapp_frontend/src/features/messenger/model/useMessenger.ts`: lấy mã
  trước optimistic send/HTTP; kiểm tra generation sau bước hash async để
  không gửi bằng tài khoản mới; cleanup sau server success. Mã explicit của
  caller vẫn được giữ nguyên.
- `chatapp_frontend/scripts/message-send-attempt-smoke.mjs`, `package.json`:
  thêm lệnh `test:messages:send-attempt`, 12 kiểm tra logic production với
  WebCrypto, storage kiểm soát, reload, identity/payload isolation và lỗi storage.
- `chatapp_frontend/scripts/message-draft-smoke.mjs`: regression browser kiểm
  tra mã request trước/sau lỗi và reload phải giống nhau.

Giới hạn: bảo vệ latest unchanged send trong cùng tab qua reload, không phải
durable outbox. Đóng tab, duplicate-tab snapshot, thay payload rồi quay lại
payload cũ, upload lại file, hoặc crash sau response thành công trước clear
draft vẫn cần thiết kế pending-send đầy đủ. sessionStorage lỗi/corrupt làm
prepare thất bại trước HTTP; không tự bỏ mã cũ để gửi mã mới. Cleanup lỗi sau
server success được log chứ không báo gửi thất bại. Không tuyên bố exactly-once.

Skill vercel-react-best-practices (`client-localstorage-schema`) được dùng để
giới hạn dữ liệu lưu; error-handling Rule 2 giữ ranh giới gửi/cleanup rõ ràng.

Kiểm tra: `test:messages:send-attempt` PASS 12 kiểm tra;
`npm run validate` PASS; `npm run build` PASS 17 pages.
`test:e2e:message-drafts` trên build mới PASS: hai POST sau 503/reload có cùng
clientMessageId, clear draft sau success, không console/request failure hoặc
mobile overflow. Đây là browser HTTP fixture, không live Cassandra.
`test:e2e:message-interactions` PASS: pin/unpin, reaction, read-receipt cursor,
mention payload; consoleErrors=[] và requestFailures=[].
