# 🔗 Frontend-Backend Integration Guide

## 📋 Table of Contents
1. [Environment Setup](#environment-setup)
2. [Authentication Flow](#authentication-flow)
3. [WebSocket Connection](#websocket-connection)
4. [API Usage Examples](#api-usage-examples)
5. [State Management](#state-management)
6. [Error Handling](#error-handling)

## 🔧 Environment Setup

### 1. Create `.env` file
```bash
cp .env.example .env
```

### 2. Configure environment variables
```env
VITE_API_URL=http://localhost:8084/api
VITE_WS_URL=http://localhost:8084/ws
VITE_ENV=development
VITE_DEBUG=true
```

### 3. Start backend server
Make sure backend is running on port 8084

### 4. Start frontend
```bash
npm run dev
```

## 🔐 Authentication Flow

### Login Example
```typescript
import { login } from '@/api/authApi';

const handleLogin = async (username: string, password: string) => {
  try {
    // Call backend API
    const response = await login({ username, password });
    
    // Save token to localStorage
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    // Redirect to chat
    navigate('/chat');
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

### Get Current User
```typescript
import { getCurrentUser } from '@/api/authApi';

const fetchUser = async () => {
  try {
    const user = await getCurrentUser();
    console.log('Current user:', user);
  } catch (error) {
    // Token invalid or expired - redirect to login
    navigate('/login');
  }
};
```

### Protected Routes
```typescript
import { ProtectedRoute } from '@/components/ProtectedRoute';

<Route path="/chat" element={
  <ProtectedRoute>
    <ChatPage />
  </ProtectedRoute>
} />
```

## 🔌 WebSocket Connection

### Connect to WebSocket
```typescript
import { connectWebSocket, subscribe } from '@/services/websocketService';

// Connect with JWT token
const token = localStorage.getItem('token');
if (token) {
  connectWebSocket(token)
    .then(() => {
      console.log('WebSocket connected');
      
      // Subscribe to user's private queue
      subscribe('/user/queue/messages', (message) => {
        console.log('New message:', message);
      });
      
      // Subscribe to conversation topic
      subscribe(`/topic/conversation/${conversationId}`, (message) => {
        console.log('Conversation update:', message);
      });
    })
    .catch(error => {
      console.error('WebSocket connection failed:', error);
    });
}
```

### Send Message via WebSocket
```typescript
import { sendMessageWs } from '@/api/messageApi';

const sendMessage = () => {
  sendMessageWs({
    conversationId: 'uuid',
    content: 'Hello!',
    messageType: 'TEXT',
  });
};
```

### WebSocket Destinations

#### Subscribe (Receive)
- `/user/queue/messages` - Private messages
- `/user/queue/notifications` - Notifications
- `/topic/conversation/{id}` - Conversation updates
- `/topic/presence` - Presence updates

#### Publish (Send)
- `/app/message.send` - Send message
- `/app/typing` - Typing indicator
- `/app/online-status` - Set online status
- `/app/request-online-status` - Request presence

## 📚 API Usage Examples

### Conversations

#### Get My Conversations
```typescript
import { fetchMyConversations } from '@/api/conversationApi';

const loadConversations = async () => {
  try {
    const conversations = await fetchMyConversations();
    console.log('Conversations:', conversations);
  } catch (error) {
    console.error('Failed to load conversations:', error);
  }
};
```

#### Create Group Conversation
```typescript
import { createConversation } from '@/api/conversationApi';

const createGroup = async () => {
  try {
    const conversation = await createConversation({
      type: 'GROUP',
      name: 'My Group',
      memberIds: ['user-id-1', 'user-id-2'],
    });
    console.log('Created:', conversation);
  } catch (error) {
    console.error('Failed to create group:', error);
  }
};
```

### Messages

#### Load Messages (Paginated)
```typescript
import { getLatestMessages, getOlderMessages } from '@/api/messageApi';

// Load initial 20 messages
const loadMessages = async (conversationId: string) => {
  const messages = await getLatestMessages(token, conversationId, 20);
  setMessages(messages);
};

// Load older messages when scrolling up
const loadMore = async (conversationId: string, oldestMessageId: string) => {
  const olderMessages = await getOlderMessages(token, conversationId, oldestMessageId);
  setMessages(prev => [...olderMessages, ...prev]);
};
```

#### Send Message (HTTP)
```typescript
import { sendMessageHttp } from '@/api/messageApi';

const sendMessage = async () => {
  const message = await sendMessageHttp(token, {
    conversationId: 'uuid',
    content: 'Hello!',
    messageType: 'TEXT',
  });
  console.log('Message sent:', message);
};
```

### Presence

#### Get Friends Presence
```typescript
import { getFriendsPresence } from '@/api/presenceApi';

const loadPresence = async () => {
  const presence = await getFriendsPresence();
  console.log('Friends online status:', presence);
  
  // Example response:
  // {
  //   "user-id-1": { userId: "...", status: "ONLINE", isOnline: true },
  //   "user-id-2": { userId: "...", status: "OFFLINE", lastSeen: "..." }
  // }
};
```

#### Check User Online
```typescript
import { checkUserOnline } from '@/api/presenceApi';

const isOnline = await checkUserOnline('user-id');
console.log('User is online:', isOnline);
```

### Notifications

#### Get Unread Notifications
```typescript
import { getUnreadNotifications, markAsRead } from '@/api/notificationApi';

// Get unread notifications
const notifications = await getUnreadNotifications();

// Mark as read
await markAsRead(notificationId);

// Get unread count
const { count } = await getUnreadCount();
```

### Search (Elasticsearch)

#### Search Conversations
```typescript
import { searchConversations } from '@/api/searchApi';

const results = await searchConversations({
  query: 'project',
  type: 'GROUP',
  limit: 20,
});
```

#### Search Messages
```typescript
import { searchMessages } from '@/api/searchApi';

const messages = await searchMessages({
  conversationId: 'uuid',
  content: 'hello',
  limit: 50,
});
```

### Friends

#### Send Friend Request
```typescript
import { sendFriendRequest } from '@/api/friendApi';

await sendFriendRequest('user-id');
```

#### Accept Friend Request
```typescript
import { acceptFriendRequest } from '@/api/friendApi';

await acceptFriendRequest('request-id');
```

## 🏪 State Management

### Using Zustand Stores

```typescript
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import { usePresenceStore } from '@/store/presenceStore';

// Auth store
const { user, token, setUser, logout } = useAuthStore();

// Conversation store
const { conversations, selectedConversation, setConversations } = useConversationStore();

// Presence store
const { presenceMap, updatePresence } = usePresenceStore();
```

## ❌ Error Handling

### Axios Interceptor (Automatic)
The axios instance automatically handles:
- 401 Unauthorized → Redirect to login
- Token injection in headers
- Error logging

### Manual Error Handling
```typescript
import api from '@/lib/axios';

try {
  const response = await api.get('/some-endpoint');
  // Success
} catch (error: any) {
  if (error.response?.status === 404) {
    console.log('Not found');
  } else if (error.response?.status === 403) {
    console.log('Forbidden');
  } else {
    console.error('Error:', error.message);
  }
}
```

### WebSocket Error Handling
```typescript
import { connectWebSocket } from '@/services/websocketService';

connectWebSocket(token)
  .then(() => console.log('Connected'))
  .catch(error => {
    if (error.headers?.message.includes('Unauthorized')) {
      // Invalid token
      navigate('/login');
    }
  });
```

## 🧪 Testing API Calls

### Using Browser Console
```javascript
// Get token
const token = localStorage.getItem('token');

// Test API call
fetch('http://localhost:8084/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}).then(r => r.json()).then(console.log);
```

### Using cURL
```bash
# Get current user
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8084/api/auth/me

# Get conversations
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8084/api/conversations/my
```

## 🔍 Debugging

### Enable Debug Logs
Set `VITE_DEBUG=true` in `.env`

### Check API Calls
Open browser DevTools → Network tab → Filter: XHR

### Check WebSocket
Open browser DevTools → Network tab → Filter: WS

### Check State
Use React DevTools to inspect Zustand stores

## 📝 Best Practices

1. **Always check token before API calls**
   ```typescript
   const token = localStorage.getItem('token');
   if (!token) {
     navigate('/login');
     return;
   }
   ```

2. **Handle loading states**
   ```typescript
   const [loading, setLoading] = useState(false);
   
   const loadData = async () => {
     setLoading(true);
     try {
       const data = await fetchData();
     } finally {
       setLoading(false);
     }
   };
   ```

3. **Use WebSocket for real-time, HTTP for data fetching**
   - WebSocket: Send messages, typing indicators, presence
   - HTTP: Load messages, conversations, user data

4. **Cleanup subscriptions**
   ```typescript
   useEffect(() => {
     subscribe(destination, callback);
     
     return () => {
       unsubscribe(destination);
     };
   }, []);
   ```

5. **Handle token expiration**
   - Automatic redirect on 401
   - Refresh token if implemented
   - Clear localStorage on logout
