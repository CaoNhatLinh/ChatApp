---
target: Nối conversation workspace
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-08-30T07-52-42Z
slug: src-route-pages-messengerpage-tsx
---
## Nối workspace review

### Design Health Score

| # | Heuristic | Score | Key issue |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 3 | Presence and unread state remain compact; live-stack proof is pending. |
| 2 | Match to real world | 4 | Conversation, members and attachments use clear product language. |
| 3 | User control and freedom | 3 | The contextual room panel is deliberately on demand. |
| 4 | Consistency and standards | 4 | The workspace uses one icon and control vocabulary. |
| 5 | Error prevention | 3 | Advanced composer options are now disclosed once on mobile. |
| 6 | Recognition over recall | 3 | Search, conversation title and info access are visible; advanced room detail stays behind the info action. |
| 7 | Flexibility and efficiency | 3 | Desktop keeps direct file/media/poll controls; mobile consolidates them. |
| 8 | Aesthetic and minimalist design | 4 | Quiet dark canvas and restrained orange prevent the reference's decorative density. |
| 9 | Error recovery | 3 | Existing offline/recovery states are present; a live backend was unavailable for this review. |
| 10 | Help and documentation | 2 | Help is available outside the workspace, not contextual to a room action. |
| Total |  | 32/40 | Good foundation; improve room-detail discoverability later. |

### Verdict

The workspace matches the reference's functional hierarchy, not its exact fixed three-column composition. The app intentionally keeps the right-side room panel on demand through the info action, which follows the product rule that advanced detail should not occupy the conversation permanently. The left directory, focused message stream, composer and mobile drawer hierarchy are in place.

### Evidence

- Static detector reported no findings for the focused workspace components.
- Current desktop and mobile Playwright captures report no horizontal overflow and no console errors.
- The unavailable local realtime endpoint produced aborted/connection-refused SockJS requests; this is an already documented infrastructure blocker, not an ignored clean-console issue.
- The review found duplicate mobile poll exposure: a direct toolbar button and the overflow menu. The direct mobile poll button was removed. The overflow now contains file, photo/video and poll exactly once.

### Priority issues

- P2: Room information is discoverable only through an icon. Retain on-demand disclosure, but make the info action more legible for first-time users through an accessible label and a short first-use cue, not a permanently open panel.
- P3: The screenshot fixture has only one message, so it cannot evaluate density across replies, attachments, reactions or long history. Add representative populated visual fixtures before release.

### Personas

- Jordan (first-time user): can find conversation search and primary composer, but may not infer that the info icon opens member/media/settings context.
- Casey (mobile user): primary compose action remains in the thumb zone. File/media/poll are now reached through a single overflow rather than competing icons.
- Sam (accessibility-dependent user): focused controls expose labels and the capture reports no unlabeled controls; manual screen-reader review of the on-demand panel remains pending.
