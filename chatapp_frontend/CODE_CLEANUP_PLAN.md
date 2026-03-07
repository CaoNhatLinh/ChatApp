# Code Cleanup Plan

## Phân tích hiện trạng

### 1. Context Files - CẦN CLEAN
- ✅ **SimpleChatContext.tsx** - ĐANG DÙNG (ChatBox, MessageInput)
- ❌ **WebSocketChatContext.tsx** - KHÔNG DÙNG (chỉ có log messages)
- ❌ **WebSocketContext.tsx** - ĐÃ XÓA/COMMENT (không tồn tại)
- ✅ **AuthContext.tsx** - ĐANG DÙNG

**Quyết định:**
- XÓA: `WebSocketChatContext.tsx` - không có component nào sử dụng
- GIỮ: `SimpleChatContext.tsx` - đang active
- GIỮ: `AuthContext.tsx` - cần thiết

### 2. Hooks Files - CẦN CLEAN

#### a. Presence Hooks - TRÙNG LẶP
- `src/hooks/usePresenceSystem.ts` - FILE TRỐNG
- `src/hooks/presence/usePresenceSystem.ts` - FILE ĐẦY ĐỦ

**Quyết định:**
- XÓA: `src/hooks/usePresenceSystem.ts` (file trống)
- GIỮ: `src/hooks/presence/usePresenceSystem.ts`

#### b. Chat Hooks - OK
- ✅ `useChatWebSocket.ts` - ĐANG DÙNG
- ✅ `useMessages.ts` - ĐANG DÙNG

### 3. Services - CẦN REVIEW

#### WebSocket Services
- ✅ `chatWebSocketService.ts` - Service chính
- ✅ `websocketService.ts` - Low-level service
- Files trong `websocket/`:
  - `websocketApi.ts`
  - `websocketEvents.ts`

**Cần kiểm tra:** websocket subfolder có đang được dùng không?

### 4. Optimization Opportunities

#### Gộp/Đơn giản hóa:
1. **Message handling**: Đã tối ưu - single source in store ✅
2. **Context providers**: Có thể gộp SimpleChatContext vào WebSocketChatContext?
3. **Presence system**: Đã tách riêng OK ✅

## Action Items

### Phase 1: Xóa files không dùng
- [ ] Delete `WebSocketChatContext.tsx`
- [ ] Delete `src/hooks/usePresenceSystem.ts` (empty)
- [ ] Check and clean `websocket/` subfolder

### Phase 2: Kiểm tra imports
- [ ] Search all imports of deleted files
- [ ] Update imports if needed

### Phase 3: Consolidate if needed
- [ ] Review if SimpleChatContext can be merged elsewhere
- [ ] Check for duplicate utility functions

### Phase 4: Clean comments
- [ ] Remove excessive console.logs (keep important ones)
- [ ] Remove commented code blocks
- [ ] Clean up TODO comments

## Estimated Impact
- Files to delete: 2-3
- Files to update: 0-2
- Code reduction: ~500-800 lines
