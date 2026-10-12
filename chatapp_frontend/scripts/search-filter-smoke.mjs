import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const conversationId = '00000000-0000-0000-0000-000000000501';
const ownerId = '00000000-0000-0000-0000-000000000502';
const messageId = '00000000-0000-0000-0000-000000000503';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const createdAt = '2026-08-30T12:05:00Z';
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
  name: 'Search room',
  description: 'Message search verification',
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
const message = {
  conversationId,
  messageBucket: '2026-08-30-12:03',
  messageId,
  senderId: ownerId,
  content: 'A message that can be found in this room',
  messageType: 'TEXT',
  contentFormat: 'PLAIN_TEXT',
  isDeleted: false,
  hasAttachments: false,
  hasMentions: false,
  isPinned: false,
  createdAt,
};

const consoleErrors = [];
const requestFailures = [];
const searchRequests = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(10_000);
page.on('console', (entry) => {
  const location = entry.location();
  if (entry.type() === 'error' && !location.url.includes('/ws/') && !entry.text().includes('/ws/')) {
    consoleErrors.push(entry.text());
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
  if (path.endsWith('/devices')) return json({ deviceId: 'device-search' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations') && method === 'GET') {
    return json({ content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: createdAt, notificationOverride: 'INHERIT', lastMessage: null }], nextCursor: null, hasNext: false });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages`) && method === 'GET') {
    return json({ content: [message], nextCursor: null, hasNext: false, interactions: [], polls: [] });
  }
  if (path.endsWith('/search/messages') && method === 'POST') {
    const payload = request.postDataJSON();
    searchRequests.push(payload);
    return json({ content: [{ ...message, content: `Result for ${payload.q ?? 'filter'}` }], nextCursor: null });
  }
  if (path.includes('/friends/status/')) return json([]);
  if (path.includes('/notifications')) return json({ content: [], hasNext: false });
  if (path.includes('/invites/conversation/')) return json([]);
  if (path.includes('/friendships/requests')) return json({ content: [], userDetails: [], hasNext: false });
  return json({ content: [], userDetails: [], hasNext: false });
});

await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
await page.getByText('Search room', { exact: true }).first().click();
await page.getByRole('button', { name: 'Tìm trong cuộc trò chuyện', exact: true }).click();
await page.getByRole('heading', { name: 'Tìm tin nhắn', exact: true }).waitFor();

const searchInput = page.getByRole('searchbox', { name: 'Từ khóa tin nhắn' });
await searchInput.fill('message');
await page.waitForResponse((response) => response.url().endsWith('/search/messages') && response.request().method() === 'POST');
await page.getByRole('button', { name: /Result for message/ }).waitFor();
await page.getByRole('button', { name: /Result for message/ }).click();
await page.getByRole('heading', { name: 'Tìm tin nhắn', exact: true }).waitFor({ state: 'detached' });

const report = { baseUrl, searchRequests, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  consoleErrors.length
  || requestFailures.length
  || searchRequests.length !== 1
  || searchRequests[0]?.conversationId !== conversationId
  || searchRequests[0]?.q !== 'message'
) process.exitCode = 1;
