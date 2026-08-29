import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const operator = {
  userId: '00000000-0000-0000-0000-000000000010',
  username: 'operator',
  email: 'operator@example.com',
  displayName: 'Operator',
  accountStatus: 'ACTIVE',
};
const emptyFriendship = {
  userId: operator.userId,
  status: 'ACCEPTED',
  userDetails: [],
};
const friend = {
  userId: '00000000-0000-0000-0000-000000000011',
  username: 'minh',
  displayName: 'Minh',
  accountStatus: 'ACTIVE',
  createdAt: '2026-01-10T00:00:00Z',
};
const acceptedFriendship = {
  userId: operator.userId,
  status: 'ACCEPTED',
  userDetails: [friend],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const requestFailures = [];
const realtimeFailures = [];
const isRealtimeFailure = (value) => value.includes('/ws/') || value.includes('SockJS');

page.on('console', (message) => {
  if (message.type() !== 'error') return;
  if (isRealtimeFailure(message.text())) {
    realtimeFailures.push(message.text());
    return;
  }
  consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  const failure = `${request.url()} ${request.failure()?.errorText ?? ''}`;
  if (isRealtimeFailure(failure)) {
    realtimeFailures.push(failure);
    return;
  }
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const pathname = new URL(route.request().url()).pathname;

  if (pathname.endsWith('/auth/refresh')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: token }) });
    return;
  }
  if (pathname.endsWith('/auth/me')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(operator) });
    return;
  }
  if (pathname.endsWith('/devices')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        deviceId: 'device-1',
        platform: 'WEB',
        deviceName: 'Browser',
        appVersion: 'test',
        lastSeenAt: '2026-08-29T00:00:00Z',
      }),
    });
    return;
  }
  if (pathname.endsWith('/conversations')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return;
  }
  if (pathname.endsWith(`/users/${friend.userId}`)) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(friend) });
    return;
  }
  if (pathname.endsWith(`/friends/check-block/${friend.userId}`)) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasBlocked: false, isBlockedBy: false }) });
    return;
  }
  if (pathname.endsWith(`/friends/mutual/${friend.userId}`)) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return;
  }
  if (pathname.endsWith('/friends') || pathname.endsWith('/friends/status/ACCEPTED')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(acceptedFriendship) });
    return;
  }
  if (pathname.includes('/friends/')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyFriendship) });
    return;
  }
  if (pathname.endsWith('/notifications')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], hasNext: false }) });
    return;
  }

  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], hasNext: false }) });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});

await page.goto(`${baseUrl}/friends`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Danh sách', exact: true }).waitFor();
const viTabs = await page.locator('header button').allTextContents();
const viShellNav = await page.locator('header a').allTextContents();
const viSelectedTab = await page.getByRole('button', { name: 'Bạn bè', exact: true }).getAttribute('aria-pressed');

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await page.getByRole('heading', { name: 'Friends list', exact: true }).waitFor();
const enTabs = await page.locator('header button').allTextContents();
const enShellNav = await page.locator('header a').allTextContents();
const enSelectedTab = await page.getByRole('button', { name: 'Friends', exact: true }).getAttribute('aria-pressed');
await page.getByRole('button', { name: /Minh/ }).first().click();
const profileDialog = page.getByRole('dialog', { name: 'Minh' });
await profileDialog.waitFor();
const profileActions = {
  hasMessage: (await profileDialog.getByRole('button', { name: 'Message', exact: true }).count()) === 1,
  hasBlock: (await profileDialog.getByRole('button', { name: 'Block this user', exact: true }).count()) === 1,
  hasReport: (await profileDialog.getByRole('button', { name: 'Report profile', exact: true }).count()) === 1,
  hasInertFriendAction: (await profileDialog.getByRole('button', { name: /Add friend|Remove friend/ }).count()) > 0,
};
await profileDialog.getByRole('button', { name: 'Close profile' }).click();
await page.getByRole('button', { name: 'Requests', exact: true }).click();
const enRequestsSelected = await page.getByRole('button', { name: 'Requests', exact: true }).getAttribute('aria-pressed');

const report = {
  baseUrl,
  language: await page.locator('html').getAttribute('lang'),
  viTabs,
  viShellNav,
  viSelectedTab,
  enTabs,
  enShellNav,
  enSelectedTab,
  enRequestsSelected,
  profileActions,
  realtimeFailures,
  consoleErrors,
  requestFailures,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  consoleErrors.length
  || requestFailures.length
  || report.language !== 'en'
  || viSelectedTab !== 'true'
  || enSelectedTab !== 'true'
  || enRequestsSelected !== 'true'
  || !profileActions.hasMessage
  || !profileActions.hasBlock
  || !profileActions.hasReport
  || profileActions.hasInertFriendAction
  || !viTabs.includes('Bạn bè')
  || !viTabs.includes('Lời mời')
  || !viTabs.includes('Tìm bạn')
  || !viShellNav.includes('Chat')
  || !viShellNav.includes('Bạn bè')
  || !viShellNav.includes('Tìm kiếm')
  || !viShellNav.includes('Hồ sơ')
  || !viShellNav.includes('Cài đặt')
  || !enTabs.includes('Friends')
  || !enTabs.includes('Requests')
  || !enTabs.includes('Find people')
  || !enShellNav.includes('Chat')
  || !enShellNav.includes('Friends')
  || !enShellNav.includes('Search')
  || !enShellNav.includes('Profile')
  || !enShellNav.includes('Settings')
) {
  process.exitCode = 1;
}
