# Accessibility checklist

- `html lang="vi"` is set by the Next root layout.
- Every page has semantic `header`, `main`, `nav`, `section` and `footer`
  landmarks where applicable, plus exactly one primary `h1`.
- Labels are explicit and placed above inputs. Errors and helper text remain in
  the accessibility tree. Icon-only controls include `aria-label`.
- Focus indicators are visible in keyboard navigation. Hover is never the only
  way to discover an action.
- Online, typing, unread, loading, empty and error states include text or an
  icon with a meaningful accessible name, not color alone.
- Test at 320, 768, 1024 and 1440px, in light and dark themes, with reduced
  motion enabled.
- Browser evidence must include console/request failure checks and an
  accessibility-tree review before release.
