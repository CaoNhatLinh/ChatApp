# C3 frontend call-history boundary — 2026-10-23

## Scope and status

The frontend HTTP adapter now reads canonical own/DM month pages and exact
room/call detail. This is a data-boundary increment, **not connected member UI**
and not live Cassandra/broker/media acceptance. C3 remains unchecked.

Connected member-UI follow-up is recorded separately in
`call-history-ui-verification-2026-10-23.md`; the data-boundary checkpoint below
is historical, not a claim that the later UI is still absent.

## Changed files

- `chatapp_frontend/src/features/calls/api/call-history.api.ts`: typed participant,
  outcome, entry/page/query contracts; authenticated shared-client GETs, abort
  signals and no-store. Actor is used only to validate the response, never sent
  as an authorization query parameter. Request inputs are snapshotted before
  awaiting HTTP so subsequent caller changes cannot retarget validation.
- `chatapp_frontend/scripts/call-history-api-smoke.mjs`: executable controlled
  HTTP-boundary tests against the actual transpiled adapter.
- `chatapp_frontend/package.json`: `test:calls:history-api` command.
- This report, the C3 contract checkpoint and the C3 todo: evidence and remaining
  work; no API/schema/route changes in this increment.

## Boundary guarantees

- Validate nonreserved UUIDs before interpolating room/call paths, month syntax
  and lower bound, bounded opaque request cursors. Current-month eligibility
  remains server-owned rather than trusting a potentially wrong client clock.
- Accept only HTTP200, canonical finite pages of at most50, boolean continuation
  and exactly matching cursor/null semantics. Filtered-empty continuation is valid.
- Validate actor-relative direction, exact optional room/call scope and UTC month,
  positive safe-integer version, VOICE/VIDEO and all eight history outcomes.
- Validate real UTC timestamps, terminal/consent facts, chronology and exactly two
  authority-derived participant roles. Strip unknown fields, including potential
  signaling/provider metadata, rather than carrying raw response objects into UI.
- Preserve distinct MISSED versus UNANSWERED. ACCEPTED is consent, not media
  attendance. No duration, callback eligibility, profile or presence is invented.
- Keep same call UUID in different conversations distinct; no callId-only dedupe.
- Preserve transport/auth/abort errors unchanged; do not synthesize empty success.

## Verification

- Red: initial executable test failed because the adapter did not exist.
- Red: malformed-response checks failed before decoder implementation.
- Red: exact-detail tests failed before the detail reader existed.
- Red: mutating the caller query during an outstanding request failed before
  snapshotting request inputs.
- `npm run test:calls:history-api`: **111 checks pass**.
- `node scripts/incoming-calls-api-smoke.mjs`: **85 checks pass**.
- `node scripts/call-active-api-smoke.mjs`: **15 checks pass**.
- `npm run validate`: **pass**, full frontend type-check and lint, exit0 with no
  warnings in the final run. Initial targeted lint found one unsafe array
  destructuring warning; explicitly typed unknown participant inputs resolved it.
- `npm run build`: **pass**, Next16.3.3 production compile, TypeScript and17-page
  generation, exit0. No layout or route was added by this data-boundary increment.

The port is controlled in these tests. They do not start an HTTP backend, prove
datastore isolation, or substitute for rendered UI, actual auth or two-client calls.

## Next member surface: route/state matrix before layout edits

| Entry/scope | Reading states | Next real action |
|---|---|---|
| Chat-list header, own history (mobile and desktop) | Selected UTC month; loading; page; empty; error; continuation | Change month, retry or explicitly load next page |
| DM header menu, room history independent of current call-start eligibility | Same states, restricted to the selected DM | Read detail or change month; not an implied call-back permission |
| Selected historical call, same reading plane | Fresh detail; loading; forbidden/missing; error | Back to list or retry; no stacked mobile dialog |
| Actor/session, month or room changes; close/unmount | Invalidate prior data/requests | Abort and reject late success/error from old scope |
| Lost access/revalidation | Hide stale detail/content while checking authorization | Explicit retry or return to conversation |
| Bounded memory or repeated cursor | Incomplete-list feedback, not fake completion | Refresh current month; no automatic all-month scan |

The existing mobile rail already has six actions, so history should not add a
seventh bottom icon or be buried in an account-settings modal. Keep a single
protected-focus reading plane, opaque app-theme surfaces even with custom room
themes, VI/EN labels and honest consent facts. This entry plan is not implemented
or visually accepted yet.

Still open: resource/request ownership and session guards; list/detail UI;
keyboard/focus; mobile/light/dark/custom-room/VI/EN browser acceptance; real
Cassandra/broker/two-client/crash/restart/media tests (Docker deferred by user).
