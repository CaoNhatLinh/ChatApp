import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'production-invite-token';
const accessToken = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const conversationId = '00000000-0000-0000-0000-000000000072';
const userId = '00000000-0000-0000-0000-000000000073';
const preview = {
  status: 'ACTIVE',
  conversationId,
  conversationName: 'Product Studio',
  conversationType: 'GROUP',
  createdBy: '00000000-0000-0000-0000-000000000074',
  displayName: 'Link phòng chat',
  joinPolicy: 'REQUEST_APPROVAL',
  expiresAt: '2026-09-05T08:00:00Z',
  remainingUses: null,
};

const browser = await chromium.launch({ headless: true });
await mkdir('artifacts', { recursive: true });
const consoleErrors = [];
const requestFailures = [];
const apiRequests = [];
let viewerStatus = 'AVAILABLE';
let consumeCount = 0;

const configurePage = async (page) => {
  page.setDefaultTimeout(10_000);
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('request', (request) => {
    if (request.url().startsWith(apiBaseUrl)) apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.route(`${apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/auth/refresh')) return json({ accessToken });
    if (path.endsWith('/auth/me')) return json({
      userId,
      username: 'linh',
      email: 'linh@example.com',
      displayName: 'Linh Tran',
      accountStatus: 'ACTIVE',
    });
    if (path.endsWith('/devices')) return json({ deviceId: 'device-invite-join' });
    if (path.endsWith(`/public/invites/${token}`)) return json(preview);
    if (path.endsWith(`/invites/${token}/status`)) return json({ status: viewerStatus, conversationId });
    if (path.endsWith('/invites/consume') && method === 'POST') {
      consumeCount += 1;
      viewerStatus = 'PENDING';
      return json({ status: 'PENDING', conversationId });
    }
    return json({ content: [], hasNext: false });
  });
};

const publicPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await configurePage(publicPage);
await publicPage.goto(`${baseUrl}/join/${token}`, { waitUntil: 'domcontentloaded' });
await publicPage.getByRole('heading', { name: 'Product Studio' }).waitFor();
const publicViewerStatusRequests = apiRequests.filter(request => request.endsWith(`/invites/${token}/status`)).length;
const publicOverflow = await publicPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
await publicPage.screenshot({ path: 'artifacts/invite-public-mobile.png', fullPage: true });
await publicPage.getByRole('button', { name: 'Đăng nhập' }).click();
await publicPage.waitForURL(url => url.pathname === '/login' && url.searchParams.get('from') === `/join/${token}`);
await publicPage.close();

const authenticatedPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await authenticatedPage.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await configurePage(authenticatedPage);
await authenticatedPage.goto(`${baseUrl}/join/${token}`, { waitUntil: 'domcontentloaded' });
await authenticatedPage.getByRole('heading', { name: 'Product Studio' }).waitFor();
await authenticatedPage.getByRole('button', { name: 'Chấp nhận' }).click();
await authenticatedPage.getByText('Yêu cầu đã được gửi tới quản lý phòng.', { exact: true }).waitFor();
await authenticatedPage.reload({ waitUntil: 'domcontentloaded' });
await authenticatedPage.getByText('Yêu cầu đã được gửi tới quản lý phòng.', { exact: true }).waitFor();
const acceptVisibleAfterReload = await authenticatedPage.getByRole('button', { name: 'Chấp nhận' }).isVisible().catch(() => false);
await authenticatedPage.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await authenticatedPage.getByText('Your request was sent to the room manager.', { exact: true }).waitFor();
const authenticatedOverflow = await authenticatedPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
await authenticatedPage.screenshot({ path: 'artifacts/invite-pending-mobile.png', fullPage: true });
await authenticatedPage.close();
await browser.close();

const viewerStatusRequests = apiRequests.filter(request => request.endsWith(`/invites/${token}/status`)).length;
const report = {
  publicViewerStatusRequests,
  viewerStatusRequests,
  consumeCount,
  acceptVisibleAfterReload,
  publicOverflow,
  authenticatedOverflow,
  apiRequests,
  consoleErrors,
  requestFailures,
};
console.log(JSON.stringify(report, null, 2));

if (publicViewerStatusRequests !== 0
  || viewerStatusRequests !== 2
  || consumeCount !== 1
  || acceptVisibleAfterReload
  || publicOverflow
  || authenticatedOverflow
  || consoleErrors.length
  || requestFailures.length) process.exitCode = 1;
