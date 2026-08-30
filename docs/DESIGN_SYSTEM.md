# NovaChat design system

This is the canonical visual contract for the frontend. Tokens live in
`chatapp_frontend/src/index.css`; component defaults live under
`chatapp_frontend/src/shared/ui`.

## Direction

Signal orange, cool ink neutrals, one sans family, and a restrained elevation
language. The landing page may be expressive and asymmetric; product and admin
screens stay familiar and state-first.

Brand assets are intentionally separated: the personal mark supplied by the
owner is reference-only, while the app uses the NovaChat mark at
`chatapp_frontend/public/novachat-app-mark.png`. Shared shells, loading states
and operator surfaces use the app mark; personal-brand artwork is never used as
the product identity.

## Token contract

| Role | Token | Use |
|---|---|---|
| Canvas | `--background` | page background |
| Text | `--foreground` | primary content |
| Secondary text | `--muted-foreground` | supporting copy, never essential status alone |
| Action | `--primary` / `--primary-foreground` | primary actions, selection, live indicators |
| Surface | `--card`, `--secondary` | grouped content |
| Divider | `--border` | structure, focus context |
| Danger/success/warning | semantic tokens | status with text or icon, never color alone |

Radius is `sm` for compact controls, `md` for controls and `lg` for panels.
Cards do not exceed the `lg` radius. Shadows are short and tinted; a static
surface does not receive a decorative wide shadow.

## Type and spacing

Use the `Avenir Next`, `Segoe UI`, system UI stack. Landing display headings are
large but capped at 6rem and use a single family. Product headings use fixed
rem sizes. Use the existing spacing scale in `index.css`; do not add one-off
pixel values.

## Page families

- Brand: `/`, `/about`, `/help`, `/privacy`, `/terms`.
- Auth: `/login`, `/register`.
- Product: `/app`, `/friends`, `/search`, `/profile`, `/settings`.
- Operator: `/admin`.
- Recovery and invite: `/403`, Next `not-found.tsx`, `/join/:token`.

`/home`, `/messages`, `/activity`, and `/404` are removed. There is no redirect
or compatibility layer for those non-canonical routes.

## Required states

Every data surface exposes loading, empty, error and success/updated states.
Interactive controls expose keyboard focus, hover, active, disabled and pending
states. Realtime state uses text and icons in addition to color.

Dense operator or detail surfaces use progressive disclosure: keep the primary
task visible and collapse secondary audit, investigation, analytics or policy
details with the native `SurfacePanel` disclosure. Never turn an unavailable
or not-yet-synced value into a guessed status; `unknown` remains visually
neutral until an authoritative snapshot arrives.

Transient feedback must not become page content. The shared toaster uses a
mobile-safe width and at most one visible success/warning plus one error slot;
later messages replace the same slot. Persistent or multi-step information
belongs inline beside the affected control, not in a stack that obscures the
workspace.

Responsive information density is intentional. On narrow product pages, omit
supporting promo or explanation panels when the heading and primary copy already
carry the same meaning. A card must not repeat an action's meaning in an
adjacent label (for example, “Join now” beside “Join community”); keep only
authoritative state, constraints and the named action.

## Language

The product supports Vietnamese (`vi`, canonical copy) and English (`en`). The
`AppI18nProvider` is mounted at the root layout and retained by feature shells;
`LanguageToggle` persists the selected locale in the `novachat_locale` cookie
and local storage and updates the document language. New user-visible strings
must be added to `COPY_TRANSLATIONS` with concise, reviewed translations rather
than silently falling back to guessed text. User-generated content, protocol
enums and opaque IDs are not translated.
