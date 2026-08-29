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
const vietnameseControls = {
  languageTitle: await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).first().getAttribute('title'),
  hasThemeToggle: (await page.getByRole('button', { name: 'Đổi giao diện' }).count()) > 0,
};
await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await page.getByRole('heading', { name: 'Say what matters. Keep what matters.' }).waitFor();

const home = {
  lang: await page.locator('html').getAttribute('lang'),
  heading: await page.locator('h1').first().innerText(),
  storedLocale: await page.evaluate(() => window.localStorage.getItem('novachat_locale')),
  navigation: await page.locator('header a').allTextContents(),
  languageTitle: await page.getByRole('button', { name: 'Switch to Vietnamese' }).first().getAttribute('title'),
  hasThemeToggle: (await page.getByRole('button', { name: 'Change theme' }).count()) > 0,
};

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Say what matters. Keep what matters.', exact: true }).waitFor();
await page.getByRole('button', { name: 'Open navigation menu' }).click();
home.mobileNavigation = await page.locator('#public-mobile-navigation a').allTextContents();
await page.getByRole('button', { name: 'Close navigation menu' }).waitFor();

await page.goto(`${baseUrl}/does-not-exist`, { waitUntil: 'networkidle' });
const notFound = {
  lang: await page.locator('html').getAttribute('lang'),
  heading: await page.locator('h1').innerText(),
  hasHomeRecovery: (await page.getByRole('link', { name: 'Back to home' }).count()) === 1,
  hasWorkspaceRecovery: (await page.getByRole('link', { name: 'Open workspace' }).count()) === 1,
};

await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
const login = {
  heading: await page.locator('h1').innerText(),
  passwordLabel: (await page.getByText('Password', { exact: true }).count()) === 1,
  accountPrompt: (await page.locator('p').filter({ hasText: 'No account yet?' }).count()) === 1,
};

await page.goto(`${baseUrl}/register`, { waitUntil: 'networkidle' });
const register = {
  heading: await page.locator('h1').innerText(),
  passwordLabel: (await page.getByText('Password', { exact: true }).count()) === 1,
  backToSignIn: (await page.getByRole('link', { name: 'Back to sign in' }).count()) === 1,
};

const expectedNotFoundDocumentError = 'Failed to load resource: the server responded with a status of 404 (Not Found)';
const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes(expectedNotFoundDocumentError));
const report = { baseUrl, vietnameseControls, home, notFound, login, register, consoleErrors: unexpectedConsoleErrors, expectedNotFoundDocumentErrors: consoleErrors.length - unexpectedConsoleErrors.length, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  unexpectedConsoleErrors.length ||
  requestFailures.length ||
  vietnameseControls.languageTitle !== 'Tiếng Anh' ||
  !vietnameseControls.hasThemeToggle ||
  home.lang !== 'en' ||
  home.storedLocale !== 'en' ||
  home.languageTitle !== 'Vietnamese' ||
  !home.hasThemeToggle ||
  !home.navigation.includes('Home') ||
  !home.navigation.includes('About') ||
  !home.navigation.includes('Help') ||
  !home.navigation.includes('Sign in') ||
  !home.navigation.includes('Create account') ||
  !home.mobileNavigation.includes('Home') ||
  !home.mobileNavigation.includes('About') ||
  !home.mobileNavigation.includes('Help') ||
  !home.mobileNavigation.includes('Sign in') ||
  !home.mobileNavigation.includes('Create account') ||
  notFound.lang !== 'en' ||
  !notFound.hasHomeRecovery ||
  !notFound.hasWorkspaceRecovery ||
  login.heading !== 'Sign in' ||
  !login.passwordLabel ||
  !login.accountPrompt ||
  register.heading !== 'Create your account' ||
  !register.passwordLabel ||
  !register.backToSignIn
) {
  process.exitCode = 1;
}
