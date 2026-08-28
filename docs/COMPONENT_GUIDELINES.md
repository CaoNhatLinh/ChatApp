# Component guidelines

- Keep data fetching and mutations in feature stores/API modules. UI components
  render explicit loading, empty and error states.
- Prefer composition over large configurable components. Split components once a
  file carries more than one responsibility.
- Use semantic HTML and one `h1` per page. Labels sit above inputs; helper and
  error text sit below them.
- Every interactive control has a visible accessible name and a keyboard path.
  Icon-only controls require `aria-label`.
- Use the existing Lucide family consistently. Do not hand-roll SVG paths.
- Shared primitives use the canonical tokens. Page code should not invent raw
  colors, radii or shadows.
- Motion is limited to transform/opacity and must honor reduced motion. Product
  transitions stay within 150-250ms.
