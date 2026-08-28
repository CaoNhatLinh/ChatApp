# Information architecture

Public: `/`, `/about`, `/help`, `/privacy`, `/terms`, `/join/:token`.

Authenticated: `/app` (messenger), `/friends`, `/settings`, `/search`,
`/profile`, `/admin` (server-authorized admin workspace).
The global `/admin` surface is a native App Router route with a client feature
island. Supported public/authenticated routes use the same native entry pattern;
BrowserRouter remains only inside the current interactive feature shell until
its navigation hooks are decomposed.

Cross-cutting surfaces: auth provider, theme provider, presence manager,
notification panel, conversation shell, message composer, and error/loading/
empty states. Each listed URL is a native `src/app/**/page.tsx` entry; client
feature components are mounted through the shared native route shell.

Admin IA: capability overview -> runtime health -> global room directory (monthly
partition) → room policy/archive moderation → report queue/resolution and sanctions
→ monthly audit timeline → user directory search → app-role assignment/revocation
→ bounded daily analytics. Long-range analytics/SLO, message investigation and
bounded audit export remain planned modules and must not be represented by fake
controls. Conversation roles remain room-local and are never treated as global
admin permissions.
