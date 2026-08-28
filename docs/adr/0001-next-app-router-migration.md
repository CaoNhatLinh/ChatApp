# ADR 0001: Next.js App Router as the frontend runtime

Status: Accepted (native route migration complete; client navigation decomposition in progress)

## Decision

Use Next.js 16 App Router as the supported dev/build/start runtime. Native
entries now cover every supported URL, including `/admin` and `/join/[token]`,
and mount the existing interactive feature tree through an explicit client shell.
This preserves deep links while the final slice decomposes BrowserRouter hooks
from feature components; the removed optional catch-all is not a supported
runtime.

## Consequences

The build is Next-native, metadata is server-owned, and client-only browser APIs
remain isolated. There is no secondary build or compatibility runtime.
