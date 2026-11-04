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
let communityPaused = true;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const apiRequests = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('/ws/')) consoleErrors.push({ text: message.text(), url: message.location().url });
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
    if (communityPaused) {
      await route.fulfill({ status: 403, json: { code: 'COMMUNITY_CREATION_DISABLED', message: 'Do not display this server text' } });
      return;
    }
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
  if (pathname.includes('/messages')) {
    if (pathname.endsWith('/messages/pins')) {
      await route.fulfill({ json: { conversationId, revision: '0', pins: [] } });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], interactions: [], polls: [], nextCursor: null, hasNext: false }) });
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
await dialog.getByText('Tạm dừng tạo cộng đồng mới. Bạn vẫn có thể trò chuyện trong các phòng hiện có. Thử lại sau nhé.', { exact: true }).waitFor();
await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
if (await dialog.getByLabel('Tên phòng chat').inputValue() !== 'Cộng đồng sản phẩm') throw new Error('Policy denial discarded the creation draft');
communityPaused = false;
await dialog.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
await dialog.getByRole('button', { name: 'Tạo phòng ngay', exact: true }).click();
await dialog.waitFor({ state: 'detached' });

const report = { baseUrl, createPayload, apiRequests, consoleErrors, requestFailures, pageErrors };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  createPayload?.conversationType !== 'CHANNEL'
  || createPayload?.visibility !== 'COMMUNITY'
  || createPayload?.joinPolicy !== 'REQUEST_APPROVAL'
  || consoleErrors.length !== 2
  || consoleErrors.filter(error => error.url === `${apiBaseUrl}/conversations` && error.text.includes('403 (Forbidden)')).length !== 1
  || consoleErrors.filter(error => error.url.startsWith(`${baseUrl}/_next/static/`) && error.text === '[ERROR] [CreateRoomModal] Failed to create room Request failed with status code 403').length !== 1
  || requestFailures.length
  || pageErrors.length
) process.exitCode = 1;
