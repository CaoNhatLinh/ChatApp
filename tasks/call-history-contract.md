# Direct-call history and participant facts — C3

Date: 2026-10-22. Approved feature-expansion scope; fresh canonical schema only.
This extends durable signaling history, not a media attendance/provider service.

Implementation checkpoint2026-10-23: immutable history repository/schema,
pre-claim producer, authorized own/room/detail HTTP API and controlled member
history UI are connected. Live datastore/broker/media acceptance remains open. Controlled
API evidence: `call-history-api-verification-2026-10-23.md`; producer prerequisite:
`call-history-producer-verification-2026-10-23.md`; decision: ADR0020.

Frontend HTTP boundary follow-up: own/room/detail readers and111 controlled
checks are implemented; `call-history-client-verification-2026-10-23.md` records
that increment and the pre-layout route/state matrix. Connected UI evidence is
separate: `call-history-ui-verification-2026-10-23.md` (19 reader groups,
17 controlled browser groups/33 reads,17 captures, two scoped review fixes resolved).

## User outcome and access

A signed-in member can page their own calls or a particular DM's calls for a
selected UTC month, then inspect the exact two historical participant roles and
consent timestamps. Require current actor membership in the existing DM and
actor identity among the call's exact caller/callee. A removed peer does not erase
the actor's own history. A removed actor cannot continue reading that room even
through the personal index. Missing rooms and non-DMs do not disclose call data.
Clients identify entries and compare versions by `(conversationId, callId)`,
never by callId alone, because different rooms can reuse a client call UUID.

Archived DM and blocks do not erase a currently authorized actor's own prior
history. History is not new contact: existing start/accept/active-call gates still
apply archive and block restrictions. Peer-account eligibility is a separate
contact policy, never inferred from readable history. This API grants no call permission,
presence or profile access, and no callback-eligibility promise. It returns IDs
and call facts only; existing member summary/profile contracts govern names.

## API

- `GET /api/calls/history?month=YYYY-MM&cursor&limit` — current actor only.
- `GET /api/conversations/{conversationId}/calls/history?month=YYYY-MM&cursor&limit`.
- `GET /api/conversations/{conversationId}/calls/{callId}/history` — exact detail.

All JSON, authenticated and no-store. Lists return canonical
`{content: Entry[], nextCursor, hasNext}`. Month is explicit, UTC,1970 through
the current UTC month; limit defaults25, range1..50. No room enumeration, global
scan, total count, offsets, raw driver cursor or automatic month search.

Entry fields: `conversationId`, `callId`, `callerId`, `calleeId`, `callType`,
`direction` (`INCOMING|OUTGOING`), `outcome`, `createdAt`, `acceptedAt`, `endedAt`,
`version` and `participants`. Outcome is `RINGING|ACCEPTED|CANCELLED|DECLINED|MISSED|
UNANSWERED|ENDED|FAILED`: authority MISSED becomes MISSED for the callee and
UNANSWERED for the caller. Cancel and decline remain distinct. ACCEPTED means
the callee consented; ENDED does not prove media connected or a talk duration.

Each of exactly two participants has `userId`, `role` (`CALLER|CALLEE`),
`initiatedAt` (caller only) and `acceptedAt` (callee only). No fake joined/left,
media duration, device, heartbeat/last-seen, SDP/ICE or provider room metadata.

## Durable access path

Replace the unused provider-shaped `calls_by_conversation` with immutable keys:
partition `(conversation_id, call_month)`, descending tuple `(started_at, call_id)`.
Replace unused `call_participants_by_call` with `calls_by_user`: partition
`(user_id, call_month)`, descending `(started_at, conversation_id, call_id)`.
`started_at` is the exact authority `startedOrder` timeuuid; month comes from
authority createdAt in UTC. Participants derive from authority, not a second
mutable participant source or a call-ID-only partition that can collide by room.

New-call claims prewrite the room key and BOTH participant keys before existing
incoming/work registration and authority CAS. Failed/partial prewrites cannot
commit authority. Losing/uncertain attempts may leave false-positive keys; reads
verify the exact authority room/call/start tuple, month and participant scope.
No state/name/timestamp copies, deletes, TTL or rewrite on heartbeat/terminal
changes. Prewrites have no side effects visible as a call without authority.
This targets fresh installs, not automatic backfill of existing volumes.

## Reads, cursors and failure

Hydrate at most `limit` raw keys from one partition. Filter missing/uncommitted,
wrong-identity/start/month, wrong-participant and no-longer-authorized hints.
Continue from the complete last scanned tuple, even for filtered-empty pages.
A full raw page can require one final empty request. Cursor is versioned,
actor/month/optional-room scoped and contains every tie key. Reject wrong scope,
oversized/malformed/noncanonical/reserved UUIDs and invalid/non-month timeuuid
before index access. Cursor content never grants authorization. This is a
changing feed, not a transactional snapshot.

Read latest authority. If a nonterminal deadline elapsed, use the existing fenced
expiry transition and bounded reread, never fabricate a terminal outcome locally.
Archive/block does not prevent that server-owned expiry. Missing/inconsistent
authority slot, datastore failure or sustained CAS contention remains an error,
not an empty-success fallback. List access denials are filtered; exact detail
returns canonical forbidden/not-found. No content from denied items is returned.

## Verification gates

- Test-first repository binding/order/limit/consistency and prewrite-before-CAS,
  partial failure, losing/uncertain retry and no mutation rewrites.
- Service own/room/detail scope, archive/block and removed actor/peer policies,
  exact immutable identity, all outcomes/roles, filtering and tied cursor pages.
- Actual MVC/security binding, JSON/no-store/error schemas and forged actor query.
- Canonical schema/static manifest, OpenAPI/contract/traceability parity.
- Frontend adapter, history/detail UI, VI/EN/theme/mobile/error/focus acceptance.
- Live CQL/conditional batches, two drivers, process-kill/restart, broker and real
  media acceptance remain open while Docker is deferred. Unit/query tests do not
  establish database performance, retention/capacity or provider connectivity.
