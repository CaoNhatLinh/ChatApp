# Refactoring Progress Report

## ✅ Completed Tasks

### 1. **Xóa Files Demo/Debug**
- ✅ Đã xóa: `src/components/examples/`, `src/components/debug/`
- ✅ Đã xóa: `src/pages/DebugPage.tsx`, `src/pages/PresenceDemo.tsx`, `src/pages/RoomFeaturesDemo.tsx`
- ✅ Đã xóa: `src/utils/debugOnlineStatus.ts`, `src/utils/onlineStatusFlowTest.ts`, `src/utils/testPresenceSystem.js`
- ✅ Đã xóa: `src/components/chat/FileUploadTest.tsx`, `src/components/chat/ChatBoxWithRoomFeatures.tsx`

### 2. **Tạo AvatarCircle Component** ✅
**File**: `src/components/ui/AvatarCircle.tsx`

**Features**:
- Multi-size support: `xs`, `sm`, `md`, `lg`, `xl`
- Auto-generate avatar màu từ tên
- Hiển thị chữ cái đầu (1 hoặc 2 chữ cái)
- Online status indicator (green/gray dot)
- Hỗ trợ cả avatar image và fallback

**Usage**:
```typescript
<AvatarCircle
  src={user.avatarUrl}
  name={user.displayName}
  size="md"
  online={isOnline(user.userId)}
/>
```

### 3. **Tạo ContextMenu Component** ✅
**Files**: 
- `src/components/ui/ContextMenu.tsx`
- `src/hooks/common/useContextMenu.ts`

**Features**:
- Right-click context menu
- Auto-adjust position nếu ra ngoài màn hình
- Support dividers
- Danger actions (red text)
- Disabled items
- Click outside to close
- ESC to close

**Usage**:
```typescript
const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();

<div onContextMenu={(e) => openContextMenu(e, menuItems)}>
  {/* Content */}
</div>

{contextMenu && (
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextMenu.items}
    onClose={closeContextMenu}
  />
)}
```

### 4. **Error Handler Utility** ✅
**File**: `src/utils/errorHandler.ts`

**Features**:
- Convert technical errors → user-friendly messages
- Specific error handlers cho từng feature:
  - `friendRequestErrors.send()`
  - `friendRequestErrors.accept()`
  - `friendRequestErrors.reject()`
  - `messageErrors.send()`
  - `messageErrors.delete()`
  - `conversationErrors.create()`
  - `conversationErrors.update()`
- Toast helpers: `showSuccessToast()`, `showErrorToast()`, `showInfoToast()`

**Example Error Mapping**:
- "Request failed with status code 400" → "Invalid request. Please check your input"
- "Friend request already sent" → "Friend request already sent"
- "Already friends" → "You are already friends with this user"

### 5. **ConversationItem Updated** ✅
**File**: `src/components/conversation/ConversationItem.tsx`

**Changes**:
- ✅ Sử dụng `AvatarCircle` component
- ✅ Thêm Context Menu với options:
  - Mark as Read
  - Mute/Unmute Notifications
  - Conversation Settings
  - Leave Conversation
  - Delete Conversation (for group owners)
- ✅ Removed manual avatar color logic
- ✅ Online status tự động từ AvatarCircle

### 6. **MessageBubble Updated** ✅
**File**: `src/components/chat/MessageBubble.tsx`

**Changes**:
- ✅ Sử dụng `AvatarCircle` thay vì manual avatar div
- ✅ Đơn giản hóa avatar rendering
- ✅ Consistent avatar style với rest of app

---

## ⚠️ In Progress Tasks

### 7. **FriendItem Needs Refactoring** 🔄
**File**: `src/components/friend/FriendItem.tsx`

**Issues Found** (39 compile errors):
1. **snake_case vs camelCase**:
   - `friend.user_id` → `friend.userId`
   - `friend.display_name` → `friend.displayName`
   - `friend.avatar_url` → `friend.avatarUrl`
   - `friend.username` → `friend.userName`

2. **Missing imports**:
   - Need to import toast functions from errorHandler
   - Need to add AvatarCircle
   - Need to add useOnlineStatus

3. **Error messages**:
   - Replace all `toast.success()` → `showSuccessToast()`
   - Replace all `toast.error()` → `friendRequestErrors.xxx()`

**Fix Script** (để thực hiện):
```typescript
// 1. Fix all property names
user_id → userId (15 occurrences)
display_name → displayName (5 occurrences)  
avatar_url → avatarUrl (2 occurrences)
username → userName (3 occurrences)

// 2. Replace avatar div with AvatarCircle
<AvatarCircle
  src={friend.avatarUrl}
  name={friend.displayName || friend.userName}
  size="md"
  online={isOnline(friend.userId)}
/>

// 3. Replace all toast calls
toast.success(...) → showSuccessToast(...)
toast.error(...) → friendRequestErrors.xxx(error)
```

---

## 📋 Not Started Tasks

### 8. **Fix 30+ Any Types**
**Locations Found**:
1. `src/components/chat/MessageInput.tsx:141` - `const fileMessagePayload: any`
2. `src/utils/debounce.ts:3` - `<T extends (...args: any[]) => void>`
3. `src/utils/auth.ts:35` - `export const decodeToken = (token: string): any`
4. `src/utils/apiHelpers.ts:200, 215` - `isApiError(error: any)`, cache data
5. `src/types/websocket.ts:10, 123, 147, 151, 155, 159` - Multiple any types
6. `src/types/api.ts:49` - `user: any`
7. `src/store/presenceStore.ts` - 4 catch blocks with `error: any`
8. `src/services/chatWebSocketService.ts` - 4 any types
9. `src/utils/logger.ts` - 4 any[] parameters
10. `src/hooks/social/useFriends.ts` - 3 `.map((item: any) =>`
11. `src/hooks/room/useRoomActions.ts` - 4 `err: any` in catch blocks

**Fix Strategy**:
- Type guards instead of any
- Proper Error types
- Define specific interfaces
- Use unknown instead of any where appropriate

### 9. **Ẩn Debug UI Elements**
**Need to find and remove**:
- "Debug: conversationId" text
- "{number} of {number} conversations" counter

**Search command**:
```bash
grep -r "Debug:" src/
grep -r "conversations" src/ | grep -i "of"
```

### 10. **Auto-focus Khi Tạo Phòng**
**File to update**: `src/components/conversation/CreateConversationModal.tsx`

**Current behavior**: Phải reload trang để thấy phòng mới
**Expected**: Sau create, tự động:
1. Add conversation to list
2. Set as selectedConversation
3. Close modal
4. Focus input

**Implementation**:
```typescript
const handleCreate = async () => {
  const newConv = await createConversation(data);
  
  // Add to store
  conversationStore.addConversation(newConv);
  
  // Select immediately
  setSelectedConversation(newConv);
  
  // Close modal
  onClose();
};
```

---

## 🔧 Additional Tasks (From Original Request)

### Not Yet Addressed:

1. **Kiểm tra chức năng gửi message** ❌
   - Verify API calls
   - Test real-time updates
   - Check WebSocket sync

2. **Sửa bố cục message** ⚠️
   - Partially done (added AvatarCircle)
   - Need to review layout spacing

3. **Kiểm tra chức năng reaction** ❌
   - Test add/remove reactions
   - Verify real-time sync

4. **Fix notification ra ngoài màn hình** ❌
   - Need to find notification modal
   - Fix CSS positioning

5. **Right-click member trong conversation** ⚠️
   - ContextMenu created ✅
   - Not yet integrated in MemberList

6. **Chức năng setting room gọi API chưa** ❌
   - Need to check RoomSettingsModal
   - Verify API integration

7. **Owner xóa phòng với confirmation** ❌
   - Need confirmation modal
   - Require typing room name to confirm

---

## 🎯 Recommended Next Steps

### Priority 1 (Critical):
1. **Fix FriendItem.tsx** (39 errors) - Replace all snake_case, add AvatarCircle, use errorHandler
2. **Ẩn Debug UI** - Find and remove debug text
3. **Auto-focus tạo phòng** - Update CreateConversationModal callback

### Priority 2 (Important):
4. **Fix any types** - Start with most critical files (websocket, api)
5. **Kiểm tra message/reaction** - Test functionality
6. **Fix notification modal positioning** - CSS fixes

### Priority 3 (Enhancement):
7. **Room settings API** - Verify integration
8. **Owner delete room** - Add confirmation flow
9. **Member context menu** - Integrate ContextMenu in MemberList

---

## 📊 Statistics

- **Files Created**: 4
  - AvatarCircle.tsx
  - ContextMenu.tsx
  - useContextMenu.ts
  - errorHandler.ts

- **Files Updated**: 3
  - ConversationItem.tsx
  - MessageBubble.tsx
  - (FriendItem.tsx in progress)

- **Files Deleted**: ~15 demo/debug files

- **Errors Fixed**: ~20 (ConversationItem, MessageBubble)
- **Errors Remaining**: 39 (FriendItem) + unknown

---

## 🛠️ Quick Fix Commands

### Fix FriendItem (bulk replace needed):
```bash
# In FriendItem.tsx:
# 1. Find/Replace: user_id → userId
# 2. Find/Replace: display_name → displayName
# 3. Find/Replace: avatar_url → avatarUrl
# 4. Find/Replace: .username → .userName
# 5. Replace avatar <div> with <AvatarCircle />
# 6. Replace toast.xxx with errorHandler functions
```

### Find Debug UI:
```bash
cd src
grep -r "Debug:" . --include="*.tsx"
grep -r "conversations" . --include="*.tsx" | grep -i "of"
```

---

**Last Updated**: Current session
**Status**: 60% Complete
