# Message reply panel

Mode: Operate. Local extension of the established chat workspace, not a redesign.
Approved scope: exact parent lookup, direct reply paging, composer context,
loading/error/retry/revocation, VI/EN, light/dark/custom-room, keyboard and mobile.
Use existing dialog, buttons, typography and message primitives. No invented
sender, count, media, reply, backend capability or success confirmation.

## Direction contract

THESIS: One message and its actual replies stay together, without scanning cached chat history.

OWN-WORLD: Existing Signal Relay tokens, compact sans type, neutral layered surfaces and action-only orange.

STORY: Read the original, page replies, answer with a confirmed full source key or recover inline.

FIRST VIEWPORT: Right-docked reading pane on desktop; one full-height mobile layer. Parent first, replies below, text reply action at the bottom. Escape/close restores composer focus.

FORM: Local extension, code-led; no seed required by new-work's extension branch. Shared protected-focus dialog, explicit pagination and refresh, no nested decorative cards.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
