import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

// Isolated production UI with synthetic canonical HTTP/STOMP, not a real backend.
const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3117';
const actor = '00000000-0000-0000-0000-000000000871', peer = '00000000-0000-0000-0000-000000000872';
const room = '00000000-0000-0000-0000-000000000873';
const at = new Date().toISOString(), month = at.slice(0, 7);
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const user = { userId: actor, username: 'member', displayName: 'Người dùng kiểm thử', email: 'member@example.test', accountStatus: 'ACTIVE' };
const peerUser = { userId: peer, username: 'friend', displayName: 'Bạn cùng nhóm', avatarUrl: null };
const conversation = { conversationId: room, conversationType: 'DM', name: 'Direct call', ownerId: actor,
  createdBy: actor, createdAt: at, updatedAt: at, lastActivityAt: at, memberCount: 2, isDeleted: false,
  defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const summary = { conversation, peer: peerUser, pinned: false, unreadCount: 0, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null };
const entry = (overrides = {}) => {
  const createdAt = `${month}-01T10:00:00Z`;
  const value = { conversationId: room, callId: randomUUID(), callerId: peer, calleeId: actor, callType: 'VOICE',
    direction: 'INCOMING', outcome: 'MISSED', createdAt, acceptedAt: null, endedAt: `${month}-01T10:00:45Z`, version: 2, ...overrides };
  return { ...value, participants: [
    { userId: value.callerId, role: 'CALLER', initiatedAt: value.createdAt, acceptedAt: null },
    { userId: value.calleeId, role: 'CALLEE', initiatedAt: null, acceptedAt: value.acceptedAt },
  ] };
};
const missed = entry(), answered = entry({ callerId: actor, calleeId: peer, direction: 'OUTGOING', outcome: 'ENDED', callType: 'VIDEO',
  acceptedAt: `${month}-01T10:00:02Z` });
const list = (content = [missed, answered], nextCursor = null) => ({ content, nextCursor, hasNext: nextCursor !== null });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(12000);
const errors = [], warnings = [], failures = [], reads = [], commands = [], captures = [];
let responseMode = 'normal', detailStatus = 200, custom = false, hold;
let failContinuation = false;
let checks = 0;
const check = () => checks++;
const dialog = () => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /^(Lịch sử cuộc gọi|Chi tiết cuộc gọi|Call history|Call details)$/ }) });
const ownTrigger = () => page.getByRole('button', { name: /^(Lịch sử cuộc gọi của bạn|Your call history)$/ });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'warning' && message.text() === '[WARN] [WebSocket] Cannot send, STOMP not connected to: /app/presence.subscribe') {
    warnings.push(message.text()); return;
  }
  if (['error', 'warning'].includes(message.type()) && !message.text().includes('Failed to load resource')) errors.push(message.text());
});
page.on('requestfailed', request => { if (!request.url().includes('/ws/') && request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
await page.routeWebSocket('**/ws/**', ws => {
  ws.onMessage(raw => {
    for (const frame of JSON.parse(raw.toString())) {
      if (frame.startsWith('CONNECT')) ws.send(`a${JSON.stringify(['CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'])}`);
      if (frame.startsWith('SEND') && frame.includes('/app/call.')) commands.push(frame);
    }
  }); ws.send('o');
});
await page.route('**/*', async route => {
  const url = new URL(route.request().url()), path = url.pathname;
  if (!path.startsWith('/api/') && !path.includes('/ws/')) return route.continue();
  const json = body => route.fulfill({ json: body });
  if (path.endsWith('/calls/history')) {
    reads.push({ path, month: url.searchParams.get('month'), cursor: url.searchParams.get('cursor') });
    if (responseMode === 'hold' && url.searchParams.get('month') === month) await new Promise(resolve => { hold = resolve; });
    if (responseMode === 'error') return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
    if (url.searchParams.get('month') !== month) return json(list([]));
    if (responseMode === 'paged') {
      const cursor = url.searchParams.get('cursor');
      if (cursor === null) return json(list([], 'opaque-next'));
      if (cursor === 'opaque-next') return json(list([missed], 'opaque-after-missed'));
      assert.equal(cursor, 'opaque-after-missed');
      if (failContinuation) return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
      return json(list([answered]));
    }
    return json(list());
  }
  if (/\/calls\/[^/]+\/history$/.test(path)) {
    reads.push({ path });
    return detailStatus === 200 ? json(path.includes(answered.callId) ? answered : missed) : route.fulfill({ status: detailStatus, json: { code: 'FORBIDDEN' } });
  }
  if (path.endsWith('/calls/incoming')) return json(list([]));
  if (path.endsWith('/calls/active')) return route.fulfill({ status: 204 });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(user);
  if (path.endsWith('/devices')) return json({ ...route.request().postDataJSON(), deviceName: null, appVersion: null,
    active: true, createdAt: at, lastSeenAt: at });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'tiktok', rooms: custom ? [{ conversationId: room, themeId: 'aurora', customBackgroundUrl: 'https://assets.example.test/bg.svg', updatedAt: at }] : [] });
  if (path.endsWith('/conversations')) return json(list([summary]));
  if (path.endsWith(`/conversations/${room}/summary`)) return json(summary);
  if (path.endsWith(`/conversations/${room}`)) return json(conversation);
  if (path.endsWith('/read-state')) return json({ joinedAt: at });
  if (path.endsWith('/notification-policy')) return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  if (path.includes('/users/')) return json(peerUser);
  if (path.includes('/unread/count')) return json({ count: 0 });
  if (path.includes('/friends/status/')) return json([]);
  if (path.endsWith('/info')) return json({ websocket: true, cookie_needed: false, origins: ['*:*'], entropy: 1 });
  return json({ content: [], userDetails: [], hasNext: false, nextCursor: null, polls: [], interactions: [] });
});
await page.route('https://assets.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path fill="white" d="M0 0h8v8H0z"/></svg>' }));
await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
  window.__historyMedia = 0;
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { window.__historyMedia++; throw new Error('History must not acquire media'); } });
});
await mkdir('.impeccable/review', { recursive: true });
async function capture(name) {
  const path = `.impeccable/review/${name}.png`;
  if (process.argv.includes('--no-capture')) { captures.push(path); return; }
  const panel = dialog(); await panel.waitFor();
  await page.waitForFunction(() => {
    const panel = document.querySelector('[role="dialog"]');
    if (!panel) return false;
    let opacity = 1;
    for (let node = panel; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity > .99;
  });
  const { box, close, viewport } = await panel.getByRole('button', { name: /^(Đóng|Close)$/ }).evaluate(async button => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      box: button.closest('[role="dialog"]')?.getBoundingClientRect().toJSON(),
      close: button.getBoundingClientRect().toJSON(),
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  assert.ok(box && box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 && box.y + box.height <= viewport.height + 1);
  assert.ok(close && close.x > box.x + box.width - 60 && close.y < box.y + 15,
    `close stays upper-right, outside flex flow: ${JSON.stringify({ name, box, close, viewport })}`);
  assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
  const contrast = await panel.evaluate(node => {
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const luminance = color => {
      context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
        const normalized = value / 255; return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
      });
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    };
    const background = luminance(getComputedStyle(node).backgroundColor);
    return [...node.querySelectorAll('p, time, h2, h3, label')].map(element => {
      const foreground = luminance(getComputedStyle(element).color);
      return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
    });
  });
  assert.ok(contrast.every(value => value >= 4.5), `history text contrast: ${contrast}`);
  await page.screenshot({ path, fullPage: true }); captures.push(path);
}
try {
  await page.goto(`${baseUrl}/app?conversationId=${room}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Bạn cùng nhóm', exact: true, level: 2 }).waitFor();
  assert.equal(reads.length, 0, 'no history read before opening'); check();
  await ownTrigger().click();
  await dialog().getByText('Thoại · Cuộc gọi nhỡ', { exact: false }).waitFor();
  await dialog().getByRole('button').filter({ hasText: 'Cuộc gọi nhỡ' }).click();
  await dialog().getByRole('heading', { name: 'Chi tiết cuộc gọi' }).waitFor();
  await dialog().getByText('Người gọi', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.equal(await dialog().getByRole('heading', { name: 'Chi tiết cuộc gọi' }).evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Escape'); await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-call-history-trigger') === 'own');
  assert.equal(await ownTrigger().evaluate(node => node === document.activeElement), true); check();

  await page.getByRole('button', { name: 'Tùy chọn khác', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Lịch sử cuộc gọi', exact: true }).click();
  await dialog().getByText('Các cuộc gọi trong hội thoại này.').waitFor();
  assert.ok(reads.at(-1).path.endsWith(`/conversations/${room}/calls/history`));
  await page.keyboard.press('Escape'); check();

  responseMode = 'hold'; await ownTrigger().click();
  await dialog().getByRole('status', { name: 'Đang tải lịch sử cuộc gọi…' }).waitFor();
  await dialog().getByLabel('Tháng (UTC)').fill('2020-02');
  await dialog().getByText('Chưa có cuộc gọi trong tháng này.').waitFor();
  hold?.(); responseMode = 'normal';
  assert.equal(await dialog().getByText('Cuộc gọi nhỡ', { exact: true }).count(), 0);
  await page.keyboard.press('Escape'); check();

  responseMode = 'paged'; await ownTrigger().click();
  await dialog().getByText('Chưa thấy cuộc gọi trong phần vừa đọc.').waitFor();
  await dialog().getByRole('button', { name: 'Tải thêm cuộc gọi' }).click();
  const pagedMissedCall = dialog().getByRole('button').filter({ hasText: 'Thoại · Cuộc gọi nhỡ' });
  await pagedMissedCall.waitFor();
  assert.equal(reads.at(-1).cursor, 'opaque-next');

  await pagedMissedCall.click();
  await dialog().getByText('Người gọi', { exact: true }).waitFor();
  const readsBeforeBack = reads.length;
  await dialog().getByRole('button', { name: 'Về lịch sử' }).click();
  await pagedMissedCall.waitFor();
  await page.waitForFunction(node => node === document.activeElement, await pagedMissedCall.elementHandle());
  assert.equal(reads.length, readsBeforeBack, 'back preserves the loaded list without re-reading the month');
  check();

  failContinuation = true;
  await dialog().getByRole('button', { name: 'Tải thêm cuộc gọi' }).click();
  await dialog().getByRole('alert').waitFor();
  assert.equal(await pagedMissedCall.count(), 1, 'a transient continuation failure keeps loaded rows');
  assert.equal(reads.at(-1).cursor, 'opaque-after-missed', 'back preserves the next cursor');
  failContinuation = false;
  await dialog().getByRole('button', { name: 'Thử lại', exact: true }).click();
  await dialog().getByRole('button').filter({ hasText: 'Video' }).waitFor();
  assert.equal(await pagedMissedCall.count(), 1, 'continuation retry appends without duplicating loaded rows');
  assert.deepEqual(reads.slice(readsBeforeBack).map(read => read.cursor), ['opaque-after-missed', 'opaque-after-missed']);
  check();

  await page.keyboard.press('Escape'); responseMode = 'normal'; check();

  await ownTrigger().click(); await dialog().getByLabel('Tháng (UTC)').fill('2020-01');
  await dialog().getByText('Chưa có cuộc gọi trong tháng này.').waitFor();
  assert.equal(reads.at(-1).month, '2020-01');
  await page.keyboard.press('Escape'); check();

  responseMode = 'error'; await ownTrigger().click();
  await dialog().getByRole('alert').waitFor();
  responseMode = 'normal'; await dialog().getByRole('button', { name: 'Thử lại', exact: true }).click();
  await dialog().getByText('Thoại · Cuộc gọi nhỡ', { exact: false }).waitFor();
  detailStatus = 403; await dialog().getByRole('button').filter({ hasText: 'Cuộc gọi nhỡ' }).click();
  await dialog().getByText('Bạn không có quyền xem lịch sử này.').waitFor();
  assert.equal(await dialog().getByText(peer, { exact: true }).count(), 0);
  detailStatus = 200; await dialog().getByRole('button', { name: 'Thử lại', exact: true }).click();
  await dialog().getByText('Người gọi', { exact: true }).waitFor();
  await page.keyboard.press('Escape'); check();

  for (const theme of ['light', 'dark']) {
    custom = true;
    await page.evaluate(theme => localStorage.setItem('themePreference', theme), theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Bạn cùng nhóm', exact: true, level: 2 }).waitFor();
    await ownTrigger().click(); await dialog().getByText('Thoại · Cuộc gọi nhỡ', { exact: false }).waitFor();
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await capture(`call-history-list-${theme}-${width}`);
      await dialog().getByRole('button').filter({ hasText: 'Cuộc gọi nhỡ' }).click();
      await dialog().getByText('Người gọi', { exact: true }).waitFor();
      await capture(`call-history-detail-${theme}-${width}`);
      await dialog().getByRole('button', { name: 'Về lịch sử' }).click();
      await dialog().getByText('Thoại · Cuộc gọi nhỡ', { exact: false }).waitFor(); check();
    }
    await page.keyboard.press('Escape');
  }
  await switchLocaleInSettings(page, 'en');
  await ownTrigger().click(); await dialog().getByText('Voice · Missed call', { exact: false }).waitFor();
  await dialog().getByRole('button').filter({ hasText: 'Video' }).click();
  await dialog().getByText('Caller', { exact: true }).waitFor();
  await capture('call-history-detail-en-1440'); check();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), true);
  await page.keyboard.press('Escape');
  assert.equal(commands.length, 0, 'history never sends a call command');
  assert.equal(await page.evaluate(() => window.__historyMedia), 0);
  assert.deepEqual(errors, []); assert.deepEqual(failures, []); check();
  const report = { checks, reads: reads.length, captures, errors, warnings, failures, boundary: 'Controlled HTTP/STOMP production Chromium; not live backend, Cassandra or media' };
  await writeFile('.impeccable/review/call-history-browser-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { hold?.(); await browser.close(); }
