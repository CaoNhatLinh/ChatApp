import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const user = {
  userId: '00000000-0000-0000-0000-000000000010',
  username: 'operator',
  email: 'operator@example.com',
  displayName: 'Operator',
  accountStatus: 'ACTIVE',
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const requestFailures = [];
const realtimeFailures = [];
const isRealtimeFailure = (value) => value.includes('/ws/') || value.includes('SockJS');

page.on('console', (message) => {
  if (message.type() !== 'error') return;
  if (isRealtimeFailure(message.text())) realtimeFailures.push(message.text());
  else consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  const failure = `${request.url()} ${request.failure()?.errorText ?? ''}`;
  if (isRealtimeFailure(failure)) realtimeFailures.push(failure);
  else requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const pathname = new URL(route.request().url()).pathname;
  if (pathname.endsWith('/auth/refresh')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: token }) });
    return;
  }
  if (pathname.endsWith('/auth/me')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    return;
  }
  if (pathname.endsWith('/conversations')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], nextCursor: null, hasNext: false }) });
    return;
  }
  if (pathname.includes('/friends')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ userId: user.userId, status: 'ACCEPTED', userDetails: [] }),
    });
    return;
  }
  if (pathname.endsWith('/notifications')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], hasNext: false }) });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});

await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
const statusTriggerVi = page.getByRole('button', { name: 'Trực tuyến', exact: true });
await statusTriggerVi.waitFor();
await statusTriggerVi.click();
const viOptions = await page.getByRole('menuitem').allTextContents();
await page.keyboard.press('Escape');

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
const statusTriggerEn = page.getByRole('button', { name: 'Online', exact: true });
await statusTriggerEn.waitFor();
await statusTriggerEn.click();
const enOptions = await page.getByRole('menuitem').allTextContents();
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 390, height: 844 });
const mobileStatusTrigger = page.getByRole('button', { name: 'Online', exact: true });
await mobileStatusTrigger.waitFor();
const mobileStatusNamed = await mobileStatusTrigger.getAttribute('aria-label');

const report = { baseUrl, viOptions, enOptions, mobileStatusNamed, realtimeFailures, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  consoleErrors.length
  || requestFailures.length
  || !viOptions.some((option) => option.includes('Trực tuyến'))
  || !viOptions.some((option) => option.includes('Không làm phiền'))
  || !viOptions.some((option) => option.includes('Vô hình'))
  || !enOptions.some((option) => option.includes('Online'))
  || !enOptions.some((option) => option.includes('Do not disturb'))
  || !enOptions.some((option) => option.includes('Invisible'))
  || mobileStatusNamed !== 'Online'
) {
  process.exitCode = 1;
}
