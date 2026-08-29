import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const operator = {
  userId: '00000000-0000-0000-0000-000000000020',
  username: 'operator',
  email: 'operator@example.com',
  displayName: 'Operator',
  accountStatus: 'ACTIVE',
};
const conversationId = '00000000-0000-0000-0000-000000000021';
let createPayload = null;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const requestFailures = [];
const apiRequests = [];
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('/ws/')) consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  if (!request.url().includes('/ws/')) requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});
page.on('request', (request) => {
  if (request.url().startsWith(apiBaseUrl)) apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
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
  if (pathname.endsWith('/conversations') && request.method() === 'POST') {
    createPayload = request.postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        conversationId,
        conversationType: 'CHANNEL',
        name: createPayload.name,
        description: createPayload.description,
        createdBy: operator.userId,
        ownerId: operator.userId,
        createdAt: '2026-08-29T00:00:00Z',
        updatedAt: '2026-08-29T00:00:00Z',
        isDeleted: false,
        lastActivityAt: '2026-08-29T00:00:00Z',
        memberCount: 1,
        defaultNotificationLevel: 'ALL',
        chatMode: 'OPEN',
        slowModeSeconds: 0,
      }),
    });
    return;
  }
  if (pathname.endsWith('/devices')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deviceId: 'device-1' }) });
    return;
  }
  if (pathname.endsWith('/conversations')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], nextCursor: null, hasNext: false }) });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], userDetails: [], hasNext: false }) });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Tạo phòng mới', exact: true }).click();
const dialog = page.getByRole('dialog', { name: 'Tạo phòng mới' });
await dialog.getByLabel('Tên phòng chat').fill('Cộng đồng sản phẩm');
await dialog.getByRole('button', { name: /Kênh \(Channel\)/ }).click();

if (await dialog.getByText('Phạm vi kênh', { exact: true }).count() !== 1) {
  throw new Error('Channel visibility control is missing');
}
await dialog.getByText('Cộng đồng', { exact: true }).click();
await dialog.getByText('Cần phê duyệt', { exact: true }).click();
await dialog.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
await dialog.getByRole('button', { name: 'Tạo phòng ngay', exact: true }).click();
await dialog.waitFor({ state: 'detached' });

const report = { baseUrl, createPayload, apiRequests, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  createPayload?.conversationType !== 'CHANNEL'
  || createPayload?.visibility !== 'COMMUNITY'
  || createPayload?.joinPolicy !== 'REQUEST_APPROVAL'
  || consoleErrors.length
  || requestFailures.length
) process.exitCode = 1;
