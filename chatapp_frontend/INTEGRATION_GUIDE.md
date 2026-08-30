# Frontend–backend integration

Nối runs as one Next.js frontend and one Spring Boot backend. The
frontend uses only the canonical contracts in
[`../docs/api/openapi.yaml`](../docs/api/openapi.yaml) and
[`../docs/api/asyncapi.yaml`](../docs/api/asyncapi.yaml).

## Local setup

1. Start Cassandra, Redis, Kafka and Elasticsearch from
   `chat-service/docker-compose.yml`.
2. Start Spring Boot on `http://localhost:8084`.
3. Copy `.env.example` to `.env` and set:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8084/api
   NEXT_PUBLIC_WS_URL=http://localhost:8084/ws
   ```

4. Run `npm run dev` for development or `npm run build && npm run start` for
   production verification.

## Runtime boundaries

- `src/shared/auth/access-token.ts` holds the access token only in memory.
  `src/shared/api/apiClient.ts` sends it and handles the canonical refresh flow;
  `novachat_session` is a non-authorizing startup hint, not a credential.
- `src/features/*/api` modules map only the documented canonical payloads.
- `src/features/messenger/model/useMessenger.ts` owns HTTP and STOMP message
  and typing flows; `src/features/calls/hooks/useWebRtcCall.ts` owns the exact
  1–1 native WebRTC offer/answer/ICE lifecycle over the canonical call topics.
- `src/features/presence/services` owns presence subscriptions and exact
  correlation fields.
- `src/features/admin/api` and `/admin` use app-scoped global permissions;
  conversation-local roles do not grant global access.

## Verification

```bash
npm run validate
npm run build
npm run test:e2e:smoke
npm run test:e2e:admin
```

The smoke commands must fail on console errors or request failures. They do not
replace authenticated multi-service verification; that gate requires the real
Cassandra, Redis, Kafka and Elasticsearch services.
