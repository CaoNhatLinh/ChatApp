# Incomplete Features

⚠️ **List of unfinished features and mock limitations in the codebase**

## 1. Polls System
- **Status:** Interface/Controller built, logic missing.
- **Details:** The `PollController` provides several endpoints (`/api/polls`, `vote`, `results`, `close`), but requests are routed to an entirely empty `PollService` class. 
- **Required Fix:** Implement internal DB schema for Polls, Choices, Votes, and bind with `Message` entity. Add `SimpMessagingTemplate` broadcasts for real-time vote updates.

## 2. User Mentions Integration
- **Status:** Parsing exists, Notification loop incomplete.
- **Details:** Backend regex can identify `@username` within texts, but we need robust enforcement tying the mention into `NotificationService` explicitly across all send vectors.
- **Required Fix:** Extract `List<UUID> mentionedUsers` pre-save -> generate `MENTION` type notifications -> route through Kafka to consumers.

## 3. Large-scale Presence System (Fan-out)
- **Status:** Basic caching.
- **Details:** Currently, presence is managed via basic REST/WebSocket heartbeats refreshing a Redis TTL key. For scalable environments, calculating exactly "who" should receive the explicit presence change without over-broadcasting requires a fan-out graph algorithm.
- **Required Fix:** Implement a directed acyclic graph (DAG) or robust Pub/Sub model for presence fan-out instead of isolated endpoint fetches.

## 4. WebRTC Signaling (Voice/Video)
- **Status:** Completely missing.
- **Details:** No Java service or WebSocket topics exist yet to negotiate WebRTC SDP answers/offers and ICE Candidates.
- **Required Fix:** Creating `WebRTCController`, `SignalingHandlers`, and integrating TURN/STUN configurations.

## 5. Audit & Compliance Logging
- **Status:** Completely missing.
- **Details:** System doesn't log standard administrative actions for groups (e.g. tracking exactly who changed the conversation background or revoked admin access into a permanent ledger).
- **Required Fix:** Build an `AuditLog` entity, integrate Spring AOP to catch `@AdminAction` and record them asynchronously.

---

*Note if you run into any 500 server errors on endpoints handling message features like Reactions or Attachments, they ARE completely implemented on the logic level. Please ensure your Redis and Cassandra DBs are properly connected to avoid faults.*
