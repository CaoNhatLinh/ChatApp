# Canonical Capability Matrix

This matrix is the canonical capability inventory. Runtime contains only the
listed contracts/modules; legacy files and data are outside the runtime scope.

| Capability | Cassandra contract | Spring target | Runtime integration | Frontend target | Required evidence |
| --- | --- | --- | --- | --- | --- |
| Identity/auth/app RBAC | `users_by_*`, identity lookups, refresh tokens, `app_roles_by_user` | `canonical.identity`, `security` | Redis short-lived auth limits | auth/profile/admin users | auth + RBAC integration tests |
| Room create/discovery/list | `conversations_by_id`, `conversations_by_user`, community projections, DM pair | `canonical.conversation` | Kafka events, Redis cache, ES room index | sidebar/create/community search | four room-type E2E |
| Last message/order/unread | `message_summary`, `conversations_by_user` | conversation projection writer | Kafka durable fan-out | sorted room list | multi-user ordering test |
| Room pins max 3 | `pinned_conversation_slots_by_user` | room pin command | Redis cache invalidation | personal pinned section | concurrent fourth-pin test |
| Custom room RBAC | `conversation_roles_by_conversation`, member `role_ids` | permission/role command services | Redis versioned permission cache | role editor/member manager | permission-union/escalation tests |
| Messages/interactions | bucketed messages, client-id lookup, reply/mention/reaction/revision/read tables | message command/query services | Kafka + Redis STOMP | chat window/composer | retry, bucket and two-user E2E |
| Message pins max 5 | `pinned_message_slots_by_conversation` | message pin command | Kafka event | pinned messages UI | concurrent sixth-pin test |
| Attachments/media | `attachment_ref`, attachment rows, `media_assets_by_id`, thumbnails | media command/webhook/cleanup | Cloudinary | uploader/gallery/preview | signature, lifecycle and E2E tests |
| Search | Cassandra source projections | authorized search service | Elasticsearch Kafka consumer | room/message advanced search | filter matrix + leakage test |
| Polls | poll/vote/count tables | poll command/query services | Kafka + STOMP | poll composer/card/results | concurrent vote/policy tests |
| Moderation/chat controls | conversation bans, sanctions, reports, moderation results | moderation/report/policy services | Redis limiter, Kafka audit, bounded expiry scheduler | room controls/report/admin review | sanction enforcement/expiry unit tests pass; lock/language/integration audit tests remain |
| Invites/QR | invite/link/join-request projections | invite command/query services | Kafka analytics | landing, paste URL, QR manager | state/concurrency/browser tests |
| Notifications | preferences, devices, inbox/delivery tables | policy + delivery workers | Kafka, Redis STOMP, push adapter | inbox/global/room settings | precedence truth table + device E2E |
| Personal appearance | themes and user/room preferences | preference service | Cloudinary optional background | local/private themes | cross-account privacy test |
| Calls | call and participant tables | signaling/call services | Redis STOMP + SFU adapter | voice/video UI | authorization/multi-client tests |
| Audit/admin/analytics | room/audit/outbox/analytics tables, `audit_events_by_month`, admin room/session/device directories | admin/query/outbox services | Kafka + optional OLAP | integrated `/admin` workspace | permission, reconciliation and ops tests; room/audit/session controls are implemented, analytics/ops drills remain |

## Mandatory integrations

- Cassandra is authoritative and cannot be replaced by Redis, Kafka or Elasticsearch.
- Kafka consumers must be replay-safe; Kafka is never the only copy of a mutation.
- Redis data may expire or disappear without losing business history.
- Elasticsearch indexes must be rebuildable and authorization is rechecked by Spring.
- Cloudinary stores bytes; Cassandra retains detailed immutable attachment metadata.
- Spring REST/STOMP adapters never issue CQL directly.
