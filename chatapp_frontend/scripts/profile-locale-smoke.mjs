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

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
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
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});

await page.goto(`${baseUrl}/profile`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Hồ sơ của bạn', exact: true }).waitFor();
const vi = {
  lang: await page.locator('html').getAttribute('lang'),
  quickLinksTitle: (await page.getByText('Truy cập nhanh', { exact: true }).count()) === 1,
  quickLinks: await page.locator('main a').allTextContents(),
};

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await page.getByRole('heading', { name: 'Your profile', exact: true }).waitFor();
const en = {
  lang: await page.locator('html').getAttribute('lang'),
  quickLinksTitle: (await page.getByText('Quick access', { exact: true }).count()) === 1,
  quickLinks: await page.locator('main a').allTextContents(),
};

const report = { baseUrl, vi, en, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  consoleErrors.length
  || requestFailures.length
  || vi.lang !== 'vi'
  || !vi.quickLinksTitle
  || !vi.quickLinks.some((label) => label.includes('Chat'))
  || !vi.quickLinks.some((label) => label.includes('Tìm nhanh'))
  || !vi.quickLinks.some((label) => label.includes('Bạn bè'))
  || en.lang !== 'en'
  || !en.quickLinksTitle
  || !en.quickLinks.some((label) => label.includes('Chat'))
  || !en.quickLinks.some((label) => label.includes('Quick search'))
  || !en.quickLinks.some((label) => label.includes('Friends'))
) {
  process.exitCode = 1;
}
