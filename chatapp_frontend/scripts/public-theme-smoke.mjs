import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3100';
const captureDirectory = new URL('../artifacts/readiness/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const failures = [];
const captures = [];
let preference = 'system';

async function openPage(context) {
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  page.on('requestfailed', (request) => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.addInitScript((value) => {
    localStorage.setItem('themePreference', value);
    localStorage.setItem('novachat_locale', 'vi');
  }, preference);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.tech-layer-button').first().waitFor();
  return page;
}

const assertTheme = (page, dark) => page.waitForFunction(
  (expected) => (document.documentElement.dataset.theme === 'dark') === expected,
  dark,
  { timeout: 3000 },
);

try {
  const context = await browser.newContext({ colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await openPage(context);
  await assertTheme(page, false);
  await page.emulateMedia({ colorScheme: 'dark' });
  await assertTheme(page, true);
  await page.emulateMedia({ colorScheme: 'light' });
  await assertTheme(page, false);
  await context.close();

  await mkdir(captureDirectory, { recursive: true });
  for (preference of ['light', 'dark']) {
    for (const width of [320, 768, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      const page = await openPage(context);
      await assertTheme(page, preference === 'dark');
      await page.emulateMedia({ colorScheme: preference === 'dark' ? 'light' : 'dark' });
      // An explicit preference must win over a subsequent OS theme change.
      await assertTheme(page, preference === 'dark');
      const layer = page.getByRole('button', { name: /Spring Boot \+ Cassandra/ });
      await layer.click();
      await page.getByRole('heading', { name: 'Spring Boot + Cassandra', exact: true }).waitFor();
      assert.equal(await layer.getAttribute('aria-pressed'), 'true');
      assert.equal(await layer.locator('svg').count(), 3, 'Two technology marks and one action arrow');
      assert.equal(await page.getByText('Spring Boot + PostgreSQL', { exact: true }).count(), 0);
      await layer.press('ArrowRight');
      assert.equal(await page.getByRole('button', { name: /WebSocket \+ STOMP/ }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('heading', { name: 'WebSocket + STOMP', exact: true }).waitFor();
      await layer.click();
      await page.getByRole('heading', { name: 'Spring Boot + Cassandra', exact: true }).waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `Overflow at ${width}px in ${preference}`);
      await page.locator('.tech-relay').evaluate((section) => {
        window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top - 80, behavior: 'instant' });
      });
      const capture = new URL(`technology-${preference}-${width}.png`, captureDirectory);
      // Capture the actual viewport with the fixed header in place. An element
      // taller than the viewport can produce a misleading mid-section header.
      await page.screenshot({ path: fileURLToPath(capture) });
      captures.push(capture.href);
      await context.close();
    }
  }
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ systemThemeChanges: 2, explicitThemeLayouts: captures.length, captures, failures }, null, 2));
} finally {
  await browser.close();
}
