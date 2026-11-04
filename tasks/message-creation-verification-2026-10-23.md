# Conditional message creation — 2026-10-23

## Outcome and scope

The initial authority write now uses `createIfAbsent`, backed by one conditional
INSERT with LOCAL_QUORUM/LOCAL_SERIAL and the actual applied outcome. A delayed
creator cannot use that operation to reset a logically deleted/edited existing
row or its revision. The losing service worker reads current authority, repairs
permitted references and returns the public current view, not its stale draft.

The client-command claim and authority creation are distinct. A worker resuming
another worker's claim can win authority creation; it now performs the initial
projection/publication work. Conversely, owning the earlier claim does not allow
a worker losing creation to repeat those effects. Missing authority after an
unapplied create conflicts; unknown storage outcomes propagate without fallback.

This is controlled verification, not a live Cassandra concurrency/crash pass.
ADR0023 records the design and partially supersedes the old reply/forward logged
creation-batch decision. The existing repair protocol remains; no schema changes.

## Changed files

Java paths relative to `chat-service/src`:

- `main/java/com/chatapp/chat_service/canonical/message/MessageRepository.java`:
  replace void overwrite-style save with explicit create-if-absent result.
- `main/java/com/chatapp/chat_service/canonical/message/CassandraMessageRepository.java`:
  single authority IF NOT EXISTS and applied outcome; no implicit projection batch.
- `main/java/com/chatapp/chat_service/canonical/message/MessageService.java`:
  creator/loser branches, current-row return, explicit projection repair and
  actual-creator first-send effects.
- `test/java/com/chatapp/chat_service/canonical/message/MessageCreation{Repository,Service}Test.java`:
  dedicated query/outcome and service interleaving/error tests.
- `test/java/com/chatapp/chat_service/canonical/message/MessageServiceTest.java`:
  existing send/replay fixtures and assertions use the new boolean contract;
  the prior interrupted-reference fixture returns applied success when storing
  its first authority. New creation tests were extracted rather than growing
  this already-large suite further.
- `test/java/com/chatapp/chat_service/canonical/message/Message{Reply,Forward,Gif}RepositoryTest.java`:
  conditional creation binding plus explicit deterministic index repair; obsolete
  cross-row create-batch assertions are replaced with the new documented contract.
- `test/java/com/chatapp/chat_service/canonical/conversation/ChatReadCassandraIT.java`:
  seed authority/projections explicitly, add real two-client create-once followed
  by delayed create after edit/delete and retained revision check. **Compiled,
  not executed** because Docker is deferred. No Docker/host database probe.
- ADR0023, partial-supersession notes in ADR0015/0016, OpenAPI send description,
  TODO/testing/traceability and this report: architecture and acceptance boundary.

No frontend/provider/configuration/dependency/schema changes, commit or push.
No existing user data was deleted or migrated. No old `save(CanonicalMessage)`
compatibility wrapper remains; compilation/search cover its callers.

## Verification

1. New repository regression initially had an incomplete fixture timestamp; after
   fixing the fixture, it failed specifically because the real prepared INSERT
   did not contain IF NOT EXISTS. This is the meaningful pre-fix failure.
2. The renamed contract exposed old opt-in IT fixture callers during compilation;
   updated them to explicit creation and projection setup, not a legacy alias.
3. Dedicated service5 and repository2 tests pass. They cover losing the authority
   after losing the claim, losing authority despite winning the claim, preserving
   edited/deleted authority, missing authority after an unapplied create,
   ambiguous failure/no overwrite fallback and a recovered claim's actual creator.
4. Repository tests assert exact conditional query, applied outcome, local serial /
   normal consistency, one authority statement and no projection batch. Reply /
   forward tests verify stable repair bindings after creation.
5. Final focused run: creation service5 + creation repository2 + existing message
   service46 + reply1 + forward1 + GIF1 = **56 tests pass**.
6. Final `./mvnw.cmd -q test` on the final production/test/OpenAPI source:
   **731 tests / 118 fresh suites, zero failures/errors/skips**. Report aggregation
   uses only XML modified after this invocation started, excluding stale IT output.
7. `git diff --check`: pass, incumbent CRLF notices only. Searches find no old
   message repository save signature/call in runtime or the adapted message/IT tests.

Java uses process-local `JAVA_HOME=C:/Program Files/Java/jdk-20`. Default Maven
compiles the opt-in test source but does not run the Cassandra IT profile. No
frontend build/browser/screenshots are claimed for this backend-only increment.

## Five-axis review

- Correctness: a failed conditional creation cannot overwrite fields; service
  does not treat client-claim ownership as proof that it created the authority.
  Unknown outcome remains an error. Current deletion is publicly redacted.
- Readability: explicit create name/outcome and dedicated creation tests, no
  compatibility overload or generic transaction framework.
- Architecture: authority in the message partition, projections are explicit
  repairable writes. Their former shared logged-create guarantee is superseded,
  not silently retained in documentation.
- Security: existing permission, membership, archive, chat policy, fingerprint and
  source validation ordering remains; no extra source keys or credentials exposed.
- Performance: one extra LWT per new authority, plus a point read after losing.
  No unbounded retries/scans. Latency/load and multi-datacenter acceptance unmeasured.

## Remaining work

There is a crash window between authority creation and projection/reference/
mention/audit/notification/realtime completion. Exact retries repair only the
currently supported index/reference subset; a durable completion/outbox protocol
is still required. No exactly-once cross-system or provider lifecycle claim.

A later edit/delete can also occur after a creator's authority write but before
it publishes its original snapshot. Preventing stale event/UI rollback requires
message revision/event ordering and durable publication work, not another
unconditional row rewrite. This remains tracked with send completion.

The added real two-client IT must still run after the user installs Docker.
Process-kill/restart, CAS ambiguity, physical purge/TTL late replay and provider
acceptance remain unproven. Full roadmap remains active/incomplete.
