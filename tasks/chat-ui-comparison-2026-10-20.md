# Nối and MultiChat reference: UI comparison

Method: dual-agent (A: /root/comparison_design; B: /root/comparison_evidence).
Target: chatapp_frontend/src/widgets/chat-window/ChatWindow.tsx and adjoining sidebar/info surfaces.
Date: 2026-10-20, Asia/Saigon.

## Verdict

Learn the reference's conversation triage and context retrieval, not its sales dashboard identity. The supplied image explicitly uses simulated data. It cannot establish backend behavior, mobile quality, keyboard support or dark-mode quality. Nối has a recognizable Signal Relay identity and existing canonical chat functionality; current interaction gaps matter more than copying CRM controls.

## Reference strengths and weaknesses

Strengths: actionable list previews with time/unread/send failure; conversation context next to messages; visible unread boundary; image/file/link browsing affordances; quick search and conversation switching affordances.

Weaknesses: four simultaneous columns and multiple header rows; overlapping search scopes; pin/star/priority distinctions; many colored badges and dots; private notes/account identity exposed persistently. Notes-save recovery, actual counts, keyboard behavior and provider functions are not proven by the screenshot. Demo layout selectors are not production navigation recommendations.

## Provisional chat-surface heuristic scores

These scores assess source and incumbent controlled screenshots, not the whole application or production readiness.

| Heuristic | Score /4 | Main limitation |
|---|---:|---|
| System status | 2 | Tiny message metadata and no inspected unread boundary |
| Real-world language | 3 | Broad options label and ambiguous shared-content dash |
| Control/freedom | 2 | Desktop information close does not reclaim width |
| Consistency | 3 | Independent shell and room-theme defaults |
| Error prevention | 3 | Guards/confirmations exist; live flows not verified |
| Recognition | 2 | Icon rail and common actions behind advanced options |
| Efficiency | 2 | Local-only list filtering; no evidenced quick switcher |
| Minimalism | 2 | Persistent low-value information panel |
| Recovery | 3 | Explicit message retry and contextual errors in source |
| Help | 2 | Labels/tooltips exist; limited contextual guidance |
| Total | 24/40 | Provisional, not release acceptance |

## Priorities

1. P1: Preserve reading position. ChatWindow effect at211-218 follows lastMessageId and typingUsers without a near-bottom guard. Follow only when near bottom or sending oneself; otherwise show new-message/catch-up controls. Add localized date/unread boundaries from authoritative read state, not loaded badge arithmetic. MessageItem metadata at221-243 uses9px/opacity; improve legibility and explicit failure retry. Suggested command: impeccable harden.
2. P1: Honest and reachable search. ChatSidebar70-75 filters loaded conversation names;148 disables pagination with a query. Provide authorized paginated conversation search or explicitly describe limited filtering. ConversationHeader77 hides search below640px; provide a mobile route. Existing MessageSearchDialog already has API/type/date/files/pinned filters; reuse it. Suggested commands: impeccable clarify and harden.
3. P1/P2: Make information-panel control real. ChatWindow603-612 forces desktop opening/width despite close. Allow genuine collapse and restore focus. ConversationInfo277-280 only shows a shared-content dash; implement authorized cursor-paginated images/files/links with source-message navigation, deletion and retention rules, or clearly state unavailability. Suggested commands: impeccable adapt and shape.
4. P2: Predictable theme inheritance. Default aurora is dark independent of app theme. Default to follow app; preserve explicit personal room overrides. Preview shell/room/bubble/status/composer combinations and test contrast rather than assuming it. Suggested command: impeccable colorize.
5. P2: Keyboard/touch list interaction. ConversationItem108-117 has a keyboard-operated role-button row containing pin button192-208. Bubbling is a source-level risk, not a browser-proven failure. Separate selection and action controls, expose touch-friendly menus and readable unread semantics. Suggested commands: impeccable adapt and harden.

## Feature comparison

| Reference | Nối evidence/status |
|---|---|
| Name/snippet/time/unread | Already in ConversationItem; refine hierarchy |
| Pin | Real pin/unpin API; not personal favorites |
| Send/read/failure/retry | Existing frontend flows; live delivery not verified here |
| Room search | Existing API and filters, membership authorization; Elasticsearch-dependent |
| Notification mute | Existing room default and personal override; reuse for shortcut |
| Custom appearance | Existing personal scope; inheritance needs clarity |
| Shared images/files/links | Information panel only has dash, not functional library |
| Global search/Ctrl+K/tabs | Not evidenced in inspected frontend; new scope |
| Labels/private notes | Not evidenced; new per-user data/privacy contracts |
| Personal archive | Not evidenced; never reuse global room archive semantics |
| Multiple sending identities | Not evidenced and not core personal/community product scope |

## Recommended additions

First: All/Unread/Pinned filters, shared media, mobile room search, quick conversation switcher, date/unread/catch-up controls. Then complete already approved thread/forward/sticker/GIF/call-history work without placing every action on the main header.

Optional later: personal labels, private saved messages, personal archive. Private notes and send-as-account are appropriate only if deliberately expanding toward work/sales. Do not add fake counts, galleries or unsupported controls.

## Cognitive load and user scenarios

Reference has good grouping but high simultaneous navigation/action density. Nối is quieter but discoverability is weaker; fewer visible options do not automatically mean easier use. First-time users face icon-only navigation and ambiguous dash; power users face limited search scope; mobile users lose header search; keyboard users need row/pin event verification. Preserve text drafts and contextual recovery. White artwork in incumbent screenshots is deliberate1px fixture art, not a production image defect.

## Direction questions

1. Product direction: personal/community chat, team workspace, or sales inbox?
2. First scope: fix existing chat UX first, or fix it alongside filters/shared-media/quick-switcher additions?

No production code changed by this review.
