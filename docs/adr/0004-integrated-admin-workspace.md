# ADR 0004: Integrate the admin workspace into the existing apps

## Status

Accepted

## Context

NovaChat already has one Spring Boot backend (`chat-service`) and one web client
(`chatapp_frontend`). A separate admin project would duplicate authentication,
authorization, API contracts, design tokens and deployment pipelines before the
admin domain has a separate scaling or compliance boundary.

## Decision

Keep admin as a protected vertical slice in the existing projects:

- Backend owns `/api/admin/**`, permission evaluation, validation, audit/outbox
  records and all authoritative mutations.
- Frontend exposes `/admin` with the same App Router/React shell, but gates the
  page from `GET /api/admin/overview`; the browser never treats a decoded JWT as
  proof of admin access.
- The first real UI manages capability overview, runtime health, a bounded
  whole-app room directory with policy/archive actions, user search,
  application role grant/revoke, report queue/resolution and sanctions. Every
  mutation requires a reason and is recorded in the audit timeline.
- Language moderation, appeals, long-range analytics/SLO dashboards,
  investigation and bounded export are future admin modules. The bounded daily
  analytics panel is implemented; remaining modules stay within the same
  projects and are not represented by fake buttons or success states.

## Consequences

This keeps one session and contract surface, makes audit/security enforcement
central, and reduces deployment cost. Conversation roles remain room-local and
must not be used as a substitute for global operator permission. If a later requirement introduces a
separate operator identity provider, network boundary, or independent release
cadence, the `/api/admin` contract can be extracted behind a dedicated admin
frontend without changing end-user APIs.
