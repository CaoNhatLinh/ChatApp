# ADR0028: Release deleted pins with version-fenced repair

Status: accepted for controlled implementation; live acceptance open.

## Context

Messages and the bounded conversation pin aggregate occupy different Cassandra
partitions. A tombstone could leave a pin slot occupied. A pin admitted while
the message was live could commit after deletion's cleanup read. The public
content revision and pin revision remain independent (ADR0024/0027).

## Decision

Deletion and idempotent deletion retry release pins using a fresh canonical pin
snapshot and the existing same-partition revision/generation CAS. Cleanup may
re-observe at most five times, and only with an irreversible tombstone as proof.
Ordinary user unpin intents still never silently replay against a new revision.
Non-conflict storage errors propagate; no fabricated version-zero state exists.

The pin command re-reads message authority after committing. If deletion is then
visible, it releases the pin, publishes only the cleanup snapshot and returns
conflict rather than a pinned success. If deletion happens after that re-read,
the deletion path releases the pin; delayed pin HTTP/events cannot supersede
newer pin/content versions on the client.

The member snapshot endpoint checks at most five pinned references. Proven
tombstones trigger the same cleanup and a fresh final snapshot. A missing row
does not prove deletion and is never destructively interpreted as such. This
bounded read repair requires membership, not permission to pin a live message.
It cannot remove live pins. It lets later entry/reconnect recover interrupted
cleanup without scanning tables or requiring the original sender to return.

Tombstone read/write explicitly use LOCAL_QUORUM; deletion CAS uses LOCAL_SERIAL.
These are statement attributes on the installed Apache Java Driver4.19.0; setter
results are chained because statements are immutable. See the
[official statement API guidance](https://apache.github.io/cassandra-java-driver/4.19.0/core/statements/#statements).
The existing conditional pin mutation remains the sole slot write authority.

## Alternatives and limits

- Unconditional slot deletion can remove another message/reused generation and
  was rejected.
- Hiding a tombstone in the UI without releasing capacity does not repair data.
- A logged batch does not provide this cross-partition CAS protocol. No such
  atomicity or exactly-once publication claim is made.

There is no background durable deletion/pin-completion intent yet. A crash after
commit can still lose audit/search/realtime publication; read repair recovers
slot state when the endpoint is used, not every lost event. Existing message pin
flag projection can still lag. Real CQL/two-client/crash acceptance is deferred
with Docker. Controlled interleavings are not a replacement for those gates.

Evidence: `tasks/deleted-message-pin-verification-2026-10-23.md`.
