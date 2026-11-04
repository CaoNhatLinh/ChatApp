# Conversation deep-link summary and queued realtime subscriptions — 2026-10-20

Status: implementation and controlled verification, not completion of C2/global
incoming calls or the full expansion roadmap. Docker remains explicitly deferred.
No database/provider/credential writes, commits or pushes were performed.

## Why this was required

The point-room frontend adapter mapped the raw conversation response, which has
no public DM peer or member projection. Opening a room outside the loaded first
directory page therefore lost the peer needed by direct calls and substituted
false pin/zero unread values. The same adapter refreshed already loaded rooms.

Use the existing canonical directory view, not a frontend profile lookup, a scan
through every directory page or another invented DM/profile response contract.

The new deep-link browser scenario also exposed a real queued-subscription race:
presence could already be opening the shared transport, while the realtime
adapter registered its restore listener only through its own connect method.
The call channel could subsequently send SYNC without a reply subscription.

## Files and behavior

- `canonical/conversation/ConversationBrowseService.java`: bounded point read,
  membership before private reads and before view hydration, same public peer,
  unread-read-pointer policy and member projection as the directory.
- `canonical/repository/CanonicalCqlStore.java`: reuse the exact activity-key
  prepared query for at most the pinned/unpinned pair. Ambiguous pin rows fail
  with conflict; no full directory scan, invented defaults or new schema.
- `canonical/controller/CanonicalConversationController.java`: authenticated
  `GET /api/conversations/{conversationId}/summary`, no-store. Existing raw-room
  endpoint is unchanged. Missing authority is 404, denied membership 403;
  missing/moving projection is a bounded-retry 409, storage errors propagate.
  Archived room summaries remain readable by members, not callable/sendable.
- `features/messenger/api/messenger.api.ts`: point adapter now maps that same
  canonical summary, rejects wrong room/invalid pin/unread shape and rejects the
  raw-room shape. No compatibility fallback.
- `shared/websocket/realtime-service.ts`: subscribers register connection
  restoration even without an explicit adapter connect call. Explicit connect
  restores once, and removing the final callback removes its directory entry so
  a later reconnect does not resurrect an empty subscription.
- `ConversationBrowseServiceTest`, `ConversationReadProjectionTest`,
  `ChatReadHttpSecurityTest`: actual member state, public peer fields, access
  revocation, missing/moving data, exact actor/key bindings, signed actor and
  no-store HTTP behavior. Database boundaries remain mocked.
- Frontend scripts: directory/point adapter and new realtime subscription model
  tests; call browser starts with an empty directory and an explicit DM deep
  link. Thread/workspace fixtures serve the new canonical summary shape.
  Call fixture replies target the originating websocket session, not whichever
  session was most recently assigned globally; retained frame assertions check
  reply subscription before any command. Recovery allows only same-call SYNC,
  never mutations/device acquisition merely from opening a room.
- `package.json`: runnable `test:realtime:subscriptions` command.
- OpenAPI, canonical API inventory, todo/testing/traceability: scope and limits.

## Verification

- JDK 20 `./mvnw.cmd -q test`: exit 0, 526 tests / 97 default suites, zero
  failures/errors/skips, counted from `TEST-*Test.xml`. Old opt-in missing-Docker
  reports are preserved and not represented as passing.
- Focused browse/projection/security suite: exit 0.
- `npm run validate`: exit 0 after final production changes. Later test-only
  edits also passed targeted ESLint.
- `npm run build`: exit 0 after final production changes, 17 routes.
- `conversation-directory-api-smoke.mjs`: 17 controlled assertions. The new
  summary scenario failed against the raw-room adapter before the fix.
- `realtime-subscriptions-smoke.mjs`: 11 controlled assertions. Queued restore
  initially failed; the first fix exposed empty-callback resurrection, now fixed.
- Call channel20 and active-call adapter15: pass with controlled transport.
- `call-browser-smoke.mjs`: 28 groups pass, production Chromium with controlled
  HTTP/STOMP and fake media; 320/768/1024/1440 light/dark plus custom captures.
- `thread-browser-smoke.mjs`: 19 groups pass on the final production build.
- `chat-workspace-ux-smoke.mjs`: 39 groups pass on the final production build,
  including filters/Ctrl+K/library/unread and four-width light/dark/custom-room
  inheritance. Body-text contrast checks returned 17.19 light / 17.56 dark.
  An earlier attempt exposed an unbounded test promise. That owned process/browser
  were explicitly stopped after inspection; the test now waits for a bounded
  request and waits for the reading viewport to settle before emitting the
  slow-read message. The stopped attempt is not counted as passing.
- `scripts/test-local-schema.ps1`: 83 tables / 716 columns / 2 UDTs; unchanged
  schema. `git diff --check`: pass.

Fresh call captures remain in `chatapp_frontend/artifacts/ui-audit/current/`:
`call-{light,dark}-{320,768,1024,1440}.png`, `call-custom-{320,1440}.png`, and
`call-recovered-{light,dark}-{320,768,1024,1440}.png`. Recovered light320 and
dark1440 were visually inspected: painted app chrome/panel, readable controls,
no horizontal overflow. The gray conversation canvas is controlled custom-room
artwork, not evidence of a provider image or a full-app theme audit.

## Still open

Follow-up: `tasks/conversation-entry-ux-verification-2026-10-20.md` subsequently
implements and controlled-tests the unknown-room summary failure/retry surface.
The limits below record the state at this report's original verification point.

Global incoming-call browser queue/UI, offline pending-call lookup, C3 history,
and actual Cassandra/broker/two-client/restart/media acceptance are not proven.
Unknown-room summary failure/retry UX still needs hardening before a global
incoming CTA can be considered complete. This slice establishes the correct
success-path data contract, not a finished global-call notification feature.
Media lifecycle, settings, email and moderation roadmap items remain unchanged.
