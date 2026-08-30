import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const ownerId = '00000000-0000-0000-0000-000000000201';
const conversationId = '00000000-0000-0000-0000-000000000202';
const messageId = '20000000-0000-0000-0000-000000000203';
const messageBucket = '2026-08-30T10:00:00Z';
const now = '2026-08-30T10:05:00Z';
const originalContent = 'Nội dung riêng tư phải biến mất';

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
  name: 'Message Actions',
  description: 'Message action verification',
  createdBy: ownerId,
  ownerId,
  createdAt: now,
  updatedAt: now,
  isDeleted: false,
  lastActivityAt: now,
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
  createdAt: now,
};

const deleteRequests = [];
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
  if (path.endsWith('/devices')) return json({ deviceId: 'device-message-delete' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations') && method === 'GET') {
    return json({
      content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: now, notificationOverride: 'INHERIT', lastMessage: null }],
      nextCursor: null,
      hasNext: false,
    });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages`) && method === 'GET') {
    return json({ content: [message], nextCursor: null, hasNext: false });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages/${messageId}`) && method === 'DELETE') {
    deleteRequests.push({ method, bucket: requestUrl.searchParams.get('bucket') });
    return json({ ...message, isDeleted: true, deletedBy: ownerId, deletedAt: now });
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
await page.getByText('Message Actions', { exact: true }).first().click();
const messageRow = page.locator(`[data-message-id="${messageId}"]`);
await messageRow.getByText(originalContent, { exact: true }).waitFor();

await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Xóa tin nhắn' }).click();
const vietnameseDialog = page.getByRole('dialog', { name: 'Xóa tin nhắn' });
await vietnameseDialog.getByText('Tin nhắn sẽ bị xóa khỏi cuộc trò chuyện. Bạn không thể hoàn tác thao tác này.').waitFor();
await vietnameseDialog.getByRole('button', { name: 'Hủy' }).click();
if (deleteRequests.length !== 0) throw new Error('Cancel must not delete the message');

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await messageRow.hover();
await messageRow.getByRole('button', { name: 'More options' }).click();
await page.getByRole('menuitem', { name: 'Delete message' }).click();
const englishDialog = page.getByRole('dialog', { name: 'Delete message' });
await englishDialog.getByText('This message will be removed from the conversation. You cannot undo this action.').waitFor();
await englishDialog.getByRole('button', { name: 'Delete', exact: true }).click();

await messageRow.getByText('Message deleted', { exact: true }).waitFor();
if (await messageRow.getByText(originalContent, { exact: true }).count()) {
  throw new Error('Deleted message content remains rendered');
}
if (await messageRow.getByRole('button', { name: 'More options' }).count()) {
  throw new Error('Deleted message still exposes message actions');
}

const report = { baseUrl, deleteRequests, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  deleteRequests.length !== 1
  || deleteRequests[0].method !== 'DELETE'
  || deleteRequests[0].bucket !== messageBucket
  || consoleErrors.length
  || requestFailures.length
) process.exitCode = 1;
