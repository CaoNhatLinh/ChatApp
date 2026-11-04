import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3117';
const actor = '00000000-0000-0000-0000-000000000601', room = '00000000-0000-0000-0000-000000000602';
const target = '00000000-0000-0000-0000-000000000603', sourceRoom = '00000000-0000-0000-0000-000000000604';
const id = '40000000-0000-1000-8000-000000000605', sourceId = '40000000-0000-1000-8000-000000000606';
const bucket = '2026-10-20-08:03', at = '2026-10-20T08:00:00Z';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const user = { userId: actor, username: 'operator', displayName: 'Người thử nghiệm', email: 'actor@example.test', accountStatus: 'ACTIVE' };
const conversation = { conversationId: room, conversationType: 'GROUP', name: 'Forward verification', ownerId: actor,
  createdBy: actor, createdAt: at, updatedAt: at, lastActivityAt: at, memberCount: 2, isDeleted: false,
  defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const message = { conversationId: room, messageBucket: bucket, messageId: id, senderId: actor,
  content: 'Tin cần chia sẻ.', contentFormat: 'PLAIN', revision: 0, messageType: 'TEXT', forwarded: true,
  isDeleted: false, hasAttachments: false, hasMentions: false, isPinned: false, createdAt: at };
const source = { ...message, conversationId: sourceRoom, messageId: sourceId, content: 'Nguồn đã xác minh.', forwarded: false };
const row = conversation => ({ conversation, pinned: false, unreadCount: 0, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null });
let failSend = true, unavailable = false, failDraft = true, failPage = true, custom = false, sourceAttachments = false;
const sends = [], errors = [], failures = [], directoryCalls = [], libraryCalls = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const settleMessage = () => page.waitForFunction(() => {
  const messages = [...document.querySelectorAll('.forward-message-dialog article > [style], .forward-source-dialog article > [style]')];
  return messages.length > 0 && messages.every(node => Number(getComputedStyle(node).opacity) >= 0.999);
});
page.setDefaultTimeout(12000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', entry => { if (entry.type() === 'error' && !entry.text().includes('Failed to load resource')) errors.push(entry.text()); });
page.on('requestfailed', request => { if (!request.url().includes('/ws/') && request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
await page.routeWebSocket('**/ws/**', ws => {
  ws.onMessage(raw => { for (const frame of JSON.parse(raw.toString())) if (frame.startsWith('CONNECT')) ws.send(`a${JSON.stringify(['CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'])}`); }); ws.send('o');
});
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/') && !path.includes('/ws/')) return route.continue();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(user);
  if (path.endsWith('/devices')) return json({ deviceId: 'forward-device' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'tiktok', rooms: custom ? [{ conversationId: room, themeId: 'aurora', customBackgroundUrl: 'https://assets.example.test/forward-bg.svg', updatedAt: at }] : [] });
  if (path.endsWith('/conversations')) {
    directoryCalls.push({ cursor: url.searchParams.get('cursor'), query: url.searchParams.get('q') });
    if (url.searchParams.get('cursor') && failPage) { failPage = false; return json({ code: 'INTERNAL_ERROR' }, 503); }
    if (url.searchParams.get('q') === 'đọc') return json({ content: [row({ ...conversation, conversationId: target, name: 'Cộng đồng đọc sách' })], hasNext: false, nextCursor: null });
    return json({ content: url.searchParams.get('cursor') ? [row({ ...conversation, conversationId: target, name: 'Cộng đồng đọc sách' })] : [row(conversation)],
      nextCursor: url.searchParams.get('cursor') ? null : 'target-page', hasNext: !url.searchParams.get('cursor') });
  }
  if (path.endsWith(`/conversations/${room}`)) return json(conversation);
  if (path.endsWith('/read-state')) return json({ lastReadMessageId: id, joinedAt: at });
  if (path.endsWith('/notification-policy')) return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  if (path.endsWith('/forward-draft')) { if (failDraft) { failDraft = false; return json({ code: 'INTERNAL_ERROR' }, 503); } return json({ message, attachments: [] }); }
  if (path.endsWith('/forward-source')) return json(unavailable ? { available: false, source: null } : { available: true, source: { ...source, hasAttachments: sourceAttachments } });
  if (path.endsWith('/shared-content')) { libraryCalls.push(path); return json({ content: [], hasNext: false, nextCursor: null }); }
  if (path.endsWith('/messages') && request.method() === 'GET') return json({ content: [message], polls: [], interactions: [], nextCursor: null, hasNext: false });
  if (path.endsWith('/messages') && request.method() === 'POST') {
    const payload = request.postDataJSON(); sends.push({ path, payload });
    if (failSend) { failSend = false; return json({ code: 'INTERNAL_ERROR' }, 503); }
    return json({ ...message, conversationId: target, clientMessageId: payload.clientMessageId, content: payload.content }, 201);
  }
  if (path.includes('/users/')) return json({ ...user, userId: path.split('/').at(-1), displayName: 'Người gửi nguồn' });
  if (path.includes('/unread/count')) return json({ count: 0 });
  if (path.includes('/friends/status/')) return json([]);
  if (path.endsWith('/info')) return json({ websocket: true, cookie_needed: false, origins: ['*:*'], entropy: 1 });
  return json({ content: [], userDetails: [], hasNext: false, nextCursor: null });
});
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
await page.route('https://assets.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><path fill="white" d="M0 0h800v800H0z"/></svg>' }));
await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
await page.getByText('Forward verification', { exact: true }).first().click();
const composer = page.locator('.chat-composer-dock textarea'); await composer.fill('Bản nháp không được mất.');
const messageRow = page.locator(`[data-message-id="${id}"]`);
await messageRow.hover(); await messageRow.getByRole('button', { name: 'Tùy chọn khác', exact: true }).click();
await page.getByRole('menuitem', { name: 'Chuyển tiếp', exact: true }).click();
const dialog = page.getByRole('dialog', { name: 'Chuyển tiếp tin nhắn', exact: true });
await dialog.getByText('Không tải được tin nguồn. Hãy thử lại.', { exact: true }).waitFor();
await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click();
await dialog.getByText(message.content, { exact: true }).waitFor();
await dialog.getByRole('button', { name: 'Tải thêm cuộc trò chuyện', exact: true }).click();
await dialog.getByRole('alert').waitFor();
await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click();
await dialog.getByRole('button', { name: 'Cộng đồng đọc sách', exact: true }).waitFor();
await dialog.getByRole('button', { name: 'Forward verification', exact: true }).click();
assert.equal(await dialog.getByRole('button', { name: 'Chuyển tiếp', exact: true }).isEnabled(), true);
await dialog.getByRole('textbox', { name: 'Tìm nơi nhận', exact: true }).fill('đọc');
assert.equal(await dialog.getByRole('button', { name: 'Chuyển tiếp', exact: true }).isDisabled(), true);
assert.equal(sends.length, 0);
await dialog.getByRole('button', { name: 'Cộng đồng đọc sách', exact: true }).click();
assert.ok(directoryCalls.some(call => call.query === 'đọc'));
await dialog.getByRole('button', { name: 'Chuyển tiếp', exact: true }).click();
await dialog.getByRole('button', { name: 'Thử gửi lại', exact: true }).waitFor();
assert.equal(await dialog.getByRole('textbox', { name: 'Tìm nơi nhận', exact: true }).isDisabled(), true);
await page.keyboard.press('Escape');
const discard = page.getByRole('dialog', { name: 'Đóng lượt gửi chưa rõ kết quả?', exact: true });
await discard.getByRole('button', { name: 'Hủy', exact: true }).click();
await dialog.getByRole('button', { name: 'Thử gửi lại', exact: true }).click();
await dialog.getByText('Đã chuyển tiếp.', { exact: true }).waitFor();
assert.equal(sends.length, 2); assert.equal(sends[0].payload.clientMessageId, sends[1].payload.clientMessageId);
assert.deepEqual(sends[0], sends[1]); assert.equal(sends[1].payload.forwardedFromMessageId, id);
assert.equal(sends[1].path, `/api/conversations/${target}/messages`);
assert.ok(directoryCalls.some(call => call.cursor === 'target-page'));
await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
assert.equal(await composer.inputValue(), 'Bản nháp không được mất.');
assert.equal(await composer.evaluate(node => node === document.activeElement), true);
await messageRow.getByRole('button', { name: 'Xem nguồn chuyển tiếp', exact: true }).click();
const sourceDialog = page.getByRole('dialog', { name: 'Nguồn tin nhắn', exact: true });
await sourceDialog.getByText(source.content, { exact: true }).waitFor();
unavailable = true; await sourceDialog.getByRole('button', { name: 'Tải lại nguồn', exact: true }).click();
await sourceDialog.getByText('Nguồn không còn khả dụng với bạn.', { exact: true }).waitFor();
assert.equal(await sourceDialog.getByText(source.content, { exact: true }).count(), 0);
await page.screenshot({ path: 'artifacts/ui-audit/current/forward-source-unavailable-1440.png', fullPage: true });
const matrix = []; await mkdir('artifacts/ui-audit/current', { recursive: true });
for (const theme of ['light', 'dark']) {
  await page.evaluate(theme => localStorage.setItem('themePreference', theme), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Forward verification', { exact: true }).first().click();
  await messageRow.hover(); await messageRow.getByRole('button', { name: 'Tùy chọn khác', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Chuyển tiếp', exact: true }).click();
  await dialog.getByText(message.content, { exact: true }).waitFor();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await settleMessage();
    await page.screenshot({ path: `artifacts/ui-audit/current/forward-${theme}-${width}.png`, fullPage: true }); matrix.push({ theme, width });
  }
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  unavailable = false;
  await messageRow.getByRole('button', { name: 'Xem nguồn chuyển tiếp', exact: true }).click();
  await sourceDialog.getByText(source.content, { exact: true }).waitFor();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const bounds = await sourceDialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    assert.equal(await sourceDialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await settleMessage();
    await page.screenshot({ path: `artifacts/ui-audit/current/forward-source-${theme}-${width}.png`, fullPage: true });
  }
  if (theme === 'light') {
    sourceAttachments = true;
    await sourceDialog.getByRole('button', { name: 'Tải lại nguồn', exact: true }).click();
    await sourceDialog.getByRole('button', { name: 'Xem thư viện ảnh và tệp', exact: true }).click();
    const library = page.getByRole('dialog', { name: 'Tệp và nội dung dùng chung', exact: true });
    await library.waitFor(); assert.ok(libraryCalls.some(path => path === `/api/conversations/${sourceRoom}/shared-content`));
    await page.keyboard.press('Escape'); await library.waitFor({ state: 'hidden' }); sourceAttachments = false;
  }
  await page.keyboard.press('Escape'); await sourceDialog.waitFor({ state: 'hidden' });
}
custom = true;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByText('Forward verification', { exact: true }).first().click();
await messageRow.hover(); await messageRow.getByRole('button', { name: 'Tùy chọn khác', exact: true }).click();
await page.getByRole('menuitem', { name: 'Chuyển tiếp', exact: true }).click();
await dialog.getByText(message.content, { exact: true }).waitFor();
for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 1000 }); await settleMessage(); await page.screenshot({ path: `artifacts/ui-audit/current/forward-custom-${width}.png`, fullPage: true }); }
await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
await switchLocaleInSettings(page);
await messageRow.getByRole('button', { name: 'View forward source', exact: true }).click();
await page.getByRole('dialog', { name: 'Message source', exact: true }).getByRole('button', { name: 'Reload source', exact: true }).waitFor();
assert.deepEqual(errors, []); assert.deepEqual(failures, []);
await browser.close();
console.log(JSON.stringify({ passed: 23, matrix, boundary: 'Production Chromium with controlled canonical HTTP/STOMP; not live Cassandra' }));
