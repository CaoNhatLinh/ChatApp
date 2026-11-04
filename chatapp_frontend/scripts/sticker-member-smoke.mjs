import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3115';
const captureVisuals = process.env.SKIP_CAPTURE !== '1';
const apiUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const actorId = '00000000-0000-0000-0000-000000000401';
const roomId = '00000000-0000-0000-0000-000000000402';
const packId = '00000000-0000-0000-0000-000000000403';
const stickerId = '00000000-0000-0000-0000-000000000404';
const messageId = '00000000-0000-0000-0000-000000000405';
const bucket = '2026-10-12-08:00';
const imageUrl = 'https://fixture.example/sticker.png';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6SAAAAABJRU5ErkJggg==', 'base64');
const image = { assetId: stickerId, url: imageUrl, mimeType: 'image/png', width: 1, height: 1 };
const pack = { stickerPackId: packId, name: 'Browser fixture pack', description: '', coverAssetId: null, cover: null, isOfficial: false, isActive: true, revision: packId };
const item = { stickerId, stickerPackId: packId, name: 'Fixture sticker', image, isActive: true, sortOrder: 0, revision: stickerId };
const secondPack = { ...pack, stickerPackId: '00000000-0000-0000-0000-000000000409', name: 'Current fixture pack' };
const currentItem = { ...item, stickerId: '00000000-0000-0000-0000-000000000410', stickerPackId: secondPack.stickerPackId, name: 'Current fixture sticker' };
const actor = { userId: actorId, username: 'member', displayName: 'Test Member', accountStatus: 'ACTIVE' };
const createdAt = '2026-10-12T08:00:00Z';
const conversation = { conversationId: roomId, conversationType: 'GROUP', name: 'Sticker verification', createdBy: actorId, ownerId: actorId,
  createdAt, updatedAt: createdAt, lastActivityAt: createdAt, isDeleted: false, memberCount: 1, defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const history = { conversationId: roomId, messageBucket: bucket, messageId, senderId: actorId, revision: 0, messageType: 'STICKER', stickerId,
  content: '', contentFormat: 'PLAIN', hasAttachments: false, hasMentions: false, isDeleted: false, isPinned: false, createdAt };
let artworkState = 'available';
let catalogState = 'paged';
let failSend = false;
let failPacks = false;
let repeatCursor = false;
let holdMore = false;
let releaseMoreResponse;
let releaseSlowResponse;
let markSlowStarted;
let markSlowFinished;
const slowResponse = new Promise(resolve => { releaseSlowResponse = resolve; });
const slowStarted = new Promise(resolve => { markSlowStarted = resolve; });
const slowFinished = new Promise(resolve => { markSlowFinished = resolve; });
const moreResponse = new Promise(resolve => { releaseMoreResponse = resolve; });
const packPageRequests = [];
const sends = [];
const reads = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route(imageUrl, route => route.fulfill({ contentType: 'image/png', body: pixel }));
await page.route(`${apiUrl}/**`, async route => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(actor);
  if (path.endsWith('/devices')) return json({ deviceId: 'sticker-member-fixture' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations') && request.method() === 'GET') return json({ content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: createdAt, notificationOverride: 'INHERIT', lastMessage: null }], nextCursor: null, hasNext: false });
  if (path.endsWith(`/conversations/${roomId}/messages`) && request.method() === 'GET') return json({ content: [history], nextCursor: null, hasNext: false, interactions: [], polls: [] });
  if (path.endsWith(`/conversations/${roomId}/messages`) && request.method() === 'POST') {
    const payload = request.postDataJSON(); sends.push(payload);
    if (failSend) { failSend = false; return route.abort('failed'); }
    return json({ ...history, messageId: `00000000-0000-0000-0000-${String(405 + sends.length).padStart(12, '0')}`, clientMessageId: payload.clientMessageId }, 201);
  }
  if (path.endsWith('/sticker')) {
    reads.push(url.searchParams.get('bucket'));
    if (artworkState === 'failure') return json({ message: 'temporary' }, 503);
    if (artworkState === 'forbidden') return json({ message: 'forbidden' }, 403);
    return json({ stickerId, name: 'Fixture sticker', image: artworkState === 'unavailable' ? null : image });
  }
  if (path.endsWith('/sticker-packs')) {
    packPageRequests.push(url.searchParams.get('cursor'));
    if (holdMore && url.searchParams.has('cursor')) await moreResponse;
    if (failPacks) { failPacks = false; return json({ message: 'temporary' }, 503); }
    if (catalogState === 'empty') return json({ content: [], nextCursor: null, hasNext: false });
    if (catalogState === 'cycle') return json({ content: [], nextCursor: url.searchParams.get('cursor') === 'cycle-a' ? 'cycle-b' : 'cycle-a', hasNext: true });
    if (catalogState === 'race') return json({ content: [pack, secondPack], nextCursor: null, hasNext: false });
    if (repeatCursor && url.searchParams.has('cursor')) return json({ content: [], nextCursor: url.searchParams.get('cursor'), hasNext: true });
    return json(url.searchParams.has('cursor') ? { content: [pack], nextCursor: null, hasNext: false } : { content: [], nextCursor: 'pack-cursor', hasNext: true });
  }
  if (path.endsWith('/stickers')) {
    if (catalogState === 'race' && path.includes(secondPack.stickerPackId)) return json({ content: [currentItem], nextCursor: null, hasNext: false });
    if (catalogState === 'race') {
      markSlowStarted();
      await slowResponse;
      try { return await json({ content: [{ ...item, name: 'Old fixture sticker' }], nextCursor: null, hasNext: false }); }
      finally { markSlowFinished(); }
    }
    return json(url.searchParams.has('cursor') ? { content: [item], nextCursor: null, hasNext: false } : { content: [], nextCursor: 'item-cursor', hasNext: true });
  }
  if (path.endsWith('/notification-policy')) return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  if (path.includes('/friends/status/')) return json([]);
  if (path.endsWith('/notifications/unread/count')) return json({ count: 1 });
  if (path.endsWith('/notifications') && request.method() === 'GET') return json({ content: [{ notificationId: '00000000-0000-0000-0000-000000000411', userId: actorId, type: 'MESSAGE', title: 'Fixture sender', body: 'Sticker', isRead: false, createdAt, metadata: { conversationId: roomId, messageId, messageType: 'STICKER' } }], hasNext: false, hasContent: true });
  return json({ content: [], userDetails: [], nextCursor: null, hasNext: false });
});
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
async function open() {
  await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Sticker verification', { exact: true }).first().click();
}
async function picker() {
  await page.getByRole('button', { name: 'Thêm nội dung', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Chọn sticker', exact: true }).click();
  return page.getByRole('region', { name: 'Chọn sticker', exact: true });
}
try {
  await open();
  const row = page.locator(`[data-message-id="${messageId}"]`);
  await row.getByRole('img', { name: 'Fixture sticker' }).waitFor();
  assert.equal(reads[0], bucket);
  await row.hover(); await row.getByRole('button', { name: 'Tùy chọn khác' }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'Sửa', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await page.locator('textarea').last().fill('Giữ bản nháp này');
  let shelf = await picker();
  await shelf.getByRole('button', { name: 'Xem thêm bộ', exact: true }).waitFor();
  await shelf.getByText('Trang này chưa có bộ sticker. Chọn “Xem thêm bộ” để tìm tiếp.', { exact: true }).waitFor();
  assert.equal(await shelf.getByText('Chưa có bộ sticker nào. Bạn vẫn có thể gửi tin nhắn hoặc emoji.', { exact: true }).count(), 0, 'filtered page is not an exhausted catalog');
  await shelf.getByRole('button', { name: 'Xem thêm bộ', exact: true }).click();
  await shelf.getByRole('button', { name: 'Xem thêm sticker', exact: true }).waitFor();
  await shelf.getByText('Trang này chưa có sticker. Chọn “Xem thêm sticker” để tìm tiếp.', { exact: true }).waitFor();
  assert.equal(await shelf.getByText('Bộ này chưa có sticker để gửi. Hãy chọn bộ khác.', { exact: true }).count(), 0, 'filtered page is not an exhausted pack');
  await shelf.getByRole('button', { name: 'Xem thêm sticker', exact: true }).click();
  await shelf.getByRole('button', { name: 'Fixture sticker', exact: true }).waitFor();
  assert.equal(await shelf.getByRole('button', { name: /Tạo|Tải lên|Sửa|Xóa/ }).count(), 0, 'member shelf has no catalog administration');
  failSend = true;
  await shelf.getByRole('button', { name: 'Fixture sticker', exact: true }).click();
  await shelf.getByRole('alert').waitFor();
  await page.getByRole('button', { name: 'Thử gửi lại' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-message-id]').length >= 2);
  assert.equal(sends.length, 2);
  assert.equal(sends[0].clientMessageId, sends[1].clientMessageId);
  assert.equal(sends[1].stickerId, stickerId);
  assert.equal(sends[1].content, '');
  await page.getByRole('button', { name: 'Thử gửi lại' }).waitFor({ state: 'hidden' });
  await shelf.getByRole('button', { name: 'Fixture sticker', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-message-id]').length >= 3);
  assert.equal(sends.length, 3);
  assert.notEqual(sends[2].clientMessageId, sends[1].clientMessageId, 'new intentional identical sticker after confirmed retry gets a fresh send');
  assert.equal(await page.locator('textarea').last().inputValue(), 'Giữ bản nháp này');
  await shelf.getByRole('button', { name: 'Đóng', exact: true }).focus();
  await page.keyboard.press('Escape');
  assert.equal(await shelf.count(), 0);
  assert.equal(await page.locator('textarea').last().evaluate(element => element === document.activeElement), true);
  artworkState = 'unavailable'; await open();
  await row.getByText('Hình sticker không còn khả dụng.', { exact: true }).waitFor();
  artworkState = 'failure'; await open();
  await row.getByText('Không tải được hình sticker.', { exact: true }).waitFor();
  artworkState = 'available'; await row.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await row.getByRole('img', { name: 'Fixture sticker' }).waitFor();
  shelf = await picker();
  await shelf.getByRole('button', { name: 'Xem thêm bộ', exact: true }).click();
  await shelf.getByRole('button', { name: 'Xem thêm sticker', exact: true }).click();
  await mkdir('artifacts/ui-audit/current', { recursive: true });
  await page.addStyleTag({ content: 'nextjs-portal { visibility:hidden !important; }' });
  for (const theme of ['light', 'dark']) {
    await page.locator('button[aria-label="Cài đặt"]:visible').first().click();
    const settings = page.getByRole('dialog');
    await settings.locator('button:visible').filter({ hasText: 'Giao diện' }).first().click();
    await settings.getByRole('button', { name: theme === 'light' ? /^Sáng/ : /^Tối/ }).click();
    const save = settings.getByRole('button', { name: 'Lưu thay đổi', exact: true });
    if (await save.isEnabled()) await save.click();
    await page.keyboard.press('Escape');
    await settings.waitFor({ state: 'hidden' });
    await page.waitForFunction(value => (document.documentElement.dataset.theme === 'dark') === (value === 'dark'), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width < 768) await page.waitForFunction(() => {
        const sidebar = document.querySelector('.messenger-sidebar');
        return sidebar && sidebar.getBoundingClientRect().right <= 0;
      });
      await shelf.getByRole('button', { name: 'Fixture sticker', exact: true }).waitFor();
      // Let the workspace's 200 ms responsive/sidebar transitions settle before capture.
      await page.waitForTimeout(300);
      const shelfBounds = await shelf.boundingBox();
      assert.ok(shelfBounds && shelfBounds.x >= 0 && shelfBounds.x + shelfBounds.width <= width, `shelf containment ${theme}/${width}: ${JSON.stringify(shelfBounds)}`);
      assert.ok(shelfBounds.width >= 240, `readable shelf width ${theme}/${width}`);
      const closeBounds = await shelf.getByRole('button', { name: 'Đóng', exact: true }).boundingBox();
      assert.ok(closeBounds && closeBounds.x + closeBounds.width <= width, `close hit area ${theme}/${width}`);
      const sendBounds = await page.getByRole('button', { name: 'Gửi tin', exact: true }).boundingBox();
      assert.ok(sendBounds && sendBounds.x + sendBounds.width < width, `send control gutter ${theme}/${width}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow ${theme}/${width}`);
      if (captureVisuals) await page.screenshot({ path: `artifacts/ui-audit/current/member-stickers-${theme}-${width}.png`, fullPage: true });
    }
  }
  catalogState = 'race';
  await open(); shelf = await picker();
  await slowStarted;
  const cancelledRequest = page.waitForEvent('requestfailed', { predicate: request => request.url().includes(`/sticker-packs/${packId}/stickers`) });
  await shelf.getByRole('button', { name: secondPack.name, exact: true }).click();
  assert.equal((await cancelledRequest).failure()?.errorText, 'net::ERR_ABORTED', 'old pack request is cancelled');
  await shelf.getByRole('button', { name: currentItem.name, exact: true }).waitFor();
  releaseSlowResponse(); await slowFinished;
  assert.equal(await shelf.getByRole('button', { name: 'Old fixture sticker', exact: true }).count(), 0, 'old pack response must not replace current selection');
  await shelf.getByRole('button', { name: currentItem.name, exact: true }).waitFor();
  catalogState = 'paged'; failPacks = true;
  await open(); shelf = await picker();
  await shelf.getByRole('alert').waitFor();
  await shelf.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await shelf.getByRole('button', { name: 'Xem thêm bộ', exact: true }).waitFor();
  repeatCursor = true; holdMore = true;
  const beforeMore = packPageRequests.length;
  const pageStarted = page.waitForRequest(request => new URL(request.url()).searchParams.get('cursor') === 'pack-cursor');
  await shelf.getByRole('button', { name: 'Xem thêm bộ', exact: true }).dblclick();
  await pageStarted;
  assert.equal(packPageRequests.length - beforeMore, 1, 'rapid clicks start only one pending page request');
  releaseMoreResponse(); holdMore = false;
  await shelf.getByRole('alert').waitFor();
  repeatCursor = false;
  await shelf.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await shelf.getByRole('button', { name: pack.name, exact: true }).waitFor();
  assert.equal(packPageRequests.at(-1), packPageRequests.at(-2), 'page retry retains the failed cursor');
  catalogState = 'cycle';
  await open(); shelf = await picker();
  const cyclePage = page.waitForResponse(response => new URL(response.url()).searchParams.get('cursor') === 'cycle-a');
  await shelf.getByRole('button', { name: 'Xem thêm bộ', exact: true }).click();
  await cyclePage;
  await shelf.getByRole('button', { name: 'Xem thêm bộ', exact: true }).click();
  await shelf.getByRole('alert').waitFor();
  assert.equal(await shelf.getByRole('button', { name: 'Xem thêm bộ', exact: true }).count(), 0, 'multi-step cursor cycle stops instead of offering an endless loop');
  catalogState = 'paged';
  await shelf.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await shelf.getByRole('button', { name: pack.name, exact: true }).waitFor();
  assert.equal(packPageRequests.at(-1), 'cycle-b', 'cycle recovery retries the failed page');
  await page.goto(`${baseUrl}/app?notifications=1`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Đã gửi sticker.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await switchLocaleInSettings(page, 'en');
  await page.goto(`${baseUrl}/app?notifications=1`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Sent a sticker.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByText('Sticker verification', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Choose a sticker', exact: true }).click();
  await page.getByRole('region', { name: 'Choose a sticker', exact: true }).waitFor();
  const englishShelf = page.getByRole('region', { name: 'Choose a sticker', exact: true });
  await englishShelf.getByText('No packs on this page. Choose “More packs” to keep looking.', { exact: true }).waitFor();
  await englishShelf.getByRole('button', { name: 'More packs', exact: true }).click();
  await englishShelf.getByText('No stickers on this page. Choose “More stickers” to keep looking.', { exact: true }).waitFor();
  await englishShelf.getByRole('button', { name: 'Close', exact: true }).click();
  catalogState = 'empty';
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Choose a sticker', exact: true }).click();
  await page.getByText('No sticker packs yet. You can still send text or emoji.', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: 26, screenshots: captureVisuals ? 8 : 0, boundary: 'Real Chromium with controlled API/artwork responses, not live Cassandra/provider' }));
} finally { releaseSlowResponse(); releaseMoreResponse(); await browser.close(); }
