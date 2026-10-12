# Kiểm tra và bàn giao local — 2026-10-12

Phạm vi: Nối / ChatApp, không phải Skipli. Đây là kiểm tra snapshot hiện tại
trước commit/push và hướng dẫn chạy local, không đánh dấu toàn app hoàn tất.

## Kết quả thực thi

| Phạm vi | Kết quả |
| --- | --- |
| Root `npm run validate` | PASS: TypeScript và ESLint |
| Root `npm run build` | PASS: Next production build, 17 pages generated |
| Java 20 `mvnw.cmd clean test -q` | PASS: 225 tests / 50 suites, 0 failures/errors/skipped |
| Frontend `test:auth:session` | PASS: 19 cases, controlled Axios transport |
| Frontend `test:auth:lifecycle` | PASS: 7 cases, controlled API responses |
| Frontend `test:auth:google` | PASS: 11 safe-return cases + 5 HTTP contracts; Firebase live vẫn cần |
| Frontend `test:messages:send-attempt` | PASS: 12 cases, per-tab storage/WebCrypto boundary |
| Frontend `test:i18n:copy` | PASS: 1.118 keys, không missing |
| Frontend `test:errors:copy` | PASS: 6 guarded files, không violation |
| Browser `test:e2e:public-theme` | PASS: system theme change + 8 light/dark layouts ở 320/768/1024/1440, failures=[] |
| Browser `test:e2e:auth-recovery` | PASS: settings/admin recovery, HTTP fixture, không phải live auth |
| Browser `test:e2e:admin` | PASS: global admin actions với HTTP fixture, consoleErrors/requestFailures=[] |

Browser chạy trên production frontend tại port tạm 3114; server kiểm tra được
dừng sau khi hoàn tất. Log lệnh local nằm trong `%TEMP%/chatapp-*-20261012.log`.
Capture public theme nằm trong `chatapp_frontend/artifacts/readiness/` và được
Git ignore như artifact, không phải dữ liệu ứng dụng.

## Setup local đã chuẩn bị

- Thêm `docs/LOCAL_WINDOWS_SETUP.md` và link từ README.
- Xác nhận JDK 20 có trên máy; Java mặc định là 17 nên terminal cần JAVA_HOME.
- Backend `.env` local thiếu JWT secret; đã bổ sung khóa ngẫu nhiên 48 bytes
  Base64, public URL `http://localhost:3000` và cookie secure=false cho HTTP local.
- Giữ nguyên Firebase credential. Backend project `fir-a6b57`, credential file
  được cấu hình và tồn tại; chưa kiểm chứng provider/authorized domains từ console.
- `.env`, `.env.local` và credential không được commit. Không in giá trị khóa
  hay nội dung JSON credential vào báo cáo.

## Gate chưa hoàn tất

Docker không có trên PATH tại thời điểm kiểm tra. Không xác nhận live startup,
migration mới/nâng cấp, persistence/realtime hai tài khoản hay Google login thật.
Các vấn đề fencing/crash recovery, concurrency và các mục UI/architecture còn
mở giữ nguyên ở `tasks/readiness/todo.md`; không đổi thành hoàn tất vì unit hoặc
fixture test pass. Cloudinary/TURN cũng cần provider và kiểm thử riêng.

Commit/push là lưu snapshot công việc hiện tại, không phải tuyên bố release
production hay đã review đầy đủ mọi dòng code.

## Bổ sung launcher một lệnh

- Root `npm run local` gọi Windows launcher trong `scripts/start-local.ps1`.
- Máy mới nạp duy nhất canonical `chat_app_complete.cql`; không tự chạy migration
  hoặc xóa dữ liệu. File `.env` thiếu được tạo với mặc định local và JWT random.
- Guard kiểm tra 78 bảng / 676 cột, type/static và 2 UDT / 20 fields từ schema;
  đây không phải kiểm chứng đầy đủ primary keys hay migration dữ liệu cũ.
- Windows PowerShell parser và `scripts/test-local-schema.ps1`: PASS, gồm thiếu
  cột, sai type, sai static và parsing output JSON của cqlsh.
- Maven `-Dtest=InfrastructureManifestTest test`: PASS, 9 tests. Guard mới xác
  nhận bảng trong truy vấn runtime của các class import CqlSession có trong schema.
- Background-job runtime và cleanup native child: PASS với process test riêng.
- `npm run local` trên host hiện tại dừng đúng ở preflight Docker chưa được cài;
  chưa chạy được luồng Docker/schema/backend/frontend thật. Không ghi đây là live PASS.

## Hợp nhất schema cho máy mới

Đã đối chiếu 17 migration CQL với schema/code. Các thay đổi còn dùng đã có
trong schema canonical; loại bỏ hai định nghĩa legacy (`users` và
`message_revisions`) thay vì đưa chúng vào schema mới. Xóa 17 script migration,
cập nhật hướng dẫn Firebase/local/data model và ghi quyết định trong
`docs/SCHEMA_CONSOLIDATION.md`. Không xóa hay thay đổi database/volume.

Schema guard PowerShell vẫn PASS. Toàn bộ Maven suite có 227 tests PASS,
0 failures/errors/skipped. InfrastructureManifestTest có 10 tests PASS,
bao gồm truy vấn runtime tham chiếu bảng đã định nghĩa và schema standalone
không cần script upgrade. Live Cassandra vẫn chưa được kiểm chứng trên host này.
