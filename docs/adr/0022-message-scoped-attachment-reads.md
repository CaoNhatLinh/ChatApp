# 0022 — Read attachment availability through the message boundary

Date: 2026-10-23. Status: implemented under controlled verification; live gates open.

## Context

The canonical message contains `hasAttachments`, not deliverable media URLs.
The former `/attachments` topic published raw send metadata before MESSAGE_SEND.
It could be discarded before the message existed, and its shape did not match
the frontend Attachment upload model. History had no hydration path.

## Decision

Use `GET /api/conversations/{conversationId}/messages/{messageId}/attachments`
with exact bucket, bounded limit and last-returned attachment UUID cursor. Check
current membership and message visibility first. Resolve each persisted reference
against its active READY asset, matching provider/key; use the asset original and
persisted READY SMALL thumbnail. Never reconstruct a URL from storageKey or trust
the send-time thumbnail. Missing/deleted/unready/mismatched assets return an
UNAVAILABLE item with no delivery URL. Datastore errors remain failures.

Remove the raw attachment topic producer/consumer/store mutator and its AsyncAPI
entry; MESSAGE_SEND's existing flag triggers the same message-scoped read used by
history. No parallel legacy payload decoder is maintained.

The frontend loads only visible attachment-bearing messages. A keyed reader owns
its request and page state (actor/session/room/bucket/message); it aborts on
unmount. Confirmed messages, including the sender's own messages, read server
availability. Only unconfirmed local sends can render their confirmed upload
metadata directly. No global/persistent private-media cache is introduced.

## Consequences and limits

There is one extra bounded reference read and per-asset authority/thumbnail read
for visible media messages. Performance/load acceptance still needs measurement.
Spoilers do not preload media before reveal. HTTP errors, empty references,
unavailable files and failed image decoding have distinct UI feedback. Existing
URLs remain point-in-time public provider URLs, not revocable signed downloads.

An empty attachment page is not a durable "message complete" guarantee. Current
message/reference writes can be interrupted; durable intents/reference/deletion
reconciliation remain M2. This decision neither repairs those writes nor proves
provider upload/delete/crash behavior. Schema is unchanged.

Evidence: `tasks/message-attachment-read-verification-2026-10-23.md`.
