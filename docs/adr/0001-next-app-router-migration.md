# ADR 0001: Next.js App Router as the frontend runtime

Status: Accepted (native route migration complete)

## Decision

Use Next.js 16 App Router as the supported dev/build/start runtime. Native
entries now cover every supported URL, including `/admin` and `/join/[token]`,
and mount the interactive feature tree through an explicit client shell. All
feature navigation uses Next App Router APIs; the removed optional catch-all and
the old BrowserRouter runtime are not supported.

## Consequences

The build is Next-native, metadata is server-owned, and client-only browser APIs
remain isolated. There is no secondary build or compatibility runtime.
