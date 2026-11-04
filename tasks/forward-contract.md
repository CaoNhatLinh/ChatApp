# Forward provenance contract

Approved scope: F1/F2 in `feature-expansion-spec.md`. Immediate source only;
never recursively disclose an earlier source or enumerate destination rooms.

## Send boundary

Existing message POST carries all three `forwardedFrom*` keys and an exact
snapshot payload. Server validates the complete timeuuid/bucket key, current
source membership, source existence/non-deletion and sender block state before
identity allocation. Content/type/format/sticker/GIF and attachment metadata must
match authority, otherwise409; a client cannot invent attributed content.
The server materializes content from the verified source, strips reply/mention
semantics, and retains only the immediate source key internally. POLL/SYSTEM
forwarding has no runtime copy contract and is rejected, not rendered as working.
Forwarded messages cannot be edited to change their attributed content.

An identical committed retry uses the existing target message before mutable
source checks. Uncommitted retry must still validate the frozen request snapshot;
an edited/deleted source cannot silently produce a different body with the same
client command. Existing claim + message authority is reused; no new schema.

Attachments are bounded (at most50), compared to source authority, and rechecked
against ready/active asset metadata; forwarding does not grant arbitrary upload
ownership. Destination attachment IDs must remain unique. The normal upload send
path retains owner-only validation.

## Read boundary

Ordinary HTTP/history/search/thread and shared realtime expose only `forwarded`
boolean, never source conversation/bucket/message IDs. A later actor-authorized
point endpoint may return an accessible immediate source; absent membership,
deleted/blocked source and missing source have the same unavailable response.
No source room name, user profile or retained content is returned when unavailable.
The copied destination snapshot remains part of destination history; source
revocation removes source navigation, not a promise to retract the copy.

## Verification matrix

Full/partial/malformed source keys; spoofed body/type/GIF/sticker/attachments;
outsider/blocked/deleted source; target send denial/archive; no allocation on
invalid source; idempotent committed retry after source deletion; frozen snapshot
conflict after uncommitted source edit; no source keys in HTTP or STOMP; forward
edit rejection; bounded authority hydration and unavailable source reads.

This contract file is not completion evidence. F1/F2 stay open until implemented
and verified; live Cassandra/two-client gates remain separately open.
