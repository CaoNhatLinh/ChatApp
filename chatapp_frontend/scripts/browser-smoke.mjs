import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const paths = ['/', '/login', '/about', '/403', '/search?conversationId=00000000-0000-0000-0000-000000000001', '/settings?tab=reports', '/admin'];
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

const results = {};
for (const path of paths) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  results[path] = { status: response?.status() ?? 0, finalUrl: page.url(), title: await page.title() };
  if (results[path].status !== 200) throw new Error(`${path} returned ${results[path].status}`);
}

await browser.close();
const report = { baseUrl, results, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
if (consoleErrors.length || requestFailures.length) process.exitCode = 1;
