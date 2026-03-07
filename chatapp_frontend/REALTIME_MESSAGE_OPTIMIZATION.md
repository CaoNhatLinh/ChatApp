# WebSocket Message Flow - Optimized

## Architecture Changes

### 1. **Single Source of Truth**
- Messages are now stored **only** in `conversationStore`
- No more separate `realtimeMessages` state in `SimpleChatContext`
- Eliminates message duplication and synchronization issues

### 2. **Simplified Data Flow**

```
User sends message → WebSocket → Backend
                                     ↓
Backend broadcasts → WebSocket receives → SimpleChatContext.onMessageReceived
                                                      ↓
                                          conversationStore.addMessage
                                                      ↓
                                          MessageList reads from store
                                                      ↓
                                          UI updates immediately
```

### 3. **Key Optimizations**

#### SimpleChatContext.tsx
- ✅ Removed `realtimeMessages` local state
- ✅ Removed `clearRealtimeMessages()` and `addRealtimeMessage()`
- ✅ Messages go directly to `conversationStore.addMessage()`
- ✅ Simplified context type - only methods, no state

#### MessageList.tsx
- ✅ Get realtime messages from `store.getConversationMessages()`
- ✅ Merge stored and realtime messages with deduplication
- ✅ Removed dependency on context's realtime messages

#### conversationStore.ts
- ✅ Enhanced `addMessage()` with duplicate detection
- ✅ Single Map storing all messages by conversationId
- ✅ Auto-deduplication prevents same message appearing twice

## Benefits

1. **Real-time Display**: Messages appear immediately when sent
2. **No Duplication**: Duplicate detection at store level
3. **Better Performance**: Single state update, no re-renders from multiple states
4. **Easier Debugging**: One place to track all messages
5. **Cleaner Code**: Less state management complexity

## Flow Example

```typescript
// User sends message
sendMessage({
  type: "NEW_MESSAGE",
  payload: { content: "Hello", conversationId: "123" }
});

// Backend processes and broadcasts
// WebSocket receives message

// SimpleChatContext handler
onMessageReceived(message) {
  addMessage(message); // → Store
}

// MessageList renders
const messages = getConversationMessages(conversationId); // From store
// → UI updates immediately
```

## Testing Checklist

- [ ] Send message → appears immediately
- [ ] Receive message → appears immediately  
- [ ] No duplicate messages
- [ ] Scroll to bottom on new message
- [ ] Load older messages works
- [ ] Typing indicator works
- [ ] Switch conversations clears messages
- [ ] Reconnection resubscribes correctly
