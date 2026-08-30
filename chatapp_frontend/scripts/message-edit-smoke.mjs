import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const ownerId = '00000000-0000-0000-0000-000000000301';
const conversationId = '00000000-0000-0000-0000-000000000302';
const messageId = '30000000-0000-0000-0000-000000000303';
const messageBucket = '2026-08-30T11:00:00Z';
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
  messageType: 'TEXT',
  contentFormat: 'PLAIN_TEXT',
  isDeleted: false,
  hasAttachments: false,
  hasMentions: false,
  isPinned: false,
  createdAt,
};

const editRequests = [];
const revisionRequests = [];
const consoleErrors = [];
const requestFailures = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(10_000);

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
  if (path.endsWith('/devices')) return json({ deviceId: 'device-message-edit' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations') && method === 'GET') {
    return json({
      content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: createdAt, notificationOverride: 'INHERIT', lastMessage: null }],
      nextCursor: null,
      hasNext: false,
    });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages`) && method === 'GET') {
    return json({ content: [message], nextCursor: null, hasNext: false });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages/${messageId}`) && method === 'PUT') {
    const body = request.postDataJSON();
    editRequests.push({ method, bucket: requestUrl.searchParams.get('bucket'), body });
    return json({ ...message, content: body.content, editedAt });
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
await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await page.getByText('Editing', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Save changes' }).click();

await messageRow.getByText(updatedContent, { exact: true }).waitFor();
await page.waitForFunction((expected) => document.querySelector('textarea')?.value === expected, preservedDraft);
if (await composer.inputValue() !== preservedDraft) throw new Error('Successful editing did not restore the unsent draft');
await messageRow.getByRole('button', { name: 'Edited' }).click();
const historyDialog = page.getByRole('dialog', { name: 'Edit history' });
await historyDialog.getByText(originalContent, { exact: true }).waitFor();

const report = { baseUrl, editRequests, revisionRequests, consoleErrors, requestFailures };
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
