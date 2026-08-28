# Motion guidelines

Landing uses a small number of purposeful reveals to establish hierarchy. App
and admin surfaces use short transitions for feedback and state changes only.

- Animate `transform` and `opacity`, never layout properties.
- Use 150-250ms ease-out transitions in product UI.
- Respect `prefers-reduced-motion`; content remains visible without animation.
- Loading uses skeleton or a stable brand mark, not an indefinite decorative
  spinner in the content area.
- Every animation must explain what it communicates: hierarchy, feedback,
  loading, or a state transition.
