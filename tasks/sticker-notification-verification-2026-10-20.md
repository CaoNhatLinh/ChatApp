# Sticker notification previews — 2026-10-20

## Scope and changes

- `chat-service/src/main/java/com/chatapp/chat_service/canonical/message/MessageService.java`: sticker notification preview is `Sticker`, not empty message content; action payload includes canonical `messageType`. No additional lookup/query or artwork URL.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/message/MessageServiceTest.java`: two regression cases distinguish sticker notification metadata/preview from user-authored TEXT saying `Sticker`.
- `chatapp_frontend/src/features/notifications/model/notification-copy.ts`: MESSAGE/MENTION sticker preview is localized using structured metadata; sender names and user content remain intact. An empty server-redacted body remains empty.
- `chatapp_frontend/scripts/notification-copy-smoke.mjs`, `package.json`: executable eight-concept production copy-model checks for VI/EN, mention, unmodified text/sender, unrelated system types, join decisions and redacted body.
- `docs/api/openapi.yaml`, `docs/flows/sticker-catalog.md`, `tasks/todo.md`: metadata/redaction contract and precise acceptance status.

No database/schema, provider credentials, email content, UI layout or reference-image redesign changed. Generic bilingual email templates do not expose private message text/artwork.

## Evidence

Before the fix, two backend notification assertions failed against actual generated notifications: sticker body empty and messageType absent. Frontend sticker-copy assertion failed. Review then found that metadata-based copy could reconstruct a server-redacted preview; its regression test failed before the nonempty-body guard.

- JDK 20 `./mvnw.cmd -q test`: exit 0; XML totals 345 tests across 70 suites, failures/errors/skips all 0. MessageServiceTest: 28 tests, all pass. The run also emits warning logs; a green suite is not evidence of live infrastructure.
- `npm run test:notifications:copy`: exit 0, eight reported concepts, production pure function with controlled inputs.
- `npm run validate`: exit 0 (TypeScript/ESLint); final production build also checks TypeScript after the redaction guard.
- `npm run build`: exit 0, Next.js 16.3.3, 17 routes generated.
- `git diff --check`: checked after documentation update; no whitespace errors.

Self-review covered correctness, ownership/readability, security/redaction and constant-time performance. No second agent was started while critique permission is pending; this is not an independent UI critique.

## Still not proven

Notification drawer/realtime rendering with a real second client, actual datastore/provider delivery and broader S5 stale/cursor/browser gates remain unverified. Pure-model/JUnit checks are not live end-to-end evidence. No new screenshots are claimed for this copy/data-only slice; no commit/push or external provider call.
