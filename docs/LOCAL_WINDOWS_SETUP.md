# Chạy Nối bằng VS Code và Docker trên Windows

## Trạng thái hiện tại

Code có thể build và chạy kiểm tra local; chưa được xác nhận hoàn tất toàn bộ
ứng dụng hay sẵn sàng production. Các gate còn mở nằm trong
[checklist](../tasks/readiness/todo.md). Docker chạy các dịch vụ dữ liệu;
backend Java và frontend Next.js chạy trong hai terminal VS Code. Manifest
hiện tại không chứa container backend/frontend.

## 1. Chuẩn bị máy

### Khởi động bằng một lệnh

Sau khi cài/mở Docker Desktop và có JDK 20+ cùng Node,
mở terminal tại root repo:

```powershell
Set-Location E:\WORKSPACE\ChatApp
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
Các hướng dẫn migration bên dưới chỉ dành cho người nâng cấp database có sẵn,
không áp dụng cho setup máy mới này.

JDK nằm ở đường dẫn khác có thể chọn một lần trong terminal:

```powershell
$env:JAVA_HOME='C:\duong-dan\jdk-21'
npm run local
```

Kiểm tra điều kiện mà không chạy container/app:
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -CheckOnly`.
Launcher Windows không cài Docker/JDK tự động và không thay đổi cấu hình hệ thống.

1. Cài [Docker Desktop cho Windows](https://docs.docker.com/desktop/setup/install/windows-install/),
   dùng Linux containers và WSL 2 engine. Bật virtualization theo yêu cầu Docker.
   Mở Docker Desktop và chờ engine chạy. Nếu Windows cần cài WSL, làm theo
   hướng dẫn installer; có thể cần restart máy. Mở lại terminal sau cài đặt.
2. Có Node.js/npm; máy được kiểm tra dùng Node 22.
3. Backend đang target Java 20 trong `chat-service/pom.xml`. Máy này đã có
   `C:\Program Files\Java\jdk-20`, nhưng Java mặc định là 17. Phải chọn đúng JDK
   khi chạy Maven; không đổi target của dự án chỉ để khớp Java mặc định.
4. Mở VS Code tại `E:\WORKSPACE\ChatApp`. Extension Pack for Java và Spring Boot
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

```powershell
Set-Location E:\WORKSPACE\ChatApp\chat-service
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

`CREATE IF NOT EXISTS` không nâng cấp các bảng cũ. Không chạy toàn bộ migration
theo alphabet: có file ALTER/DROP và có file rebuild cần kế hoạch dữ liệu riêng.
Sao lưu trước, kiểm tra schema hiện tại rồi chỉ áp dụng migration còn thiếu.
Đặc biệt kiểm tra các thay đổi identity Google và invite state machine.

Ví dụ nạp **một migration đã được xác nhận phù hợp**, từ terminal root:

```powershell
Set-Location E:\WORKSPACE\ChatApp
docker cp .\migrations\V_firebase_google_identity.cql chat-cassandra:/tmp/google-identity.cql
docker exec chat-cassandra cqlsh -k chat_app -f /tmp/google-identity.cql
```

Ví dụ này không có nghĩa chỉ một file là đủ cho mọi database cũ. Schema mới đã
có các thay đổi này; không chạy lại ALTER đã tồn tại. Chưa có migration runner
tự động xác định version database.

Không dùng `chat-service/update_cassandra.ps1`: script cũ gọi tên container
không khớp manifest hiện tại và không phải quy trình migration đã kiểm chứng.
Không dùng `docker compose down -v` để khắc phục lỗi: nó xóa các volume dữ liệu.

## 4. Kiểm tra cấu hình local

Backend đọc `chat-service/.env` khi chạy từ thư mục `chat-service`.
Frontend đọc `chatapp_frontend/.env` và `.env.local`; `.env.local` ưu tiên cao hơn.
Các file local đã tồn tại trên máy này: không chép `.env.example` đè lên chúng.

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

Các connection local có default trong `application.properties`. Khóa JWT local
đã được bổ sung trên máy này; không dùng khóa ví dụ để deploy. CORS và WebSocket
defaults đã cho phép `http://localhost:3000`. Dùng cùng hostname `localhost`
cho frontend/backend để tránh lệch cookie; không tự trộn với `127.0.0.1`.

Frontend phải có:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8084/api
NEXT_PUBLIC_WS_URL=http://localhost:8084/ws
```

Firebase frontend và backend hiện trỏ project `fir-a6b57`. Backend credential
file đã được cấu hình và tồn tại; tuyệt đối không đưa JSON/private key lên Git.
Đường dẫn trong `.env` backend nên dùng `/` vì file được đọc như Java properties.
Để Google login hoạt động, còn phải bật Google provider và authorize `localhost`
trong Firebase Console; xem [setup đầy đủ](FIREBASE_GOOGLE_AUTH_SETUP.md).
Không cần `gcloud config set project` khi dùng credential file và project ID rõ ràng.

Upload media chỉ hoạt động khi cấu hình Cloudinary thật. STUN/TURN/WebRTC và
các provider khác phải được kiểm chứng riêng; không coi chúng hoạt động chỉ vì
frontend chạy được.

## 5. Khởi động backend — terminal 2

```powershell
Set-Location E:\WORKSPACE\ChatApp\chat-service
$env:JAVA_HOME='C:\Program Files\Java\jdk-20'
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
Set-Location E:\WORKSPACE\ChatApp\chatapp_frontend
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
| Cassandra timeout/keyspace/table thiếu | Chờ healthy, xem schema job và migration; không xóa volume |
| Thiếu `JWT_SECRET` | Chạy từ `chat-service` và kiểm tra `.env`, không in khóa ra log |
| CORS/cookie/login mất phiên | Dùng localhost nhất quán, port 3000; cookie secure=false chỉ với HTTP local |
| Google unavailable | Project ID/credential/provider/domain, rồi xem `/api/auth/providers` |
| Port đã được dùng | Xác định process/container sở hữu; không kill bừa dịch vụ đang chạy |

Không expose các port database ra Internet. Compose local tắt một số cơ chế
xác thực để phát triển; đây không phải cấu hình deploy production.
