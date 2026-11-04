import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3117';
const apiUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const configured = process.env.SMOKE_GIPHY_CONFIGURED === '1';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const actor = '00000000-0000-0000-0000-000000000401', room = '00000000-0000-0000-0000-000000000402';
const id = '00000000-0000-1000-8000-000000000405';
const at = '2026-10-20T08:00:00Z';
const reference = { provider: 'GIPHY', providerGifId: 'abc123' };
const conversation = { conversationId: room, conversationType: 'GROUP', name: 'GIF history verification', createdBy: actor,
  ownerId: actor, createdAt: at, updatedAt: at, lastActivityAt: at, isDeleted: false, memberCount: 1, defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const message = { conversationId: room, messageBucket: '2026-10-20-08:00', messageId: id, senderId: actor, content: '',
  revision: 0, messageType: 'GIF', contentFormat: 'PLAIN', gif: reference, isDeleted: false, hasAttachments: false, hasMentions: false, isPinned: false, createdAt: at };
const animatedUrl = 'https://media.giphy.com/media/abc123/200.gif?ep=must-keep';
const stillUrl = 'https://media.giphy.com/media/abc123/200_s.gif?ep=must-keep';
let providerState = 'ready';
let deleted = false;
const providerRequests = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 320, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route(`${apiUrl}/**`, async route => {
  const path = new URL(route.request().url()).pathname;
  const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json({ userId: actor, username: 'gif-member', displayName: 'GIF test member', accountStatus: 'ACTIVE' });
  if (path.endsWith('/devices')) return json({ deviceId: 'gif-fixture' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'classic', rooms: [] });
  if (path.endsWith('/conversations')) return json({ content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null }], nextCursor: null, hasNext: false });
  if (path.endsWith(`/conversations/${room}/messages`)) return json({ content: [{ ...message, isDeleted: deleted, gif: deleted ? null : reference }], nextCursor: null, hasNext: false, interactions: [], polls: [] });
  if (path.endsWith('/read-state')) return json({ lastReadMessageId: id, lastReadAt: at, joinedAt: at });
  return json({ content: [], userDetails: [], nextCursor: null, hasNext: false });
});
await page.route('https://api.giphy.com/**', route => {
  providerRequests.push(route.request().url());
  const status = providerState === 'error' ? 503 : providerState === 'missing' ? 404 : 200;
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ meta: { status }, data: {
    id: 'abc123', type: 'gif', title: 'Controlled GIF artwork', images: {
      fixed_width: { url: animatedUrl, width: '200', height: '100' },
      fixed_width_still: { url: stillUrl, width: '200', height: '100' },
    },
  } }) });
});
await page.route('https://media.giphy.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#276468"/><circle cx="100" cy="50" r="24" fill="#ff7845"/></svg>' }));
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
const row = page.locator(`[data-message-id="${id}"]`);
async function open() {
  await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
  await page.getByText(conversation.name, { exact: true }).first().click();
}
try {
  await open();
  if (!configured) {
    await row.getByText('Chưa cấu hình GIF cho ứng dụng.', { exact: true }).waitFor();
    assert.equal(providerRequests.length, 0, 'blank web key does not contact GIPHY');
    await switchLocaleInSettings(page, 'en');
    await row.getByText('GIFs are not configured for this app yet.', { exact: true }).waitFor();
  } else {
    const artwork = row.getByRole('img', { name: 'Controlled GIF artwork', exact: true });
    await artwork.waitFor();
    assert.equal(await artwork.getAttribute('src'), stillUrl, 'reduced motion initially loads the provider still');
    await row.getByRole('button', { name: 'Phát GIF', exact: true }).click();
    assert.equal(await artwork.getAttribute('src'), animatedUrl, 'explicit play uses unchanged media URL');
    await row.getByRole('button', { name: 'Tạm dừng GIF', exact: true }).click();
    assert.equal(await artwork.getAttribute('src'), stillUrl);
    await row.getByRole('img', { name: 'Powered By GIPHY', exact: true }).waitFor();
    await row.hover(); await row.getByRole('button', { name: 'Tùy chọn khác' }).click();
    assert.equal(await page.getByRole('menuitem', { name: 'Sửa', exact: true }).count(), 0);
    assert.equal(await page.getByRole('menuitem', { name: /Sao chép/ }).count(), 0);
    await page.keyboard.press('Escape');
    await mkdir('artifacts/ui-audit/current', { recursive: true });
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
        await page.waitForTimeout(300);
        const bounds = await row.getByRole('img', { name: 'Controlled GIF artwork', exact: true }).boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, `GIF fits ${theme}/${width}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: `artifacts/ui-audit/current/chat-gif-${theme}-${width}.png`, fullPage: true });
      }
    }
    providerState = 'error'; await open();
    await row.getByText('Không tải được GIF.', { exact: true }).waitFor();
    providerState = 'ready'; await row.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await row.getByRole('img', { name: 'Controlled GIF artwork', exact: true }).waitFor();
    providerState = 'missing'; await open();
    await row.getByText('GIF này không còn khả dụng.', { exact: true }).waitFor();
    const beforeDelete = providerRequests.length;
    deleted = true; await open();
    await row.getByText('Tin nhắn đã bị xóa', { exact: true }).waitFor();
    assert.equal(providerRequests.length, beforeDelete, 'deleted tombstone does not fetch provider');
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: configured ? 8 : 2, screenshots: configured ? 8 : 0, configured, boundary: 'Real Chromium with controlled Nối/GIPHY/artwork routes; no live provider/database' }));
} finally { await browser.close(); }
