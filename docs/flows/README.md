# Flow documentation

`USER_FLOWS.md` contains the current cross-feature journeys. Add a Mermaid flow
or sequence document here when a workflow has meaningful branches, retries,
concurrency, reconnect, authorization, or external-provider behavior.

Every flow must include a stable flow identifier, linked feature identifiers,
actors, trigger, preconditions, success path, cancellation and failure/recovery
paths, state changes, data stores/topics, observability signals and test
evidence. Keep diagrams aligned with the actual Spring, Cassandra, Redis,
Kafka, Elasticsearch, Cloudinary and browser boundaries; never draw a system
that the implementation does not use.

Current detailed flows:

- [`FLOW-MESSAGE-001`](message-drafts.md): per-user/per-conversation browser
  draft ownership, edit isolation, reload, failed-send preservation and
  successful-send cleanup.
- [`FLOW-MESSAGE-002`](message-interactions.md): refresh-safe reactions, reads,
  pins and revision inspection.
- [`FLOW-POLL-001`](polls.md): poll creation, voting, close and recovery.
- [`FLOW-REALTIME-001` and `FLOW-DIRECTORY-001`](presence-and-large-directory.md):
  authorized viewport presence, multi-device expiry, reconnect boundaries and
  bounded room/conversation directory loading.
- [`FLOW-INVITE-001`](invites-and-join-approval.md): public preview isolation,
  authenticated viewer-state restoration, manager resolution and retry rules.
