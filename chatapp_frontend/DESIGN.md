---
name: Nối
description: A privacy-conscious realtime conversation product with a focused workspace and a global operator surface.
platform: web
register: adaptive
---

# Nối design system

## Direction

Nối uses a signal-orange accent over a cool ink canvas. The landing surface
is confident and editorial, while signed-in screens stay quiet and operational.
The product should feel like a reliable relay: every state is visible, every
action has a clear place, and nothing ornamental competes with the conversation.

Design read: a full visual overhaul for a consumer and team messaging product,
with an art-directed landing page and a familiar restrained product interface.
Dial values: landing variance 8, motion 5, density 4; product variance 4,
motion 2, density 6.

## Tokens

Tokens are defined in `src/index.css` and are the only source for color, radius
and elevation decisions.

- Accent: `--primary`, signal orange, reserved for actions, active state and live status.
- Canvas: `--background`, cool near-white in light mode and ink blue in dark mode.
- Content: `--foreground`, `--muted-foreground`, `--border`.
- Surfaces: `--card`, `--secondary`.
- Radius: `sm` for compact controls, `md` for controls, `lg` for panels. No ad-hoc 24px+ cards.
- Elevation: thin borders and a short tinted shadow only where hierarchy requires it.

## Typography

One sans family is used throughout: `Avenir Next`, `Segoe UI`, then system UI.
Landing headings use high contrast in size and weight, not a second serif family.
Product UI uses fixed rem sizes with `text-wrap: balance` for headings and a
maximum prose width of 65-75ch.

## Layout and navigation

- Public navigation: Home, About, Help, then legal links in the footer.
- Authenticated navigation: Workspace, Friends, Search, Profile, Settings.
- `/app` is the canonical conversation workspace. `/home`, `/messages`, and `/activity` are removed because they were duplicate or non-canonical surfaces.
- `/admin` is a global app-level operator surface. Room roles never grant app admin access.
- Mobile collapses navigation to horizontal scroll or a single-column flow; no desktop-only assumptions.

## Component rules

- Use semantic landmarks and one `h1` per page.
- Every control has focus, hover, active, disabled and pending states.
- Loading uses layout-matched skeletons. Empty states explain the next action.
- Errors are contextual and never replaced by invented data.
- Use the existing Lucide icon family consistently until a deliberate migration is planned.
- Keep motion on transform and opacity, under 250ms for product UI, and disable it for reduced-motion users.

## Landing art direction

The landing uses a split hero and a generated Nối signal image at
`public/noi-relay-hero.png`. Copy stays concrete and short. No decorative
version labels, fake metrics, generic logo walls, repeated eyebrows, or
duplicate CTA intents.

## Accessibility and verification

Target WCAG 2.1 AA contrast, keyboard-complete interaction, 320/768/1024/1440px
layouts, both theme modes, and Playwright smoke checks with zero console or
request failures. Browser and integration evidence belongs in `docs/TESTING.md`.
