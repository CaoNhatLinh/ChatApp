import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const captureVisualAudit = process.env.VISUAL_AUDIT_CAPTURE === '1';
const smokeTheme = process.env.SMOKE_THEME === 'dark' ? 'dark' : 'light';
const emailAvailable = process.env.SMOKE_EMAIL_AVAILABLE === '1';
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
const historyRequests = [];
const utcNow = new Date();
const currentMonth = utcNow.toISOString().slice(0, 7);
const previousMonth = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
const cursor = 'fixture-email-history-cursor';
let savedPayload = null;
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const pathname = url.pathname;
  let body = {};
  if (pathname.endsWith('/auth/refresh')) {
    body = { accessToken: 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature', user: operator };
  } else if (pathname.endsWith('/auth/me')) {
    body = operator;
  } else if (pathname.endsWith('/notifications/channels')) {
    body = { emailAvailable, emailMode: 'ALLOWLIST', webhookConfigured: emailAvailable };
  } else if (pathname.endsWith('/notifications/email-history')) {
    const month = url.searchParams.get('month');
    const after = url.searchParams.get('cursor');
    historyRequests.push({ month, cursor: after });
    if (month === currentMonth && after === null) {
      body = { content: [], hasNext: true, nextCursor: cursor };
    } else if (month === currentMonth && after === cursor) {
      body = { content: [
        { notificationId: '82af3a80-0a91-11ef-beb5-0242ac120002', status: 'SENT', attemptedAt: `${currentMonth}-01T09:00:00Z`, deliveredAt: null },
        { notificationId: '82af3814-0a91-11ef-beb5-0242ac120002', status: 'DELIVERED', attemptedAt: `${currentMonth}-01T08:00:00Z`, deliveredAt: `${currentMonth}-01T08:01:00Z` },
      ], hasNext: false, nextCursor: null };
    } else {
      body = { content: [], hasNext: false, nextCursor: null };
    }
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
await page.locator('label').filter({ hasText: 'Email' }).locator('input[type="checkbox"]').waitFor({ state: 'attached' });
if (captureVisualAudit) {
  await mkdir(captureDirectory, { recursive: true });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
      throw new Error(`Notification settings overflow at ${width}px`);
    }
    await page.screenshot({ path: `${captureDirectory}/settings-notifications-${smokeTheme}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: `${captureDirectory}/settings-notifications-${smokeTheme}-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${captureDirectory}/settings-notifications-${smokeTheme}-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
}
const pushToggle = page.locator('label').filter({ hasText: 'Thông báo đẩy' }).locator('input[type="checkbox"]');
if (!(await pushToggle.isDisabled())) throw new Error('Push toggle must stay disabled without a runtime provider');
const emailToggle = page.locator('label').filter({ hasText: 'Email' }).locator('input[type="checkbox"]');
if ((await emailToggle.isDisabled()) === emailAvailable) throw new Error('Email availability must follow the runtime channel contract');
if (emailAvailable) {
  await emailToggle.focus();
  await emailToggle.press('Space');
  if (!(await emailToggle.isChecked())) throw new Error('Email must be keyboard-toggleable');
  await page.getByText('Giờ yên tĩnh', { exact: true }).click();
  const start = page.getByLabel('Bắt đầu', { exact: true });
  if (!(await start.isEnabled())) throw new Error('Email quiet hours must be editable');
  await start.fill('23:00');
}
await page.locator('input[name="notification-global-level"][value="MENTIONS"]').check();
const saveResponse = page.waitForResponse((response) => response.url().endsWith('/notifications/settings') && response.request().method() === 'PUT');
await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
await saveResponse;
await page.getByRole('button', { name: 'Lưu thay đổi' }).waitFor({ state: 'visible' });
await page.waitForFunction(() => {
  const button = Array.from(document.querySelectorAll('button')).find((element) => element.textContent?.includes('Lưu thay đổi'));
  return button instanceof HTMLButtonElement && button.disabled;
});

assert.equal(historyRequests.length, 0, 'closed email history must not fetch');
const historyTitle = page.locator('summary').filter({ hasText: 'Lịch sử gửi email' });
await historyTitle.press('Enter');
await page.getByText('Chưa có mục trong phần này. Bạn có thể xem tiếp.', { exact: true }).waitFor();
const historyMonth = page.getByLabel('Tháng (UTC)', { exact: true });
assert.equal(await historyMonth.inputValue(), currentMonth);
const loadMore = page.getByRole('button', { name: 'Xem thêm', exact: true });
await loadMore.click();
const sent = page.getByText('Đã chuyển cho dịch vụ email', { exact: true });
const delivered = page.getByText('Đã giao', { exact: true });
await sent.waitFor();
await delivered.waitFor();
const sentLookup = page.getByRole('listitem').filter({ has: sent });
await sentLookup.locator('summary').filter({ hasText: 'Mã tra cứu' }).press('Enter');
await sentLookup.getByText(operator.userId, { exact: true }).waitFor();
await sentLookup.getByText(currentMonth, { exact: true }).waitFor();
await sentLookup.getByText('82af3a80-0a91-11ef-beb5-0242ac120002', { exact: true }).waitFor();
assert.equal(await loadMore.isVisible(), false);
const previousMonthResponse = page.waitForResponse(response => {
  const url = new URL(response.url());
  return url.pathname.endsWith('/notifications/email-history') && url.searchParams.get('month') === previousMonth;
});
await historyMonth.fill(previousMonth);
await previousMonthResponse;
await sent.waitFor({ state: 'hidden' });
await delivered.waitFor({ state: 'hidden' });
assert.deepEqual(historyRequests, [
  { month: currentMonth, cursor: null },
  { month: currentMonth, cursor },
  { month: previousMonth, cursor: null },
]);

const result = {
  baseUrl,
  pageUrl: page.url(),
  savedPayload,
  historyRequests,
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
  || savedPayload.emailEnabled !== emailAvailable
  || (emailAvailable && savedPayload.quietHoursStart !== '23:00')
) {
  process.exitCode = 1;
}
