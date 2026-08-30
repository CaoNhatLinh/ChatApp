import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const captureVisualAudit = process.env.VISUAL_AUDIT_CAPTURE === '1';
const captureDirectory = 'artifacts/ui-audit/current';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const ownerId = '00000000-0000-0000-0000-000000000401';
const conversationId = '00000000-0000-0000-0000-000000000402';
const messageId = '40000000-0000-0000-0000-000000000403';
const messageBucket = '2026-08-30T12:00:00Z';
const createdAt = '2026-08-30T12:05:00Z';
const latestReadAt = '2026-08-30T12:08:00Z';

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
  name: 'Message Interactions',
  description: 'Message interaction verification',
  createdBy: ownerId,
  ownerId,
  createdAt,
  updatedAt: createdAt,
  isDeleted: false,
  lastActivityAt: createdAt,
  memberCount: 2,
  defaultNotificationLevel: 'ALL',
  chatMode: 'OPEN',
  slowModeSeconds: 0,
};
let message = {
  conversationId,
  messageBucket,
  messageId,
  senderId: ownerId,
  content: 'Tin nhắn có tương tác bền vững',
  messageType: 'TEXT',
  contentFormat: 'PLAIN_TEXT',
  isDeleted: false,
  hasAttachments: false,
  hasMentions: false,
  isPinned: false,
  createdAt,
};
let reactions = [{ emoji: 'like', count: 3, reactedByCurrentUser: true }];

const pinRequests = [];
const reactionRequests = [];
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
  if (path.endsWith('/devices')) return json({ deviceId: 'device-message-interactions' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations') && method === 'GET') {
    return json({
      content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: createdAt, notificationOverride: 'INHERIT', lastMessage: null }],
      nextCursor: null,
      hasNext: false,
    });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages`) && method === 'GET') {
    return json({
      content: [message],
      nextCursor: null,
      hasNext: false,
      interactions: [{ messageId, reactions, latestReadAt }],
      polls: [],
    });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages/${messageId}/pin`)) {
    pinRequests.push({ method, bucket: requestUrl.searchParams.get('bucket') });
    message = { ...message, isPinned: method === 'POST' };
    return json(message);
  }
  if (path.endsWith(`/conversations/${conversationId}/messages/${messageId}/reactions`)) {
    const emoji = method === 'POST' ? request.postDataJSON().emoji : requestUrl.searchParams.get('emoji');
    reactionRequests.push({ method, bucket: requestUrl.searchParams.get('bucket'), emoji });
    if (method === 'DELETE' && emoji === 'like') {
      reactions = [{ emoji: 'like', count: 2, reactedByCurrentUser: false }];
    }
    if (method === 'POST' && emoji === 'love') {
      reactions = [...reactions, { emoji: 'love', count: 1, reactedByCurrentUser: true }];
    }
    return route.fulfill({ status: 204 });
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

const openConversation = async () => {
  await page.getByText('Message Interactions', { exact: true }).first().click();
  const row = page.locator(`[data-message-id="${messageId}"]`);
  await row.getByText(message.content, { exact: true }).waitFor();
  return row;
};

await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
let messageRow = await openConversation();
await messageRow.getByRole('button', { name: 'Thích: 3' }).waitFor();
await messageRow.getByRole('button', { name: 'Đã xem' }).waitFor();

await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Ghim' }).click();
await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Bỏ ghim' }).waitFor();
await page.keyboard.press('Escape');

await messageRow.getByRole('button', { name: 'Thích: 3' }).click();
await messageRow.getByRole('button', { name: 'Thêm cảm xúc' }).click();
if (captureVisualAudit) {
  await mkdir(captureDirectory, { recursive: true });
  await page.screenshot({ path: `${captureDirectory}/message-reaction-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await messageRow.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${captureDirectory}/message-reaction-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
}
await page.getByRole('button', { name: 'Yêu thích' }).click();

await page.reload({ waitUntil: 'domcontentloaded' });
messageRow = await openConversation();
await messageRow.getByRole('button', { name: 'Thích: 2' }).waitFor();
await messageRow.getByRole('button', { name: 'Yêu thích: 1' }).waitFor();
await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Bỏ ghim' }).click();

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await messageRow.getByRole('button', { name: 'Like: 2' }).waitFor();
await messageRow.hover();
await messageRow.getByRole('button', { name: 'More options' }).click();
await page.getByRole('menuitem', { name: 'Pin' }).waitFor();

const report = { baseUrl, pinRequests, reactionRequests, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  pinRequests.length !== 2
  || pinRequests[0].method !== 'POST'
  || pinRequests[1].method !== 'DELETE'
  || pinRequests.some((request) => request.bucket !== messageBucket)
  || reactionRequests.length !== 2
  || reactionRequests[0].method !== 'DELETE'
  || reactionRequests[0].emoji !== 'like'
  || reactionRequests[1].method !== 'POST'
  || reactionRequests[1].emoji !== 'love'
  || reactionRequests.some((request) => request.bucket !== messageBucket)
  || consoleErrors.length
  || requestFailures.length
) process.exitCode = 1;
