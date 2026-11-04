# Durable direct-call lifecycle

Approved C1/C2/C3 scope: `feature-expansion-spec.md`, `plan.md`.
This contract precedes the C1 implementation; C2 transport and C3 history are
separate acceptance steps, not capabilities implied by tables or unit tests.

## Authority and consistency

One `call_state_by_conversation` partition contains a reserved zero-UUID slot row
and immutable-identity call rows. Clients may not use the reserved ID. Start
conditionally changes the empty slot and inserts the call in the same partition.
Every later mutation checks both slot and call revisions in one conditional batch.
Terminal transitions clear the slot in that batch. There is no cross-partition
claim that can be half acquired. Contention is bounded and returns conflict.

Identity is `(conversationId, callId, callerId, calleeId, callType)`. Reusing a call
ID with another identity conflicts; exact start retry returns its existing state,
including a terminal state, and never creates a second call. Only current members
of an active DM can start, with CALL_START and no block between the two users.
Other operations require a participant and current direct-room access. Cleanup
does not require a participant's continuing permission.
Acceptance, media signals and heartbeat also recheck the active room and both
authoritative block directions. Heartbeat cannot renew newly revoked access.

Contact-account follow-up (2026-10-23): start, nonterminal acceptance/heartbeat,
accepted media signals, existing active-call discovery and final STATE/SIGNAL
delivery also read both canonical user accounts through `UserRepository`.
Both must exist with ACTIVE status. Missing, suspended, banned, null or unknown
status fails closed with the same generic unavailable-participant denial;
account-store failure remains an unavailable error, not forbidden or empty.
This is a fresh point-in-time check, not an atomic user/call transaction or
instant remote-media revocation guarantee. Explicit participant END/LEAVE/FAIL,
server-owned expiry and authorized historical reads do not require the peer to
remain contact-eligible. Normal HTTP/STOMP authentication still rejects an
inactive acting account before that account can issue commands.

## States and time

| Before | Action | After |
| --- | --- | --- |
| RINGING | callee accepts | ACCEPTED |
| RINGING | caller leaves/ends | CANCELLED |
| RINGING | callee leaves/ends | DECLINED |
| RINGING | server deadline reached | MISSED |
| RINGING or ACCEPTED | participant reports failure | FAILED |
| ACCEPTED | either participant leaves/ends | ENDED |
| ACCEPTED | server heartbeat deadline reached | FAILED |

Ringing deadline is 45 seconds; caller heartbeat cannot extend it. After acceptance,
the lease is 90 seconds after the older participant heartbeat. A heartbeat cannot
keep the absent peer alive. At/after a deadline, expiration wins over a late action.
All times and revisions are server generated. Terminal calls cannot reopen.
ACCEPTED records consent/signaling only, never verified media connection or a
measured audio/video duration. Do not persist SDP, ICE, provider credentials or
media in the authority/history.

## Discovery and repair

Before every authority CAS (including terminal), prewrite PUBLISH and, if
nonterminal, EXPIRE work in 16 fixed conversation-derived shards. Each key includes
due time, room, call, revision and kind. The work retains expected slot revision
and a 30-second write deadline. Missing/superseded authority is removable only
after its expected slot changed or a post-deadline slot-fence CAS succeeds. A
paused producer cannot commit after that fence. The active slot ID is preserved.

The scheduled worker reads bounded pages and a durable CAS checkpoint per shard.
It wraps after exhaustion, so old/failed/behind-cursor work is revisited without
an hourly lookback or TTL. Failed rows remain but do not prevent cursor advancement.
Publication sends the current STATE then conditionally acknowledges its exact
revision/version. Failure retains work; duplicates and reordered versions are
allowed. This is latest-state broker handoff, not subscriber receipt or every
intermediate transition. See ADR 0018 for delete-heavy partition/load limitations.
Live Cassandra and crash-recovery acceptance remain unverified.

The existing history/participant projections are not authority. C3 must hydrate
their rows against the call state and provide bounded permission-scoped reads.
The C2 adapter/client now use this authority for active-DM call control. C1 remains
a prerequisite, not a claim that the shipping UI already has durable call history.

## C2 command boundary and connected transport

### Active-call point lookup

`GET /api/conversations/{conversationId}/calls/active` reads the current slot and
public authority without a caller-supplied call ID. Current membership is checked
even when no slot exists. Only active DM rooms and exact call participants are
eligible; existing calls recheck both block directions and peer membership.
Missing/archived rooms, denied reads and unavailable/inconsistent authority are
errors, never an empty-success fallback. A slot changed between reads is retried
at most four times. Overdue authority is expired through the same fenced mutation
path and its prewritten terminal publication, then the slot is read again.

`200` returns the same public View schema as STOMP; `204` has no body when no
active call remains. Both are no-store. This point-in-time read never initializes
a slot, accepts a call, acquires devices or proves media connectivity.

The frontend now reads it on active-DM entry and successful realtime reconnect,
aborts obsolete scope reads and preserves failures as inline retry, not absence.
Recovered RINGING callee state can be explicitly answered; other nonterminal
states are detached, with no peer/media auto-creation and no heartbeat claiming
media participation. They use SYNC for convergence. Explicit detached END waits
for terminal confirmation and retains an error/retry on uncertainty. Navigating
away from a merely viewed incoming/detached state does not send LEAVE or mark it
locally closed. Discovery does not replace a session already owned by this tab.
Global incoming discovery outside the active DM is still separate work.

`CallSignalingService` accepts START/JOIN/LEAVE/END/FAIL/HEARTBEAT/SYNC/SIGNAL
with `requestId`, conversation/call IDs and exact peer target. START also requires
VOICE/VIDEO. There is no caller-supplied provider or participant-count fiction.
The actor is supplied by the authenticated adapter, never by command payload.
`CallController` extracts it from the authenticated STOMP principal.

Every result echoes request/call scope and action. Accepted results contain a
public typed snapshot; rejection uses INVALID/FORBIDDEN/NOT_FOUND/CONFLICT or
UNAVAILABLE, never raw exception text or SDP/ICE. UNAVAILABLE may follow a committed
mutation and must remain uncertain: retry/sync the same call ID. Results are wired
to `/user/queue/call-results` with session-only replies. The typed browser channel
matches request/action/room/call and validates participant/type/state shape, with
64 in-flight requests and a 10-second acknowledgment timeout. It is memory-only.

Snapshots include a monotonic per-call `version` (initial 1, incremented with the
same authority CAS) and opaque revision. Duplicate actions do not increment;
late state events must not regress clients. Controls emit actorless STATE events;
only a RINGING snapshot addressed to the callee can open an incoming prompt.
Terminal replay cannot invite again. SYNC reads authority and repairs handoff only
if its receipt is pending, without a new transition. Broker failure cannot roll
back committed state. The scheduled worker retries pending latest-state handoff.

SDP/ICE is permitted only for an accepted call, current active DM membership,
both block directions and the exact authority peer. Caller sends offer; callee
sends answer. SDP is limited to 65536 characters, ICE candidate to 8192 and
metadata to declared bounded types. Undeclared fields are removed from relay
payloads. Neither the payload nor exception text is persisted/logged by this
service. A signal racing with a terminal mutation is not an atomic media
transaction; the client must ignore data for an obsolete/closed session.

## Participant-private state handoff prerequisite

The backend also hands STATE to `/user/queue/calls` for both exact participants,
using their authenticated immutable user-ID destination names. It contains no
SDP/ICE. The originating-session `/user/queue/call-results` stays distinct.
Receipt advances only after room/caller/callee handoffs return; partial failure
retains recovery work and may duplicate earlier handoffs on retry.

Fresh internal SIMP metadata accompanies room STATE/SIGNAL and private STATE;
it is not client/native metadata or extra JSON fields. Outbound delivery requires
that scope and rereads authority, participants, active DM access, current membership,
both block directions and deadline. STATE requires matching revision; accepted
SIGNAL can survive a heartbeat-only revision but not terminal state. Wrong room,
missing metadata, denied or unavailable authority fail closed. Private SIGNAL
is rejected. Client SEND to raw/user broker queues is not allowed.

The protected client now has a bounded memory-only incoming reminder outside
the active DM; its local controlled evidence is recorded separately in
`incoming-call-ui-verification-2026-10-22.md`. Current simple-broker user
registries are node-local. This queue alone is not offline delivery or a durable
list of missed calls. Live multi-client/multi-node/authorization-race acceptance
remains open.

## Callee-scoped incoming discovery

`GET /api/calls/incoming` adds an authenticated, no-store JSON page of currently
ringing calls for the current callee. It scans one bounded deadline-ordered index
page, then reuses the active-call authority/access read. Full tuple continuation
follows scanned rows, including filtered-empty pages; cursor scope/time/shape
and the 1..50 limit are validated before repository access. Store/invariant
failure and contention remain errors, not empty results.

The canonical fresh schema's `incoming_calls_by_user` contains only callee,
fixed ringing deadline, room and call keys. Claim prewrites it before existing
cyclic recovery work and authority CAS. No heartbeats or terminal transitions
rewrite/delete it. The physical 24-hour TTL cannot hide a valid 45-second
ringing call under the fixed-deadline/server-time invariant. This index does not
replace the non-TTL repair queue or record call history. ADR0019 and
`incoming-call-discovery-contract.md` define the reasoning and complete contract.

Backend repository/service/MVC/security tests are connected. The protected
frontend now registers private STATE before entry/reconnect lookup, follows
filtered pages in bounded batches, rejects stale requests/cursor cycles and
shares the versioned inbox merge while preserving local hide. Local failure is
retryable and dismissible without hiding a known ringing call or sending a
command. See `incoming-call-client-verification-2026-10-22.md`; live
Cassandra/TTL/crash/broker/media acceptance remains a separate unfinished gate.

## Verification gates

Policy transitions and authorization, exact replay, contention, expiry-before-late
accept, stale lease fencing, same-partition CQL bindings and schema guards must be
tested. Live conditional-batch parsing/semantics, competing real clients, restart
and process-kill acceptance require Cassandra/Docker; the user deferred Docker.

Sources: [Cassandra 4.1 DML](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html#batch)
describes conditional updates/Paxos and single-partition batch isolation. These
are the design basis, not evidence that this implementation passed live tests.
