import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3115';
const apiUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const captures = new URL('../artifacts/database-capabilities/', import.meta.url);
const user = { userId: '00000000-0000-0000-0000-000000000001', username: 'fixture', displayName: 'Fixture', accountStatus: 'ACTIVE' };
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.fixture';
const request = {
  conversationId: '00000000-0000-0000-0000-000000000010', requestedAt: '95c65b80-a869-11f1-8000-000000000001',
  requestedOn: '2026-10-12T01:00:00Z', requestId: '00000000-0000-0000-0000-000000000020',
  linkId: null, status: 'PENDING', resolvedAt: null,
};

await mkdir(captures, { recursive: true });
try {
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 768, 1024, 1440]) {
      const locale = width === 768 ? 'en' : 'vi';
      const copy = locale === 'en' ? {
        title: 'Your join requests', pending: 'Pending approval', more: 'More requests',
        declined: 'Request declined', open: 'Open room', refresh: 'Refresh',
        error: 'Could not load your join requests. Refresh to try again.',
        empty: 'You have not sent any requests. Choose a community below to get started.',
      } : {
        title: 'Yêu cầu tham gia của bạn', pending: 'Đang chờ duyệt', more: 'Xem thêm yêu cầu',
        declined: 'Yêu cầu bị từ chối', open: 'Mở phòng', refresh: 'Làm mới',
        error: 'Không thể tải yêu cầu tham gia. Thử làm mới để tải lại.',
        empty: 'Bạn chưa gửi yêu cầu nào. Chọn một cộng đồng bên dưới để bắt đầu.',
      };
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      await context.addInitScript((preferences) => {
        localStorage.setItem('themePreference', preferences.theme);
        localStorage.setItem('novachat_locale', preferences.locale);
        document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
      }, { theme, locale });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      const calls = [];
      let state = 'pending';
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().includes('net::ERR_FAILED')) errors.push(message.text());
      });
      await page.route(`${apiUrl}/**`, async (route) => {
        const url = new URL(route.request().url());
        let body = {};
        if (url.pathname.endsWith('/auth/refresh')) body = { accessToken: token };
        if (url.pathname.endsWith('/auth/me')) body = user;
        if (url.pathname.endsWith('/devices')) body = {
          ...route.request().postDataJSON(), platform: 'WEB', pushProvider: 'WEB_PUSH',
          deviceName: null, appVersion: null, active: true,
          createdAt: '2026-10-12T01:00:00Z', lastSeenAt: '2026-10-12T01:00:00Z',
        };
        if (url.pathname.endsWith('/communities')) body = { content: [], hasNext: false, nextCursor: null };
        if (url.pathname.endsWith('/me/join-requests')) {
          calls.push(url.searchParams.get('cursor'));
          assert.equal(url.searchParams.has('userId'), false);
          body = state === 'empty' ? { content: [], hasNext: false, nextCursor: null }
            : url.searchParams.get('cursor') ? { content: [{ ...request, requestId: '00000000-0000-0000-0000-000000000021', status: 'DECLINED' }], hasNext: false, nextCursor: null }
            : { content: [{ ...request, status: state === 'approved' ? 'APPROVED' : 'PENDING' }], hasNext: state === 'pending', nextCursor: state === 'pending' ? 'fixture-next' : null };
          if (state === 'error') { await route.abort('failed'); return; }
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`${baseUrl}/communities`, { waitUntil: 'domcontentloaded' });
      const disclosure = page.getByText(copy.title, { exact: true });
      await disclosure.waitFor();
      await page.getByRole('heading', { name: locale === 'en' ? 'No matching communities yet' : 'Chưa tìm thấy cộng đồng phù hợp' }).waitFor();
      assert.equal(calls.length, 0, 'Collapsed requests should not fetch');
      await disclosure.click();
      await page.getByText(copy.pending, { exact: true }).waitFor();
      await page.getByRole('button', { name: copy.more }).click();
      await page.getByText(copy.declined, { exact: true }).waitFor();
      assert.ok(calls.includes('fixture-next'));
      assert.equal(await page.getByRole('link', { name: copy.open, exact: true }).count(), 0);
      state = 'approved';
      await page.getByRole('button', { name: copy.refresh, exact: true }).click();
      const openRoom = page.getByRole('link', { name: copy.open, exact: true });
      await openRoom.waitFor();
      assert.ok((await openRoom.getAttribute('href')).includes(request.conversationId));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme === 'dark' ? 'dark' : null);
      await page.screenshot({ path: new URL(`join-requests-${theme}-${width}.png`, captures).pathname.replace(/^\/([A-Za-z]:)/, '$1'), fullPage: true });
      state = 'error';
      await page.getByRole('button', { name: copy.refresh, exact: true }).click();
      await page.getByRole('alert').filter({ hasText: copy.error }).waitFor();
      assert.equal(await openRoom.count(), 1, 'Fetch errors must preserve the previous page');
      state = 'empty';
      await page.getByRole('button', { name: copy.refresh, exact: true }).click();
      await page.getByText(copy.empty, { exact: true }).waitFor();
      assert.equal(await openRoom.count(), 0);
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
  console.log('Own join requests: 8 layouts passed (pagination, refresh, error, empty, room link, themes).');
} finally {
  await browser.close();
}
