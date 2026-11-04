# Chạy Nối bằng VS Code và Docker trên Windows

## Trạng thái hiện tại

Docker chạy các dịch vụ dữ liệu. Backend Java và frontend Next.js chạy trên máy
qua launcher hoặc terminal VS Code. Xem [checklist triển khai](../tasks/todo.md)
để phân biệt phần đã kiểm tra bằng fixture với phần cần chạy trên hạ tầng thật.

## 1. Chuẩn bị máy

### Khởi động bằng một lệnh

Sau khi cài/mở Docker Desktop và có JDK 20+ cùng Node.js 22,
mở terminal tại root repo:

```powershell
Set-Location 'C:\duong-dan\ChatApp'
npm run local
```

Launcher bật bốn dịch vụ Docker và chờ healthy, nạp duy nhất
`chat_app_complete.cql` nếu Cassandra chưa có bảng/UDT Nối, kiểm tra bảng/cột/type
canonical, rồi chạy backend và frontend trong cùng terminal. Frontend dependencies
được cài bằng `npm ci` nếu Next chưa được cài. Mở `http://localhost:3000` sau khi
launcher báo sẵn sàng. Dùng Ctrl+C để dừng app jobs; Docker và volume vẫn giữ.
Khi chưa có `.env`, launcher tạo cấu hình local từ example và khóa JWT ngẫu nhiên;
không ghi đè file đã có. Google/Cloudinary mặc định tắt trên máy mới cho tới khi
bạn cấu hình credential thật.

Máy mới dùng schema hiện tại, không chạy các file migration, không nạp dữ liệu
cũ. Nếu gặp schema không khớp, launcher dừng; nó không xóa database hay tự sửa
cấu trúc. Guard bảng/cột/type không thay kiểm thử đầy đủ primary keys hoặc dữ liệu.
Các script migration cũ đã được loại bỏ sau khi đối chiếu schema/code; xem
[bảng hợp nhất](SCHEMA_CONSOLIDATION.md). Không hỗ trợ nâng cấp database legacy
bằng launcher này.

JDK nằm ở đường dẫn khác có thể chọn một lần trong terminal:

```powershell
$env:JAVA_HOME='C:\duong-dan\jdk-21'
npm run local
```

Kiểm tra điều kiện mà không chạy container/app:
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -CheckOnly`.
Lệnh này kiểm tra Docker engine, JDK và cấu hình đã có. Nếu máy mới chưa có
`.env`, lần chạy `npm run local` thông thường sẽ tạo file đó. Cài Docker và JDK
trước khi dùng launcher.

1. Cài [Docker Desktop cho Windows](https://docs.docker.com/desktop/setup/install/windows-install/),
   dùng Linux containers và WSL 2 engine. Bật virtualization theo yêu cầu Docker.
   Mở Docker Desktop và chờ engine chạy. Nếu Windows cần cài WSL, làm theo
   hướng dẫn installer; có thể cần restart máy. Mở lại terminal sau cài đặt.
2. Dùng Node.js 22 và npm để cài frontend theo lockfile.
3. Backend target Java 20 trong `chat-service/pom.xml`. Chọn JDK 20 trở lên bằng
   `JAVA_HOME` nếu terminal đang dùng bản Java cũ hơn.
4. Mở thư mục repo trong VS Code. Extension Pack for Java và Spring Boot
   Extension Pack hữu ích khi debug. Dùng **Java: Configure Java Runtime** để
   chọn runtime cho dự án; xem [hướng dẫn VS Code](https://code.visualstudio.com/docs/java/java-project).

Kiểm tra trong terminal PowerShell:

```powershell
docker --version
docker compose version
docker info
node --version
npm --version
```

`docker info` phải kết nối được server, không chỉ in phiên bản client.

## 2. Dữ liệu nằm ở đâu?

| Dịch vụ | Vai trò | Port local | Lưu qua restart? |
| --- | --- | --- | --- |
| Cassandra 4.1 | Nguồn dữ liệu chính: tài khoản, phòng, tin nhắn, quyền, invite… | 9042 | Có, volume `cassandra-data` |
| Redis 7.4 | Presence, typing, rate limit và trạng thái tạm | 6379 | Không, cấu hình local tắt persistence |
| Kafka 3.9.1 | Vận chuyển domain events từ outbox | 9092 | Có, volume `kafka-data` |
| Elasticsearch 8.18.8 | Search projection, không phải nguồn dữ liệu chính | 9200 | Có, volume `elasticsearch-data` |

Không cần PostgreSQL/MySQL/MongoDB hay Firestore cho runtime này. Firebase Auth
chỉ xác minh Google; tài khoản và phiên Nối vẫn do backend/Cassandra quản lý.
Cloudinary là dịch vụ media bên ngoài, không có container local.

## 3. Khởi động hạ tầng — terminal 1

Các lệnh cho terminal 1, 2 và 3 đều bắt đầu từ thư mục gốc repo.

```powershell
Set-Location .\chat-service
docker compose up -d
docker compose ps -a
docker compose logs cassandra-schema
```

Lần đầu cần tải image và Cassandra cần thời gian khởi động. Chờ các dịch vụ
hiện `healthy`; `cassandra-schema` phải kết thúc với **Exited (0)**. Đây là job
khởi tạo schema một lần, không phải container cần chạy liên tục. Nếu nó lỗi,
đọc log và chưa chạy backend.

### Database mới

Compose tự mount `chat_app_complete.cql` rồi nạp keyspace `chat_app` sau khi
Cassandra healthy. Không phải tạo bảng thủ công. Có thể kiểm tra:

```powershell
docker compose exec cassandra cqlsh -e "DESCRIBE KEYSPACE chat_app"
docker compose exec redis redis-cli ping
Invoke-RestMethod http://localhost:9200/_cluster/health
```

Redis phải trả `PONG`. Elasticsearch single-node có thể `yellow` do replica
chưa được gán; lỗi kết nối hoặc `red` cần điều tra.

### Database đã có dữ liệu

`CREATE IF NOT EXISTS` không nâng cấp bảng cũ. Repo hiện phục vụ máy mới với
schema canonical, không còn các migration legacy. Nếu dùng lại một volume có
schema khác, launcher dừng và không chỉnh sửa dữ liệu. Không bỏ qua kiểm tra
schema để ép runtime chạy. Việc chuyển dữ liệu cũ, nếu cần trong tương lai, là
một công việc riêng cần backup và kế hoạch đã kiểm thử.

Không dùng `chat-service/update_cassandra.ps1`: script cũ gọi tên container
không khớp manifest hiện tại và không phải quy trình migration đã kiểm chứng.
Không dùng `docker compose down -v` để khắc phục lỗi: nó xóa các volume dữ liệu.

## 4. Kiểm tra cấu hình local

Backend đọc `chat-service/.env` khi chạy từ thư mục `chat-service`.
Frontend đọc `chatapp_frontend/.env` và `.env.local`; `.env.local` ưu tiên cao hơn.
Khi chạy thủ công lần đầu, sao chép `.env.example` của từng project sang `.env`
nếu file đích chưa tồn tại. Dùng `npm run local` để launcher làm bước này và tạo
khóa JWT ngẫu nhiên.

Backend tối thiểu:

```dotenv
JWT_SECRET=<Base64 của ít nhất 32 byte ngẫu nhiên>
APP_PUBLIC_BASE_URL=http://localhost:3000
AUTH_COOKIE_SECURE=false
CASSANDRA_CONTACT_POINTS=localhost
CASSANDRA_PORT=9042
CASSANDRA_LOCAL_DATACENTER=datacenter1
REDIS_HOST=localhost
REDIS_PORT=6379
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
ELASTICSEARCH_URIS=http://localhost:9200
```

Các kết nối local có giá trị mặc định trong `application.properties`. CORS và
WebSocket cho phép `http://localhost:3000` mặc định. Dùng `localhost` cho cả frontend
lẫn backend để cookie được gửi đúng hostname.

Nếu cần tự sinh khóa JWT trong PowerShell, chạy đoạn sau và dán kết quả vào
`JWT_SECRET` trong `chat-service/.env`:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
[Convert]::ToBase64String($bytes)
```

Frontend phải có:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8084/api
NEXT_PUBLIC_WS_URL=http://localhost:8084/ws
```

### Dịch vụ tùy chọn

| Tính năng | Cấu hình và kiểm tra |
| --- | --- |
| Đăng nhập Google | Bật provider và thêm `localhost` trong Firebase. Web config đặt ở frontend, credential Admin đặt ở backend. Xem [hướng dẫn Firebase](FIREBASE_GOOGLE_AUTH_SETUP.md). |
| Upload ảnh, tệp và sticker | Đặt `CLOUDINARY_ENABLED=true`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` và `CLOUDINARY_API_SECRET` trong backend. Thử tải lên và mở lại tệp trong hội thoại. Xem [luồng media](adr/0030-recoverable-media-upload-authority.md). |
| GIF | Đặt `NEXT_PUBLIC_GIPHY_API_KEY` ở frontend và khởi động lại Next.js. Đây là Web API key được dùng từ trình duyệt. Xem [luồng GIPHY](flows/giphy-gifs.md). |
| Email | Giữ `EMAIL_ENABLED=false` cho đến khi có API key, địa chỉ gửi, danh sách nhận thử và webhook đã cấu hình. Xem [hướng dẫn Resend](flows/resend-email.md). |
| Gọi thoại và video | `NEXT_PUBLIC_WEBRTC_ICE_SERVERS` nhận cấu hình ICE server cho trình duyệt. Kiểm tra hai thiết bị trên hai mạng để xác nhận đường truyền. Xem [giới hạn cuộc gọi và kiểm chứng](../tasks/todo.md). |

Giữ credential backend trong `.env` hoặc môi trường chạy. Các biến có tiền tố
`NEXT_PUBLIC_` sẽ có mặt trong mã tải về trình duyệt.

## 5. Khởi động backend — terminal 2

```powershell
Set-Location .\chat-service
$env:JAVA_HOME='C:\duong-dan\jdk-21'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
java -version
.\mvnw.cmd -version
.\mvnw.cmd spring-boot:run
```

Giữ terminal này mở. Chờ log `Started ...` và server port 8084. Nếu dùng nút
Run/Debug Java của VS Code, cần đặt working directory là `chat-service` để đọc
đúng `.env`; cách terminal bên trên dễ kiểm soát hơn lúc setup lần đầu.

Từ terminal khác:

```powershell
Invoke-RestMethod http://localhost:8084/actuator/health
Invoke-RestMethod http://localhost:8084/api/auth/providers
```

Health phải `UP`. Nếu bật Google, provider API phải báo `google.enabled: true`;
điều này chỉ xác nhận cấu hình, chưa chứng minh đăng nhập Google thật thành công.

## 6. Khởi động frontend — terminal 3

```powershell
Set-Location .\chatapp_frontend
npm ci
npm run dev
```

Mở **http://localhost:3000**. Giữ terminal chạy. Đăng ký/đăng nhập hai tài khoản
ở hai browser profile khác nhau; gửi tin nhắn, reload và reconnect để xác nhận
dữ liệu/realtime thật. Không chỉ dựa vào test dùng HTTP fixture.

Chạy production frontend local khi cần:

```powershell
npm run build
npm run start
```

### Quản trị toàn ứng dụng

Tài khoản mới không tự có quyền `/admin`. Với tài khoản đã tồn tại, operator có
thể đặt `APP_BOOTSTRAP_SUPER_ADMIN_USER_ID=<UUID user thật>` trong backend `.env`,
restart backend một lần để cấp quyền, rồi xóa biến bootstrap. Không dùng UUID
giả và không cấp quyền trực tiếp từ UI/browser.

## 7. Tắt và chạy lại

- Backend/frontend: `Ctrl+C` trong đúng terminal.
- Hạ tầng: `docker compose stop` từ `chat-service`; dữ liệu persistent vẫn giữ.
- Lần sau: `docker compose up -d`, chờ healthy rồi chạy backend và frontend.
- Không cần chạy `npm ci` mỗi lần; chỉ cần khi dependency/lockfile thay đổi.

## 8. Lỗi thường gặp

| Lỗi | Kiểm tra |
| --- | --- |
| Không nhận `docker` | Cài Docker Desktop, mở lại terminal; kiểm tra PATH |
| Docker client có nhưng server lỗi | Mở Docker Desktop, kiểm tra WSL/virtualization và `docker info` |
| Maven báo release 20 unsupported | Terminal đang dùng Java 17; đặt JAVA_HOME/PATH như trên |
| Cassandra timeout/keyspace/table thiếu | Chờ healthy và xem log `cassandra-schema`. So sánh volume với schema canonical nếu launcher báo khác cấu trúc. |
| Thiếu `JWT_SECRET` | Chạy từ `chat-service` và kiểm tra `.env`, không in khóa ra log |
| CORS/cookie/login mất phiên | Dùng localhost nhất quán, port 3000; cookie secure=false chỉ với HTTP local |
| Google unavailable | Project ID/credential/provider/domain, rồi xem `/api/auth/providers` |
| Port đã được dùng | Xác định process/container sở hữu; không kill bừa dịch vụ đang chạy |

Không expose các port database ra Internet. Compose local tắt một số cơ chế
xác thực để phát triển; đây không phải cấu hình deploy production.

## 9. Kiểm tra trước khi bàn giao

Chạy từ thư mục gốc, với `JAVA_HOME` đã chọn đúng:

```powershell
.\scripts\test-local-schema.ps1
Push-Location .\chat-service
try { .\mvnw.cmd test } finally { Pop-Location }
npm run validate
npm run build
```

Xem [lệnh kiểm thử trình duyệt và Testcontainers](TESTING.md) và [các ca Cassandra
thật](testing/chat-cassandra-acceptance.md). Trên máy đã cài Docker, dùng hai
browser profile để kiểm tra đăng nhập, gửi tin, đọc lại sau reload và quyền
truy cập sau khi rời phòng. Các bài Chromium dùng fixture kiểm tra giao diện và
hợp đồng HTTP, còn xác nhận ghi dữ liệu và realtime cần hạ tầng đang chạy.
