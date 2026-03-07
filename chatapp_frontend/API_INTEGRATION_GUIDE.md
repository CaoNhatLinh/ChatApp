# ChatApp Frontend API Integration

Tài liệu hướng dẫn sử dụng các API từ backend ChatApp.

## 📁 Cấu trúc Files Mới

```
src/
├── api/
│   ├── messageApi.ts          # Message APIs
│   ├── userApi.ts            # User APIs  
│   ├── conversationApi.ts    # Conversation APIs (updated)
│   └── websocketEvents.ts    # WebSocket event types
├── services/
│   └── chatWebSocketService.ts # WebSocket service class
├── hooks/
│   └── useChatWebSocket.ts   # React hooks for WebSocket
├── utils/
│   └── apiHelpers.ts         # API helper utilities
└── components/examples/
    └── ChatExample.tsx       # Demo component
```

## 🔌 API Endpoints Đã Implement

### **Message APIs**
```typescript
// Get messages from conversation
const messages = await getMessages(token, conversationId, { limit: 20 });

// Send message via HTTP
const message = await sendMessageHttp(token, {
  conversationId: "uuid",
  content: "Hello world",
  messageType: "text"
});

// Send message via WebSocket
sendMessageWs({
  conversationId: "uuid",
  content: "Hello world",
  messageType: "text"
});
```

### **User APIs**
```typescript
// Get user profile
const user = await getUserProfile(token, userId);

// Search users
const users = await searchUsersNew(token, "search query");
```

### **Conversation APIs**
```typescript
// Get user's conversations
const conversations = await fetchMyConversations(token, userId);

// Create conversation
const conversation = await createConversation(token, {
  name: "Group Chat",
  type: "group",
  memberIds: ["user1", "user2"]
});

// Find or create DM
const dmConversation = await findDmConversation(token, userId1, userId2);
```

## 🔌 WebSocket Integration

### **Sử dụng ChatWebSocketService**
```typescript
import { chatWebSocketService } from '@/services/chatWebSocketService';

// Subscribe to messages
chatWebSocketService.subscribeToMessages('conversationId', (message) => {
  console.log('New message:', message);
});

// Send message
chatWebSocketService.sendMessage({
  conversationId: 'uuid',
  content: 'Hello',
  messageType: 'text'
});

// Send typing indicator
chatWebSocketService.sendTyping('conversationId', true);

// Set online status
chatWebSocketService.setOnlineStatus(true);
```

### **Sử dụng React Hooks**
```typescript
import { useChatWebSocket } from '@/hooks/useChatWebSocket';

const ChatComponent = () => {
  const { sendMessage, sendTyping, setOnlineStatus } = useChatWebSocket({
    onMessageReceived: (message) => {
      console.log('Message received:', message);
    },
    onTypingReceived: (event) => {
      console.log('Typing event:', event);
    },
    onOnlineStatusReceived: (event) => {
      console.log('Online status:', event.statusMap);
    }
  });

  // Use the methods...
};
```

## 🛠️ Helper Utilities

### **API Helper Classes**
```typescript
import { messageApi, conversationApi, userApi } from '@/utils/apiHelpers';

// Message operations
const messages = await messageApi.getConversationMessages('conversationId');
await messageApi.sendMessage('conversationId', 'Hello world');

// Conversation operations
const conversations = await conversationApi.getMyConversations();
const newConv = await conversationApi.createGroupConversation('Group Name', ['user1', 'user2']);

// User operations
const user = await userApi.getUserById('userId');
const users = await userApi.searchUsers('query');
```

### **Utility Functions**
```typescript
import { formatTimestamp, getDisplayName, getAvatarUrl } from '@/utils/apiHelpers';

// Format timestamp
const formatted = formatTimestamp('2025-07-14T10:30:00Z'); // "2 giờ trước"

// Get display name
const name = getDisplayName(user); // user.display_name || user.nickname || user.username

// Get avatar URL
const avatar = getAvatarUrl(user); // user.avatar_url || '/default-avatar.png'
```

## 📨 Data Types

### **Interfaces Chính**
```typescript
// User data
interface UserDTO {
  user_id: string;
  username: string;
  display_name: string;
  nickname: string;
  avatar_url: string;
  created_at: string;
}

// Message data
interface MessageResponseDto {
  messageId: string;
  conversationId: string;
  sender: UserDTO;
  content: string;
  messageType: 'text' | 'image' | 'notification';
  reactions: MessageReactionDto[];
  replyTo: ReplyToDto | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// Conversation data
interface ConversationResponseDto {
  conversationId: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
  memberCount: number;
  otherParticipant?: UserDTO;
  lastMessage?: MessageSummary;
  createdAt: string;
}
```

## 🔔 WebSocket Events

### **Subscription Topics**
- `/topic/conversation/{conversationId}` - Messages for specific conversation
- `/queue/typing` - Typing indicators
- `/queue/online-status` - Online status responses
- `/topic/presence` - Global presence events
- `/queue/notifications` - User notifications

### **Send Destinations**
- `/app/message.send` - Send message
- `/app/typing` - Send typing indicator  
- `/app/online-status` - Set online status
- `/app/request-online-status` - Request online status of users
- `/app/notification.read` - Mark notification as read

## 🚀 Usage Example

Xem file `src/components/examples/ChatExample.tsx` để có ví dụ hoàn chỉnh về cách tích hợp:

1. Load conversations list
2. Subscribe to WebSocket messages
3. Display real-time messages
4. Send messages via WebSocket
5. Handle typing indicators
6. Track online status

## 🔧 Authentication

Tất cả API calls cần JWT token trong header:
```typescript
Authorization: Bearer {jwt_token}
```

Token được quản lý qua các helper functions:
```typescript
import { setAuthToken, getAuthToken, removeAuthToken } from '@/utils/apiHelpers';

// Set token
setAuthToken('your-jwt-token', true); // persistent = true for localStorage

// Get token
const token = getAuthToken();

// Remove token
removeAuthToken();
```

## 🎯 Migration từ Code Cũ

Để migration từ APIs cũ sang APIs mới:

1. **Message APIs**: Thay `Message` interface → `MessageResponseDto`
2. **WebSocket**: Sử dụng `chatWebSocketService` thay vì direct STOMP calls
3. **Error Handling**: Sử dụng `getErrorMessage()` helper
4. **Caching**: Sử dụng built-in cache helpers cho performance

## 📋 Todo

- [ ] Add message reactions API
- [ ] Add file upload/attachment APIs  
- [ ] Add conversation member management APIs
- [ ] Add notification APIs
- [ ] Add message search APIs
- [ ] Add user friend/contact APIs
