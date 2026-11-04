# A1/A2: typed system settings contract

Scope: two non-secret keys with actual new-community consumers. Existing rooms,
DMs and private groups keep their existing behavior. No arbitrary config editor.

| Key | JSON type/default | Validation / effect |
| --- | --- | --- |
| `community.creationEnabled` | boolean / true | false rejects new public COMMUNITY channels before persistence |
| `community.defaultMaxMembers` | integer / 10000 | 2..100000; only used when a new public community omits maxMembers |

GET `/api/admin/system-settings`: SYSTEM_OPERATE, no-store fixed catalog, each
entry has key/type/value/defaultValue/min/max/revision/updatedBy/updatedAt.
Pristine settings have the explicitly defined zero UUID revision and null update
metadata. Invalid stored non-pristine state fails rather than reverting defaults.

PUT `/api/admin/system-settings/{key}`: SYSTEM_OPERATE; body commandId UUID,
expectedRevision UUID, correctly typed value and trimmed nonblank reason<=500.
Zero commandId is reserved. Unknown keys/invalid types/bounds fail without write.
Stale revision or reused commandId/payload/actor conflicts without success audit.
Exact replay does not reapply a mutation. Response includes commandId, current
authoritative setting and auditPending, including on replay after later changes.

One partition per allowlisted key holds STATE, immutable COMMAND and PENDING
audit entries. State CAS and command/pending intent are one same-table conditional
batch. Audit export reuses the frozen event ID; failure returns auditPending and
finite-key recovery retries bounded pages. No timestamp-based revision and no
cross-partition audit atomicity claim. Fresh bootstrap schema only, no live reset.

A2 states: forbidden, loading/retry, pristine/default, ready, edited draft,
pending, success, validation error, 409 conflict with draft preserved and explicit
reload, and committed/audit pending. Avoid toast; use per-setting inline feedback.
UI is not complete until typed adapter/form/locale/keyboard/theme browser gates.

New-community policy denial remains HTTP403 but uses the stable error code
`COMMUNITY_CREATION_DISABLED`, not a permission guess or parsing an English
message. The create dialog shows localized pause/try-later guidance, retains the
draft and stays open. Other403 errors keep the ordinary permission explanation;
no client-side policy cache or automatic retry bypasses server validation.

Exit follow-up acceptance: the application's Back-to-app action asks before
discarding an ordinary settings draft, with Stay focused by default. An unknown
save outcome uses separate copy: the server may already have committed; leaving
does not cancel it. No navigation, new command or PUT occurs on Stay/Escape.
Workspace switches retain the mounted editors and do not need a warning. A
pending save cannot be discarded through this exit action. A clean form exits
directly; successful save, explicit Cancel or permission loss clears the guard.
This increment must not monkey-patch Next/router/history internals, persist
admin reasons/commands in browser storage, or claim browser Back/Forward and
reload recovery are complete. Those remain explicit acceptance work.
