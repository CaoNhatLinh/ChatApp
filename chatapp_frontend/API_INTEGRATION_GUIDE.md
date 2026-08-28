# API integration

The frontend consumes the canonical backend contract only. The authoritative
HTTP and STOMP definitions are:

- [`../docs/api/openapi.yaml`](../docs/api/openapi.yaml)
- [`../docs/api/asyncapi.yaml`](../docs/api/asyncapi.yaml)

Runtime client modules live under `src/features/*/api` and use the shared
`src/shared/api/apiClient.ts`. Authentication is handled by the auth store and
the rotating HttpOnly refresh cookie; application code does not persist access
tokens in local storage. A readable `novachat_session` cookie only prevents
anonymous startup from calling refresh; it cannot authenticate a request.

For local setup and verified commands, read [`INTEGRATION_GUIDE.md`](./INTEGRATION_GUIDE.md)
and [`../docs/TESTING.md`](../docs/TESTING.md).
