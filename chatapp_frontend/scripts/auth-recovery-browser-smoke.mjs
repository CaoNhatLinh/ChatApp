import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3100';
const apiBaseUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const browser = await chromium.launch({ headless: true });
const screenshots = 'artifacts/readiness';
const user = { userId: '00000000-0000-0000-0000-000000000010', username: 'linh', email: 'linh@example.com', displayName: 'Linh', accountStatus: 'ACTIVE' };
const settings = { userId: user.userId, globalLevel: 'ALL', pushEnabled: false, emailEnabled: false, desktopEnabled: false, soundEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', timezone: 'Asia/Ho_Chi_Minh' };
const results = [];
try {
  await mkdir(screenshots, { recursive: true });
  for (const scenario of [
    { route: '/settings?tab=notifications', width: 320, theme: 'light', locale: 'vi' },
    { route: '/settings?tab=notifications', width: 1440, theme: 'dark', locale: 'en' },
    { route: '/admin', width: 320, theme: 'dark', locale: 'vi' },
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const failedRequests = [];
    const unexpectedRequests = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', (request) => failedRequests.push(request.url()));
    let ready = false;
    let refreshCount = 0;
    await page.route(`${apiBaseUrl}/**`, async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path.endsWith('/auth/refresh')) {
        refreshCount += 1;
        return ready
          ? json({ accessToken: 'fixture-access-token', user })
          : json({ code: 'SERVICE_UNAVAILABLE' }, 503);
      }
      if (path.endsWith('/auth/me')) return json(user);
      if (path.endsWith('/notifications/settings')) return json(settings);
      if (path.endsWith('/admin/overview')) return json({ code: 'FORBIDDEN' }, 403);
      if (path.endsWith('/devices')) return json({
        ...route.request().postDataJSON(), appVersion: null, active: true,
        createdAt: '2026-09-12T00:00:00Z', lastSeenAt: '2026-09-12T00:00:00Z',
      });
      if (path.endsWith('/auth/providers')) return json({ google: { enabled: false } });
      unexpectedRequests.push(path);
      return json({ code: 'UNEXPECTED_TEST_REQUEST' }, 500);
    });
    await page.addInitScript(({ theme, locale }) => {
      document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
      localStorage.setItem('themePreference', theme);
      localStorage.setItem('novachat_locale', locale);
    }, scenario);
    await page.goto(`${baseUrl}${scenario.route}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: scenario.locale === 'en' ? 'Could not check your session' : 'Chưa kiểm tra được phiên đăng nhập' }).waitFor({ timeout: 8000 }).catch(async (error) => {
      console.error(JSON.stringify({ scenario, url: page.url(), refreshCount, pageErrors, consoleErrors, failedRequests, unexpectedRequests, body: (await page.locator('body').innerText()).slice(0, 1500) }, null, 2));
      throw error;
    });
    assert.ok(page.url().endsWith(scenario.route), 'A temporary failure must not redirect away from the task');
    assert.equal(refreshCount, 1);
    assert.equal(await page.evaluate(() => document.cookie.includes('novachat_session=1')), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('html').getAttribute('data-theme'), scenario.theme === 'dark' ? 'dark' : null);
    await page.screenshot({ path: `${screenshots}/session-recovery-${scenario.theme}-${scenario.width}-${scenario.route.startsWith('/admin') ? 'admin' : scenario.locale}.png` });
    if (scenario.route.startsWith('/settings')) {
      ready = true;
      await page.getByRole('button', { name: scenario.locale === 'en' ? 'Try again' : 'Thử lại', exact: true }).click();
      await page.getByRole('heading', { name: scenario.locale === 'en' ? 'Notifications' : 'Thông báo', exact: true }).last().waitFor();
      assert.ok(page.url().endsWith(scenario.route));
      assert.equal(refreshCount, 2, 'Retry must issue one new refresh');
    } else {
      await page.getByRole('link', { name: 'Trợ giúp', exact: true }).click();
      await page.waitForURL('**/help');
      await page.locator('h1').waitFor();
    }
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors.filter((message) => !message.includes('503 (Service Unavailable)')), []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(unexpectedRequests, []);
    results.push({ ...scenario, refreshCount });
    await context.close();
  }
  console.log(JSON.stringify({ results, boundary: 'HTTP fixture recovery UI, not live auth/provider verification' }, null, 2));
} finally {
  await browser.close();
}
