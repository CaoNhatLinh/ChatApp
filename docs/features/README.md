# Feature documentation

`FEATURE_INVENTORY.md` is the canonical index of every product and system
capability. Add a domain-specific document here only when a feature needs more
detail than the inventory row can carry (for example, an authorization matrix,
state machine, or provider failure contract).

Each document should link back to the stable inventory identifier and describe
purpose, actors, preconditions, states, permissions, persistence, events,
failure/recovery behavior, acceptance criteria and verification evidence. Do not
copy route or status definitions into a second source of truth; link to
`api/openapi.yaml`, `api/asyncapi.yaml` and the relevant ADR instead.
