# Content guidelines

- Visible copy is Vietnamese by default and English through the app locale
  toggle. Both versions must be concrete, short and reviewed for meaning;
  English is not a machine-generated fallback. Use English-only text for
  canonical protocol/status values that operators must match with the API.
- Buttons describe one action: `Mở workspace`, `Đăng nhập`, `Lưu thay đổi`.
  Do not repeat two labels for the same intent on one page.
- Empty states explain what is missing and how to populate it. Errors explain a
  recovery action without exposing stack traces, tokens, provider names or IDs.
- Do not ship fabricated activity, metrics, testimonials, status, avatars or
  fallback content. If canonical data is unavailable, show the explicit empty
  or unavailable state.
- Legal copy in privacy and terms pages is not shortened or rewritten by a
  visual pass without a legal/content decision.

- Add every new user-visible message, label, aria label and notification to the
  canonical translation map. Never translate user-generated message content,
  UUIDs, URLs or API enum values.
