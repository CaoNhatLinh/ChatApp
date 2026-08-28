import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const operator = {
  userId: '00000000-0000-0000-0000-000000000010',
  username: 'operator',
  email: 'operator@example.com',
  displayName: 'Operator',
  accountStatus: 'ACTIVE',
};
const settings = {
  userId: operator.userId,
  globalLevel: 'ALL',
  pushEnabled: true,
  emailEnabled: false,
  desktopEnabled: true,
  soundEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  timezone: 'Asia/Ho_Chi_Minh',
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const requestFailures = [];
let savedPayload = null;
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const request = route.request();
  const pathname = new URL(request.url()).pathname;
  let body = {};
  if (pathname.endsWith('/auth/refresh')) {
    body = { accessToken: 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature', user: operator };
  } else if (pathname.endsWith('/auth/me')) {
    body = operator;
  } else if (pathname.endsWith('/notifications/settings')) {
    if (request.method() === 'PUT') {
      savedPayload = request.postDataJSON();
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    body = settings;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await page.goto(`${baseUrl}/settings?tab=notifications`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Thông báo' }).last().waitFor();
await page.getByText('Thông báo đẩy', { exact: true }).click();
const saveResponse = page.waitForResponse((response) => response.url().endsWith('/notifications/settings') && response.request().method() === 'PUT');
await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
await saveResponse;
await page.getByText('Đã lưu cài đặt thông báo.', { exact: true }).waitFor();

const result = {
  baseUrl,
  pageUrl: page.url(),
  savedPayload,
  consoleErrors,
  requestFailures,
};
console.log(JSON.stringify(result, null, 2));
await browser.close();

if (
  consoleErrors.length
  || requestFailures.length
  || !result.pageUrl.includes('/settings?tab=notifications')
  || !savedPayload
  || savedPayload.pushEnabled !== false
  || savedPayload.globalLevel !== settings.globalLevel
) {
  process.exitCode = 1;
}
