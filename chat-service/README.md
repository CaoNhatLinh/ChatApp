# Nối Backend (Canonical Runtime)

Backend của Nối dùng mô hình dữ liệu **Cassandra-first**, realtime STOMP
và một contract duy nhất. Runtime không đọc schema/API legacy và không có
mock-success fallback.

## Current stack

- Spring Boot 3.5 + Java 20
- Cassandra 4.1 là nguồn sự thật cho dữ liệu bền vững
- Redis cho presence/typing TTL, cache bounded và distributed rate limit
- Kafka cho outbox events, consumer projection và DLQ
- Elasticsearch cho search projection được phân quyền và có thể rebuild
- Cloudinary cho binary media khi đã cấu hình provider
- JWT + STOMP/SockJS cho REST/realtime được xác thực

## Current scope

- Messages, conversations, roles, invites, notifications, polls, attachments,
  mentions, search APIs và admin/owner actions dùng canonical service paths.
- Global admin endpoints cover capability gating, bounded all-room directory,
  room policy/archive, account status/app-role mutations, bounded session/device
  revoke, daily analytics và monthly audit timeline. Mọi mutation đều kiểm tra
  quyền và ghi audit/outbox.
- Cloudinary là provider binary tùy cấu hình; Cassandra luôn giữ attachment
  metadata authoritative và snapshot bất biến trên message.
- Cuộc gọi hiện tại chỉ là 1–1 DM native WebRTC. Group/SFU không được expose
  cho tới khi có provider contract, capacity plan và kiểm thử riêng.

## Quick setup

### 1. Start dependencies

```bash
cd chat-service
docker compose up -d
```

Manifest mặc định và `docker-compose-full.yml` đều khởi động Cassandra + schema
init, Redis, Kafka và Elasticsearch. Existing keyspaces phải apply các migration
additive trong `migrations/` trước khi chạy các projection mới.

### 2. Configure application

Đặt các biến môi trường trong deployment; không commit secret. Tối thiểu cần
`JWT_SECRET`, Cassandra connection, CORS/WebSocket origins và các broker URL.

### 3. Run

```bash
./mvnw test
./mvnw spring-boot:run
```

REST chạy tại `http://localhost:8084`; SockJS/STOMP tại
`http://localhost:8084/ws`.

## Useful documents

- [API Reference](./API_REFERENCE.md)
- [Backend architecture](./docs/ARCHITECTURE.md)
- [Repository work plan](./docs/AGENT_WORK_PLAN.md)
- [Feature inventory](./docs/FEATURE_INVENTORY.md)
- [Contributing](./CONTRIBUTING.md)

Production phải dùng full manifest, environment đã review và provider external
được phê duyệt cho media/NAT traversal. Nếu provider thiếu, tính năng báo trạng
thái unavailable rõ ràng thay vì giả thành công.
