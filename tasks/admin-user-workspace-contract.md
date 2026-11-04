# Admin user workspace

Scope: existing application-level user operations, not room roles. Preserve all
server permissions, audited reasons and current canonical APIs. No database,
provider, credential, commit or push operation.

Replace the two collapsed panels plus permanently exposed multi-form profile
with the incumbent room-style list/detail grammar. Search (2+ characters)
reads at most20returned users. Real avatars and a larger selected portrait lead
recognition. Roles and sign-in resources have distinct views. Show technical
IDs behind disclosure; open only the chosen audited operation in protected focus.
Each operation owns its reason. USER_SUSPEND and USER_RESTORE gate their own
destinations; SESSION_REVOKE does not require APP_ROLE_MANAGE. Self-suspension
and self-bootstrap-role revocation remain unavailable.

Reads have abort/scope ownership; loading, error and successful empty are
distinct. Late search/detail responses and old-actor completions cannot alter
current UI. Freeze target selection while writing. Each changed draft requires
explicit discard before replacement or Back. Hidden workspace retains drafts;
app-owned exit and native unload warn. No universal route/reload recovery claim.
Unknown mutations cannot be blindly resubmitted: retain frozen intent, allow
authoritative inspection and explicitly warned discard. This is not an
idempotency or distributed-concurrency guarantee for the legacy APIs.

## Direction contract

THESIS: Find a person and act on that person, not a stack of permission/forms.
OWN-WORLD: Inherit Nối app tokens, compact sans, actual portraits, Lucide symbols.
STORY: Search, recognize, inspect roles/sign-ins, choose one audited operation.
FIRST VIEWPORT: Search/list beside a portrait-led detail at1024px; below it,
one pane with named Back and focus return. No counter hero or nested card grid.
FORM: Local workbench extension, no identity/comp roll. Native controls and
160ms selection feedback; reduced motion. No new raster or dependency.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Acceptance: role-only/session-only/status-specific permission fixtures, own
reason per task, keyboard/focus, mobile Back/draft retention, pending selection
lock, stale/failed/partial reads, unknown acknowledgement, exact target payload,
VI/EN, four widths/light-dark, existing admin/settings/room regressions, build.
Controlled browser evidence does not complete live Cassandra/two-client gates.
