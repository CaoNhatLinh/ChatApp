# Retry unavailable message pin state

## Behavior and structure

Previously initial/reconnect pin GET failure was debug-only; attempting to pin
later instructed the user to reopen the conversation. The active conversation
now has a quiet in-flow status row with VI/EN loading, error and Retry. The row
disappears after a validated snapshot is applied. Pending Retry is disabled;
there is no automatic retry loop, toast or optimistic revision-zero fallback.

- `chatapp_frontend/src/features/messenger/model/useMessagePinSync.ts`: owns
  initial/reconnect/retry GET, coalesces concurrent triggers, aborts on cleanup
  and ignores late results. Calls the existing strict adapter and monotonic store.
- `chatapp_frontend/src/widgets/chat-window/components/MessagePinSync.tsx`:
  semantic status row using existing theme tokens and Button loading state.
- `ChatWindow.tsx`: mounts one sync component keyed by user and conversation.
- `useMessenger.ts`: retains realtime snapshot subscription, removes its old
  duplicate HTTP/reconnect lookup. Retry does not replay a failed mutation.
- `messengerCopy.ts` and i18n resources: action-time guidance now points to Retry;
  loading/error copy has both Vietnamese and English.
- `scripts/message-pin-sync-smoke.mjs` and package command
  `npm run test:messages:pin-sync`: actual installed React/DOM mounts the real
  hook with controlled transport/store/reconnect boundaries, no extra dependency.
- `scripts/message-interactions-smoke.mjs`: opt-in `PIN_LOOKUP_RECOVERY=1`
  exercises repeated failure, deferred retry, recovery and subsequent commands.

## Observed verification

- Before implementation: recovery browser timed out waiting for error/retry UI
  after an explicitly malformed initial pin snapshot. This reproduced the gap.
- `npm run validate`: type-check and lint pass; production `npm run build` pass.
- Actual React hook test: **4 groups** pass, covering eager reconnect callback
  deduplication, repeated error/retry/loading, concurrent refresh coalescing,
  abort/old-room late-result exclusion and listener/unmount cleanup.
- Existing strict pin adapter **6** and actual store/revision **18** groups pass.
- Locale-copy check: **1248 keys**, none missing in its checked scope. Dynamic
  loading/error literals also have explicit VI/EN resource entries.
- Production interaction recovery: two invalid snapshots, two explicit retries,
  pending button disabled, successful state hides feedback; pin POST expected0,
  unpin DELETE expected1, reactions, receipts, mention/reply and reload pass.
  Four pin GETs across this full scenario: initial + two retries + normal reload.
- Feedback fits at **320/768/1024/1440**, light and dark. Screenshots:
  `chatapp_frontend/artifacts/ui-audit/current/message-pin-retry-{theme}-{width}.png`.
  Dark320 and light1440 visually inspected. No reported browser console/request
  errors in the full production interaction scenario.
- Production workspace regression **42 groups** passes, including controlled
  HTTP/STOMP pin ordering, shared library and all eight width/theme cases.
- Test harness initially attempted unavailable `esbuild`; it was replaced with
  the existing TypeScript transpiler and installed React production modules.
  No dependency was installed or added.

## Limits

All transport/broker data in these checks is controlled. Real Cassandra/broker/
two-client/crash acceptance stays deferred with Docker; no database/provider
change was made. HTTP refresh can still fail repeatedly and requires explicit
Retry or reconnect. Existing observed-revision conflict protection remains;
this is not durable publication, lost-event replay or pin-slot deletion repair.
No backend source changed in this increment; its previous774-test baseline was
not rerun as a substitute for the frontend lifecycle/browser evidence above.
No commit or push performed.
