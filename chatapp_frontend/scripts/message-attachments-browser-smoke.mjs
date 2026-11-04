import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3117';
const apiUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const actor = '00000000-0000-0000-0000-000000000901', peer = '00000000-0000-0000-0000-000000000902';
const roomId = '00000000-0000-0000-0000-000000000903', messageId = '00000000-0000-0000-0000-000000000904';
const attachmentId = '00000000-0000-0000-0000-000000000905', assetId = '00000000-0000-0000-0000-000000000906';
const secondId = '00000000-0000-0000-0000-000000000907';
const at = new Date().toISOString(), bucket = '2026-10-23-08:00';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const room = { conversationId: roomId, conversationType: 'GROUP', name: 'Attachment read check', ownerId: actor,
  createdBy: actor, createdAt: at, updatedAt: at, lastActivityAt: at, memberCount: 2, isDeleted: false,
  defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const message = { conversationId: roomId, messageId, messageBucket: bucket, senderId: peer, content: 'Ảnh gửi cho bạn',
  revision: 0, messageType: 'IMAGE', contentFormat: 'PLAIN_TEXT', hasAttachments: true, hasMentions: false, isDeleted: false,
  isPinned: false, forwarded: false, createdAt: at };
const imageUrl = 'https://cdn.example/attachment.png';
const audioUrl = 'https://cdn.example/attachment.wav';
const videoUrl = 'https://cdn.example/attachment.mp4';
const item = { attachmentId, assetId, fileName: 'received-photo.png', mimeType: 'image/png', byteSize: 64,
  width: 1, height: 1, durationMs: null, spoiler: false, status: 'READY', url: imageUrl, thumbnailUrl: null };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=', 'base64');
const wav = Buffer.alloc(44 + 1600);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(1600, 40);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(12000);
const errors = [], requests = [], matrix = [], failedRequests = [];
let socket, subscriptions, failure = false, forbidden = false, spoiler = false, unavailable = false, more = false, brokenImage = false, imageReads = 0;
let mediaKind = null, brokenAudio = true, videoReads = 0;
let history = [message], checks = 0;
page.on('pageerror', error => errors.push(error.stack ?? error.message));
page.on('console', entry => {
  const expectedImageError = entry.location().url.startsWith('https://cdn.example/') && entry.text().includes('404');
  if (entry.type() === 'error' && !entry.text().includes('503') && !entry.text().includes('403') && !expectedImageError) {
    errors.push(`${entry.text()} (${entry.location().url})`);
  }
});
page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push(request.url()); });
await page.route('https://cdn.example/**', route => {
  const url = route.request().url();
  if (url === audioUrl) return route.fulfill({ status: brokenAudio ? 404 : 200, body: brokenAudio ? '' : wav, contentType: 'audio/wav' });
  if (url === videoUrl) { videoReads++; return route.fulfill({ status: 404, body: '', contentType: 'video/mp4' }); }
  imageReads++; return route.fulfill({ status: brokenImage ? 404 : 200, body: brokenImage ? '' : png, contentType: 'image/png' });
});
await page.route('**/ws/info?*', route => route.fulfill({ json: { websocket: true, cookie_needed: false, origins: ['*:*'], entropy: 1 } }));
await page.routeWebSocket('**/ws/**', ws => {
  socket = ws; subscriptions = new Map();
  ws.onMessage(raw => { for (const frame of JSON.parse(raw.toString())) {
    if (frame.startsWith('CONNECT')) ws.send(`a${JSON.stringify(['CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'])}`);
    if (frame.startsWith('SUBSCRIBE')) {
      const header = Object.fromEntries(frame.split('\n').slice(1).filter(line => line.includes(':')).map(line => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)]));
      subscriptions.set(header.destination, header.id);
    }
  } }); ws.send('o');
});
await page.route(`${apiUrl}/**`, route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json({ userId: actor, username: 'reader', displayName: 'Reader', accountStatus: 'ACTIVE' });
  if (path.endsWith('/devices')) return json({ ...request.postDataJSON(), deviceName: 'Read fixture', appVersion: null, active: true, createdAt: at, lastSeenAt: at });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'classic', rooms: [] });
  if (path.endsWith('/conversations')) return json({ content: [{ conversation: room, pinned: false, unreadCount: 0,
    joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null }], hasNext: false, nextCursor: null });
  if (path.endsWith('/messages')) return json({ content: history, polls: [], interactions: [], hasNext: false, nextCursor: null });
  if (path.endsWith('/attachments')) {
    requests.push({ path, bucket: url.searchParams.get('bucket'), cursor: url.searchParams.get('cursor') });
    if (failure || forbidden) return json({ code: forbidden ? 'FORBIDDEN' : 'SERVICE_UNAVAILABLE', message: 'Controlled read failure' }, forbidden ? 403 : 503);
    const second = url.searchParams.has('cursor');
    const primary = mediaKind === 'audio' ? { ...item, fileName: 'recording.wav', mimeType: 'audio/wav', url: audioUrl }
      : mediaKind === 'video' ? { ...item, fileName: 'clip.mp4', mimeType: 'video/mp4', url: videoUrl } : item;
    return json({ conversationId: roomId, messageId, messageBucket: bucket,
      content: [second ? { ...item, attachmentId: secondId, fileName: 'received-file.pdf', mimeType: 'application/pdf', url: 'https://cdn.example/document.pdf' }
        : { ...primary, spoiler, ...(unavailable ? { status: 'UNAVAILABLE', url: null } : {}) }],
      hasNext: more && !second, nextCursor: more && !second ? attachmentId : null });
  }
  if (path.endsWith('/read-state')) return json({ lastReadMessageId: null, lastReadAt: null, joinedAt: at });
  if (path.endsWith('/notification-policy')) return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  if (path.endsWith('/calls/incoming')) return json({ content: [], nextCursor: null, hasNext: false });
  if (path.endsWith('/notifications/unread/count')) return json({ count: 0 });
  return json({ content: [], userDetails: [], hasNext: false, nextCursor: null });
});
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
const open = async () => {
  const response = await page.goto(`${baseUrl}/app?conversationId=${roomId}`, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), `Chat navigation returned HTTP ${response?.status() ?? 'unknown'}`);
  await page.getByText('Ảnh gửi cho bạn', { exact: true }).waitFor();
};
const image = () => page.getByRole('img', { name: 'received-photo.png', exact: true });
const retryAttachment = () => page.getByLabel('Tệp đính kèm', { exact: true }).getByRole('button', { name: 'Thử lại', exact: true });
const capture = async path => {
  const text = page.getByText('Ảnh gửi cho bạn', { exact: true });
  let painted = false;
  for (let i = 0; i < 120; i++) {
    painted = await text.evaluate(node => {
      let opacity = 1;
      for (let parent = node; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
      return opacity > .99;
    });
    if (painted) break;
    await page.waitForTimeout(50);
  }
  assert.ok(painted, 'capture only a fully painted message');
  await page.screenshot({ path });
};
const decoded = async () => {
  await image().waitFor();
  await page.waitForFunction(() => [...document.images].some(image => image.alt === 'received-photo.png' && image.complete && image.naturalWidth === 1));
};
const verifyPlayback = async () => {
  mediaKind = 'audio'; await open();
  const audio = page.locator('audio[aria-label="recording.wav"]');
  await audio.evaluate(player => { void player.play().catch(() => {}); });
  const audioError = page.getByText('Không phát được âm thanh.', { exact: true });
  await audioError.waitFor();
  assert.equal(await page.getByRole('link', { name: 'recording.wav', exact: true }).getAttribute('href'), audioUrl);
  brokenAudio = false;
  await retryAttachment().click();
  await audioError.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => {
    const player = document.querySelector('audio');
    return player?.readyState >= 1 && player.paused && document.activeElement === player;
  });
  checks++;
  mediaKind = 'video'; await open();
  const video = page.locator('video[aria-label="clip.mp4"]');
  assert.equal(await video.getAttribute('playsinline'), '');
  await video.evaluate(player => { void player.play().catch(() => {}); });
  const videoError = page.getByText('Không phát được video.', { exact: true });
  await videoError.waitFor();
  assert.equal(await page.getByRole('link', { name: 'clip.mp4', exact: true }).getAttribute('href'), videoUrl);
  const firstVideoRead = videoReads;
  const videoRetry = page.waitForRequest(request => request.url() === videoUrl);
  await retryAttachment().click();
  await videoRetry; await videoError.waitFor();
  assert.ok(videoReads > firstVideoRead);
  mediaKind = null; checks++;
};
const verifyAttachmentReads = async () => {
  await mkdir('.impeccable/review', { recursive: true });
  await open(); await decoded();
  assert.equal(requests[0].bucket, bucket); assert.ok(requests[0].path.includes(messageId)); checks++;
  await page.reload({ waitUntil: 'domcontentloaded' }); await decoded();
  assert.ok(requests.length >= 2, 'history reload resolves canonical asset metadata again'); checks++;
  failure = true; await open();
  await page.getByText('Chưa tải được tệp đính kèm.', { exact: true }).waitFor();
  await capture('.impeccable/review/message-attachment-read-error-light-1440.png');
  failure = false; await retryAttachment().click(); await decoded(); checks++;
  unavailable = true; await open();
  await page.getByText('Tệp này không còn khả dụng.', { exact: true }).waitFor();
  await capture('.impeccable/review/message-attachment-read-unavailable-light-1440.png');
  assert.equal(await image().count(), 0); assert.equal(await page.locator(`a[href="${imageUrl}"]`).count(), 0); checks++;
  unavailable = false; spoiler = true; const beforeSpoiler = imageReads;
  await open(); await page.getByRole('button', { name: 'Hiện tệp đính kèm', exact: true }).waitFor();
  await capture('.impeccable/review/message-attachment-read-spoiler-light-1440.png');
  assert.equal(imageReads, beforeSpoiler, 'spoiler does not preload artwork');
  await page.getByRole('button', { name: 'Hiện tệp đính kèm', exact: true }).click(); await decoded(); checks++;
  spoiler = false; more = true; await open(); await decoded();
  await page.getByRole('button', { name: 'Tải thêm tệp', exact: true }).click();
  await page.getByRole('link', { name: 'received-file.pdf', exact: true }).waitFor();
  assert.equal(requests.at(-1).cursor, attachmentId); assert.equal(await image().count(), 1); checks++;
  more = false; brokenImage = true; await open();
  await page.getByText('Không tải được ảnh.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'received-photo.png', exact: true }).waitFor();
  brokenImage = false; await retryAttachment().click(); await decoded(); checks++;
  more = false; forbidden = true; await open();
  await page.getByText('Không còn quyền xem tệp của tin nhắn này.', { exact: true }).waitFor();
  assert.equal(await image().count(), 0); checks++;
  forbidden = false; history = []; const previousSocket = socket;
  await page.reload({ waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 120 && (socket === previousSocket || !subscriptions.has(`/topic/conversation/${roomId}`)); i++) await page.waitForTimeout(50);
  assert.notEqual(socket, previousSocket, 'deliver on the current page session');
  const subscription = subscriptions.get(`/topic/conversation/${roomId}`); assert.ok(subscription);
  socket.send(`a${JSON.stringify([`MESSAGE\nsubscription:${subscription}\nmessage-id:read-check\ncontent-type:application/json\n\n${JSON.stringify({ ...message, eventType: 'MESSAGE_SEND' })}\0`])}`);
  await decoded(); checks++;
  await mkdir('.impeccable/review', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForFunction(theme => (document.documentElement.getAttribute('data-theme') === 'dark') === (theme === 'dark'), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await decoded();
      const box = await image().boundingBox(); assert.ok(box && box.width <= width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await capture(`.impeccable/review/message-attachment-read-${theme}-${width}.png`);
      matrix.push({ theme, width }); checks++;
    }
  }
};
try {
  await verifyPlayback();
  if (process.env.ATTACHMENT_PLAYBACK_ONLY !== '1') await verifyAttachmentReads();
  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []); checks++;
  console.log(JSON.stringify({ passed: checks, reads: requests.length, matrix, boundary: 'Production Chromium with controlled HTTP/STOMP and image/audio/video fixtures' }));
} catch (error) {
  console.error(JSON.stringify({ checks, url: page.url(), errors, failedRequests, lastAttachmentRead: requests.at(-1) }));
  throw error;
} finally { await browser.close(); }
