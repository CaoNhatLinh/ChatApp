# NovaChat UI Architecture

## Scope

This document describes the single current web surface. It intentionally excludes removed routes, old Vite entrypoints, static activity screens, and compatibility redirects.

## Route map

### Public and auth

- `/` — landing page
- `/about` — product principles
- `/help` — help centre and FAQ
- `/privacy` — privacy policy
- `/terms` — terms of service
- `/login` — sign in
- `/register` — account creation
- `/403` — authenticated access denied
- `not-found` — product-specific missing route state

### Authenticated product

- `/app` — realtime conversations and message workspace
- `/friends` — contacts and friend requests
- `/search` — canonical user, room, and message search
- `/profile` — current user profile
- `/settings` — account and appearance settings

### Global operations

- `/admin` — application-wide operator console for users, rooms, reports, sanctions, audit, permissions, sessions, and device controls

Removed route aliases are not redirected or rendered. `/home`, `/messages`, and `/activity` had redundant or non-canonical content and are intentionally absent.

## Layout boundaries

- `src/app/layout.tsx` owns providers and the document shell.
- `src/app/native/NativeRouteShell.tsx` owns auth-aware route mounting.
- `src/route-pages/*Page.tsx` owns route composition and page-level data flow.
- `src/route-pages/shared/layout/*` owns public, auth, and product shells.
- `src/widgets/messenger-layout/*` owns the responsive chat workspace shell and explicit loading/error states.
- `src/shared/ui/*` owns tokens and reusable interaction primitives.

## Composition rules

- Routes compose focused components and do not duplicate shell, typography, or control styles.
- Feature components own domain behavior; route pages only orchestrate data and layout.
- Every async surface has an explicit loading, empty, and error state tied to canonical request state.
- Operator controls are available only on `/admin`; room member roles are not global operator permissions.
- Navigation points only to canonical routes listed above.

## Design-system boundary

Tokens live in `src/index.css` and are consumed through semantic classes (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`). New pages use the Nova signal-orange/cool-ink palette, one sans family, compact radii, deliberate borders, and responsive spacing. Decorative gradients, fake metrics, legacy serif/uppercase treatments, and uncontrolled arbitrary colors are not part of the system.

## Editing rules

- Add a route only when it represents a distinct user task and has a canonical backend contract.
- Prefer shared shells and primitives over page-local copies.
- Keep visible copy concise, Vietnamese-first, and free of placeholder data.
- Validate type-check, lint, production build, and browser smoke after route or shell changes.
