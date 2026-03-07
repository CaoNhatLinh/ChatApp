# Frontend Integration Guide - Chat Application

## 📋 Tổng quan

Document này hướng dẫn cách sử dụng đầy đủ các tính năng đã được tích hợp từ backend.

## 🔧 Đã sửa các lỗi

### 1. ✅ Lỗi FriendItem undefined reading '0'
- **Vấn đề**: `friend.display_name[0]` khi `display_name` là `undefined`
- **Giải pháp**: Thêm optional chaining và fallback
```typescript
{(friend?.display_name?.[0] || friend?.username?.[0] || '?').toUpperCase()}
```

### 2. ✅ Lỗi User ID is not available
- **Vấn đề**: Console.error gây nhiễu khi user chưa load
- **Giải pháp**: Bỏ log error, chỉ return silently

### 3. ✅ Lỗi MessageList sender undefined
- **Vấn đề**: Message từ backend có thể thiếu sender data
- **Giải pháp**: Thêm safety checks với optional chaining

## 🎯 Các tính năng đã tích hợp

### 1. **Authentication & User Management**

#### Login/Register
```typescript
import { login, register } from '@/api/authApi';

// Login
const response = await login({ username, password });
localStorage.setItem('token', response.token);

// Register  
const user = await register({ 
  username, 
  password, 
  displayName, 
  email 
});
```

#### Get Current User
```typescript
import { getCurrentUser } from '@/api/authApi';
import { useAuthStore } from '@/store/authStore';

const { user, initializeAuth } = useAuthStore();

// Auto initialize on app start
useEffect(() => {
  initializeAuth();
}, []);
```

### 2. **Friend Management**

#### Search & Add Friends
```typescript
import { searchUsers, sendFriendRequest } from '@/api/friendApi';

// Search users
const results = await searchUsers(searchTerm);

// Send friend request
await sendFriendRequest(currentUserId, targetUserId);
```

#### Accept/Reject Friend Requests
```typescript
import { acceptFriendRequest, rejectFriendRequest } from '@/api/friendApi';

// Accept request
await acceptFriendRequest(currentUserId, requesterId);

// Reject request
await rejectFriendRequest(currentUserId, requesterId);
```

#### Get Friends List
```typescript
import { getFriends } from '@/api/friendApi';

const friendsResponse = await getFriends(userId);
// Returns: { userId, status, userDetails: User[] }
```

### 3. **Conversation Management**

#### Create Conversation
```typescript
import { createConversation } from '@/api/conversationApi';

// Create DM
const dmConv = await createConversation({
  type: 'dm',
  memberIds: [friendUserId]
});

// Create Group
const groupConv = await createConversation({
  type: 'group',
  name: 'Group Name',
  memberIds: [userId1, userId2, userId3]
});
```

#### Get Conversations
```typescript
import { getConversations } from '@/api/conversationApi';

const conversations = await getConversations(userId);
```

#### Update Conversation
```typescript
import { updateConversation } from '@/api/conversationApi';

await updateConversation(conversationId, {
  name: 'New Group Name',
  description: 'New description',
  avatarUrl: 'https://...'
});
```

### 4. **Message Management**

#### Send Message (HTTP)
```typescript
import { sendMessage } from '@/api/messageApi';

const message = await sendMessage({
  conversationId,
  content: 'Hello!',
  messageType: 'text',
  replyTo: parentMessageId, // optional
  mentionedUserIds: [userId1, userId2] // optional
});
```

#### Send Message (WebSocket) - Real-time
```typescript
import { chatWebSocketService } from '@/services/chatWebSocketService';

// Connect first
chatWebSocketService.connect(token);

// Send message
chatWebSocketService.sendMessage({
  conversationId,
  content: 'Hello in real-time!',
  type: 'TEXT',
  mentions: [userId],
  replyTo: messageId
});
```

#### Get Messages
```typescript
import { getMessages } from '@/api/messageApi';

const messages = await getMessages(conversationId, {
  before: lastMessageId, // for pagination
  limit: 50
});
```

#### React to Message
```typescript
import { addReaction, removeReaction } from '@/api/messageApi';

// Add reaction
await addReaction(messageId, '👍');

// Remove reaction
await removeReaction(messageId, '👍');
```

### 5. **Online Status & Presence**

#### Subscribe to Online Status
```typescript
import { useOnlineStatus } from '@/hooks/presence';

const { isOnline, subscribeToFriends, subscribe } = useOnlineStatus();

// Subscribe to all friends
useEffect(() => {
  subscribeToFriends();
}, []);

// Check if user is online
const userIsOnline = isOnline(userId);

// Subscribe to specific user
subscribe(friendUserId);
```

#### Update Your Status
```typescript
import { updateActivityStatus } from '@/api/presenceApi';

// Toggle activity status visibility
await updateActivityStatus(userId, true); // visible
await updateActivityStatus(userId, false); // hidden
```

#### Get User Status
```typescript
import { getUserStatus } from '@/api/presenceApi';

const status = await getUserStatus(userId);
// Returns: { userId, online, lastSeen }
```

### 6. **Real-time WebSocket Events**

#### Connect to WebSocket
```typescript
import { chatWebSocketService } from '@/services/chatWebSocketService';

// Connect with JWT token
chatWebSocketService.connect(token);

// Disconnect
chatWebSocketService.disconnect();
```

#### Subscribe to Events
```typescript
// New messages
chatWebSocketService.subscribeToMessages((message) => {
  console.log('New message:', message);
  // Update UI
});

// Typing indicators
chatWebSocketService.subscribeToTyping((event) => {
  console.log(`${event.username} is typing in ${event.conversationId}`);
});

// Online status updates
chatWebSocketService.subscribeToOnlineStatus((event) => {
  console.log('Status update:', event.statusMap);
  // Update online users list
});

// Message reactions
chatWebSocketService.subscribeToReactions((event) => {
  console.log('Reaction:', event);
  // Update message reactions
});
```

#### Send Typing Indicator
```typescript
chatWebSocketService.sendTyping(conversationId, true); // start typing
chatWebSocketService.sendTyping(conversationId, false); // stop typing
```

### 7. **Notifications**

#### Get Notifications
```typescript
import { getNotifications, getUnreadCount } from '@/api/notificationApi';

// Get all notifications
const notifications = await getNotifications(userId);

// Get unread count
const count = await getUnreadCount(userId);
```

#### Mark as Read
```typescript
import { markAsRead, markAllAsRead } from '@/api/notificationApi';

// Mark single notification
await markAsRead(notificationId);

// Mark all as read
await markAllAsRead(userId);
```

#### Subscribe to Real-time Notifications
```typescript
chatWebSocketService.subscribeToNotifications((notification) => {
  console.log('New notification:', notification);
  // Show toast or update UI
});
```

### 8. **File Upload**

#### Upload Image/File
```typescript
import { uploadFile } from '@/api/fileApi';

const file = event.target.files[0];
const result = await uploadFile(file);

// Use result.url in message
await sendMessage({
  conversationId,
  content: result.url,
  messageType: 'image'
});
```

## 🎨 UI Components Usage

### MessageList Component
```tsx
import { MessageList } from '@/components/chat/MessageList';

<MessageList 
  conversationId={selectedConversation.conversationId}
  conversation={selectedConversation}
  onReply={(message) => setReplyTo(message)}
/>
```

### FriendList Component
```tsx
import { FriendList } from '@/components/friend/FriendList';

<FriendList />
```

### FriendItem Component
```tsx
import { FriendItem } from '@/components/friend/FriendItem';

<FriendItem
  friend={user}
  isFriend={true}
  onAddFriend={handleAddFriend}
/>
```

## 🔐 Environment Variables

Tạo file `.env` với nội dung:

```env
# Backend API
VITE_API_BASE_URL=http://localhost:8084
VITE_WS_URL=ws://localhost:8084

# Optional: Cloudinary for file upload
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_preset
```

## 🐛 Debugging Tips

### 1. Message không hiển thị
```typescript
// Check message structure
console.log('Messages:', messages);
console.log('Message sender:', messages[0]?.sender);

// Ensure sender has user_id
if (!message.sender?.user_id) {
  console.error('Message missing sender ID');
}
```

### 2. WebSocket không connect
```typescript
// Check connection status
import { useWebSocketStore } from '@/store/websocketStore';

const { isConnected } = useWebSocketStore();
console.log('WebSocket connected:', isConnected);

// Check token
const token = localStorage.getItem('token');
console.log('Token exists:', !!token);
```

### 3. Online status không update
```typescript
// Verify subscription
import { useOnlineStatus } from '@/hooks/presence';

const { statusMap, subscribeToFriends } = useOnlineStatus();

useEffect(() => {
  subscribeToFriends();
  console.log('Subscribed to friends');
}, []);

console.log('Online status map:', statusMap);
```

### 4. Friend request không gửi được
```typescript
// Check user IDs
console.log('Current user ID:', currentUser?.user_id);
console.log('Target user ID:', targetUser?.user_id);

// Check API response
try {
  await sendFriendRequest(currentUserId, targetUserId);
} catch (error) {
  console.error('Friend request error:', error.response?.data);
}
```

## 📱 Modal & Toast Management

### Toast Notifications
```typescript
import toast from 'react-hot-toast';

// Success
toast.success('Message sent successfully');

// Error
toast.error('Failed to send message');

// Loading
const toastId = toast.loading('Sending...');
toast.success('Done!', { id: toastId });
```

### Fix Modal Position
```css
/* Ensure modals are properly positioned */
.modal-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

## 🚀 Performance Tips

### 1. Lazy load messages
```typescript
const { loadMoreMessages, hasMore } = useMessages({ conversationId });

// Load when scrolling to top
if (scrollTop < 100 && hasMore) {
  await loadMoreMessages();
}
```

### 2. Debounce search
```typescript
import { debounce } from 'lodash';

const debouncedSearch = debounce(async (term) => {
  const results = await searchUsers(term);
  setSearchResults(results);
}, 300);
```

### 3. Memoize components
```typescript
import { memo } from 'react';

export const MessageBubble = memo(({ message }) => {
  // Component code
});
```

## 🎯 Next Steps

1. ✅ Test tất cả các tính năng
2. ✅ Xử lý edge cases (null, undefined)
3. ✅ Optimize performance
4. ⏳ Add error boundaries
5. ⏳ Add loading skeletons
6. ⏳ Add offline support
7. ⏳ Add message caching

## 📚 Additional Resources

- Backend API Docs: `http://localhost:8084/swagger-ui.html`
- WebSocket Events: See `src/types/socketEvents.ts`
- Type Definitions: See `src/types/` folder

---

**Last Updated**: November 1, 2025
**Version**: 1.0.0
