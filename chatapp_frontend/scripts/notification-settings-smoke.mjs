import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const captureVisualAudit = process.env.VISUAL_AUDIT_CAPTURE === '1';
const smokeTheme = process.env.SMOKE_THEME === 'dark' ? 'dark' : 'light';
const captureDirectory = 'artifacts/ui-audit/current';
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

await page.addInitScript((theme) => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
  window.localStorage.setItem('themePreference', theme);
}, smokeTheme);
await page.goto(`${baseUrl}/settings?tab=notifications`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Thông báo' }).last().waitFor();
if (captureVisualAudit) {
  await mkdir(captureDirectory, { recursive: true });
  await page.screenshot({ path: `${captureDirectory}/settings-notifications-${smokeTheme}-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${captureDirectory}/settings-notifications-${smokeTheme}-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
}
const pushToggle = page.locator('label').filter({ hasText: 'Thông báo đẩy' }).locator('input[type="checkbox"]');
if (!(await pushToggle.isDisabled())) throw new Error('Push toggle must stay disabled without a runtime provider');
await page.locator('input[name="notification-global-level"][value="MENTIONS"]').check();
const saveResponse = page.waitForResponse((response) => response.url().endsWith('/notifications/settings') && response.request().method() === 'PUT');
await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
await saveResponse;
await page.getByRole('button', { name: 'Lưu thay đổi' }).waitFor({ state: 'visible' });
await page.waitForFunction(() => {
  const button = Array.from(document.querySelectorAll('button')).find((element) => element.textContent?.includes('Lưu thay đổi'));
  return button instanceof HTMLButtonElement && button.disabled;
});

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
  || savedPayload.pushEnabled !== true
  || savedPayload.globalLevel !== 'MENTIONS'
) {
  process.exitCode = 1;
}
