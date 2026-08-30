# Page coverage matrix

| Route | Public/auth | Current renderer | Loading/error/empty | Browser proof |
|---|---|---|---|---|
| `/` | public | native Next App Router entry + client shell | present in HomePage | 200, no console/request failures |
| `/login`, `/register` | public | native Next App Router entries + auth shell | form errors/loading | 200; auth service journey pending |
| `/app` | authenticated | native Next App Router entry + protected client shell | protected, empty workspace, selected room, messenger, offline/recovery states | unauthenticated redirect and browser offline→online banner verified; desktop/mobile visual audit covers empty and selected room; live services blocked |
| `/communities` | authenticated | native Next App Router entry + protected client shell | loading, error, empty, filtered, joined, approval-pending, capacity-full, pagination | production build and mock-authenticated VI→EN search/join/navigation/390px smoke pass; live Cassandra pending |
| `/friends` | authenticated | native Next App Router entry + protected client shell | list/search/request states | unauthenticated redirect verified; live services blocked |
| `/settings`, `/profile` | authenticated | native Next App Router entries + protected client shell | form states | unauthenticated redirect verified; live services blocked |
| `/about`, `/help`, `/privacy`, `/terms` | public | native Next App Router entries + public shell | static | 200, no console/request failures |
| `/join/:token` | public then auth | native dynamic Next App Router entry + session-aware client shell | invalid/expired/accepted | route build verified; live invite API pending |
| `/admin` | authenticated + app permission | native Next App Router route + client feature island | loading, forbidden, service unavailable, offline/recovery, bounded room/audit/report/session/device mutations, empty projections | public deep-link/redirect and browser offline→online banner smoke; authenticated operator flow pending |
| `/403` | public recovery surface | native Next App Router entry + public shell | explanatory copy, back/app actions | 200, no console/request failures |

Removed from the canonical IA: `/home` duplicated the landing route, `/messages`
duplicated the `/app` workspace, `/activity` had no canonical activity source,
and `/404` duplicated Next's `not-found.tsx` boundary. These entries are not
redirected or retained as compatibility routes.
