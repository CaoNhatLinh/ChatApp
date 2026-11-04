# Incoming call discovery — C2

Date: 2026-10-22. Approved roadmap scope: C2 global incoming/reload discovery.
This is an additive canonical fresh-schema/API path, not a compatibility layer.

## Outcome and contract

An authenticated member can find currently ringing calls addressed to them
without enumerating their conversations. `GET /api/calls/incoming` accepts
`limit` (default 25, range 1..50) and an opaque `cursor`. It returns the canonical
page shape `{content: CallSnapshot[], nextCursor, hasNext}` with no-store.
Actor identity always comes from the authenticated security context.

The endpoint is a live discovery feed, not a historical snapshot. It returns
only current RINGING calls whose callee is the actor, fixed ringing deadline
has not passed, index deadline matches authority, and current slot still owns
that call. Recheck current active DM, both memberships and both block directions
through the existing lifecycle access policy. Missing/denied rooms are filtered;
datastore failure, unavailable authority and sustained contention are errors,
never an empty-success fallback. No caller-supplied user ID can change scope.
The reused active-call read can expire a call whose deadline passes during
hydration through the existing fenced CAS; discovery never starts or accepts one.

## Access path and crash boundary

`incoming_calls_by_user` has partition `callee_id` and ascending clustering tuple
`(ring_deadline, conversation_id, call_id)`. It stores discovery keys only, no
names, signals or copied state. Before every new-call claim, register this key
and existing cyclic repair work before the authority CAS. Failed index writes
must prevent the authority claim. Losing claims can leave false-positive keys;
reads always hydrate authority. Only claims prewrite this index; heartbeats,
acceptance and terminal changes do not need index mutation or deletion.

Ringing deadlines are fixed at server-created time plus 45 seconds and cannot be
renewed. Table TTL 86400 seconds is physical cleanup only. A pointer removed by
that TTL cannot represent an eligible call: a paused claim still carries its
original 45-second deadline. Older keys are outside a fresh lookup's deadline
range even if a late producer writes or commits them. No cleanup worker or
cross-partition LWT is required. This does not replace the non-TTL cyclic queue.

## Pagination and validation

Each request scans at most `limit` index rows and performs bounded point reads.
Cursor continuation uses the complete last-scanned tuple, including tied
deadlines, not the last matching call. Filtered pages may be empty with
`hasNext=true`; consumers must follow the cursor. A full raw page yields a
continuation even if the next request proves empty. No total count, offsets,
ALLOW FILTERING, raw driver paging state or per-room directory scan.

Versioned base64url cursor includes actor scope, the initial server-time lower
bound and full continuation tuple. Reject malformed/oversized/wrong-actor,
reserved UUIDs, submillisecond/invalid times, future or more-than-60-second-old initial lower bound and
continuations not strictly above that bound. Cursor content is not authorization;
even a forged same-actor cursor cannot bypass current authority checks.
Subsequent pages keep their original lower bound and recheck actual time for
eligibility; concurrent insertions are not promised a snapshot position.

## Acceptance

- Query binding proves single actor partition, deadline range/complete tuple,
  LOCAL_QUORUM and bounded LIMIT. Canonical schema includes the exact table/TTL.
- Index failure prevents authority CAS; successful/uncertain/retried claim has
  the discovery pointer before commit. No deletes can erase a competing attempt.
- Service tests cover caller/other-callee, accepted/terminal/expired, old-deadline
  retries, missing/uncommitted pointer, slot replacement, block/archive/denial,
  transient failure, equal-deadline continuation and invalid cursor/limit.
- Real MVC/security tests prove actor scope, schema/no-store and canonical errors.
- Frontend follow-up subscribes before lookup on protected entry/reconnect,
  follows filtered continuation, merges by canonical version/session and preserves
  local hide. Lookup failure is actionable, not interpreted as no calls.
- Live Cassandra/TTL/CQL/crash and two-client/broker acceptance remain unverified
  while Docker is deferred. No test fixture substitutes for those gates.

## Protected frontend consumer

The protected route shell registers its participant-private subscription before
handling connection readiness. After synchronous subscription restoration, a
microtask starts the incoming lookup. Reconnect starts a fresh traversal, not
the old cursor. Public routes, including a signed-in invite preview, do not mount
this consumer. No conversation enumeration or caller-supplied actor query.

The adapter requests 50 keys per page and validates the canonical page and every
callee-scoped RINGING snapshot before merging. Empty filtered pages continue.
One batch follows at most eight pages; an incomplete batch offers an explicit
continue control. Repeated cursors and a 128-cursor traversal guard produce an
actionable error, never successful absence. Retry clears the traversal and starts
from the head; a stale/expired cursor is not silently skipped.

Each refresh aborts its predecessor. Request identity, component lifetime,
actor and session-generation fences suppress old success and failure, even if a
transport ignores cancellation. HTTP and private STATE share the bounded inbox
merge: lower/equal versions, changed immutable identity, accepted-to-ringing and
terminal resurrection are rejected; local hide survives refresh and reconnect.
An omitted HTTP result does not erase a STATE: this feed is not a snapshot.

The inbox is memory-only and retains at most 128 distinct calls. Hide and terminal
protection last only while that entry is retained in the current session. A
lookup already in flight can finish after a socket disconnect; no reliable
offline delivery is implied. A terminal event missed during disconnection can
leave a notice until its fixed deadline. Opening always revalidates the actual
DM/active call before the member explicitly answers; no automatic media or END.

Checking, connection waiting, incomplete and error feedback use the same opaque
app-theme notice plane. An error preserves an existing ringing call and its open
action. Retry and local error dismissal do not mutate call authority. Successful
absence needs no notice, toast or focus change. These semantics do not establish
live two-client, datastore, broker or device acceptance.
