import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3117';
const apiUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const actorId = '00000000-0000-0000-0000-000000000401';
const roomId = '00000000-0000-0000-0000-000000000402';
const assetId = '00000000-0000-0000-0000-000000000411';
const attachmentId = '00000000-0000-0000-0000-000000000412';
const now = '2026-10-23T08:00:00Z';
const retryMode = process.env.ATTACHMENT_RETRY_MODE ?? 'bubble';
const bubbleConflictModes = ['bubble-deleted', 'bubble-ready'];
const sendConflict = ['stale-ready', ...bubbleConflictModes].includes(retryMode);
assert.ok(['bubble', 'composer', 'new-draft', 'leave-upload', 'partial-upload', 'reload-upload', 'deleted-upload', 'stale-ready', ...bubbleConflictModes].includes(retryMode), 'known retry test mode');
const reloadModes = ['reload-upload', 'deleted-upload'];
const otherRoomId = '00000000-0000-0000-0000-000000000403';
let uploadStarted;
const waitingForUpload = new Promise(resolve => { uploadStarted = resolve; });
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const room = { conversationId: roomId, conversationType: 'GROUP', name: 'Attachment verification',
  createdBy: actorId, ownerId: actorId, createdAt: now, updatedAt: now, lastActivityAt: now,
  isDeleted: false, memberCount: 1, defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOioAAAAASUVORK5CYII=', 'base64');
const upload = { assetId, attachmentId, storageProvider: 'CLOUDINARY', storageKey: 'chatapp/fixture/image',
  url: 'https://res.cloudinary.com/fixture/image/upload/v1/chatapp/fixture/image.png', fileName: 'attachment.png', fileSize: png.length,
  contentType: 'image/png', resourceType: 'image', publicId: 'chatapp/fixture/image', width: 1, height: 1,
  durationMs: null, thumbnailUrl: 'https://res.cloudinary.com/fixture/image/upload/c_limit,f_png,h_320,pg_1,w_320/v1/chatapp/fixture/image.png',
  thumbnails: [
    { variant: 'SMALL', status: 'READY', url: 'https://res.cloudinary.com/fixture/image/upload/c_limit,f_png,h_320,pg_1,w_320/v1/chatapp/fixture/image.png', width: 1, height: 1, createdAt: now },
    { variant: 'MEDIUM', status: 'UNAVAILABLE', url: null, width: null, height: null, createdAt: now },
    { variant: 'LARGE', status: 'UNAVAILABLE', url: null, width: null, height: null, createdAt: now },
  ] };
const replacementUpload = {
  ...upload,
  assetId: '00000000-0000-0000-0000-000000000431',
  attachmentId: '00000000-0000-0000-0000-000000000432',
  storageKey: 'chatapp/fixture/replacement',
  publicId: 'chatapp/fixture/replacement',
  url: upload.url.replace('/image.png', '/replacement.png'),
  thumbnailUrl: upload.thumbnailUrl.replace('/image.png', '/replacement.png'),
  thumbnails: upload.thumbnails.map(row => row.url ? { ...row, url: row.url.replace('/image.png', '/replacement.png') } : row),
};
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(12_000);
const posts = [], unexpectedErrors = [], warnings = [], failedRequests = [];
const expectedErrors = [];
const uploadIds = [], inspectionIds = [];
let committedUploadId;
let uploads = 0;
page.on('pageerror', error => unexpectedErrors.push(error.message));
page.on('console', entry => {
  if (entry.type() === 'warning') {
    const warning = entry.text();
    const expectedUploadInterruption = [...reloadModes, 'leave-upload'].includes(retryMode)
      && warning.includes('status: undefined, method: POST, url: /files/upload}');
    const expectedUploadUnavailable = retryMode === 'partial-upload'
      && warning.includes('status: 503, method: POST, url: /files/upload}');
    const expectedSendUnavailable = ['bubble', 'composer', 'new-draft'].includes(retryMode)
      && warning.includes(`status: 503, method: POST, url: /conversations/${roomId}/messages}`);
    const expectedSendConflict = sendConflict
      && warning.includes(`status: 409, method: POST, url: /conversations/${roomId}/messages}`);
    const developmentPinReadCancellation = [roomId, otherRoomId].some(id =>
      warning.includes(`status: undefined, method: GET, url: /conversations/${id}/messages/pins}`));
    const developmentLcpNotice = warning.startsWith('Image with src "/noi-signal-orbit.svg" was detected as the Largest Contentful Paint (LCP).');
    if (!expectedUploadInterruption && !expectedUploadUnavailable && !expectedSendUnavailable && !expectedSendConflict
      && !developmentPinReadCancellation && !developmentLcpNotice) warnings.push(warning);
  }
  if (entry.type() !== 'error') return;
  const expected = entry.text().includes('[useMessenger] Error sending message')
    || entry.text().includes('[MessageInput] Failed to send message') || entry.text().includes('503')
    || (reloadModes.includes(retryMode) && entry.text().includes('net::ERR_FAILED'))
    || (sendConflict && entry.text().startsWith('Failed to load resource: the server responded with a status of 409'));
  (expected ? expectedErrors : unexpectedErrors).push(entry.text());
});
page.on('requestfailed', request => {
  const expectedUploadLoss = reloadModes.includes(retryMode)
    && new URL(request.url()).pathname.endsWith('/files/upload')
    && request.failure()?.errorText === 'net::ERR_FAILED';
  if (!expectedUploadLoss && request.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push(request.url());
});
await page.route('https://res.cloudinary.com/fixture/**', route => route.fulfill({ contentType: 'image/png', body: png }));
await page.route('**/ws/info?*', route => route.fulfill({ json: { websocket: true, cookie_needed: false, origins: ['*:*'], entropy: 1 } }));
await page.routeWebSocket('**/ws/**', socket => {
  socket.onMessage(raw => {
    for (const frame of JSON.parse(raw.toString())) {
      if (frame.startsWith('CONNECT')) socket.send(`a${JSON.stringify(['CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'])}`);
    }
  });
  socket.send('o');
});
await page.route(`${apiUrl}/**`, async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json({ userId: actorId, username: 'attachment-member', displayName: 'Attachment member', accountStatus: 'ACTIVE' });
  if (path.endsWith('/devices')) return json({ ...request.postDataJSON(), deviceName: 'Controlled browser',
    appVersion: null, active: true, createdAt: now, lastSeenAt: now });
  if (path.includes('/devices/') && path.endsWith('/heartbeat')) return route.fulfill({ status: 204 });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'classic', rooms: [] });
  if (path.endsWith('/conversations')) return json({ content: [{ conversation: room, pinned: false, unreadCount: 0,
    joinedAt: now, notificationOverride: 'INHERIT', lastMessage: null },
    { conversation: { ...room, conversationId: otherRoomId, name: 'Other recovery room' }, pinned: false,
      unreadCount: 0, joinedAt: now, notificationOverride: 'INHERIT', lastMessage: null }], hasNext: false, nextCursor: null });
  if (path.endsWith('/notification-policy')) return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  if (path.endsWith('/read-state')) return json({ lastReadMessageId: null, lastReadAt: null, joinedAt: now });
  if (path.endsWith('/messages/pins')) return json({ conversationId: path.split('/').at(-3), revision: '0', pins: [] });
  if (path.endsWith('/attachments')) {
    const content = (posts.at(-1)?.attachments ?? []).map(ref => ({ ...ref, status: 'READY', spoiler: false,
      url: ref.assetId === replacementUpload.assetId ? replacementUpload.url
        : ref.assetId === assetId ? upload.url : upload.url.replace('/image.png', '/second.png') }));
    return json({ conversationId: roomId, messageId: '00000000-0000-1000-8000-000000000413',
      messageBucket: '2026-10-23-08:00', content, nextCursor: null, hasNext: false });
  }
  if (path.endsWith('/files/upload')) {
    uploads++;
    const uploadId = url.searchParams.get('uploadId');
    assert.equal(url.searchParams.get('purpose'), 'COMPOSER');
    assert.match(uploadId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    uploadIds.push(uploadId);
    if (retryMode === 'leave-upload') { uploadStarted(); return; }
    if (reloadModes.includes(retryMode) && uploads === 1) {
      committedUploadId = uploadId;
      return route.abort('failed');
    }
    if (retryMode === 'partial-upload') {
      if (uploads === 2) return json({ code: 'SERVICE_UNAVAILABLE', message: 'Controlled second upload failure' }, 503);
      if (uploads > 2) return json({ success: true, file: { ...upload,
        assetId: '00000000-0000-0000-0000-000000000421', attachmentId: '00000000-0000-0000-0000-000000000422',
        fileName: 'second.png', storageKey: 'chatapp/fixture/second', publicId: 'chatapp/fixture/second',
        url: upload.url.replace('/image.png', '/second.png'),
        thumbnailUrl: upload.thumbnailUrl.replace('/image.png', '/second.png'),
        thumbnails: upload.thumbnails.map(row => row.url ? { ...row, url: row.url.replace('/image.png', '/second.png') } : row),
      } }, 201);
    }
    const replaced = retryMode === 'deleted-upload' || (retryMode === 'stale-ready' && uploads > 1);
    return json({ success: true, file: replaced ? replacementUpload : upload }, 201);
  }
  if (path.includes('/files/uploads/')) {
    const uploadId = path.split('/').at(-1);
    inspectionIds.push(uploadId);
    if (bubbleConflictModes.includes(retryMode) && uploadId === uploadIds[0]) {
      if (inspectionIds.length === 1) return json({ uploadId, status: 'PENDING', file: null });
      return retryMode === 'bubble-ready'
        ? json({ uploadId, status: 'READY', file: upload })
        : json({ uploadId, status: 'DELETED', file: null });
    }
    if (retryMode === 'stale-ready' && uploadId === uploadIds[0]) {
      return json({ uploadId, status: 'DELETED', file: null });
    }
    if (reloadModes.includes(retryMode) && uploadId === committedUploadId) {
      return retryMode === 'deleted-upload'
        ? json({ uploadId, status: 'DELETED', file: null })
        : json({ uploadId, status: 'READY', file: upload });
    }
    if (retryMode === 'partial-upload' && uploadId === uploadIds[1]) {
      return json({ uploadId, status: 'PENDING', file: null });
    }
    return json({ code: 'NOT_FOUND', message: 'No matching upload intent' }, 404);
  }
  if (path.endsWith(`/conversations/${otherRoomId}/messages`) && request.method() === 'GET') {
    return json({ content: [], hasNext: false, nextCursor: null, interactions: [], polls: [] });
  }
  if (path.endsWith(`/conversations/${roomId}/messages`)) {
    if (request.method() === 'GET') return json({ content: [], hasNext: false, nextCursor: null, interactions: [], polls: [] });
    const body = request.postDataJSON(); posts.push(body);
    const replaced = retryMode === 'deleted-upload' || (retryMode === 'stale-ready' && posts.length > 1);
    assert.equal(body.attachments[0].assetId, replaced ? replacementUpload.assetId : assetId);
    assert.equal(body.attachments[0].width, 1);
    assert.equal(body.attachments[0].height, 1);
    assert.equal(body.attachments[0].durationMs, null);
    assert.equal(body.attachments[0].thumbnailUrl,
      replaced ? replacementUpload.thumbnailUrl : upload.thumbnailUrl);
    if (retryMode === 'partial-upload') {
      assert.equal(body.attachments.length, 2);
      assert.equal(body.attachments[1].assetId, '00000000-0000-0000-0000-000000000421');
    }
    if (posts.length === 1 && sendConflict) {
      return json({ code: 'CONFLICT', message: 'Attachment is no longer available' }, 409);
    }
    if (posts.length === 1 && !['partial-upload', ...reloadModes].includes(retryMode)) {
      return json({ code: 'SERVICE_UNAVAILABLE', message: 'Controlled send interruption' }, 503);
    }
    return json({ ...body, conversationId: roomId, messageBucket: '2026-10-23-08:00',
      messageId: '00000000-0000-1000-8000-000000000413', senderId: actorId, contentFormat: 'PLAIN', revision: 0,
      hasAttachments: true, hasMentions: false, isDeleted: false, isPinned: false, createdAt: now });
  }
  if (path.endsWith('/read')) return route.fulfill({ status: 204 });
  if (path.endsWith('/friends/blocked')) return json([]);
  if (path.endsWith('/notifications/unread/count')) return json({ count: 0 });
  return json({ content: [], userDetails: [], hasNext: false, nextCursor: null });
});
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
try {
  await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: room.name, exact: true }).click();
  await page.locator('textarea').waitFor();
  const chosenFiles = [{ name: 'attachment.png', mimeType: 'image/png', buffer: png }];
  const staleDraft = 'Giữ lại nội dung khi tệp thay đổi trạng thái';
  if (sendConflict) await page.locator('textarea').fill(staleDraft);
  if (retryMode === 'partial-upload') chosenFiles.push({ name: 'second.png', mimeType: 'image/png', buffer: png });
  await page.locator('input[type="file"]').first().setInputFiles(chosenFiles);
  await page.getByRole('button', { name: 'Gửi tin', exact: true }).click();
  if (retryMode === 'leave-upload') {
    await waitingForUpload;
    const aborted = page.waitForEvent('requestfailed', request => new URL(request.url()).pathname.endsWith('/files/upload')
      && request.failure()?.errorText === 'net::ERR_ABORTED');
    await page.getByRole('button', { name: 'Other recovery room', exact: true }).click();
    await aborted;
    assert.equal(posts.length, 0, 'leaving during upload cannot send into the departed room');
    assert.equal(await page.locator('.chat-composer').getByText('attachment.png', { exact: true }).count(), 0);
    assert.deepEqual(unexpectedErrors, []);
    assert.deepEqual(warnings, []);
    console.log(JSON.stringify({ passed: 3, retryMode, uploads, messagePosts: posts.length,
      uploadAborted: true, boundary: 'Production Chromium route switch/client HTTP cancellation, not provider deletion or rollback' }));
  } else if (bubbleConflictModes.includes(retryMode)) {
    const retry = page.getByRole('button', { name: 'Thử gửi lại', exact: true });
    await retry.waitFor();
    assert.equal(posts.length, 1);
    assert.deepEqual(inspectionIds, []);
    await retry.click();
    await page.getByRole('status').filter({ hasText: 'Chưa kiểm tra được tệp đính kèm. Hãy thử lại.' }).waitFor();
    assert.deepEqual(inspectionIds, [uploadIds[0]]);
    assert.equal(posts.length, 1, 'unconfirmed receipt blocks the replay');
    assert.equal(await page.locator('textarea').inputValue(), staleDraft);
    await retry.click();
    if (retryMode === 'bubble-deleted') {
      await page.getByText('Tệp đính kèm không còn dùng được. Hãy chọn lại tệp.', { exact: true }).waitFor();
      await retry.waitFor({ state: 'detached' });
      assert.equal(posts.length, 1, 'deleted receipt blocks the replay');
      assert.equal(await page.locator('textarea').inputValue(), staleDraft);
      assert.equal(await page.locator('.chat-composer').getByText('attachment.png', { exact: true }).count(), 1);
    } else {
      await page.locator('[data-message-id="00000000-0000-1000-8000-000000000413"]').waitFor();
      assert.equal(posts.length, 2);
      assert.deepEqual(posts[1], posts[0], 'READY replays the exact frozen send');
      await retry.waitFor({ state: 'detached' });
    }
    assert.equal(uploads, 1, 'bubble retry never creates another provider asset');
    assert.deepEqual(inspectionIds, [uploadIds[0], uploadIds[0]], 'both checks use the original receipt');
    assert.deepEqual(unexpectedErrors, []);
    assert.deepEqual(warnings, []);
    assert.deepEqual(failedRequests, []);
    console.log(JSON.stringify({ retryMode, uploads, inspections: inspectionIds.length, messagePosts: posts.length,
      boundary: 'Chromium failed bubble recovery with controlled HTTP/STOMP' }));
  } else if (retryMode === 'stale-ready') {
    await page.getByRole('button', { name: 'Thử gửi lại', exact: true }).waitFor();
    assert.equal(uploads, 1);
    assert.equal(posts.length, 1);
    assert.deepEqual(inspectionIds, [], 'composer waits for an explicit retry');
    await page.getByRole('button', { name: 'Gửi tin', exact: true }).click();
    const notice = page.getByRole('alert').filter({ hasText: 'Tệp đã bị xóa.' });
    await notice.getByText('attachment.png', { exact: true }).waitFor();
    assert.deepEqual(inspectionIds, [uploadIds[0]], 'retry checks the exact cached upload');
    assert.equal(uploads, 1, 'terminal receipt does not cause a new upload');
    assert.equal(posts.length, 1, 'terminal receipt stops the repeated message');
    assert.equal(await page.locator('textarea').inputValue(), staleDraft);
    await page.getByRole('button', { name: 'Đặt lại lượt tải', exact: true }).click();
    await notice.waitFor({ state: 'hidden' });
    assert.equal(uploads, 1, 'reset does not upload or send');
    assert.equal(posts.length, 1);
    await page.getByRole('button', { name: 'Gửi tin', exact: true }).click();
    await page.locator('[data-message-id="00000000-0000-1000-8000-000000000413"]').waitFor();
    assert.equal(uploads, 2);
    assert.notEqual(uploadIds[1], uploadIds[0]);
    assert.equal(posts.length, 2);
    assert.equal(posts[1].attachments[0].attachmentId, replacementUpload.attachmentId);
    assert.equal(posts[1].content, staleDraft);
    assert.deepEqual(unexpectedErrors, []);
    assert.deepEqual(warnings, []);
    assert.deepEqual(failedRequests, []);
    console.log(JSON.stringify({ passed: 11, retryMode, uploads, inspectedSameIntent: true, messagePosts: posts.length,
      boundary: 'Chromium composer conflict and explicit retry with controlled HTTP/STOMP' }));
  } else if (reloadModes.includes(retryMode)) {
    await page.getByText('Không thể kết nối đến máy chủ. Kiểm tra kết nối và thử lại.', { exact: true }).waitFor();
    assert.equal(posts.length, 0, 'a lost upload response cannot send an incomplete message');
    assert.equal(uploads, 1);
    assert.deepEqual(inspectionIds, [], 'a newly allocated intent does not need inspection');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: room.name, exact: true }).click();
    const draft = 'Giữ lại nội dung khi tệp hết hạn';
    if (retryMode === 'deleted-upload') await page.locator('textarea').fill(draft);
    await page.locator('input[type="file"]').first().setInputFiles(chosenFiles);
    await page.getByRole('button', { name: 'Gửi tin', exact: true }).click();
    if (retryMode === 'deleted-upload') {
      const notice = page.getByRole('alert').filter({ hasText: 'Tệp đã bị xóa.' });
      await notice.getByText('attachment.png', { exact: true }).waitFor();
      assert.equal(await page.locator('textarea').inputValue(), draft);
      assert.equal(uploads, 1, 'a terminal lookup must not start another upload');
      assert.equal(posts.length, 0, 'the terminal file cannot send a partial message');
      await page.getByRole('button', { name: 'Đặt lại lượt tải', exact: true }).click();
      await notice.waitFor({ state: 'hidden' });
      assert.equal(uploads, 1, 'resetting the upload is not an implicit send');
      assert.equal(await page.locator('textarea').inputValue(), draft);
      await page.getByRole('button', { name: 'Gửi tin', exact: true }).click();
    }
    await page.locator('[data-message-id="00000000-0000-1000-8000-000000000413"]').waitFor();
    assert.deepEqual(inspectionIds, [committedUploadId], 'reselection inspects the exact intent saved before reload');
    if (retryMode === 'deleted-upload') {
      assert.equal(uploads, 2);
      assert.notEqual(uploadIds[1], committedUploadId, 'resetting a deleted intent allocates a new identity');
      assert.equal(posts[0].content, draft);
    } else {
      assert.equal(uploads, 1, 'confirmed upload receipt avoids a second provider upload');
    }
    assert.equal(posts.length, 1);
    assert.equal(posts[0].attachments[0].attachmentId,
      retryMode === 'deleted-upload' ? replacementUpload.attachmentId : attachmentId);
    assert.deepEqual(unexpectedErrors, []);
    assert.deepEqual(warnings, []);
    assert.deepEqual(failedRequests, []);
    console.log(JSON.stringify({ passed: retryMode === 'deleted-upload' ? 10 : 5, retryMode, uploads, inspectedSameIntent: true, messagePosts: posts.length,
      boundary: 'Chromium reload and exact file reselection with controlled HTTP/STOMP; no real provider/backend/database' }));
  } else {
  if (retryMode === 'partial-upload') {
    await page.getByText('Gửi tin nhắn thất bại.', { exact: true }).waitFor();
    assert.equal(posts.length, 0, 'a partial upload cannot send a partial message');
    assert.equal(uploads, 2);
    await page.getByRole('button', { name: 'Gửi tin', exact: true }).click();
  } else {
  await page.getByRole('button', { name: 'Thử gửi lại', exact: true }).waitFor();
  assert.equal(uploads, 1);
  if (retryMode === 'new-draft') {
    await page.locator('textarea').fill('New draft must survive the earlier send');
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'new-selection.png', mimeType: 'image/png', buffer: png });
  }
  const retryControl = page.getByRole('button', { name: retryMode === 'composer' ? 'Gửi tin' : 'Thử gửi lại', exact: true });
  await retryControl.focus();
  await retryControl.press('Enter');
  }
  await page.locator('[data-message-id="00000000-0000-1000-8000-000000000413"]').waitFor();
  if (retryMode === 'partial-upload') {
    assert.equal(posts.length, 1);
    assert.equal(uploads, 3, 'only the failed second upload is retried');
    assert.deepEqual(inspectionIds, [uploadIds[1]], 'retry checks the unresolved second intent');
    assert.equal(uploadIds[2], uploadIds[1], 'a pending upload retries with the same id');
  } else {
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[1], posts[0], 'retry retains exact command and canonical attachment facts');
    assert.equal(uploads, 1, 'retry does not create another provider asset');
    assert.deepEqual(inspectionIds, [], 'an ambiguous send interruption keeps the cached receipt without a status lookup');
  }
  assert.equal(await page.getByRole('button', { name: 'Thử gửi lại', exact: true }).count(), 0);
  await page.getByText('Gửi tin nhắn thất bại.', { exact: true }).waitFor({ state: 'hidden' });
  if (retryMode === 'new-draft') {
    assert.equal(await page.locator('textarea').inputValue(), 'New draft must survive the earlier send');
    assert.equal(await page.locator('.chat-composer').getByText('new-selection.png', { exact: true }).count(), 1);
    assert.equal(await page.locator('.chat-composer').getByText('attachment.png', { exact: true }).count(), 0, 'only the already-confirmed file is removed from the newer draft');
  } else {
    assert.equal(await page.locator('.chat-composer').getByText('attachment.png', { exact: true }).count(), 0, 'confirmed selection is cleared');
    assert.equal(await page.locator('textarea').inputValue(), '');
  }
  const image = page.locator('[data-message-id="00000000-0000-1000-8000-000000000413"] img').first();
  await image.waitFor();
  await image.evaluate(element => element.decode());
  assert.equal(await image.evaluate(element => element.naturalWidth), 1);
  await mkdir('.impeccable/review', { recursive: true });
  const matrix = [];
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForFunction(theme => document.querySelector('.chat-message-history')?.getAttribute('data-room-mode') === theme, theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 760 : 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      await page.screenshot({ path: `.impeccable/review/attachment-recovery-${retryMode}-${theme}-${width}.png` });
      matrix.push({ theme, width });
    }
  }
  assert.deepEqual(unexpectedErrors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(failedRequests, []);
  console.log(JSON.stringify({ passed: 5, retryMode, uploads, messagePosts: posts.length, matrix,
    unexpectedErrors, warnings, failedRequests, boundary: 'Production Chromium app with controlled HTTP/STOMP/assets; no real provider/backend/database' }));
  }
} catch (error) {
  console.error(JSON.stringify({ retryMode, uploads, uploadIds, inspectionIds, messagePosts: posts.length,
    unexpectedErrors, expectedErrors, warnings, failedRequests }));
  throw error;
} finally { await browser.close(); }
