import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
const requestFailures = [];

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});

await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
await context.setOffline(true);
await page.getByRole('status').filter({ hasText: 'Mất kết nối mạng' }).waitFor();
const offlineVisible = await page.getByRole('status').filter({ hasText: 'Mất kết nối mạng' }).isVisible();

await context.setOffline(false);
await page.getByRole('status').filter({ hasText: 'Mất kết nối mạng' }).waitFor({ state: 'detached' });
const recovered = (await page.getByRole('status').filter({ hasText: 'Mất kết nối mạng' }).count()) === 0;

const report = { baseUrl, offlineVisible, recovered, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (!offlineVisible || !recovered || consoleErrors.length || requestFailures.length) {
  process.exitCode = 1;
}
