# API Reference

## REST API Endpoints

### 1. Authentication (`AuthController`)
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user and receive a JWT token
- `POST /api/auth/refresh` - Refresh an expired JWT token
- `POST /api/auth/logout` - Logout and invalidate user session
- `GET /api/auth/me` - Get current authenticated user details

### 2. User Profiles (`UserController`)
- `GET /api/users/search` - Search users by name/email
- `GET /api/users/{userId}` - Get specific user profile
- `PUT /api/users/profile` - Update current user profile

### 3. Friendship & Blocking (`FriendController`)
- `GET /api/friends/` - Get user's friend list
- `GET /api/friends/requests/received/{userId}` - Get pending received requests
- `GET /api/friends/requests/sent/{userId}` - Get sent friend requests
- `POST /api/friends/request` - Send a friend request
- `PUT /api/friends/accept` - Accept a friend request
- `PUT /api/friends/reject` - Reject a friend request
- `DELETE /api/friends/{friendId}` - Unfriend a user
- `POST /api/friends/block/{userId}` - Block a user
- `POST /api/friends/unblock/{userId}` - Unblock a user
- `GET /api/friends/check-block/{otherUserId}` - Check blocking status with another user

### 4. Conversations (`ConversationController` & `ConversationManagementController`)
- `GET /api/conversations/my` - Get all conversations (groups/DMs) for current user
- `GET /api/conversations/{conversationId}` - Get details of a specific conversation
- `GET /api/conversations/dm` - Find private conversation between two users
- `POST /api/conversations` - Create a new conversation (Group/DM)
- `PUT /api/conversations/{conversationId}` - Update conversation details (name, background)
- `DELETE /api/conversations/{conversationId}` - Soft delete a conversation
- `PUT /api/conversations/{conversationId}/restore` - Restore a soft-deleted conversation
- `DELETE /api/conversations/{conversationId}/permanent` - Permanently delete a conversation
- `PUT /api/conversations/{conversationId}/pin` - Pin conversation to top
- `PUT /api/conversations/{conversationId}/unpin` - Unpin conversation

**Management (Group Members & Roles)**
- `GET /api/conversations/{conversationId}/management/members` - Get conversation members
- `POST /api/conversations/{conversationId}/management/members/add` - Add members to group
- `DELETE /api/conversations/{conversationId}/management/members/{memberId}` - Remove member from group
- `POST /api/conversations/{conversationId}/management/leave` - Leave conversation
- `POST /api/conversations/{conversationId}/management/transfer-ownership` - Transfer owner role
- `POST /api/conversations/{conversationId}/management/grant-admin` - Grant admin role
- `POST /api/conversations/{conversationId}/management/revoke-admin` - Revoke admin role

**Invitation Links**
- `POST /api/conversations/{conversationId}/management/invitations` - Create an invite link
- `GET /api/conversations/{conversationId}/management/invitations` - Get all invite links
- `DELETE /api/conversations/{conversationId}/management/invitations/{linkId}` - Delete invite link
- `PUT /api/conversations/{conversationId}/management/invitations/{linkId}/deactivate` - Deactivate link
- `POST /api/conversations/{conversationId}/management/invitations/join/{linkToken}` - Join via link

### 5. Messages & Enhancements (`MessageController`)
- `GET /api/messages/{conversationId}` - Get latest messages within a conversation
- `GET /api/messages/conversations/{conversationId}/older` - Get older messages (pagination before ID)
- `GET /api/messages/conversations/{conversationId}/filtered` - Get messages mapped between date ranges
- `POST /api/messages` - Send a message to a conversation
- `POST /api/messages/{conversationId}/{messageId}/attachments` - Add attachment to a message
- `GET /api/messages/{conversationId}/{messageId}/attachments` - Get attachments of a message
- `POST /api/messages/{conversationId}/{messageId}/reactions/{emoji}` - Toggle emoji reaction
- `GET /api/messages/{conversationId}/{messageId}/reactions` - Get aggregated reactions
- `POST /api/messages/{conversationId}/{messageId}/read` - Mark specific message as read
- `GET /api/messages/{conversationId}/{messageId}/read-receipts` - Get list of users who read message
- `POST /api/messages/{conversationId}/{messageId}/pin` - Toggle pinning a message in conversation
- `GET /api/messages/{conversationId}/pinned` - Get all pinned messages of a conversation

### 6. Search (Elasticsearch) (`SearchController`)
- `GET /api/search/conversations` - Full-text search conversations by name/type
- `GET /api/search/messages` - Full-text search messages by content/sender/type
- `GET /api/search/messages/mentions` - Find messages mentioning a specific user

### 7. Notifications (`NotificationController`)
- `GET /api/notifications` - Get user notifications (paginated)
- `GET /api/notifications/unread` - Get unread notifications
- `GET /api/notifications/unread/count` - Get number of unread notifications
- `GET /api/notifications/type/{type}` - Filter by notification type
- `GET /api/notifications/search` - Search through notifications
- `GET /api/notifications/latest` - Fetch the most recent notifications
- `PUT /api/notifications/{notificationId}/read` - Mark specific notification as read
- `PUT /api/notifications/read-all` - Mark ALL user notifications as read
- `PUT /api/notifications/bulk-read` - Mark multiple specified notifications as read
- `DELETE /api/notifications/{notificationId}` - Delete single notification
- `DELETE /api/notifications/all` - Delete all notifications

### 8. File Uploads (`FileUploadController`)
- `POST /api/files/upload` - Upload a single text/image/video/audio file
- `POST /api/files/upload/multiple` - Upload multiple files concurrently
- `DELETE /api/files/delete/{publicId}` - Remove an uploaded file (from Cloudinary/storage)

### 9. Presence (`PresenceController`)
- `POST /api/presence/heartbeat` - Refresh user online session
- `POST /api/presence/subscribe` - Subscribe to explicitly track a user's presence
- `POST /api/presence/unsubscribe` - Stop tracking a user's presence
- `POST /api/presence/batch-get` - Get presence bounds for a list of users

### 10. Cache Management (`CacheManagementController`)
- `GET /api/cache/stats` - Read Redis cache metrics
- `GET /api/cache/health` - Check Redis cache connection health
- `DELETE /api/cache/clear/all` - Flush entire Redis cache (Admin only)
- `DELETE /api/cache/clear/conversation/{conversationId}` - Clear cache for a specific conversation
- `DELETE /api/cache/clear/user/{userId}` - Clear cache for a specific user

### 11. Polls (`PollController`) - *Currently Mocked/Stubbed*
- `POST /api/polls` - Create a new poll
- `POST /api/polls/{pollId}/vote` - Cast a vote
- `GET /api/polls/{pollId}/results` - Get poll results
- `POST /api/polls/{pollId}/close` - Close an active poll
- `DELETE /api/polls/{pollId}/vote` - Revoke vote

---

## 🔌 WebSocket (STOMP) Endpoints

Connect to WebSocket at: `ws://localhost:8084/ws`

### Subscribe Channels (Client listens):
- `/user/queue/messages` - Receive personal messages
- `/user/queue/message-echo` - Receive echo of your sent messages (for instant UI update)
- `/user/queue/notifications` - Receive push notifications
- `/user/queue/online-status` - Receive updates when friends come online/offline
- `/user/queue/errors` - Receive WebSocket-level errors
- `/topic/conversation/{conversationId}` - Global conversation updates
- `/topic/conversation/{conversationId}/typing` - Typing indicators
- `/topic/conversation/{conversationId}/reactions` - Real-time reaction updates
- `/topic/conversation/{conversationId}/read` - Real-time read receipt updates
- `/topic/conversation/{conversationId}/pins` - Real-time pin/unpin updates

### Send Channels (Client sends):
- `/app/message.send` - Send a text message payload
- `/app/message.file` - Send a file attachment message payload
- `/app/typing` - Broadcast typing status (`{ "typing": true }`)
- `/app/request-online-status` - Query explicit online status of someone
- `/app/heartbeat` - Send heartbeat frame to maintain presence
- `/app/notification.read` - Acknowledge a push notification as read
- `/app/notifications.read-all` - Acknowledge all notifications as read
- `/app/presence/logout` - Broadcast offline status immediately
- `/app/presence.subscribe` - Subscribe to presence push for array of users
- `/app/presence.unsubscribe` - Unsubscribe from presence push
- `/app/presence.batch` - Request immediate presence list
