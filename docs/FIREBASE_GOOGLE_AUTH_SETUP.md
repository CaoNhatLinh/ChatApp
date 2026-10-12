# Thiết lập đăng nhập Google qua Firebase

Google chỉ xác minh danh tính. Tài khoản, quyền, trạng thái khóa và phiên đăng
nhập ứng dụng vẫn do backend Nối quản lý.

## 1. Tạo và cấu hình Firebase project

1. Mở [Firebase Console](https://console.firebase.google.com/), tạo hoặc chọn
   project dành riêng cho môi trường cần chạy.
2. Vào **Build → Authentication → Get started → Sign-in method**.
3. Bật **Google**, chọn support email và lưu.
4. Vào **Project settings → General → Your apps**, thêm một Web app.
5. Sao chép bốn giá trị public: `apiKey`, `authDomain`, `projectId`, `appId`.
6. Trong **Authentication → Settings → Authorized domains**, thêm chính xác
   domain local/staging/production sẽ mở giao diện Nối. Không thêm wildcard rộng.

Nếu dùng redirect trên trình duyệt hạn chế third-party storage, cấu hình hosting
theo [redirect best practices của Firebase](https://firebase.google.com/docs/auth/web/redirect-best-practices).

## 2. Cấu hình frontend

Tạo `chatapp_frontend/.env.local` từ `.env.example` và điền:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Đây là Firebase Web config, không phải service-account secret. Không đưa private
key hay file JSON của service account vào frontend.

## 3. Cấp quyền xác minh cho backend

Cách khuyến nghị khi phát triển local:

1. Cài Google Cloud CLI và đăng nhập đúng project.
2. Chạy `gcloud auth application-default login`.
3. Đặt `FIREBASE_PROJECT_ID` đúng với project ở frontend.

Trong môi trường deploy, dùng workload identity/service account của hạ tầng.
Nếu buộc phải dùng JSON key local, đặt đường dẫn qua
`GOOGLE_APPLICATION_CREDENTIALS` ở process environment hoặc `chat-service/.env`;
file key phải nằm ngoài repository và không được commit.
Firebase Admin SDK đọc credential theo
[Application Default Credentials](https://firebase.google.com/docs/admin/setup).

Backend environment:

```dotenv
GOOGLE_AUTH_ENABLED=true
FIREBASE_PROJECT_ID=your-project
FIREBASE_AUTH_EMULATOR_ALLOWED=false
AUTH_COOKIE_SECURE=true
CORS_ALLOWED_ORIGIN_PATTERNS=https://your-ui.example
```

`AUTH_COOKIE_SECURE` chỉ để `false` khi chạy HTTP local. Production phải là
`true`. `FIREBASE_AUTH_EMULATOR_ALLOWED` mặc định `false` để một biến emulator
bị sót không chuyển production sang xác minh token giả.

## 4. Cassandra

Schema canonical phải có các bảng/field identity đang nằm trong
`chat_app_complete.cql`, đặc biệt `external_identity_owner_by_key` và các field
`auth_provider`, `external_subject` của user. Máy mới chỉ nạp schema canonical
này; không cần migration Google riêng. Không dùng schema init để nâng cấp database
cũ hoặc xóa/recreate dữ liệu production. Xem [quyết định hợp nhất schema](SCHEMA_CONSOLIDATION.md).

## 5. Chạy và kiểm tra

```powershell
# backend
cd chat-service
$env:JAVA_HOME='C:\Program Files\Java\jdk-20'
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run

# frontend, terminal khác
cd chatapp_frontend
npm install
npm run type-check
npm run lint
npm run build
npm run dev
```

Kiểm tra theo thứ tự:

1. `GET /api/auth/providers` trả `google.enabled: true`.
2. Tài khoản Google mới mở bước chọn username; chưa hoàn tất thì chưa có cookie
   refresh Nối.
3. Tài khoản Google đã nối vào đúng `userId` cũ.
4. Email trùng tài khoản LOCAL trả hướng dẫn liên kết, không tự merge.
5. Settings → **Cách đăng nhập** yêu cầu mật khẩu hiện tại và Google cùng email.
6. Sai mật khẩu, khác email, tài khoản bị khóa và popup bị đóng đều giữ UI ổn
   định; thao tác hủy không tạo toast.
7. Logout rồi reload không tự đăng nhập lại từ Firebase.

## 6. Emulator (chỉ local/test)

Theo [Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth),
đặt `FIREBASE_AUTH_EMULATOR_HOST` không kèm protocol và đồng thời đặt
`FIREBASE_AUTH_EMULATOR_ALLOWED=true`. Không dùng hai biến này ở staging/prod.

## Release gate còn bắt buộc

- Chạy Google thật trên domain staging đã authorize, gồm popup và redirect mobile.
- Chạy fault-injection/Cassandra thật cho đăng ký lần đầu; hiện recovery bền
  vững sau process crash chưa hoàn tất.
- Thêm rate limit phân tán cho exchange/register/link và bằng chứng malicious-origin.
- Rà soát privacy/retention và giám sát lỗi không chứa ID token hoặc email.
