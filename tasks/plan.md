# Kế hoạch triển khai mở rộng Nối

Ngày 2026-10-12. Người dùng đã duyệt kế hoạch và các bổ sung schema cần thiết. Đang triển khai; không phải danh sách tính năng đã hoàn tất. Phạm vi/ma trận/quy tắc: [feature-expansion-spec.md](feature-expansion-spec.md). Các checklist đợt trước được giữ nguyên.

## Thứ tự

Sticker → GIF → thread → provenance forward → call history → media lifecycle → global settings → email history/recovery → moderation review integration. Push được người dùng hoãn; không tự triển khai FCM.

Mỗi bước bên dưới chỉ thay một concern, tối đa khoảng năm file production; tests/docs đi cùng. Không commit toàn bộ dirty worktree hoặc push khi chưa được yêu cầu.

| Task | Acceptance và verification | Dependency / vùng code |
| --- | --- | --- |
| S1: sticker access path | catalog cursor thực + CAS revision; active/inactive rõ; static schema guard và repository cursor/CAS tests | schema được duyệt; CQL, sticker repository |
| S2: admin sticker commands | app-level permission, asset ownership/status, mutation/audit/recovery; forbidden, stale revision, invalid asset tests | S1; sticker service/policy/controller |
| S3: admin catalog UI | create/edit/order/deactivate, draft/409/error, empty data thật; validate/build + browser fixture | S2; admin sticker API/components |
| S4: sticker send/render | server validate sticker trước claim/send, ID nằm trong fingerprint; không phá lịch sử khi pack inactive; message tests | S2; message service/policy/view |
| S5: composer sticker picker | paged pack/items, send/error/pending, VI/EN; keyboard/browser light/dark/custom-room | S3/S4; composer và message rendering |
| G1: GIPHY picker client | trực tiếp client, attribution, bounded search/paging, unconfigured/quota/unavailable; mocked provider response validation tests | key/config; GIF API/types/picker |
| G2: canonical GIF message | provider/id trong send/hash/store/view; không server-fetch tùy ý, tombstone khi provider ID unavailable; backend + browser retry tests | G1; message DTO/policy/repository/renderer |
| T1: reply source validation/index | full parent key, server sender, repair idempotent index; outsider/cross-bucket/retry/deleted-parent tests | message pipeline; DTO/policy/repository |
| T2: thread query | hydrate authority, access mỗi request, complete cursor ties; no scan; paging/permission tests | T1; thread service/controller/API doc |
| T3: thread UI | panel/mobile layer, paged replies, reply composer context, deleted parent; browser stale/error/retry tests | T2; thread API/panel/composer |
| F1: forward provenance | server-authoritative source, source+target access, replay repair; privacy/revoke/deletion tests | message pipeline; forward policy/repository |
| F2: source UI | authorized source link only, unavailable/redacted states, no private target-room disclosure; browser two-permission fixtures | F1; message view/API/renderer |
| C1: durable call authority | lookup/claim/expiry, CAS fencing; actor/target validation; start/end/takeover tests | schema approved; call repository/policy/service |
| C2: call lifecycle integration | STOMP uses durable transitions, timeout/cancel/decline/missed distinct, event idempotency; reconnect/process-kill integration | C1; call controller/scheduler/events |
| C3: call history UI/API | paged own/room history and participants authorized; media-connected not inferred from signaling; browser pending/missed/end states | C2; call history API/panel |
| M1: real image derivatives | variants metadata from actual processor/provider, bounds and unavailable/failed states; mocked provider + live image inspection | Cloudinary configured; media repository/service/policy |
| M2: asset references/delete jobs | attachment/sticker reference safety, orphan cleanup bounded queue, idempotent provider delete and recovery; referenced/deleted/crash tests | M1,S4; media lifecycle jobs/policy |
| M3: media UI | processing/ready/error thumbnail preview, upload cancel, no broken history; browser + provider integration | M2; attachment API/components |
| A1: typed global settings | limited key catalog with real consumer, revision-CAS + repairable audit; validation/forbidden/409 tests | schema approved; settings repository/service/controller |
| A2: settings admin form | draft/save/cancel/reload conflict, audit reason, no secret fields; keyboard/VI/EN/browser tests | A1; admin settings API/form |
| E1: email history queries | own user/month cursor + ledger hydration, redacted failure info, no recipient cross-account access; tests | existing Resend; email history repository/service/controller |
| E2: email recovery commands | fenced operational review, reason/audit, uncertain expired delivery never blind-resend; race/replay tests | E1; email recovery service/controller/index |
| E3: history/review UI | honest sent vs delivered, own settings history and permission-gated admin review; fixture/browser and real signed webhook evidence | E2; email API/settings/admin panels |
| Q1: real detector contract | explicit categories/policy/model version, provider/rules configured, unavailable when not; no fabricated scores/no auto ban; input/output/privacy tests | provider/rules/content-processing approval |
| Q2: durable flagged queue | review projection, idempotent analysis and human revision-CAS decision/audit; permissions and duplicate/crash tests | Q1; moderation repository/service |
| Q3: moderation UI | queue filters/paging, sanitized evidence, human review outcomes/409, availability; browser + provider integration | Q2; moderation admin components |

## Checkpoints

After S5/G2: catalog-to-message happy path and negative authorization; validate/build/JUnit/schema/i18n + four-width light/dark screenshots. GIF remains unavailable without a configured key.

After T3/F2: thread pagination spanning buckets, source deletion and permission revocation; no fabricated source/sender; two-user live check required.

After C3/M3: actual database restart/crash and provider IO evidence; no claim of complete calls/media from fixture-only tests.

After A2/E3/Q3: app-vs-room permission matrix, stale-write conflicts, audit/review recovery and canonical docs. Detector remains blocked until real provider/rules and privacy approval.

## Risks and mitigations

- Missing Cassandra access path: add narrowly scoped projection/claim/index after approval, never full-table scan.
- Provider terms/privacy: GIPHY direct client + no unauthorized URL caching; moderation external processing needs explicit consent; no Resend/Firebase Admin keys in frontend.
- Message retries and source deletion: same canonical send/fingerprint, source validation/redaction, repair projections from authority.
- Calls/media uncertainty: distinct runtime states, fenced transitions, bounded repair and true integration checks.
- Large pre-existing dirty tree: preserve it; no destructive reset, blanket cleanup, automatic commit/push.

## Runtime gates

GIPHY web key, Cloudinary credentials/runtime, live Cassandra/Redis/realtime clients, public Resend webhook + signing secret and actual moderation detector remain separately verified. Push is explicitly deferred. This plan does not start tunnels, contact moderation providers, send test emails or reset a database.
