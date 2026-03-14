# NovaChat Social And Messaging Technical Guide

This document describes the current cross-layer behavior for friendship, block, notifications, unread/read state, pinning, reply, attachments, and presence across:

- `chat-service` (Spring Boot, Cassandra, Redis, Kafka, WebSocket)
- `chatapp_frontend` (React, TypeScript, Zustand, STOMP)

It is intended to be the source of truth for feature behavior and data contracts.

## 1. Core Principles

- Backend is the source of truth for conversations, message history, read receipts, notification persistence, and pin limits.
- Frontend keeps optimistic UI to a minimum and reconciles against REST or WebSocket payloads.
- Conversation ordering is driven by `lastActivityAt` and refreshed when new messages arrive.
- Notification badges are split into two concerns:
  - conversation unread count: unread messages in a conversation
  - conversation notification badge: unread notification events tied to a conversation, such as DM message, mention, or reply

## 2. Friendship And Block

### Friendship lifecycle

- Friend requests are created in `FriendService` and broadcast through `FriendshipEventListener` and Kafka listeners.
- Friend-request updates are delivered through `/queue/friend-requests` for realtime UI refresh.
- Persistent notification records are also stored through the notification pipeline, so friend requests and accept/reject outcomes are queryable from `/api/notifications`.

### Frontend behavior

- Contacts and friend views render request state from the relationships store.
- Sender-side UI no longer promotes a pending request directly into the accepted friends list.
- `friendRequestCount` is rendered on the contacts button in the messenger sidebar.

### Block behavior

- Block/unblock flows are handled in friendship state.
- Group-chat message previews and message rendering respect block state and hide blocked-user content where required.

## 3. Conversation List Semantics

### Last message

- Backend conversation responses include `lastMessage`.
- Frontend sidebar consumes `lastMessage` to render sender name, content preview, and relative time.

### Ordering

- When a new message is persisted, all `user_conversations` rows are rewritten with updated `lastActivityAt`.
- Frontend hoists the touched conversation to the correct position and keeps pinned conversations ahead of unpinned ones.

### Pin conversation

- Conversation pin/unpin is done through `/api/conversations/{conversationId}/pin` and `/unpin`.
- Backend enforces a maximum of `5` pinned conversations per user.
- Frontend renders pinned state and pin/unpin controls in the sidebar item.

## 4. Message Lifecycle

### Send

- Message submission goes through `POST /api/messages`.
- The request is forwarded to Kafka and then persisted by `KafkaEventConsumer` through `MessageService.sendMessage(...)`.
- Persisted messages are rebroadcast to `/topic/conversation/{conversationId}`.

### Reply

- Requests may include `replyTo` / `replyToId`.
- Backend enriches the referenced message into `replyTo` data in `MessageResponseDto`.
- Frontend shows reply preview in both composer and bubble.
- Reply notifications are created for the original message author when another user replies.

### Mention

- Mentioned user IDs are persisted in `message_mentions` and propagated into the search index.
- Mention notifications are stored and pushed in realtime.

### Edit and delete

- `PUT /api/messages/{conversationId}/{messageId}` edits a message.
- `DELETE /api/messages/{conversationId}/{messageId}` performs soft delete.
- Every edit and delete stores the prior state in `message_revisions`.
- `GET /api/messages/{conversationId}/{messageId}/revisions` returns message history.
- Frontend exposes edit, soft-delete, and revision-history dialog from message actions.

### Attachments

- Frontend uploads files through `/api/files/upload` or `/api/files/upload/multiple`.
- Uploaded file metadata is attached to `SendMessageRequest.attachments`.
- Backend persists attachment rows in `message_attachments` and includes them in enriched message responses.
- Frontend renders images, video, and file attachments inline.

### Pin message

- Pinning uses `POST /api/messages/{conversationId}/{messageId}/pin`.
- Backend enforces a maximum of `5` pinned messages per conversation.

## 5. Read State And Unread State

### Read receipts

- `POST /api/messages/{conversationId}/{messageId}/read` creates a read receipt if one does not already exist.
- Backend enriches messages with `readReceipts`.
- Frontend subscribes to read-receipt realtime events and updates local message state.
- Sender can inspect the latest seen timestamp from their own message bubble.

### Conversation unread count

- Backend conversation responses include `unreadCount`.
- The unread count is computed from all non-deleted, non-self messages that do not yet have a read receipt for the current user.
- Frontend sidebar renders this count and resets it to `0` when the conversation is opened.

### Auto-read behavior

- When a conversation is selected, frontend marks visible incoming messages as read.
- This causes message-level read receipts to propagate and conversation unread count to drop on the next sync or realtime merge.

## 6. Notification System

### Backend notification types

Current persisted notification types include:

- `FRIEND_REQUEST`
- `MESSAGE`
- `MENTION`
- `REPLY`
- `REACTION`
- `PIN_MESSAGE`
- `POLL`
- `CONVERSATION_INVITE`
- `SYSTEM`

### Persistence and delivery

- Notifications are stored in the Cassandra `notifications` table.
- `NotificationCreationService` saves the record, invalidates notification caches, increments unread count, and pushes realtime data through `/user/queue/notifications` unless the recipient is in `DND`.
- Read/delete mutations emit realtime updates through:
  - `/user/queue/notification-read`
  - `/user/queue/notification-delete`

### Conversation-specific notifications

- DM messages generate `MESSAGE` notifications for the other participant.
- Mentions generate `MENTION` notifications for each mentioned user.
- Replies generate `REPLY` notifications for the author of the original message.
- Frontend maps these unread notifications by `metadata.conversationId` and displays them on the conversation avatar.
- Opening the related conversation bulk-marks those notifications as read, so the avatar badge clears automatically.

### Friend-request notifications

- Friend-request notifications remain global rather than conversation-specific.
- Frontend keeps those visible through the contacts/friends affordance and the notification center.

### REST endpoints used by frontend

- `GET /api/notifications`
- `GET /api/notifications/unread`
- `GET /api/notifications/unread/count`
- `PUT /api/notifications/{notificationId}/read`
- `PUT /api/notifications/bulk-read`
- `PUT /api/notifications/read-all`
- `DELETE /api/notifications/{notificationId}`
- `DELETE /api/notifications/all`
- `GET /api/notifications/stats`

## 7. Presence And Device

- Presence statuses exposed to clients are aligned to the backend contract.
- Device information is included in presence responses and realtime presence events.
- Frontend shows device-aware status in the DM header, for example online plus current device.
- `DND` suppresses realtime notification push, but notifications are still persisted and remain unread in the database.

## 8. Frontend State Ownership

### Messenger store

The messenger Zustand store owns:

- conversations
- active conversation
- message collections and pagination
- typing users
- conversation unread counts

### Notification store

The notification Zustand store owns:

- notification list fetched from `/api/notifications`
- unread notification count
- realtime notification merges
- notification-center panel state
- bulk mark-read for conversation-linked notifications

## 9. Runtime Notes And Limits

- Backend static diagnostics for the latest messaging and notification changes are clean.
- Frontend production build is currently passing.
- Local backend compile was not revalidated in this session because the environment is missing `JAVA_HOME`.
- End-to-end runtime verification against a running backend is still recommended for:
  - reply notification delivery
  - mention notification delivery
  - DM notification suppression in `DND`
  - Cassandra migration rollout for `message_revisions`

## 10. Suggested QA Checklist

Use this list for manual verification after backend is running:

1. Send a DM from user A to user B and confirm:
   - user B receives a `MESSAGE` notification
   - the conversation avatar badge increments
   - opening the conversation clears the badge
2. Mention user B in a group conversation and confirm:
   - user B receives a `MENTION` notification
   - the linked conversation avatar shows the notification count
3. Reply to user B’s message and confirm:
   - user B receives a `REPLY` notification
   - opening that conversation clears it
4. Send and accept a friend request and confirm:
   - contacts request count updates
   - notification center shows the persisted event
5. Edit and delete a message and confirm:
   - revision history returns previous content
   - soft-deleted message remains visible as deleted state
6. Pin more than five messages or conversations and confirm backend rejects the overflow.