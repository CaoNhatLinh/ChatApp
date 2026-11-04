# Conversation preview authority — 2026-10-23

## Problem reproduced

Two new actual-service tests failed against the prior implementation: a current
edit returned the retained projection text, and a deleted authority still exposed
that text and the old attachment affordance. The frontend adapter also failed a
new test because it dropped summary revision7. These were observed failures, not
assumptions inferred from green tests.

## Implemented

- The canonical `message_summary` UDT now carries `message_bucket`. The writer
  copies the exact committed message key; it does not guess a shard from ID/time.
- Projection mapping retains that key. After checking current membership,
  directory and point-summary reads hydrate their referenced message through
  `MessageRepository.find`, already LOCAL_QUORUM. There is one additional exact
  message read per nonempty preview, within the existing capped page scan; no
  scan of 16 shards or unbounded history traversal.
- Preview content/type/deletion/attachment state/revision come from authority,
  not the retained UDT content. Preview remains limited to280 characters. A
  tombstone exposes empty content and no attachment affordance. A missing source
  fails409 instead of returning retained private content; a missing bucket is an
  invariant failure, not a legacy scan/fallback.
- `LastMessageSummary` and OpenAPI require `messageBucket` and canonical integer
  `revision`. The frontend validates/retains revision for both list and point
  reads using the same validator as message snapshots. Local optimistic preview
  types remain distinct from network contracts.

## Changed files and reasons

- `chat_app_complete.cql`: canonical message-summary source key.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/repository/CanonicalCqlStore.java`:
  write and map the exact bucket, extending the internal projection record.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/conversation/ConversationBrowseService.java`:
  authorize, hydrate current preview authority, redact and bound output.
- `chat-service/src/main/java/com/chatapp/chat_service/canonical/dto/CanonicalApiContracts.java`
  and `docs/api/openapi.yaml`: public source key/revision contract.
- `chat-service/src/test/java/com/chatapp/chat_service/canonical/conversation/{ConversationBrowseServiceTest,ConversationReadProjectionTest,ChatReadHttpSecurityTest}.java`:
  current edit/deletion, list/point parity, exact query budget/key, writer/reader,
  missing source, bounded text and actual authenticated MVC JSON coverage.
- `chatapp_frontend/src/features/messenger/api/messenger.api.ts` and
  `src/features/messenger/types/messenger.types.ts`: consume versioned summaries.
- `chatapp_frontend/scripts/conversation-directory-api-smoke.mjs`: list/point
  retention and invalid/missing revision rejection.
- `chatapp_frontend/scripts/message-edit-smoke.mjs`: versioned directory/point
  fixtures and persisted edited-content assertion after browser reload.
- `chatapp_frontend/scripts/visual-audit-capture.mjs`: explicit canonical summary
  key/revision in its controlled fixture.
- `scripts/test-local-schema.ps1`: require all21 UDT fields including the new key.

## Verification

- `$env:JAVA_HOME='C:/Program Files/Java/jdk-20'; ./mvnw.cmd -q test`: exit0;
  **747 tests,120 fresh suites,0 failures/errors/skips**. XML reports from this
  invocation span12:50:11–12:50:44 +07:00; old opt-in IT XML is excluded.
- `./scripts/test-local-schema.ps1`: pass;84 tables/714 table columns/2 UDTs,
  now21 UDT fields. This parses/checks schema, not a live CQL execution.
- Frontend `npm run validate` and `npm run build`: pass.
- `node scripts/conversation-directory-api-smoke.mjs`:20 controlled groups pass.
- `node scripts/message-revision-order-smoke.mjs`:14 actual-source groups pass.
- Production Chromium `message-edit-smoke.mjs`: edit/cancel/history and reload
  pass; no reported console/request failures. Canonical HTTP is controlled.
- Production Chromium `chat-workspace-ux-smoke.mjs`:39 groups pass across
  320/768/1024/1440, light/dark and room overrides; controlled HTTP/STOMP, not a
  real Cassandra/broker/two-client run. This increment changes no visual layout.
- `git diff --check`: pass, existing CRLF notices only.

## Schema and acceptance limits

This updates the **fresh canonical bootstrap** used on the user's new machine.
Running `CREATE TYPE IF NOT EXISTS` against an already-existing old UDT does not
add fields. The existing read-only startup schema guard will reject that mismatch;
no migration, volume reset, data deletion or Docker setup was performed. Do not
claim old populated installations were upgraded by this change.

Hydration proves freshness for the referenced message, not that a delayed/lost
directory projection always references the globally newest message. Durable
projection ordering/completion, stale/missing pointer repair and real concurrency
remain open. One quorum lookup per preview adds bounded query cost; live page
latency/load is not yet measured. Sender display name/activity/unread still use
their existing projection/member policies, not a fabricated global snapshot.

The user deferred Docker. Live schema/Cassandra/provider/broker/two-client/crash
gates remain unchecked. No secrets, external services or configuration changed.
