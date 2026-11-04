import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3117';
const actor = '00000000-0000-0000-0000-000000000401', peer = '00000000-0000-0000-0000-000000000409';
const room = '00000000-0000-0000-0000-000000000402', root = '40000000-0000-1000-8000-000000000403';
const child = '40000000-0000-1000-8000-000000000404', child2 = '40000000-0000-1000-8000-000000000405';
const bucket = '2026-10-20-08:03', at = '2026-10-20T08:00:00Z';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const user = { userId: actor, username: 'operator', displayName: 'Người thử nghiệm', email: 'actor@example.test', accountStatus: 'ACTIVE' };
const conversation = { conversationId: room, conversationType: 'GROUP', name: 'Thread verification', ownerId: actor,
  createdBy: actor, createdAt: at, updatedAt: at, lastActivityAt: at, memberCount: 2, isDeleted: false,
  defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const parent = { conversationId: room, messageBucket: bucket, messageId: root, senderId: peer,
  content: 'Tin gốc nằm ngoài phần lịch sử đã tải.', contentFormat: 'PLAIN', revision: 0, messageType: 'TEXT',
  isDeleted: false, hasAttachments: false, hasMentions: false, isPinned: false, createdAt: at };
const reply = { ...parent, messageId: child, senderId: actor, content: 'Trả lời đầu tiên.', replyToMessageId: root, replyToMessageBucket: bucket };
let failNextPage = false, denied = false, deleted = false, cycle = false, failSend = true;
let empty = false, missing = false, custom = false, holdSource = false, releaseSource, sourceStarted;
const requests = [], sends = [], reads = [], errors = [], failures = [], expectedSendErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const subscriptions = new Map();
let socket;
await page.routeWebSocket('**/ws/**', ws => {
  socket = ws; subscriptions.clear();
  ws.onMessage(raw => {
    for (const frame of JSON.parse(raw.toString())) {
      if (frame.startsWith('CONNECT')) ws.send(`a${JSON.stringify(['CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'])}`);
      if (frame.startsWith('SUBSCRIBE')) subscriptions.set(frame.match(/\ndestination:([^\n]+)/)?.[1], frame.match(/\nid:([^\n]+)/)?.[1]);
    }
  });
  ws.send('o');
});
const emit = payload => {
  const destination = `/topic/conversation/${room}`;
  assert.ok(subscriptions.has(destination));
  socket.send(`a${JSON.stringify([`MESSAGE\nsubscription:${subscriptions.get(destination)}\nmessage-id:thread-fixture-${Date.now()}\ndestination:${destination}\n\n${JSON.stringify(payload)}\0`])}`);
};
page.setDefaultTimeout(12000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', entry => {
  if (entry.type() !== 'error' || entry.text().includes('Failed to load resource')) return;
  if (entry.text().includes('[useMessenger] Error sending message')) expectedSendErrors.push(entry.text());
  else errors.push(entry.text());
});
page.on('requestfailed', request => {
  if (!request.url().includes('/ws/') && request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url());
});
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
  if (!url.pathname.startsWith('/api/') && !url.pathname.includes('/ws/')) return route.continue();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (path.endsWith('/calls/incoming')) return route.fulfill({ json: { content: [], nextCursor: null, hasNext: false } });
  if (path.endsWith('/calls/active')) return route.fulfill({ status: 204 });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(user);
  if (path.endsWith('/devices')) return json({ deviceId: 'thread-device' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'tiktok', rooms: custom ? [{ conversationId: room, themeId: 'aurora', customBackgroundUrl: 'https://assets.example.test/thread-bg.svg', updatedAt: at }] : [] });
  if (path.endsWith('/conversations')) return json({ content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null }], nextCursor: null, hasNext: false });
  if (path.endsWith(`/conversations/${room}`)) return json(conversation);
  if (path.endsWith(`/conversations/${room}/summary`)) return json({ conversation, pinned: false, unreadCount: 0, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null });
  if (path.endsWith('/read-state')) return json({ lastReadMessageId: child, joinedAt: at });
  if (path.endsWith('/read') && method === 'POST') { reads.push({ path, body: request.postDataJSON() }); return json({}); }
  if (path.endsWith('/notification-policy')) return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  if (path.endsWith(`/messages/${root}/replies`)) {
    const cursor = url.searchParams.get('cursor'); requests.push({ cursor, bucket: url.searchParams.get('bucket') });
    if (holdSource) { holdSource = false; sourceStarted(); await new Promise(resolve => { releaseSource = resolve; }); }
    if (denied) return json({ code: 'FORBIDDEN' }, 403);
    if (missing) return json({ code: 'RESOURCE_NOT_FOUND' }, 404);
    if (cursor && failNextPage) { failNextPage = false; return json({ code: 'INTERNAL_ERROR' }, 503); }
    return json({ parent: { ...parent, isDeleted: deleted, content: deleted ? '' : parent.content },
      content: cursor ? [{ ...reply, messageId: child2, content: 'Trả lời ở trang tiếp theo.' }] : empty ? [] : [reply],
      hasNext: !cursor || cycle, nextCursor: !cursor ? 'cursor-a' : cycle ? 'cursor-a' : null });
  }
  if (path.endsWith(`/messages/${child}/replies`)) return json({ parent: reply, content: [], hasNext: false, nextCursor: null });
  if (path.endsWith('/messages') && method === 'GET') return json({ content: [reply], polls: [], interactions: [{ messageId: child, reactions: [] }], nextCursor: null, hasNext: false });
  if (path.endsWith('/messages') && method === 'POST') {
    const payload = request.postDataJSON(); sends.push(payload);
    if (failSend) { failSend = false; return json({ code: 'INTERNAL_ERROR' }, 503); }
    return json({ ...reply, messageId: '40000000-0000-1000-8000-000000000406', content: payload.content, clientMessageId: payload.clientMessageId }, 201);
  }
  if (path.includes('/users/')) return json({ ...user, userId: path.split('/').at(-1), displayName: 'Người gửi thật' });
  if (path.includes('/unread/count')) return json({ count: 0 });
  if (path.includes('/friends/status/')) return json([]);
  if (path.endsWith('/members')) return json({ content: [], hasNext: false, nextCursor: null });
  if (path.endsWith('/info')) return json({ websocket: true, cookie_needed: false, origins: ['*:*'], entropy: 1 });
  return json({ content: [], userDetails: [], hasNext: false, nextCursor: null });
});
await page.route('https://assets.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><path fill="white" d="M0 0h800v800H0z"/></svg>' }));
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
await page.getByText('Thread verification', { exact: true }).first().click();
const mainComposer = page.locator('.chat-composer-dock textarea');
await mainComposer.fill('Bản nháp chính vẫn ở đây.');
await page.getByRole('button', { name: 'Xem tin nhắn gốc', exact: true }).click();
const dialog = page.getByRole('dialog', { name: 'Trả lời tin nhắn', exact: true });
await dialog.getByText(parent.content, { exact: true }).waitFor();
assert.equal(requests[0].bucket, bucket, 'point source uses full key, not a history scan');
const behindId = '80000000-0000-1000-8000-000000000499';
emit({ ...parent, messageId: behindId, content: 'Tin mới sau panel.' });
await page.waitForTimeout(650);
assert.equal(reads.some(read => JSON.stringify(read).includes(behindId)), false, 'covered timeline must not acknowledge a new message');
await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
await page.waitForTimeout(650);
assert.equal(reads.some(read => JSON.stringify(read).includes(behindId)), true, 'visible timeline resumes acknowledgment after closing');
await page.getByRole('button', { name: 'Xem tin nhắn gốc', exact: true }).click();
await dialog.getByText(parent.content, { exact: true }).waitFor();
failNextPage = true;
await dialog.getByRole('button', { name: 'Tải thêm trả lời', exact: true }).click();
await dialog.getByRole('alert').waitFor();
await dialog.getByText(reply.content, { exact: true }).waitFor();
await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click();
await dialog.getByText('Trả lời ở trang tiếp theo.', { exact: true }).waitFor();
assert.deepEqual(requests.slice(-2).map(item => item.cursor), ['cursor-a', 'cursor-a']);
await dialog.getByLabel('Nội dung trả lời', { exact: true }).fill('Một trả lời mới.');
await dialog.getByRole('button', { name: 'Gửi trả lời', exact: true }).click();
await dialog.getByRole('button', { name: 'Thử gửi lại', exact: true }).waitFor();
await dialog.getByRole('button', { name: 'Thử gửi lại', exact: true }).click();
await dialog.getByText('Đã gửi trả lời.', { exact: true }).waitFor();
assert.equal(sends.length, 2); assert.equal(sends[0].clientMessageId, sends[1].clientMessageId);
assert.equal(sends[0].replyToMessageId, root); assert.equal(sends[0].replyToMessageBucket, bucket);
assert.equal(await mainComposer.inputValue(), 'Bản nháp chính vẫn ở đây.');
deleted = true;
emit({ ...parent, isDeleted: true, content: '' });
await dialog.getByText('Tin nhắn đã bị xóa', { exact: true }).waitFor();
assert.equal(await dialog.getByLabel('Nội dung trả lời', { exact: true }).isEnabled(), false);
denied = true;
await dialog.getByRole('button', { name: 'Tải lại trả lời', exact: true }).click();
await dialog.getByText('Bạn không còn quyền xem cuộc trò chuyện này.', { exact: true }).waitFor();
assert.equal(await dialog.getByText(reply.content, { exact: true }).count(), 0);
denied = false; deleted = false;
await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click();
await dialog.getByText(parent.content, { exact: true }).waitFor();
empty = true;
const beforeEmpty = requests.length;
await dialog.getByRole('button', { name: 'Tải lại trả lời', exact: true }).click();
await dialog.getByText('Phần này chưa có trả lời hiển thị. Bạn có thể tải tiếp.', { exact: true }).waitFor();
assert.equal(requests.length, beforeEmpty + 1, 'no automatic unbounded scan to fill a filtered page');
await dialog.getByRole('button', { name: 'Tải thêm trả lời', exact: true }).click();
await dialog.getByText('Trả lời ở trang tiếp theo.', { exact: true }).waitFor();
empty = false; cycle = true;
await dialog.getByRole('button', { name: 'Tải lại trả lời', exact: true }).click();
await dialog.getByText(parent.content, { exact: true }).waitFor();
await dialog.getByRole('button', { name: 'Tải thêm trả lời', exact: true }).click();
await dialog.getByRole('alert').waitFor();
cycle = false;
await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click();
await dialog.getByText('Trả lời ở trang tiếp theo.', { exact: true }).waitFor();
missing = true;
await dialog.getByRole('button', { name: 'Tải lại trả lời', exact: true }).click();
await dialog.getByText('Tin gốc không còn khả dụng.', { exact: true }).waitFor();
assert.equal(await dialog.getByText(parent.content, { exact: true }).count(), 0);
missing = false;
await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click();
await dialog.getByText(parent.content, { exact: true }).waitFor();
const matrix = [];
await mkdir('artifacts/ui-audit/current', { recursive: true });
for (const theme of ['light', 'dark']) {
  await page.evaluate(theme => localStorage.setItem('themePreference', theme), theme);
  // Real preference changes are observed by the app only after reload; reopen from the reference.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Thread verification', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Xem tin nhắn gốc', exact: true }).click();
  await dialog.getByText(parent.content, { exact: true }).waitFor();
  await dialog.getByText('Người gửi thật', { exact: true }).first().waitFor();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(250);
    const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await page.screenshot({ path: `artifacts/ui-audit/current/thread-${theme}-${width}.png`, fullPage: true });
    matrix.push({ theme, width });
  }
}
await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
assert.equal(await mainComposer.evaluate(node => node === document.activeElement), true);
holdSource = true;
const held = new Promise(resolve => { sourceStarted = resolve; });
await page.getByRole('button', { name: 'Xem tin nhắn gốc', exact: true }).click();
await held;
await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
const mainRow = page.locator(`[data-message-id="${child}"]`);
await mainRow.hover(); await mainRow.getByRole('button', { name: 'Tùy chọn khác', exact: true }).click();
await page.getByRole('menuitem', { name: 'Xem các trả lời', exact: true }).click();
await dialog.getByText(reply.content, { exact: true }).waitFor();
releaseSource();
await page.waitForTimeout(200);
assert.equal(await dialog.getByText(parent.content, { exact: true }).count(), 0, 'aborted previous parent cannot overwrite the new thread');
await dialog.getByLabel('Nội dung trả lời', { exact: true }).fill('Bản nháp chưa gửi.');
await page.keyboard.press('Escape');
const discard = page.getByRole('dialog', { name: 'Bỏ bản nháp trả lời?', exact: true });
await discard.getByRole('button', { name: 'Hủy', exact: true }).click();
assert.equal(await dialog.getByLabel('Nội dung trả lời', { exact: true }).inputValue(), 'Bản nháp chưa gửi.');
await page.keyboard.press('Escape');
await discard.getByRole('button', { name: 'Bỏ bản nháp', exact: true }).click();
await dialog.waitFor({ state: 'hidden' });
custom = true;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByText('Thread verification', { exact: true }).first().click();
await page.getByRole('button', { name: 'Xem tin nhắn gốc', exact: true }).click();
await dialog.getByText(parent.content, { exact: true }).waitFor();
for (const width of [320, 1440]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.waitForFunction(() => document.querySelector('.thread-dialog [data-room-mode]')?.getAttribute('data-room-mode') === 'dark');
  assert.ok(await dialog.locator('[data-room-mode]').evaluate(node => getComputedStyle(node).backgroundImage.includes('thread-bg.svg')));
  for (const label of [dialog.getByRole('heading', { name: 'Tin gốc', exact: true }), dialog.getByText('Người gửi thật', { exact: true }).first()]) {
    const contrast = await label.evaluate(node => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      const luminance = color => {
        context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
        const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
          const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const text = luminance(getComputedStyle(node).color);
      const background = luminance(getComputedStyle(node.closest('.thread-reading-plane')).backgroundColor);
      return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
    });
    assert.ok(contrast >= 4.5, `custom room label contrast ${contrast}`);
  }
  await page.screenshot({ path: `artifacts/ui-audit/current/thread-custom-${width}.png`, fullPage: true });
}
await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
await switchLocaleInSettings(page);
await page.getByRole('button', { name: 'View source message', exact: true }).click();
await page.getByRole('dialog', { name: 'Message replies', exact: true }).getByRole('button', { name: 'Load more replies', exact: true }).waitFor();
assert.deepEqual(errors, []); assert.deepEqual(failures, []); assert.equal(expectedSendErrors.length, 1);
await browser.close();
console.log(JSON.stringify({ passed: 19, matrix, boundary: 'Production Chromium with controlled canonical HTTP and SockJS/STOMP; no live datastore/realtime provider' }));
