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
const permissions = [
  'ROOM_READ', 'ROOM_MODERATE', 'AUDIT_READ', 'REPORT_MANAGE', 'USER_READ',
  'USER_SUSPEND', 'USER_RESTORE', 'APP_ROLE_MANAGE', 'SESSION_REVOKE', 'ANALYTICS_READ',
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const requestFailures = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const pathname = new URL(route.request().url()).pathname;
  let body = { content: [], hasNext: false };
  if (pathname.endsWith('/auth/refresh')) {
    body = { accessToken: 'mock-access-token', user: operator };
  } else if (pathname.endsWith('/auth/me')) {
    body = operator;
  } else if (pathname.endsWith('/admin/overview')) {
    body = {
      actorId: operator.userId,
      roles: ['APP_ADMIN'],
      permissions,
      availableRoleCodes: ['APP_ADMIN', 'TRUST_SAFETY', 'SUPPORT', 'ANALYST', 'AUDITOR'],
    };
  } else if (pathname.endsWith('/health')) {
    body = {
      status: 'UP',
      service: 'chat-service',
      runtimeMode: 'cassandra-native',
      cassandra: 'UP',
      timestamp: new Date().toISOString(),
    };
  } else if (pathname.endsWith('/admin/audit/export')) {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/csv; charset=UTF-8' },
      body: 'eventMonth,eventId,action\n',
    });
    return;
  } else if (pathname.includes('/admin/')) {
    body = [];
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await page.goto(`${baseUrl}/admin`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Điều hành toàn ứng dụng' }).waitFor();
const before = page.url();
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Xuất CSV audit/ }).click(),
]);
await page.getByRole('button', { name: /Về ứng dụng/ }).click();
await page.waitForURL('**/app');
const result = { baseUrl, before, after: page.url(), exportedFilename: download.suggestedFilename(), consoleErrors, requestFailures };
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (consoleErrors.length || requestFailures.length || !result.after.endsWith('/app') || !/^novachat-audit-\d{4}-\d{2}\.csv$/.test(result.exportedFilename)) process.exitCode = 1;
