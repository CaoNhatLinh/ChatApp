# Incoming-call notice

Mode: Operate. Extend the existing protected app surface; no identity replacement.
Audience: signed-in personal/community chat members outside the incoming DM.
Task: notice a call and open its conversation without automatic media access.
States: checking, waiting for connection, lookup error/retry/dismiss, incomplete/load-more,
ringing, hidden locally, accepted/terminal, expired, disconnected, session change.
Constraints: canonical private STATE plus authenticated incoming lookup; memory-only
bounded inbox; no live/offline acceptance claim, fake name, automatic answer or toast.

## Direction contract

THESIS: One actionable call notice, not a second call-control panel.

OWN-WORLD: Existing Signal Relay app tokens, compact type, shared buttons and Lucide icons.

STORY: A member notices a ringing call, opens the real DM, then explicitly answers there.

FIRST VIEWPORT: One bounded notice above mobile navigation or bottom-right on desktop. Verified caller, open/hide; lookup feedback uses the same plane, with explicit retry or continue. Never take focus or cover a call with a second notice.

FORM: Local extension of the established app; no concept seed or comp round applies.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
