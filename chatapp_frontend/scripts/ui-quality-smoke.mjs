import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const paths = ['/', '/about', '/help', '/privacy', '/terms', '/login', '/register', '/403'];
const viewports = [
  { width: 320, height: 780 },
  { width: 1440, height: 900 },
];

const browser = await chromium.launch({ headless: true });
const results = [];
const consoleErrors = [];
const requestFailures = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push({ path: page.url(), message: message.text() });
  });
  page.on('requestfailed', (request) => {
    requestFailures.push({ path: page.url(), url: request.url(), error: request.failure()?.errorText });
  });

  for (const path of paths) {
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(250);
    const audit = await page.evaluate(() => {
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
      };
      const unnamedControls = [...document.querySelectorAll('a,button,[role="button"]')]
        .filter(isVisible)
        .filter((element) => {
          const labelledBy = element.getAttribute('aria-labelledby');
          const labelledText = labelledBy
            ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
            : '';
          return !((element.textContent ?? '').trim() || element.getAttribute('aria-label') || element.getAttribute('title') || labelledText.trim());
        }).length;
      const unlabeledFields = [...document.querySelectorAll('input,textarea,select')]
        .filter(isVisible)
        .filter((element) => element.getAttribute('type') !== 'hidden')
        .filter((element) => {
          if (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')) return false;
          if (element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`)) return false;
          return !element.closest('label');
        }).length;
      const internalLinksWithoutHref = [...document.querySelectorAll('a')]
        .filter(isVisible)
        .filter((element) => !element.getAttribute('href')).length;
      return {
        lang: document.documentElement.lang,
        h1Count: document.querySelectorAll('h1').length,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        unnamedControls,
        unlabeledFields,
        internalLinksWithoutHref,
      };
    });
    results.push({ path, viewport: `${viewport.width}x${viewport.height}`, status: response?.status() ?? null, finalUrl: page.url(), ...audit });
  }
  await context.close();
}

console.log(JSON.stringify({ baseUrl, results, consoleErrors, requestFailures }, null, 2));
await browser.close();

const invalid = results.filter((result) => result.status !== 200
  || result.h1Count !== 1
  || result.horizontalOverflow
  || result.unnamedControls > 0
  || result.unlabeledFields > 0
  || result.internalLinksWithoutHref > 0);
if (invalid.length || consoleErrors.length || requestFailures.length) process.exitCode = 1;
