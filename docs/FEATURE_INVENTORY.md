# Feature inventory

Legend: **Complete and verified**, **Implemented but not fully verified**,
**Partially implemented**, **Not implemented**, **Externally blocked**. A row
cannot be complete without real persistence, permission, failure/recovery and
end-to-end evidence.

| ID | Capability | Current status | Evidence / next proof |
|---|---|---|---|
| ID-IDENTITY-001 | Register/login/me/logout | Implemented but not fully verified | Backend tests green; real Cassandra/CORS cookie journey pending |
| ID-IDENTITY-002 | Rotating refresh cookie | Implemented but not fully verified | `RefreshTokenServiceTest`; browser cookie journey pending |
| ID-IDENTITY-003 | User search/profile update | Implemented but not fully verified | `CanonicalBackendServiceUserTest`; live directory data pending |
| ID-SOCIAL-001 | Friendship, block, mutuals | Implemented but not fully verified | `FriendshipServiceTest`; live two-user journey pending |
| ID-ROOM-001 | DM/group creation and member management | Implemented but not fully verified | Service/controller coverage; live Cassandra pending |
| ID-ROOM-002 | Room chat policy, member roles, kick/leave, invite/search | Implemented but not fully verified | Canonical conversation APIs and real frontend hooks; live authorization journey pending |
| ID-MESSAGE-001 | Cursor message history/idempotent send | Implemented but not fully verified | shard merge and retry tests; live persistence/realtime pending |
| ID-MESSAGE-002 | Edit/delete/reaction/read/pin | Implemented but not fully verified | backend tests plus realtime publisher; browser evidence pending |
| ID-MESSAGE-003 | Poll create/vote/close | Implemented but not fully verified | service path exists; live persistence/realtime pending |
| ID-ROOM-003 | Invites and join requests | Implemented but not fully verified | controller/service paths; live link journey pending |
| ID-NOTIFY-001 | Notifications and notification settings | Implemented but not fully verified | canonical inbox plus bilingual channel/quiet-hour settings UI, room defaults, personal overrides, evaluator-backed precedence and explicit policy endpoint; canonical controller scans the latest 12 monthly partitions; live Cassandra pagination pending |
| ID-REALTIME-001 | Presence/heartbeat/typing | Implemented but not fully verified | STOMP services/controllers; Redis and browser reconnect pending |
| ID-CALL-001 | Audio/video call signalling + native 1–1 WebRTC session | Implemented but not fully verified | Authenticated `/app/call.*` STOMP controller, explicit target-user routing, native `RTCPeerConnection` offer/answer/ICE flow, incoming accept/decline, mute/camera/hang-up UI; live browser/media and reconnect evidence pending |
| ID-MEDIA-001 | Attachments | Implemented but not fully verified | Cloudinary is configuration-gated; local provider is externally blocked |
| ID-SEARCH-001 | Full-text message search | Implemented but not fully verified | Elasticsearch-gated controller/projector; live index pending |
| ID-ADMIN-001 | Global admin workspace (whole-app capabilities, user search, app-role grant/revoke, status, bounded session/device revoke, runtime health, all-room directory/policy/archive, monthly audit timeline and CSV export) | Implemented but not fully verified | `/admin` UI + `/api/admin/overview` + `/api/admin/audit` + `/api/admin/audit/export` + `/api/admin/conversations/**` + `/api/admin/users/{id}/app-roles|status|sessions|devices`; authenticated operator journey and room-directory backfill pending |
| ID-MODERATION-001 | User reports and global moderation | Implemented but not fully verified | Message menu and profile report forms, user report-history tab, plus `/api/reports`, `/api/reports/mine`, `/api/admin/reports`, `/api/admin/sanctions`; Cassandra moderation projections, bounded sanction-expiry worker and audit are wired; authenticated moderation E2E, language classifiers and appeals remain |
| ID-ADMIN-002 | Admin moderation/analytics/investigation | Partially implemented | report queue/resolution, APP/CONVERSATION sanctions, bounded daily analytics, reasoned message/revision inspection and monthly bounded audit CSV export are implemented; language moderation, appeals and long-range metric dashboards remain planned |
| ID-UX-001 | Canonical page system and responsive redesign | Complete and verified | All retained public, auth, product, recovery, invite, and operator routes use the shared signal-orange/cool-ink system; removed duplicate routes have no compatibility renderer; Next build, Playwright route smoke, desktop visual QA, and 390px overflow checks pass |
| ID-IDENTITY-004 | Password reset/email verification/social login/MFA | Not implemented | No provider/workflow in repository |
| ID-NOTIFY-002 | Production push notifications | Externally blocked | Requires FCM/APNS/Web Push credentials and worker |
| ID-CALL-002 | Production audio/video media | Externally blocked | Native 1–1 P2P media is implemented; production NAT traversal still requires an explicitly configured reviewed STUN/TURN provider via `NEXT_PUBLIC_WEBRTC_ICE_SERVERS`; group/SFU calls are not enabled |
