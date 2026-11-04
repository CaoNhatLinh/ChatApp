import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const disconnected = process.env.EDIT_OFFLINE_CALLS === '1';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const ownerId = '00000000-0000-0000-0000-000000000301';
const conversationId = '00000000-0000-0000-0000-000000000302';
const messageId = '30000000-0000-0000-0000-000000000303';
const messageBucket = '2026-08-30-11:03';
const createdAt = '2026-08-30T11:05:00Z';
const editedAt = '2026-08-30T11:10:00Z';
const originalContent = 'Nội dung trước khi sửa';
const updatedContent = 'Nội dung đã chỉnh sửa chính xác';
const preservedDraft = 'Bản nháp chưa gửi phải được giữ lại';

const operator = {
  userId: ownerId,
  username: 'owner',
  email: 'owner@example.com',
  displayName: 'Room Owner',
  accountStatus: 'ACTIVE',
};
const conversation = {
  conversationId,
  conversationType: 'GROUP',
  name: 'Message Editing',
  description: 'Message edit verification',
  createdBy: ownerId,
  ownerId,
  createdAt,
  updatedAt: createdAt,
  isDeleted: false,
  lastActivityAt: createdAt,
  memberCount: 1,
  defaultNotificationLevel: 'ALL',
  chatMode: 'OPEN',
  slowModeSeconds: 0,
};
const message = {
  conversationId,
  messageBucket,
  messageId,
  senderId: ownerId,
  content: originalContent,
  revision: 0, messageType: 'TEXT',
  contentFormat: 'PLAIN_TEXT',
  isDeleted: false,
  hasAttachments: false,
  hasMentions: false,
  isPinned: false,
  createdAt,
};

const editRequests = [];
let currentMessage = message;
const conversationItem = () => ({ conversation, pinned: false, unreadCount: 0, joinedAt: createdAt,
  notificationOverride: 'INHERIT', lastMessage: { messageId, messageBucket, revision: currentMessage.revision,
    senderId: ownerId, senderDisplayName: operator.displayName, contentPreview: currentMessage.content,
    messageType: currentMessage.messageType, createdAt, deleted: false, hasAttachments: false } });
const revisionRequests = [];
const consoleErrors = [];
const requestFailures = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(10_000);

// Editing exercises HTTP semantics; unrelated global discovery gets a connected broker fixture.
await page.route('**/ws/info?*', route => route.fulfill({ json: { websocket: true, cookie_needed: false, origins: ['*:*'], entropy: 1 } }));
await page.routeWebSocket('**/ws/**', socket => {
  socket.onMessage(raw => {
    for (const frame of JSON.parse(raw.toString())) {
      if (!disconnected && frame.startsWith('CONNECT')) socket.send(`a${JSON.stringify(['CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'])}`);
    }
  });
  socket.send('o');
});

page.on('console', (entry) => {
  const location = entry.location();
  if (entry.type() === 'error' && !location.url.includes('/ws/') && !entry.text().includes('/ws/')) {
    consoleErrors.push({ text: entry.text(), url: location.url });
  }
});
page.on('requestfailed', (request) => {
  if (!request.url().includes('/ws/')) requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const request = route.request();
  const requestUrl = new URL(request.url());
  const path = requestUrl.pathname;
  const method = request.method();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(operator);
  if (path.endsWith('/devices')) return json({ ...request.postDataJSON(), deviceName: 'Controlled edit browser',
    appVersion: null, active: true, createdAt, lastSeenAt: createdAt });
  if (path.endsWith('/calls/incoming')) return json({ content: [], nextCursor: null, hasNext: false });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations') && method === 'GET') {
    return json({
      content: [conversationItem()],
      nextCursor: null,
      hasNext: false,
    });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages`) && method === 'GET') {
    return json({ content: [currentMessage], nextCursor: null, hasNext: false, interactions: [], polls: [] });
  }
  if (path.endsWith(`/conversations/${conversationId}/summary`)) return json(conversationItem());
  if (path.endsWith(`/conversations/${conversationId}/messages/${messageId}`) && method === 'PUT') {
    const body = request.postDataJSON();
    editRequests.push({ method, bucket: requestUrl.searchParams.get('bucket'), body });
    currentMessage = { ...message, revision: 1, content: body.content, editedAt };
    return json(currentMessage);
  }
  if (path.endsWith(`/conversations/${conversationId}/messages/${messageId}/revisions`) && method === 'GET') {
    revisionRequests.push({ method, bucket: requestUrl.searchParams.get('bucket') });
    return json([{ revisionNumber: 1, content: originalContent, editedAt, editedBy: ownerId, action: 'EDIT' }]);
  }
  if (path.endsWith(`/conversations/${conversationId}/notification-policy`)) {
    return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  }
  if (path.includes('/friendships/requests')) return json({ content: [], userDetails: [], hasNext: false });
  if (path.includes('/friends/status/')) return json([]);
  if (path.includes('/notifications/unread/count')) return json({ count: 0 });
  if (path.includes('/notifications')) return json({ content: [], hasNext: false });
  if (path.includes('/invites/conversation/')) return json([]);
  return json({ content: [], userDetails: [], hasNext: false });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
await page.getByText('Message Editing', { exact: true }).first().click();
const messageRow = page.locator(`[data-message-id="${messageId}"]`);
await messageRow.getByText(originalContent, { exact: true }).waitFor();
const composer = page.locator('textarea');
await composer.fill(preservedDraft);

await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Sửa' }).click();
await page.getByText('Đang chỉnh sửa', { exact: true }).waitFor();
if (await composer.inputValue() !== originalContent) throw new Error('Edit mode did not load the current message content');
await page.getByRole('button', { name: 'Hủy chỉnh sửa' }).click();
await page.waitForFunction((expected) => document.querySelector('textarea')?.value === expected, preservedDraft);
if (await composer.inputValue() !== preservedDraft) throw new Error('Cancel editing did not restore the unsent draft');
if (editRequests.length !== 0) throw new Error('Cancel editing must not send a mutation');

await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Sửa' }).click();
await composer.fill(updatedContent);
await switchLocaleInSettings(page);
await page.getByText('Editing', { exact: true }).waitFor();
const layoutChecks = [];
if (disconnected) {
  const feedback = page.getByLabel('Incoming call check', { exact: true });
  await feedback.getByText('Waiting for a connection to check calls.', { exact: true }).waitFor();
  await mkdir('.impeccable/review', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForFunction(theme => (document.documentElement.getAttribute('data-theme') === 'dark') === (theme === 'dark'), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const save = page.getByRole('button', { name: 'Save changes', exact: true });
      await save.click({ trial: true });
      const banner = await feedback.boundingBox(), control = await save.boundingBox();
      assert.ok(banner && control && banner.y >= 0 && banner.y + banner.height <= control.y, 'lookup feedback stays visible without overlapping composer');
      assert.ok(control.y + control.height <= 900, 'composer stays inside viewport');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `.impeccable/review/call-feedback-edit-${theme}-${width}.png` });
      layoutChecks.push({ theme, width });
    }
  }
}
await page.getByRole('button', { name: 'Save changes' }).click();

await messageRow.getByText(updatedContent, { exact: true }).waitFor();
await page.waitForFunction((expected) => document.querySelector('textarea')?.value === expected, preservedDraft);
if (await composer.inputValue() !== preservedDraft) throw new Error('Successful editing did not restore the unsent draft');
await messageRow.getByRole('button', { name: 'Edited' }).click();
const historyDialog = page.getByRole('dialog', { name: 'Edit history' });
await historyDialog.getByText(originalContent, { exact: true }).waitFor();
await page.keyboard.press('Escape');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Message Editing', exact: true }).click();
await page.locator(`[data-message-id="${messageId}"]`).getByText(updatedContent, { exact: true }).waitFor();

const report = { baseUrl, disconnected, layoutChecks, editRequests, revisionRequests, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  editRequests.length !== 1
  || editRequests[0].method !== 'PUT'
  || editRequests[0].bucket !== messageBucket
  || editRequests[0].body.content !== updatedContent
  || revisionRequests.length !== 1
  || revisionRequests[0].bucket !== messageBucket
  || consoleErrors.length
  || requestFailures.length
) process.exitCode = 1;
