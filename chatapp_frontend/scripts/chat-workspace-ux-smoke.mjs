import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3117';
const apiUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const actorId = '00000000-0000-0000-0000-000000000401';
const peerId = '00000000-0000-0000-0000-000000000403';
const roomId = '00000000-0000-0000-0000-000000000402';
const otherRoomId = '00000000-0000-0000-0000-000000000404';
const backgroundAssetId = '00000000-0000-3000-8000-000000000405';
const uploadedBackgroundUrl = 'https://assets.example.test/uploaded-background.png';
const externalBackgroundUrl = 'https://assets.example.test/external-background.svg';
const backgroundBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOioAAAAASUVORK5CYII=', 'base64');
const createdAt = '2026-10-20T08:00:00Z';
const actor = { userId: actorId, username: 'member', displayName: 'UX test member', accountStatus: 'ACTIVE' };
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const room = { conversationId: roomId, conversationType: 'GROUP', name: 'UX room A', createdBy: actorId, ownerId: actorId,
  createdAt, updatedAt: createdAt, lastActivityAt: createdAt, isDeleted: false, memberCount: 2, defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const message = (index) => ({ conversationId: roomId, messageBucket: '2026-10-20-08:00',
  messageId: `00000000-0000-1000-8000-${String(1000 + index).padStart(12, '0')}`, senderId: peerId,
  content: `Controlled history message ${index}`, revision: 0, messageType: 'TEXT', contentFormat: 'PLAIN',
  hasAttachments: false, hasMentions: false, isDeleted: false, isPinned: false, createdAt: new Date(Date.parse(createdAt) + index * 1000).toISOString(),
  ...(index === 89 ? { editedAt: '2026-10-20T09:00:00Z' } : {}) });
const subscriptions = new Map();
let socket;
let resolveSubscribed;
const subscribed = new Promise(resolve => { resolveSubscribed = resolve; });
let pinRequests = 0;
let unpinRequests = 0;
let pinnedRoomB = false;
const directoryRequests = [];
let currentMessagePins = { conversationId: roomId, revision: '0', pins: [] };
const readRequests = [];
let roomTheme = 'system';
let roomOverrides = [];
let bubbleStyle = 'classic';
let failThemeSave = false;
const appearanceWrites = [];
let failLibrary = false;
let paginateLibrary = false;
let failLibraryContinuation = false;
let failSource = false;
let roomBHistoryFailure = true;
let roomBEmptyContinuation = false;
let roomAHistoryDenied = false;
let roomAOlderHistoryDenied = false;
let transientOlderFailure = false;
let invalidOlderCursor = null;
let releaseTransientOlder;
const transientOlderGate = new Promise(resolve => { releaseTransientOlder = resolve; });
const olderHistoryCursors = [];
let releaseDeniedOlderHistory;
const deniedOlderHistoryGate = new Promise(resolve => { releaseDeniedOlderHistory = resolve; });
let releaseStaleRevisions;
const staleRevisionsGate = new Promise(resolve => { releaseStaleRevisions = resolve; });
let revisionRequests = 0;
const privatePreview = { ...message(89), senderDisplayName: 'Peer', contentPreview: 'Private sidebar preview fixture', deleted: false };
let showPrivatePreview = false;
let releaseRoomBHistory;
const roomBHistoryGate = new Promise(resolve => { releaseRoomBHistory = resolve; });
let roomBHistoryRequests = 0;
const sourceRequests = [];
const sharedRequests = [];
const libraryCursors = [];
const sharedItem = { id: 'fixture-asset', messageId: message(60).messageId, messageBucket: message(60).messageBucket,
  createdAt, url: 'https://assets.example.test/image.svg', name: 'shared-image.svg', mimeType: 'image/svg+xml', byteSize: 200, spoiler: false };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('https://assets.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#568a74"/></svg>' }));
await page.route('**/ws/info?*', route => route.fulfill({ json: { websocket: true, cookie_needed: false, origins: ['*:*'], entropy: 1 } }));
await page.routeWebSocket('**/ws/**', ws => {
  socket = ws;
  ws.onMessage(raw => {
    for (const frame of JSON.parse(raw.toString())) {
      if (frame.startsWith('CONNECT')) ws.send(`a${JSON.stringify(['CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'])}`);
      if (frame.startsWith('SUBSCRIBE')) {
        const id = frame.match(/\nid:([^\n]+)/)?.[1];
        const destination = frame.match(/\ndestination:([^\n]+)/)?.[1];
        subscriptions.set(destination, id);
        if (destination === `/topic/conversation/${roomId}/typing`) resolveSubscribed();
      }
    }
  });
  ws.send('o');
});
const emit = (destination, payload) => {
  assert.ok(subscriptions.has(destination), `subscribed to ${destination}`);
  socket.send(`a${JSON.stringify([`MESSAGE\nsubscription:${subscriptions.get(destination)}\nmessage-id:fixture-${Date.now()}\ndestination:${destination}\n\n${JSON.stringify(payload)}\0`])}`);
};
await page.route(`${apiUrl}/**`, route => {
  const path = new URL(route.request().url()).pathname;
  const method = route.request().method();
  const json = body => route.fulfill({ json: body });
  if (path.endsWith(`/conversations/${roomId}/messages/pins`)) return json(currentMessagePins);
  if (path.endsWith('/calls/incoming')) return route.fulfill({ json: { content: [], nextCursor: null, hasNext: false } });
  if (path.endsWith('/calls/active')) return route.fulfill({ status: 204 });
  if (/\/conversations\/[^/]+\/summary$/.test(path)) {
    const id = path.split('/').at(-2);
    const conversation = { ...room, conversationId: id, name: id === roomId ? room.name : id === otherRoomId ? 'UX room B' : 'Hidden community' };
    return json({ conversation, pinned: id === otherRoomId && pinnedRoomB, unreadCount: 0, joinedAt: createdAt, notificationOverride: 'INHERIT', lastMessage: showPrivatePreview && id === roomId ? privatePreview : null });
  }
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(actor);
  if (path.endsWith('/devices')) return json({ deviceId: actorId });
  if (path.endsWith('/preferences/chat')) {
    if (method === 'PUT') { bubbleStyle = route.request().postDataJSON().defaultBubbleStyleId; return route.fulfill({ status: 204 }); }
    return json({ defaultThemeId: roomTheme, defaultBubbleStyleId: bubbleStyle, rooms: roomOverrides });
  }
  if (path.includes('/preferences/chat/rooms/')) {
    if (method === 'DELETE') {
      roomOverrides = [];
      return route.fulfill({ status: 204 });
    }
    const payload = route.request().postDataJSON(); appearanceWrites.push(payload);
    if (failThemeSave) return route.fulfill({ status: 500, json: { message: 'controlled save failure' } });
    roomOverrides = [{ ...payload, conversationId: roomId, updatedAt: createdAt }];
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith('/files/upload') && method === 'POST') {
    return json({ success: true, file: { assetId: backgroundAssetId, url: uploadedBackgroundUrl, contentType: 'image/png' } });
  }
  if (path.endsWith(`/conversations/${roomId}/roles`)) return json([]);
  if (path.endsWith(`/conversations/${roomId}/permissions`)) return json({ owner: false, permissions: ['MESSAGE_SEND'] });
  if (path.endsWith('/read-state')) return json({ lastReadMessageId: message(50).messageId, lastReadAt: createdAt, joinedAt: createdAt });
  if (path.endsWith('/read') && method === 'POST') {
    readRequests.push(path);
    if (path.includes(message(93).messageId)) {
      return new Promise(resolve => setTimeout(() => resolve(route.fulfill({ status: 204 })), 800));
    }
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith('/shared-content')) {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get('kind');
    sharedRequests.push(kind);
    if (failLibrary) return route.fulfill({ status: 403, json: { message: 'not member of conversation' } });
    if (kind === 'IMAGES' && paginateLibrary) {
      const cursor = url.searchParams.get('cursor');
      libraryCursors.push(cursor);
      if (cursor === 'continue-images') return json({ content: [], nextCursor: 'continue-after-empty', hasNext: true });
      if (cursor === 'continue-after-empty') {
        if (failLibraryContinuation) return route.fulfill({ status: 503, json: { message: 'library temporarily unavailable' } });
        return json({ content: [{ ...sharedItem, id: 'fixture-second-image', name: 'second-image.svg' }], nextCursor: 'continue-denied', hasNext: true });
      }
      if (cursor === 'scanned-empty-1') return json({ content: [sharedItem], nextCursor: 'continue-images', hasNext: true });
    }
    if (kind === 'IMAGES') return json(url.searchParams.has('cursor')
      ? { content: [sharedItem], nextCursor: null, hasNext: false }
      : { content: [], nextCursor: 'scanned-empty-1', hasNext: true });
    if (kind === 'FILES') return json({ content: [{ ...sharedItem, id: 'fixture-file', name: 'notes.pdf', mimeType: 'application/pdf', url: 'https://assets.example.test/notes.pdf' }], nextCursor: null, hasNext: false });
    return json({ content: [{ ...sharedItem, id: 'fixture-link', name: 'example.com', mimeType: null, byteSize: null, url: 'https://example.com/reference' }], nextCursor: null, hasNext: false });
  }
  if (path.includes('/shared-content/')) {
    sourceRequests.push(path);
    if (failSource) return route.fulfill({ status: 503, json: { message: 'source temporarily unavailable' } });
    return json({ ...message(60), content: 'Source content from the authorized point lookup' });
  }
  if (path.endsWith('/conversations') && method === 'GET') {
    const url = new URL(route.request().url());
    directoryRequests.push({ query: url.searchParams.get('q'), filter: url.searchParams.get('filter'), cursor: url.searchParams.get('cursor') });
    const hidden = url.searchParams.get('q') === 'Hidden';
    const unread = url.searchParams.get('filter') === 'UNREAD';
    const pinned = url.searchParams.get('filter') === 'PINNED';
    const more = url.searchParams.has('cursor');
    const second = { ...room, conversationId: otherRoomId, name: 'UX room B', hasLastMessage: true };
    const matches = hidden ? (more ? [{ ...room, conversationId: peerId, name: 'Hidden community' }] : []) : unread ? [room] : pinned ? [second] : [room, second, second];
    return json({ content: matches.map(conversation => ({ conversation, pinned: conversation.conversationId === otherRoomId && pinnedRoomB, unreadCount: unread ? 3 : 0, joinedAt: createdAt, notificationOverride: 'INHERIT', lastMessage: showPrivatePreview && conversation.conversationId === roomId ? privatePreview : null })), nextCursor: hidden && !more ? 'hidden-scan-next' : null, hasNext: hidden && !more });
  }
  if (path.endsWith(`/messages/${message(89).messageId}/revisions`) && method === 'GET') {
    if (++revisionRequests === 1) {
      return staleRevisionsGate.then(() => json([{ revisionNumber: 1, editedAt: createdAt, content: 'Stale revision from previous room' }]));
    }
    return json([{ revisionNumber: 1, editedAt: createdAt, content: 'Current revision for this room' }]);
  }
  if (path.endsWith(`/conversations/${roomId}/messages`) && method === 'GET') {
    if (roomAHistoryDenied) return route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } });
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    const older = cursor !== null;
    if (older) olderHistoryCursors.push(cursor);
    if (older && transientOlderFailure) return transientOlderGate.then(() => route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } }));
    if (older && invalidOlderCursor) return json({ content: [message(0)], hasNext: true,
      nextCursor: invalidOlderCursor === 'repeat' ? cursor : null, interactions: [], polls: [] });
    if (older && roomAOlderHistoryDenied) return deniedOlderHistoryGate.then(() => route.fulfill({ status: 404, json: { code: 'RESOURCE_NOT_FOUND' } }));
    return json({ content: Array.from({ length: older ? 20 : 70 }, (_, i) => message(i + (older ? 0 : 20))), nextCursor: older ? null : 'older-page', hasNext: !older, interactions: [], polls: [] });
  }
  if (path.endsWith(`/conversations/${otherRoomId}/messages`) && method === 'GET') {
    roomBHistoryRequests++;
    if (roomBHistoryFailure) return roomBHistoryGate.then(() => route.fulfill({ status: 503, json: { message: 'history temporarily unavailable' } }));
    if (roomBEmptyContinuation && !new URL(route.request().url()).searchParams.has('cursor')) {
      return json({ content: [], nextCursor: 'room-b-next', hasNext: true, interactions: [], polls: [] });
    }
  }
  if (/\/conversations\/[^/]+\/messages$/.test(path) && method === 'GET') return json({ content: [], nextCursor: null, hasNext: false, interactions: [], polls: [] });
  if (path.endsWith('/pin') && method === 'POST') { pinRequests++; pinnedRoomB = true; return json({}); }
  if (path.endsWith(`/conversations/${otherRoomId}/pin`) && method === 'DELETE') {
    unpinRequests++;
    return route.fulfill({ status: 409, json: { code: 'CONFLICT' } });
  }
  if (path.endsWith('/notification-policy')) return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  if (path.endsWith('/friends/blocked')) return json([]);
  if (path.endsWith('/notifications/unread/count')) return json({ count: 0 });
  return json({ content: [], userDetails: [], nextCursor: null, hasNext: false });
});
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
try {
  await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
  const roomBButton = page.getByRole('button', { name: 'UX room B', exact: true });
  await roomBButton.getByText('Chưa xem được tin gần nhất', { exact: true }).waitFor();
  assert.equal(await roomBButton.count(), 1, 'duplicate directory rows render once');
  await roomBButton.click();
  const messageHistory = page.locator('.chat-message-history');
  const emptyHistory = messageHistory.getByText('Chưa có tin nhắn', { exact: true });
  await messageHistory.getByRole('status').filter({ hasText: 'Đang tải tin nhắn…' }).waitFor();
  assert.equal(await emptyHistory.count(), 0);
  releaseRoomBHistory();
  const historyError = page.getByRole('alert').filter({ hasText: 'Không thể tải tin nhắn.' });
  await historyError.waitFor();
  assert.equal(await emptyHistory.count(), 0);
  roomBHistoryFailure = false;
  roomBEmptyContinuation = true;
  await page.getByRole('button', { name: 'Tải lại tin nhắn', exact: true }).press('Enter');
  const emptyPageContinue = messageHistory.getByRole('button', { name: 'Tải thêm tin nhắn cũ', exact: true });
  await emptyPageContinue.waitFor();
  assert.equal(await emptyHistory.count(), 0, 'an empty page with a cursor is not an empty conversation');
  assert.equal(await historyError.count(), 0);
  assert.equal(await messageHistory.evaluate(element => element === document.activeElement), true, 'keyboard retry retains focus in history');
  assert.equal(roomBHistoryRequests, 2, 'initial failure retries the selected room exactly once');
  await emptyPageContinue.click();
  await emptyHistory.waitFor();
  roomBEmptyContinuation = false;
  await page.getByRole('button', { name: 'UX room A', exact: true }).click();
  await page.getByText('Controlled history message 89', { exact: true }).waitFor();
  await subscribed;
  await page.getByRole('separator', { name: 'Tin nhắn chưa đọc', exact: true }).waitFor();
  const latestRow = page.locator(`[data-message-id="${message(89).messageId}"]`);
  const revisionButton = latestRow.getByRole('button', { name: 'Đã sửa', exact: true });
  const revisions = page.getByRole('dialog', { name: 'Lịch sử chỉnh sửa', exact: true });
  const revisionRequest = page.waitForRequest(request => request.url().includes(`/messages/${message(89).messageId}/revisions`));
  await revisionButton.click();
  await revisionRequest;
  await roomBButton.click();
  await emptyHistory.waitFor();
  await page.getByRole('button', { name: /^UX room A(?:,|$)/ }).click();
  await revisionButton.waitFor();
  const staleResponse = page.waitForResponse(response => response.url().includes(`/messages/${message(89).messageId}/revisions`));
  releaseStaleRevisions();
  await (await staleResponse).finished();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await revisions.count(), 0, 'a stale revision must not reopen after leaving and returning to its room');
  await revisionButton.click();
  await revisions.getByText('Current revision for this room').waitFor();
  await page.keyboard.press('Escape');
  await revisions.waitFor({ state: 'detached' });
  currentMessagePins = { conversationId: roomId, revision: '10', pins: [{ messageId: message(89).messageId, messageBucket: message(89).messageBucket }] };
  emit(`/topic/conversation/${roomId}/pins`, currentMessagePins);
  await latestRow.hover();
  await latestRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
  await page.getByRole('menuitem', { name: 'Bỏ ghim', exact: true }).waitFor();
  currentMessagePins = { conversationId: roomId, revision: '11', pins: [] };
  emit(`/topic/conversation/${roomId}/pins`, currentMessagePins);
  await page.getByRole('menuitem', { name: 'Ghim', exact: true }).waitFor();
  emit(`/topic/conversation/${roomId}/pins`, { conversationId: roomId, revision: '10', pins: [{ messageId: message(89).messageId, messageBucket: message(89).messageBucket }] });
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole('menuitem', { name: 'Ghim', exact: true }).count(), 1, 'delayed PIN cannot replace newer full UNPIN snapshot');
  await page.keyboard.press('Escape');
  const history = page.locator('.chat-message-history');
  const info = page.getByRole('dialog', { name: 'Thông tin cuộc trò chuyện', exact: true });
  assert.equal(await info.count(), 0, 'information is not forced open');
  const fullWidth = (await history.boundingBox()).width;
  const openInfo = page.getByRole('button', { name: 'Mở thông tin cuộc trò chuyện', exact: true });
  await openInfo.click();
  await info.waitFor();
  assert.ok((await history.boundingBox()).width < fullWidth - 200);
  await page.getByRole('button', { name: 'Đóng thông tin cuộc trò chuyện', exact: true }).click();
  await info.waitFor({ state: 'detached' });
  assert.equal((await history.boundingBox()).width, fullWidth, 'closing reclaims width');
  assert.equal(await openInfo.evaluate(element => element === document.activeElement), true, 'close restores trigger focus');
  const pinB = page.getByRole('button', { name: 'UX room B', exact: true }).locator('..').getByRole('button', { name: 'Ghim cuộc trò chuyện', exact: true });
  await pinB.focus();
  const pinned = page.waitForResponse(response => response.url().endsWith('/pin') && response.request().method() === 'POST');
  await pinB.press('Enter');
  await pinned;
  assert.equal(pinRequests, 1);
  const unpinB = page.getByRole('button', { name: 'UX room B', exact: true }).locator('..').getByRole('button', { name: 'Bỏ ghim cuộc trò chuyện', exact: true });
  await unpinB.waitFor();
  const refreshAfterConflict = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/conversations/${otherRoomId}/summary`) && response.request().method() === 'GET');
  await unpinB.click();
  await refreshAfterConflict;
  assert.equal(unpinRequests, 1, 'conflict refreshes without repeating the unpin');
  await page.getByRole('button', { name: 'UX room B', exact: true }).locator('..').getByRole('alert').waitFor();
  await unpinB.waitFor();
  assert.equal(await page.getByRole('heading', { name: 'UX room A', exact: true, level: 2 }).count(), 1, 'keyboard pin does not select another room');
  await history.evaluate(element => { element.scrollTop = 400; });
  await page.waitForFunction(() => document.querySelector('.chat-message-history')?.scrollTop === 400);
  emit(`/topic/conversation/${roomId}/typing`, { conversationId: roomId, user: { userId: peerId, displayName: 'Peer' }, isTyping: true });
  await page.getByText('Peer đang nhập...', { exact: true }).waitFor();
  assert.ok(Math.abs(await history.evaluate(element => element.scrollTop) - 400) < 2, 'typing preserves reading position');
  emit(`/topic/conversation/${roomId}`, message(90));
  await page.getByRole('button', { name: 'Có tin nhắn mới · Về cuối', exact: true }).waitFor();
  assert.ok(Math.abs(await history.evaluate(element => element.scrollTop) - 400) < 2, 'incoming preserves reading position');
  await page.waitForTimeout(450);
  assert.equal(readRequests.some(path => path.includes(message(90).messageId)), false, 'incoming while reading is not marked read');
  await page.getByRole('button', { name: 'Có tin nhắn mới · Về cuối', exact: true }).click();
  await page.waitForFunction(() => { const e = document.querySelector('.chat-message-history'); return e.scrollHeight - e.clientHeight - e.scrollTop < 5; });
  await page.waitForTimeout(450);
  assert.ok(readRequests.some(path => path.includes(message(90).messageId)), 'returning to latest acknowledges visible history');
  emit(`/topic/conversation/${roomId}`, message(91));
  await history.getByText('Controlled history message 91', { exact: true }).waitFor();
  await page.waitForFunction(() => { const e = document.querySelector('.chat-message-history'); return e.scrollHeight - e.clientHeight - e.scrollTop < 5; });
  await history.evaluate(element => { element.scrollTop = 400; });
  await page.waitForFunction(() => document.querySelector('.chat-message-history')?.scrollTop === 400);
  emit(`/topic/conversation/${roomId}`, { ...message(92), senderId: actorId });
  await history.getByText('Controlled history message 92', { exact: true }).waitFor();
  await page.waitForFunction(() => { const e = document.querySelector('.chat-message-history'); return e.scrollHeight - e.clientHeight - e.scrollTop < 5; });
  await history.evaluate(element => { element.scrollTop = 0; });
  await page.waitForFunction(() => document.querySelector('.chat-message-history')?.scrollTop === 0);
  const anchor = history.locator(`[data-message-id="${message(20).messageId}"]`);
  const olderRequestCount = olderHistoryCursors.length;
  transientOlderFailure = true;
  await history.getByRole('button', { name: 'Tải thêm tin nhắn cũ', exact: true }).click();
  const loadingOlder = history.getByRole('button', { name: 'Đang tải tin nhắn…', exact: true });
  await loadingOlder.waitFor();
  assert.equal(await loadingOlder.isDisabled(), true, 'an in-flight page disables duplicate requests');
  releaseTransientOlder();
  await history.getByRole('alert').filter({ hasText: 'Chưa tải được tin nhắn cũ.' }).waitFor();
  assert.equal(await anchor.count(), 1, 'a temporary paging failure preserves loaded history');
  transientOlderFailure = false;
  for (const invalid of ['repeat', 'missing']) {
    invalidOlderCursor = invalid;
    await Promise.all([
      page.waitForResponse(response => new URL(response.url()).searchParams.get('cursor') === 'older-page'),
      history.getByRole('button', { name: 'Thử lại', exact: true }).press('Enter'),
    ]);
    await history.getByRole('alert').filter({ hasText: 'Chưa tải được tin nhắn cũ.' }).waitFor();
    assert.equal(await history.getByText('Controlled history message 0', { exact: true }).count(), 0,
      'a malformed continuation cannot replace history or publish its rows');
  }
  invalidOlderCursor = null;
  const beforePrepend = (await anchor.boundingBox()).y;
  await history.getByRole('button', { name: 'Thử lại', exact: true }).press('Enter');
  await history.getByText('Controlled history message 0', { exact: true }).waitFor();
  assert.deepEqual(olderHistoryCursors.slice(olderRequestCount), Array(4).fill('older-page'));
  assert.ok(Math.abs((await anchor.boundingBox()).y - beforePrepend) < 2, 'older pages preserve visible message anchor');
  if (process.env.CAPTURE_CHAT_UX === '1') {
    await mkdir('artifacts/ui-audit/current', { recursive: true });
    await page.waitForTimeout(400); // Settle existing row entrance motion before capture.
    await page.screenshot({ path: 'artifacts/ui-audit/current/chat-ux-u1-desktop-1440.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Chưa đọc', exact: true }).click();
  await page.getByRole('button', { name: 'UX room A, 3 tin nhắn chưa đọc', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'UX room B', exact: true }).count(), 0, 'unread filter uses remote results');
  await page.getByRole('button', { name: 'Đã ghim', exact: true }).click();
  await page.getByRole('button', { name: 'UX room B', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'UX room A', exact: true }).count(), 0, 'pinned filter uses remote results');
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await page.keyboard.press('Control+k');
  const opener = page.getByRole('dialog', { name: 'Mở nhanh hội thoại', exact: true });
  await opener.waitFor();
  const query = opener.getByRole('combobox');
  await query.fill('Hidden');
  await opener.getByText('Chưa có kết quả trong phần đã kiểm tra.', { exact: true }).waitFor();
  await opener.getByRole('button', { name: 'Tải thêm cuộc trò chuyện', exact: true }).click();
  await opener.getByRole('option', { name: 'Hidden community', exact: true }).waitFor();
  await query.press('Enter');
  await opener.waitFor({ state: 'detached' });
  await page.getByRole('heading', { name: 'Hidden community', exact: true, level: 2 }).waitFor();
  assert.ok(directoryRequests.some(request => request.query === 'Hidden' && request.cursor === 'hidden-scan-next'), 'quick opener continues server search beyond cached rooms');
  await page.keyboard.press('Control+k');
  await opener.waitFor();
  await opener.getByRole('option', { name: 'UX room A', exact: true }).waitFor();
  await opener.getByRole('option', { name: 'UX room A', exact: true }).click();
  await opener.waitFor({ state: 'detached' });
  await page.getByRole('heading', { name: 'UX room A', exact: true, level: 2 }).waitFor();
  await page.keyboard.press('Control+k');
  await opener.waitFor();
  await page.keyboard.press('Escape');
  await opener.waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Tìm trong cuộc trò chuyện', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await openInfo.click();
  await info.waitFor();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await info.evaluate(element => element.contains(document.activeElement)), true, 'mobile focus stays in information overlay');
  await page.keyboard.press('Escape');
  await info.waitFor({ state: 'detached' });
  assert.equal(await openInfo.evaluate(element => element === document.activeElement), true, 'Escape restores mobile trigger focus');
  if (process.env.CAPTURE_CHAT_UX === '1') {
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'artifacts/ui-audit/current/chat-ux-u1-mobile-320.png', fullPage: true });
  }
  paginateLibrary = true;
  await openInfo.click();
  await info.getByRole('button', { name: 'Tệp và nội dung dùng chung', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Tệp và nội dung dùng chung', exact: true });
  await library.getByRole('link', { name: 'shared-image.svg', exact: true }).waitFor();
  assert.equal(await library.locator('img').count(), 1, 'real image preview survives an empty filtered page');
  failLibraryContinuation = true;
  await library.getByRole('button', { name: 'Xem thêm', exact: true }).click();
  await library.getByRole('alert').waitFor();
  assert.equal(await library.getByRole('link', { name: 'shared-image.svg', exact: true }).count(), 1, 'transient continuation failure keeps loaded content');
  failLibraryContinuation = false;
  await library.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await library.getByRole('link', { name: 'second-image.svg', exact: true }).waitFor();
  assert.equal(await library.getByRole('link', { name: 'shared-image.svg', exact: true }).count(), 1);
  assert.deepEqual(libraryCursors, [null, 'scanned-empty-1', 'continue-images', 'continue-after-empty', 'continue-images', 'continue-after-empty']);
  failLibrary = true;
  await library.getByRole('button', { name: 'Xem thêm', exact: true }).click();
  await library.getByRole('alert').waitFor();
  assert.equal(await library.getByRole('link').count(), 0, 'authorization failure on continuation purges all loaded URLs');
  failLibrary = false;
  paginateLibrary = false;
  await library.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await library.getByRole('link', { name: 'shared-image.svg', exact: true }).waitFor();
  await page.keyboard.press('Control+k');
  assert.equal(await opener.count(), 0, 'quick opener does not stack over library dialog');
  failSource = true;
  await library.getByRole('button', { name: 'Xem tin nhắn gốc', exact: true }).first().click();
  const source = page.getByRole('dialog', { name: 'Tin nhắn gốc', exact: true });
  await source.getByRole('alert').waitFor();
  failSource = false;
  await source.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await source.getByText('Source content from the authorized point lookup', { exact: true }).waitFor();
  assert.equal(sourceRequests.length, 2, 'retry targets the same source rather than replacing it with the archive');
  await source.getByRole('button', { name: 'Về thư viện', exact: true }).click();
  await library.getByRole('link', { name: 'shared-image.svg', exact: true }).waitFor();
  await library.getByRole('button', { name: 'Tệp', exact: true }).click();
  await library.getByRole('link', { name: 'notes.pdf', exact: true }).waitFor();
  await library.getByRole('button', { name: 'Liên kết', exact: true }).click();
  const link = library.getByRole('link', { name: 'example.com', exact: true });
  await link.waitFor();
  assert.equal(await link.getAttribute('href'), 'https://example.com/reference');
  assert.ok((await link.getAttribute('rel')).includes('noopener'));
  failLibrary = true;
  await library.getByRole('button', { name: 'Ảnh', exact: true }).click();
  await library.getByRole('alert').waitFor();
  assert.equal(await library.getByRole('link').count(), 0, 'authorization failure clears retained archive content');
  failLibrary = false;
  await library.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await library.getByRole('link', { name: 'shared-image.svg', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await library.waitFor({ state: 'detached' });
  assert.ok(['IMAGES', 'FILES', 'LINKS'].every(kind => sharedRequests.includes(kind)));

  await openInfo.click();
  await info.getByRole('button', { name: 'Tùy chọn cuộc trò chuyện', exact: true }).click();
  await info.getByRole('button', { name: 'Tùy chỉnh giao diện cá nhân', exact: true }).click();
  const appearance = page.getByRole('dialog', { name: 'Tùy chỉnh giao diện cá nhân', exact: true });
  await appearance.getByRole('button', { name: 'Tối', exact: true }).click();
  await appearance.getByRole('button', { name: /Signal Haze/ }).click();
  await appearance.getByRole('button', { name: /Nhịp cắt/ }).click();
  failThemeSave = true;
  await appearance.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await appearance.getByText('Không thể lưu giao diện phòng. Vui lòng thử lại.', { exact: true }).waitFor();
  assert.equal(await appearance.getByRole('button', { name: /Signal Haze/ }).getAttribute('aria-pressed'), 'true', 'failed save preserves theme draft');
  failThemeSave = false;
  await appearance.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await appearance.waitFor({ state: 'detached' });
  assert.equal(appearanceWrites.length, 2, 'one canonical room write per attempt, not competing theme/background writes');
  assert.deepEqual(appearanceWrites[0], appearanceWrites[1], 'retry preserves requested theme/background');

  const reopenAppearance = async () => {
    await openInfo.click();
    await info.getByRole('button', { name: 'Tùy chọn cuộc trò chuyện', exact: true }).click();
    await info.getByRole('button', { name: 'Tùy chỉnh giao diện cá nhân', exact: true }).click();
  };
  const saveAppearance = async () => {
    await appearance.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await appearance.waitFor({ state: 'detached' });
  };
  await reopenAppearance();
  await appearance.locator('input[type="file"]').setInputFiles({
    name: 'background.png', mimeType: 'image/png', buffer: backgroundBytes,
  });
  await saveAppearance();
  assert.equal(appearanceWrites.at(-1).backgroundAssetId, backgroundAssetId);
  assert.equal(appearanceWrites.at(-1).customBackgroundUrl, uploadedBackgroundUrl);

  await reopenAppearance();
  const overlay = appearance.getByRole('group', { name: 'Độ phủ để đọc tin nhắn', exact: true });
  await overlay.locator('button[aria-pressed="false"]').click();
  await saveAppearance();
  assert.equal(appearanceWrites.at(-1).backgroundAssetId, backgroundAssetId, 'visual-only edits retain the background asset');

  await reopenAppearance();
  await appearance.getByRole('textbox', { name: 'Hình nền riêng', exact: true }).fill(externalBackgroundUrl);
  await saveAppearance();
  assert.equal(appearanceWrites.at(-1).backgroundAssetId, null, 'an external URL clears the linked asset');
  assert.equal(appearanceWrites.at(-1).customBackgroundUrl, externalBackgroundUrl);

  await reopenAppearance();
  await appearance.getByRole('button', { name: 'Dùng mặc định', exact: true }).click();
  await saveAppearance();
  assert.deepEqual(roomOverrides, [], 'reset clears the room preference');

  await history.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.waitForFunction(() => { const e = document.querySelector('.chat-message-history'); return e.scrollHeight - e.clientHeight - e.scrollTop < 5; });
  const slowStarted = page.waitForRequest(request => request.url().includes(message(93).messageId) && request.url().includes('/read'), { timeout: 12000 });
  emit(`/topic/conversation/${roomId}`, message(93));
  await slowStarted;
  const laterRead = page.waitForResponse(response => response.url().includes(message(94).messageId) && response.url().includes('/read'));
  emit(`/topic/conversation/${roomId}`, message(94));
  await laterRead;
  assert.ok(readRequests.some(path => path.includes(message(94).messageId)), 'new content arriving during a slow ack is acknowledged afterwards');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  emit(`/topic/conversation/${roomId}`, message(95));
  await page.waitForTimeout(500);
  assert.equal(readRequests.some(path => path.includes(message(95).messageId)), false, 'hidden page does not mark incoming content read');
  const visibleRead = page.waitForResponse(response => response.url().includes(message(95).messageId) && response.url().includes('/read'));
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await visibleRead;

  const matrix = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 768, 1024, 1440]) {
      roomTheme = 'system';
      roomOverrides = [];
      await page.evaluate(theme => localStorage.setItem('themePreference', theme), theme);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'UX room A', exact: true }).click();
      await page.getByText('Controlled history message 89', { exact: true }).waitFor();
      await page.setViewportSize({ width, height: width === 320 ? 800 : 1000 });
      await page.waitForFunction(theme => document.querySelector('.chat-message-history')?.getAttribute('data-room-mode') === theme, theme);
      if (process.env.CAPTURE_CHAT_UX === '1' && [320, 1440].includes(width)) {
        await page.getByRole('separator', { name: 'Tin nhắn chưa đọc', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `artifacts/ui-audit/current/chat-unread-${theme}-${width}.png`, fullPage: true });
      }
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert.ok(dimensions.document <= dimensions.viewport + 1, `${theme}/${width} does not overflow horizontally`);
      await openInfo.click();
      await info.getByRole('button', { name: 'Tệp và nội dung dùng chung', exact: true }).click();
      await library.getByRole('link', { name: 'shared-image.svg', exact: true }).waitFor();
      const bounds = await library.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${theme}/${width} library fits viewport`);
      const contrast = await library.evaluate(element => {
        const color = getComputedStyle(element);
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        const luminance = value => {
          ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
          const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const a = luminance(color.color), b = luminance(color.backgroundColor);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
      assert.ok(contrast >= 4.5, `${theme}/${width} dialog body contrast ${contrast.toFixed(2)}`);
      if (process.env.CAPTURE_CHAT_UX === '1' && [320, 1440].includes(width)) {
        await page.screenshot({ path: `artifacts/ui-audit/current/chat-library-${theme}-${width}.png`, fullPage: true });
      }
      await page.keyboard.press('Escape');
      await library.waitFor({ state: 'detached' });
      matrix.push({ theme, width, contrast: +contrast.toFixed(2) });
    }
  }
  showPrivatePreview = true;
  for (const [shellTheme, override, expected] of [['dark', 'studio', 'light'], ['light', 'vapor', 'dark']]) {
    roomTheme = override;
    await page.evaluate(theme => localStorage.setItem('themePreference', theme), shellTheme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'UX room A', exact: true }).click();
    await page.waitForFunction(mode => document.querySelector('.chat-message-history')?.getAttribute('data-room-mode') === mode, expected);
  }
  const cachedMessage = messageHistory.getByText('Controlled history message 89', { exact: true });
  const roomAButton = page.getByRole('button', { name: /^UX room A(?:,|$)/ });
  const cachedPreview = roomAButton.getByText(/Private sidebar preview fixture/);
  await cachedMessage.waitFor();
  await cachedPreview.waitFor();
  await page.clock.setFixedTime(new Date(Date.now() + 61_000));
  await roomBButton.click();
  await emptyHistory.waitFor();
  roomAHistoryDenied = true;
  await page.getByRole('button', { name: /^UX room A(?:,|$)/ }).click();
  await page.getByRole('alert').filter({ hasText: 'Bạn hiện không xem được tin nhắn ở đây.' }).waitFor();
  assert.equal(await cachedMessage.count(), 0, '403 removes previously cached private history');
  await roomAButton.getByText('Chưa xem được tin gần nhất', { exact: true }).waitFor();
  assert.equal(await roomAButton.locator('[title*="Private sidebar preview fixture"]').count(), 0);
  assert.equal(await page.locator('.chat-composer-dock').count(), 0, '403 closes the composer');
  roomAHistoryDenied = false;
  await page.getByRole('button', { name: 'Tải lại tin nhắn', exact: true }).press('Enter');
  await cachedMessage.waitFor();
  await cachedPreview.waitFor();
  await page.locator('.chat-composer-dock').waitFor();
  roomAOlderHistoryDenied = true;
  const olderHistoryRequest = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname.endsWith(`/conversations/${roomId}/messages`) && url.searchParams.has('cursor');
  });
  await messageHistory.getByRole('button', { name: 'Tải thêm tin nhắn cũ', exact: true }).press('Enter');
  await olderHistoryRequest;
  await revisionButton.click();
  await revisions.getByText('Current revision for this room').waitFor();
  releaseDeniedOlderHistory();
  await page.getByRole('alert').filter({ hasText: 'Bạn hiện không xem được tin nhắn ở đây.' }).waitFor();
  await revisions.waitFor({ state: 'detached' });
  assert.equal(await cachedMessage.count(), 0, '404 on an older page revokes the cached history');
  assert.equal(await page.locator('.chat-composer-dock').count(), 0, '404 on an older page closes the composer');
  roomAOlderHistoryDenied = false;
  await page.getByRole('button', { name: 'Tải lại tin nhắn', exact: true }).press('Enter');
  await cachedMessage.waitFor();
  await page.locator('.chat-composer-dock').waitFor();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: 55, matrix, boundary: 'Chromium with controlled canonical HTTP and SockJS/STOMP frames, not live Cassandra' }));
} finally {
  await browser.close();
}
