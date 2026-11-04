import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3117';
const apiUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const configured = process.env.SMOKE_GIPHY_CONFIGURED === '1';
const actor = '00000000-0000-0000-0000-000000000401', room = '00000000-0000-0000-0000-000000000402';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature', at = '2026-10-20T08:00:00Z';
const conversation = { conversationId: room, conversationType: 'GROUP', name: 'GIF picker verification', createdBy: actor, ownerId: actor,
  createdAt: at, updatedAt: at, lastActivityAt: at, isDeleted: false, memberCount: 1, defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(12000);
const errors = [], providerRequests = [], sends = [], records = new Map();
let failSend = true, quota = true, failPreview = true, failMore = true;
let releaseMore, markMoreStarted;
const moreResponse = new Promise(resolve => { releaseMore = resolve; });
const moreStarted = new Promise(resolve => { markMoreStarted = resolve; });
let releaseOld, markOldStarted, markOldFinished;
const oldResponse = new Promise(resolve => { releaseOld = resolve; });
const oldStarted = new Promise(resolve => { markOldStarted = resolve; });
const oldFinished = new Promise(resolve => { markOldFinished = resolve; });
page.on('pageerror', error => errors.push(error.message));
await page.route(`${apiUrl}/**`, async route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json({ userId: actor, username: 'gif-member', displayName: 'GIF test member', accountStatus: 'ACTIVE' });
  if (path.endsWith('/devices')) return json({ deviceId: 'gif-picker-fixture' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'classic', rooms: [] });
  if (path.endsWith('/conversations')) return json({ content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null }], nextCursor: null, hasNext: false });
  if (path.endsWith(`/conversations/${room}/messages`) && route.request().method() === 'POST') {
    const request = route.request().postDataJSON(); sends.push(request);
    if (!records.has(request.clientMessageId)) records.set(request.clientMessageId, { ...request, conversationId: room,
      messageId: `00000000-0000-1000-8000-${String(1000 + records.size).padStart(12, '0')}`, messageBucket: '2026-10-20-08:00',
      senderId: actor, isDeleted: false, hasAttachments: false, hasMentions: false, isPinned: false, createdAt: at });
    if (failSend) { failSend = false; return route.abort('failed'); }
    return json(records.get(request.clientMessageId));
  }
  if (path.endsWith(`/conversations/${room}/messages`)) return json({ content: [], nextCursor: null, hasNext: false, interactions: [], polls: [] });
  if (path.endsWith('/read-state')) return json({ lastReadMessageId: null, lastReadAt: null, joinedAt: at });
  return json({ content: [], userDetails: [], nextCursor: null, hasNext: false });
});
const gif = (id, title) => ({ id, type: 'gif', title, images: {
  fixed_width: { url: `https://media.giphy.com/media/${id}/200.gif?ep=keep`, width: '200', height: '100' },
  fixed_width_still: { url: `https://media.giphy.com/media/${id}/200_s.gif?ep=keep`, width: '200', height: '100' },
} });
await page.route('https://api.giphy.com/**', async route => {
  const url = new URL(route.request().url()); providerRequests.push(url);
  assert.equal(route.request().headers().authorization, undefined, 'Nối token never reaches provider');
  const query = url.searchParams.get('q'), offset = Number(url.searchParams.get('offset') ?? 0);
  if (!query && offset === 1) { markMoreStarted(); await moreResponse; }
  if (query === 'old') { markOldStarted(); await oldResponse; }
  const data = query === 'empty' ? [] : [gif(query === 'broken' ? 'broken' : query === 'old' ? 'old' : query === 'new' ? 'new' : offset ? 'second' : 'first',
    query === 'broken' ? 'Broken result' : query === 'old' ? 'Old result' : query === 'new' ? 'New result' : offset ? 'Second result' : 'First result')];
  const status = !query && offset === 1 && failMore ? 503 : query === 'quota' && quota ? 429 : 200;
  try { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data: url.pathname.endsWith('/search') || url.pathname.endsWith('/trending') ? data : gif(url.pathname.split('/').at(-1), 'History GIF'),
    pagination: { offset, count: data.length, total_count: !query ? 2 : data.length }, meta: { status } }) }); }
  finally { if (query === 'old') markOldFinished(); }
});
await page.route('https://media.giphy.com/**', route => failPreview && route.request().url().includes('/broken/') ? route.abort('failed') : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#276468"/><circle cx="100" cy="50" r="24" fill="#ff7845"/></svg>' }));
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
async function openPicker(english = false) {
  await page.getByRole('button', { name: english ? 'Add content' : 'Thêm nội dung', exact: true }).click();
  await page.getByRole('menuitem', { name: english ? 'Choose a GIF' : 'Chọn GIF', exact: true }).click();
  return page.getByRole('region', { name: english ? 'Choose a GIF' : 'Chọn GIF', exact: true });
}
try {
  await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
  await page.getByText(conversation.name, { exact: true }).first().click();
  await page.locator('textarea').last().fill('Giữ bản nháp GIF này');
  let shelf = await openPicker();
  if (!configured) {
    await shelf.getByText('Chưa cấu hình GIF cho ứng dụng.', { exact: true }).waitFor();
    assert.equal(providerRequests.length, 0);
    assert.equal(await shelf.evaluate(element => element.contains(document.activeElement)), true, 'opening transfers focus into picker');
    await page.keyboard.press('Escape');
    await shelf.waitFor({ state: 'detached' });
    assert.equal(await page.locator('textarea').last().evaluate(element => element === document.activeElement), true);
    await switchLocaleInSettings(page, 'en'); shelf = await openPicker(true);
    await shelf.getByText('GIFs are not configured for this app yet.', { exact: true }).waitFor();
  } else {
    await shelf.getByRole('button', { name: 'First result', exact: true }).waitFor();
    assert.ok((await shelf.getByRole('img', { name: 'First result', exact: true }).getAttribute('src')).includes('200_s.gif?ep=keep'));
    await shelf.getByRole('button', { name: 'Phát ảnh xem trước', exact: true }).click();
    assert.ok((await shelf.getByRole('img', { name: 'First result', exact: true }).getAttribute('src')).includes('/200.gif?ep=keep'));
    await shelf.getByRole('button', { name: 'Dừng ảnh xem trước', exact: true }).click();
    await shelf.getByRole('button', { name: 'Xem thêm GIF', exact: true }).dblclick();
    await moreStarted;
    assert.equal(providerRequests.filter(url => url.pathname.endsWith('/trending') && url.searchParams.get('offset') === '1').length, 1, 'rapid clicks issue only one pending page request');
    releaseMore(); await shelf.getByRole('alert').waitFor(); failMore = false;
    await shelf.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await shelf.getByRole('button', { name: 'Second result', exact: true }).waitFor();
    assert.equal(providerRequests.filter(url => url.pathname.endsWith('/trending') && url.searchParams.get('offset') === '1').length, 2, 'retry retains the failed offset');
    const input = shelf.getByRole('searchbox', { name: 'Tìm GIF', exact: true });
    await input.fill('c'); await input.fill('ca'); await input.fill('cat');
    await page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'cat');
    assert.equal(providerRequests.filter(url => ['c', 'ca'].includes(url.searchParams.get('q'))).length, 0);
    await input.fill('old'); await oldStarted;
    const aborted = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).searchParams.get('q') === 'old' });
    await input.fill('new'); await shelf.getByRole('button', { name: 'New result', exact: true }).waitFor();
    assert.equal((await aborted).failure()?.errorText, 'net::ERR_ABORTED');
    releaseOld(); await oldFinished;
    assert.equal(await shelf.getByRole('button', { name: 'Old result', exact: true }).count(), 0);
    await input.fill('quota'); await shelf.getByRole('alert').waitFor();
    quota = false; await shelf.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await shelf.getByRole('button', { name: 'First result', exact: true }).waitFor();
    await shelf.getByRole('button', { name: 'First result', exact: true }).click();
    await shelf.getByText('Chưa gửi được GIF. Bạn có thể thử lại từ tin nhắn bị lỗi.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Thử gửi lại', exact: true }).click();
    await page.getByRole('button', { name: 'Thử gửi lại', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(sends.length, 2);
    assert.equal(sends[0].clientMessageId, sends[1].clientMessageId);
    assert.deepEqual(sends[1].gif, { provider: 'GIPHY', providerGifId: 'first' });
    assert.equal(sends[1].content, '');
    await shelf.getByRole('button', { name: 'First result', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-message-id]').length === 2);
    assert.notEqual(sends[2].clientMessageId, sends[1].clientMessageId);
    assert.equal(await page.locator('textarea').last().inputValue(), 'Giữ bản nháp GIF này');
    await mkdir('artifacts/ui-audit/current', { recursive: true });
    for (const theme of ['light', 'dark']) {
      await page.locator('button[aria-label="Cài đặt"]:visible').first().click();
      const settings = page.getByRole('dialog');
      await settings.locator('button:visible').filter({ hasText: 'Giao diện' }).first().click();
      await settings.getByRole('button', { name: theme === 'light' ? /^Sáng/ : /^Tối/ }).click();
      const save = settings.getByRole('button', { name: 'Lưu thay đổi', exact: true });
      if (await save.isEnabled()) await save.click();
      await page.keyboard.press('Escape'); await settings.waitFor({ state: 'hidden' });
      await page.waitForFunction(value => (document.documentElement.dataset.theme === 'dark') === (value === 'dark'), theme);
      for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(300);
        const bounds = await shelf.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: `artifacts/ui-audit/current/gif-picker-${theme}-${width}.png`, fullPage: true });
      }
    }
    await input.fill('empty');
    await shelf.getByText('Chưa tìm thấy GIF. Bạn thử từ khóa khác nhé.', { exact: true }).waitFor();
    await input.fill('broken');
    await shelf.getByText('Không tải được ảnh xem trước.', { exact: true }).waitFor();
    assert.equal(await shelf.getByRole('button', { name: 'Broken result', exact: true }).isDisabled(), true);
    failPreview = false; await shelf.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await shelf.getByRole('img', { name: 'Broken result', exact: true }).waitFor();
    assert.equal(await shelf.getByRole('button', { name: 'Broken result', exact: true }).evaluate(element => element === document.activeElement), true, 'preview retry returns focus to the GIF choice');
    await page.keyboard.press('Escape');
    await shelf.waitFor({ state: 'detached' });
    await switchLocaleInSettings(page, 'en'); shelf = await openPicker(true);
    await shelf.getByText('Search terms are sent to GIPHY.', { exact: true }).waitFor();
    await shelf.getByRole('button', { name: 'First result', exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: configured ? 17 : 3, screenshots: configured ? 8 : 0, boundary: 'Chromium with controlled Nối/GIPHY routes, not live backend/provider' }));
} finally { releaseOld(); releaseMore(); await browser.close(); }
