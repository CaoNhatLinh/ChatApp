# Roadmap & Future Development

## Implemented (Released) Features
*(Previously in the roadmap but now available in the codebase)*
- **Message Reactions**: Toggle emoji reactions on messages (Fully implemented via `MessageEnhancementService`).
- **Pin Messages**: Pin/unpin important messages in conversations.
- **Message Read Receipts**: Track users who read specific messages.
- **Message Search (Elasticsearch)**: Full-text search within messages and conversations.
- **Role & Group Management (Admin/Owner)**: Transfer ownership, grant/revoke admins, invitation links.
- **Multiple File Uploads**: Cloudinary attachments scaling for multi-files.

## Immediate Next Steps (Must Complete First)
- **Polls System**: The REST API Controller endpoints for Polls exist (`PollController`), but the `PollService` layer is currently an empty class. This needs logic for creating polls, voting, calculating results, and WebSocket push events.
- **User Mentions**: Complete the integration of `@username` tags so that they actively trigger mention notifications (parser exists, full-service linkage needed).
- **Fan-out Presence System for Large Scale**: Upgrading the basic Redis TTL presence solution to a scalable publish-subscribe fan-out graph for high concurrency.
- **Audit Logging**: Detailed tracking of admin/owner activities (e.g., removing members, updating group name) for security compliance.

## High Priority
- Voice & Video calling integration (via WebRTC & Signaling server).
- End-to-end encryption (E2EE) for direct messages leveraging client-side keys.
- Complete message forwarding capabilities across conversations.
- Extended user blocking system to prohibit interactions across groups, not just DMs.

## Medium Priority
- Conversation data export (JSON/PDF transcription).
- Message scheduling logic (delayed publishing queues).
- Advanced Elasticsearch filters (e.g., search by date range, media type).
- Programmable Bot/Chatbot webhook integration.
