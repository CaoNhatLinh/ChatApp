# UI screen inventory

| Screen | Primary actions | Required states |
|---|---|---|
| Landing | sign in, register, public links | loading, keyboard focus, responsive |
| Auth form | submit credentials | field error, server error, pending, success redirect |
| Messenger shell | select/search/create conversation | empty list, loading, offline/reconnect |
| Chat window | send/edit/delete/react/read/pin/upload/poll | optimistic pending, retry, deleted, attachment failure |
| Contacts | search, request, accept/reject/block, open profile, report profile | no results, duplicate request, forbidden, report validation/error/success |
| Settings/profile | theme/status/profile/notification preferences, report history | unsaved, validation, save error, report loading/empty/error/status |
| Invite/join | preview, accept/decline | invalid, expired, limit reached, approval pending |
| Global admin workspace | inspect capabilities/health, browse all-room monthly directory, change room policy/archive, review monthly audit timeline, read bounded analytics, search users, grant/revoke app roles, inspect/revoke sessions and devices | forbidden, unavailable health, empty month, archived room, missing projection, empty audit/analytics range, no devices/sessions, revoked session/device, duplicate role, expired grant, mutation error/success |
| Forbidden/error recovery | explain 403/500 and offer retry/navigation | permission denied, global error, recovery action |
