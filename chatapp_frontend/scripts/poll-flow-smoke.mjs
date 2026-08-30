import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const ownerId = '00000000-0000-0000-0000-000000000501';
const conversationId = '00000000-0000-0000-0000-000000000502';
const messageId = '50000000-0000-0000-0000-000000000503';
const pollId = '00000000-0000-0000-0000-000000000504';
const createdAt = '2026-08-30T12:05:00Z';
const messageBucket = '2026-08-30-12:03';

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
  name: 'Poll Verification',
  createdBy: ownerId,
  ownerId,
  createdAt,
  updatedAt: createdAt,
  isDeleted: false,
  lastActivityAt: createdAt,
  memberCount: 4,
  defaultNotificationLevel: 'ALL',
  chatMode: 'OPEN',
  slowModeSeconds: 0,
};
const message = {
  conversationId,
  messageBucket,
  messageId,
  senderId: ownerId,
  content: 'Chúng ta gặp ở đâu?',
  messageType: 'POLL',
  contentFormat: 'PLAIN_TEXT',
  pollId,
  isDeleted: false,
  hasAttachments: false,
  hasMentions: false,
  isPinned: false,
  createdAt,
};

let poll = {
  poll: {
    pollId,
    conversationId,
    messageId,
    question: 'Chúng ta gặp ở đâu?',
    options: ['Quận 1', 'Quận 3'],
    isClosed: false,
    isMultipleChoice: false,
    isAnonymous: true,
    createdBy: ownerId,
    createdAt,
    closesAt: null,
  },
  optionCounts: { 0: 2, 1: 1 },
  currentUserOptionIndexes: [],
  totalVoters: 3,
};

const createRequests = [];
const mutationRequests = [];
const consoleErrors = [];
const requestFailures = [];
let failFirstCreate = true;

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
  if (path.endsWith('/devices')) return json({ deviceId: 'device-poll-flow' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations') && method === 'GET') {
    return json({
      content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: createdAt, notificationOverride: 'INHERIT', lastMessage: null }],
      nextCursor: null,
      hasNext: false,
    });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages`) && method === 'GET') {
    return json({ content: [message], nextCursor: null, hasNext: false, interactions: [], polls: [poll] });
  }
  if (path.endsWith('/polls') && method === 'POST') {
    createRequests.push(request.postDataJSON());
    if (failFirstCreate) {
      failFirstCreate = false;
      return json({ message: 'temporary failure' }, 503);
    }
    return json(poll, 201);
  }
  if (path.endsWith(`/polls/${pollId}/votes`) && method === 'POST') {
    const selected = request.postDataJSON().selectedOptionIndexes;
    mutationRequests.push({ method, action: 'vote', selected });
    poll = { ...poll, optionCounts: { 0: 3, 1: 1 }, currentUserOptionIndexes: selected, totalVoters: 4 };
    return json(poll);
  }
  if (path.endsWith(`/polls/${pollId}/votes`) && method === 'DELETE') {
    mutationRequests.push({ method, action: 'remove' });
    poll = { ...poll, optionCounts: { 0: 2, 1: 1 }, currentUserOptionIndexes: [], totalVoters: 3 };
    return json(poll);
  }
  if (path.endsWith(`/polls/${pollId}/close`) && method === 'POST') {
    mutationRequests.push({ method, action: 'close' });
    poll = { ...poll, poll: { ...poll.poll, isClosed: true } };
    return json(poll);
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
await page.getByText('Poll Verification', { exact: true }).first().click();
const messageRow = page.locator(`[data-message-id="${messageId}"]`);
await messageRow.getByText('Chúng ta gặp ở đâu?', { exact: true }).waitFor();

await messageRow.getByRole('button', { name: 'Quận 1' }).click();
await messageRow.getByRole('button', { name: 'Gửi' }).click();
await messageRow.getByText('4 phiếu', { exact: true }).waitFor();
await messageRow.getByRole('button', { name: 'Hủy phiếu' }).click();
await messageRow.getByText('3 phiếu', { exact: true }).waitFor();

await page.getByRole('button', { name: 'Tạo bình chọn' }).click();
const dialog = page.getByRole('dialog', { name: 'Tạo bình chọn' });
await dialog.getByLabel('Câu hỏi').fill('Ngày họp tiếp theo?');
await dialog.getByLabel('Lựa chọn 1').fill('Thứ Hai');
await dialog.getByLabel('Lựa chọn 2').fill('Thứ Hai');
await dialog.getByText('Các lựa chọn không được trùng nhau.').waitFor();
await dialog.getByLabel('Lựa chọn 2').fill('Thứ Ba');
await dialog.getByRole('button', { name: 'Tạo bình chọn', exact: true }).click();
if (await dialog.locator('#poll-question').inputValue() !== 'Ngày họp tiếp theo?') {
  throw new Error('Poll draft was not preserved after the failed request');
}
await dialog.getByRole('button', { name: 'Tạo bình chọn', exact: true }).click();
await dialog.waitFor({ state: 'detached' });

await messageRow.getByRole('button', { name: 'Đóng bình chọn' }).click();
await messageRow.getByText('Đã đóng', { exact: true }).waitFor();

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await messageRow.getByText('Poll', { exact: true }).waitFor();
await messageRow.getByText('Closed', { exact: true }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await messageRow.scrollIntoViewIfNeeded();
const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

const expectedFailureLogs = consoleErrors.filter(entry =>
  entry.text.includes('503 (Service Unavailable)')
  || entry.text.includes('[MessageInput] Failed to create poll'),
);
const unexpectedConsoleErrors = consoleErrors.filter(entry => !expectedFailureLogs.includes(entry));
const report = {
  baseUrl,
  createRequests,
  mutationRequests,
  expectedFailureLogs,
  unexpectedConsoleErrors,
  requestFailures,
  mobileOverflow,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  createRequests.length !== 2
  || createRequests.some(request => request.question !== 'Ngày họp tiếp theo?')
  || createRequests[0].clientMessageId !== createRequests[1].clientMessageId
  || mutationRequests.length !== 3
  || mutationRequests[0].action !== 'vote'
  || mutationRequests[0].selected?.[0] !== 0
  || mutationRequests[1].action !== 'remove'
  || mutationRequests[2].action !== 'close'
  || expectedFailureLogs.length !== 2
  || unexpectedConsoleErrors.length
  || requestFailures.length
  || mobileOverflow
) process.exitCode = 1;
