# ADR 0003: One canonical HTTP and realtime contract

Status: Accepted

## Decision

`docs/api/openapi.yaml` and `docs/api/asyncapi.yaml` are the source-controlled
contracts. Backend controllers, frontend feature APIs, and contract tests must
use these paths and payload semantics. No legacy alias or compatibility payload
is supported.

## Consequences

Route drift is caught in CI, cursor/bucket requirements remain explicit, and
realtime topics can be audited independently of implementation details.
