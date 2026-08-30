import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const conversationId = '00000000-0000-0000-0000-000000000001';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const operator = {
  userId: '00000000-0000-0000-0000-000000000010',
  username: 'operator',
  email: 'operator@example.com',
  displayName: 'Operator',
  accountStatus: 'ACTIVE',
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const searchRequests = [];
const consoleErrors = [];
const requestFailures = [];
let messageSearchCallCount = 0;

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const request = route.request();
  const pathname = new URL(request.url()).pathname;

  if (pathname.endsWith('/auth/refresh')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: token }) });
    return;
  }
  if (pathname.endsWith('/auth/me')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(operator) });
    return;
  }
  if (pathname.endsWith('/devices')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        deviceId: 'device-1',
        platform: 'WEB',
        deviceName: 'Browser',
        appVersion: 'test',
        lastSeenAt: '2026-08-29T00:00:00Z',
      }),
    });
    return;
  }
  if (pathname.endsWith('/search/messages')) {
    messageSearchCallCount += 1;
    searchRequests.push(request.postDataJSON());
    const firstPage = messageSearchCallCount === 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: firstPage
          ? [{
              messageId: '00000000-0000-0000-0000-000000000002',
              conversationId,
              messageBucket: '2026-08',
              senderId: operator.userId,
              messageType: 'TEXT',
              content: 'first search result',
              hasAttachments: false,
              isPinned: false,
              isDeleted: false,
              createdAt: '2026-08-29T00:00:00Z',
            }]
          : [{
              messageId: '00000000-0000-0000-0000-000000000003',
              conversationId,
              messageBucket: '2026-08',
              senderId: operator.userId,
              messageType: 'TEXT',
              content: 'second search result',
              hasAttachments: false,
              isPinned: false,
              isDeleted: false,
              createdAt: '2026-08-28T00:00:00Z',
            }],
        ...(firstPage ? { nextCursor: 'cursor-1' } : {}),
      }),
    });
    return;
  }

  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], hasNext: false }) });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});

await page.goto(`${baseUrl}/search?conversationId=${conversationId}`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Tìm kiếm nhanh' }).waitFor();

const messageFilterDisclosure = page.locator('details').filter({ hasText: 'Bộ lọc tin nhắn' });
if (await messageFilterDisclosure.getAttribute('open') !== null) {
  throw new Error('Message filters must be collapsed by default');
}
await page.getByText('Bộ lọc tin nhắn', { exact: true }).click();
if (await messageFilterDisclosure.getAttribute('open') === null) {
  throw new Error('Message filters did not open from the disclosure control');
}

const selects = page.locator('select');
const selectCount = await selects.count();
if (selectCount !== 3) {
  throw new Error(`Expected three message filter selects, received ${selectCount}`);
}

const typeResponse = page.waitForResponse((response) => response.url().endsWith('/search/messages') && response.request().method() === 'POST');
await selects.nth(0).selectOption('TEXT');
await typeResponse;
const typeRequest = searchRequests.at(-1);

const loadMoreResponse = page.waitForResponse((response) => response.url().endsWith('/search/messages') && response.request().method() === 'POST');
await page.getByRole('button', { name: 'Tải thêm kết quả', exact: true }).waitFor();
await page.getByRole('button', { name: 'Tải thêm kết quả', exact: true }).click();
await loadMoreResponse;
const loadMoreRequest = searchRequests.at(-1);

const attachmentResponse = page.waitForResponse((response) => response.url().endsWith('/search/messages') && response.request().method() === 'POST');
await selects.nth(1).selectOption('true');
await attachmentResponse;
const attachmentRequest = searchRequests.at(-1);

const pinnedResponse = page.waitForResponse((response) => response.url().endsWith('/search/messages') && response.request().method() === 'POST');
await selects.nth(2).selectOption('false');
await pinnedResponse;
const pinnedRequest = searchRequests.at(-1);

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await page.getByRole('heading', { name: 'Quick search' }).waitFor();
const englishOptions = await selects.nth(0).locator('option').allTextContents();
const englishBody = await page.locator('body').innerText();

await page.goto(`${baseUrl}/search`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Quick search' }).waitFor();
const requestCountBeforeMissingConversation = searchRequests.length;
await page.locator('input').first().fill('chat');
await page.locator('li').filter({ hasText: 'Open a conversation to use advanced message search.' }).waitFor();
await page.waitForTimeout(450);

const report = {
  baseUrl,
  messageFiltersCollapsedByDefault: true,
  selectCount,
  typeRequest,
  loadMoreRequest,
  attachmentRequest,
  pinnedRequest,
  englishOptions,
  missingConversationRequestCount: searchRequests.length - requestCountBeforeMissingConversation,
  consoleErrors,
  requestFailures,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  consoleErrors.length
  || requestFailures.length
  || typeRequest?.conversationId !== conversationId
  || typeRequest?.messageType !== 'TEXT'
  || loadMoreRequest?.pageCursor !== 'cursor-1'
  || attachmentRequest?.hasAttachment !== true
  || pinnedRequest?.isPinned !== false
  || englishOptions[0] !== 'All'
  || !englishBody.includes('Attachment')
  || !englishBody.includes('Pin status')
  || !englishBody.includes('With attachments')
  || !englishBody.includes('Not pinned')
  || report.missingConversationRequestCount !== 0
) {
  process.exitCode = 1;
}
