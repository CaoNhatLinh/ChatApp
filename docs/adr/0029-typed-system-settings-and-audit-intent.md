# ADR0029: Typed system settings with same-partition audit intent

Status: accepted for controlled A1/A2 implementation. Live engine/crash and full
page-leave/reload-persistent command acceptance remain open.

## Context and decision

The unused key/value settings table had neither revision nor audit consistency.
Only two keys are introduced: boolean `community.creationEnabled` (defaulttrue)
and integer `community.defaultMaxMembers` (default10000, bounds2..100000).
They have a real consumer in public-community creation. Existing rooms, DMs and
private groups are not retroactively modified. Creation reads at validation;
already in-flight creation is not a cross-partition revocation transaction.

The admin catalog/PUT require SYSTEM_OPERATE and no-store responses. No environment
secret, arbitrary key, role assignment or untyped JSON config editor is exposed.
Opaque UUID revisions fence writes; zero UUID denotes only a never-written default.
Persisted state with missing/zero revision or invalid metadata/value fails closed.

`system_settings_by_key` becomes one partition per allowlisted key with STATE,
COMMAND and PENDING rows. STATE CAS, immutable command snapshot/fingerprint/audit
event and pending export intent are one conditional same-table batch. Commands
bind actor, expected revision, canonical typed value and trimmed reason.
Stale writes do not commit any success audit. Exact replay does not reapply the
setting and returns the current authority (possibly newer than the receipt).

Audit export upserts the frozen event/month/ID and only then acknowledges pending
intent. A post-commit export failure returns auditPending=true. Recovery rotates
the finite catalog, reads at most25 cursor-scoped commands and retains failed
entries for a later wrap. This avoids a full-table scan and a separate discovery
pointer that could be lost. The admin-mutation command log has no automatic TTL;
retention/partition growth needs operational observation before broadening this
low-write catalog.

## Alternatives

- Timestamp revisions cannot reliably fence two writers and were rejected.
- Audit-before-CAS creates false successes; CAS then transient-only audit loses
  intent on crash. Neither is used.
- A generic settings framework/editor would expose unconsumed keys and secrets.
  The finite typed catalog is intentionally small.
- No migration of old volumes is performed. Fresh bootstrap now has84 tables,
  720 columns and2 UDTs/21 fields; CREATE IF NOT EXISTS does not upgrade old keys.

## Verification boundary

Statement consistency is LOCAL_QUORUM/LOCAL_SERIAL. Conditional batch design is
grounded in [Cassandra4.1 CQL](https://cassandra.apache.org/doc/4.1/cassandra/cql/dml.html#batch)
and the [installed driver4.19 batch API](https://apache.github.io/cassandra-java-driver/4.19.0/core/statements/batch/).
Controlled repository, service, recovery, consumer and MVC tests do not establish
real Cassandra CAS/crash/prepare behavior. Docker remains explicitly deferred.
No external provider or network secret is required. A2 now uses compact saved-value
rows and on-demand shared dialogs; the validated catalog/current receipt drives
the diagram, not a local draft. Conflicts preserve drafts, unknown acknowledgements
freeze the command, and closing the dialog retains it while mounted. Settings
Refresh reads the actual catalog and is disabled while drafts/uncertain saves
exist. Stable COMMUNITY_CREATION_DISABLED403 gives localized creation-policy
feedback without interpreting an English server message.

Controlled UI/adapter/browser evidence does not mark live gates complete. Drafts
and retry commands remain memory-only; native unload warning is not an app-wide
SPA route-leave guard.

The admin Back-to-app action now uses a route-owned context for per-editor
clear/draft/busy/uncertain state. Stay/Escape preserves memory-only drafts;
explicit Leave does not cancel or retry a dispatched command. Unknown-outcome
copy warns that the server may have committed. This avoids private router/history
patching and browser-storage admin reasons, but does not solve arbitrary browser
Back/Forward or recovery after reload/crash. Admin loading copy uses the root
locale context to keep initial hydration consistent; duplicate admin locale
providers are removed.

Contract: `tasks/system-settings-contract.md`. Evidence:
`tasks/system-settings-backend-verification-2026-10-23.md`.
UI evidence: `tasks/system-settings-ui-verification-2026-10-23.md`.
Exit evidence: `tasks/system-settings-exit-verification-2026-10-23.md`.
