# NovaChat design system

This is the canonical visual contract for the frontend. Tokens live in
`chatapp_frontend/src/index.css`; component defaults live under
`chatapp_frontend/src/shared/ui`.

## Direction

Signal orange, cool ink neutrals, one sans family, and a restrained elevation
language. The landing page may be expressive and asymmetric; product and admin
screens stay familiar and state-first.

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
