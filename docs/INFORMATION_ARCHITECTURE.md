# Information architecture

Public: `/`, `/about`, `/help`, `/privacy`, `/terms`, `/join/:token`.

Authenticated: `/app` (messenger), `/friends`, `/settings`, `/search`,
`/profile`, `/admin` (server-authorized admin workspace).
The global `/admin` surface is a native App Router route with a client feature
island. Supported public/authenticated routes use the same native entry pattern;
all feature navigation uses Next App Router APIs and no BrowserRouter
compatibility layer remains.

Cross-cutting surfaces: auth provider, theme provider, presence manager,
notification panel, conversation shell, message composer, and error/loading/
empty states. Each listed URL is a native `src/app/**/page.tsx` entry; client
feature components are mounted through the shared native route shell. The root
layout owns the bilingual provider so recovery pages use the same locale state.

Admin IA: capability overview -> runtime health -> global room directory (monthly
partition) → room policy/archive moderation → report queue/resolution and sanctions
→ monthly audit timeline → user directory search → app-role assignment/revocation
→ bounded daily analytics and monthly bounded audit CSV export. Long-range
analytics/SLO, language moderation and appeals remain planned modules and must
not be represented by fake controls. Conversation roles remain room-local and are never treated as global
admin permissions.
