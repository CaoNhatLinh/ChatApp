import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const user = {
  userId: '00000000-0000-0000-0000-000000000030',
  username: 'explorer',
  email: 'explorer@example.com',
  displayName: 'Explorer',
  accountStatus: 'ACTIVE',
};
const approvalId = '00000000-0000-0000-0000-000000000031';
const directId = '00000000-0000-0000-0000-000000000032';
const communities = [
  {
    conversationId: approvalId,
    name: 'Product Việt Nam',
    description: 'Nơi những người làm sản phẩm cùng chia sẻ kinh nghiệm thực tế.',
    avatarUrl: null,
    categoryId: 'Sản phẩm',
    communityTags: ['product', 'design'],
    languageCode: 'vi',
    joinPolicy: 'REQUEST_APPROVAL',
    memberCount: 1280,
    maxMembers: 5000,
    lastActivityAt: '2026-08-29T08:00:00Z',
    membershipStatus: 'AVAILABLE',
  },
  {
    conversationId: directId,
    name: 'Frontend Sài Gòn',
    description: 'Trao đổi React, hiệu năng web và thiết kế giao diện.',
    avatarUrl: null,
    categoryId: 'Công nghệ',
    communityTags: ['frontend', 'react'],
    languageCode: 'vi',
    joinPolicy: 'DIRECT_JOIN',
    memberCount: 842,
    maxMembers: 3000,
    lastActivityAt: '2026-08-29T09:00:00Z',
    membershipStatus: 'AVAILABLE',
  },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(5_000);
const consoleErrors = [];
const requestFailures = [];
const apiRequests = [];

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});
page.on('request', (request) => {
  if (request.url().startsWith(apiBaseUrl)) apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname.endsWith('/auth/refresh')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: token }) });
    return;
  }
  if (url.pathname.endsWith('/auth/me')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    return;
  }
  if (url.pathname.endsWith(`/communities/${approvalId}/join`) && request.method() === 'POST') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'PENDING', conversationId: approvalId }) });
    return;
  }
  if (url.pathname.endsWith('/communities') && request.method() === 'GET') {
    const query = url.searchParams.get('query')?.toLowerCase();
    const categoryId = url.searchParams.get('categoryId');
    const tag = url.searchParams.get('tag');
    const content = communities.filter((community) => (
      (!query || community.name.toLowerCase().includes(query))
      && (!categoryId || community.categoryId === categoryId)
      && (!tag || community.communityTags.includes(tag))
    ));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content, nextCursor: null, hasNext: false }) });
    return;
  }
  if (url.pathname.endsWith('/devices')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deviceId: 'device-community' }) });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});

await page.goto(`${baseUrl}/communities`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Tìm một cuộc trò chuyện có chung mối quan tâm.' }).waitFor();
await page.getByRole('heading', { name: 'Product Việt Nam' }).waitFor();
await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
await page.getByRole('button', { name: 'Đang chờ duyệt' }).waitFor();
await page.getByText('Bộ lọc', { exact: true }).click();
const categoryResponse = page.waitForResponse((response) => {
  const url = new URL(response.url());
  return url.pathname.endsWith('/communities') && url.searchParams.get('categoryId') === 'Sản phẩm';
});
await page.getByRole('group', { name: 'Lọc theo danh mục' }).getByRole('button', { name: 'Sản phẩm', exact: true }).click();
await categoryResponse;
await page.getByRole('heading', { name: 'Frontend Sài Gòn' }).waitFor({ state: 'detached' });
const allResponse = page.waitForResponse((response) => {
  const url = new URL(response.url());
  return url.pathname.endsWith('/communities') && !url.searchParams.has('categoryId');
});
await page.getByRole('group', { name: 'Lọc theo danh mục' }).getByRole('button', { name: 'Tất cả' }).click();
await allResponse;
const filteredResponse = page.waitForResponse((response) => {
  const url = new URL(response.url());
  return url.pathname.endsWith('/communities') && url.searchParams.get('query') === 'Frontend';
});
await page.getByPlaceholder('Tìm theo tên cộng đồng...').fill('Frontend');
await filteredResponse;
await page.getByRole('heading', { name: 'Frontend Sài Gòn' }).waitFor();
await page.getByRole('heading', { name: 'Product Việt Nam' }).waitFor({ state: 'detached' });

const englishResponse = page.waitForResponse((response) => {
  const url = new URL(response.url());
  return url.pathname.endsWith('/communities') && url.searchParams.get('languageCode') === 'en';
});
await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await englishResponse;
await page.getByRole('heading', { name: 'Find a conversation around a shared interest.' }).waitFor();
await page.getByRole('heading', { name: 'Frontend Sài Gòn' }).waitFor();
await page.getByRole('heading', { name: 'Product Việt Nam' }).waitFor({ state: 'detached' });
const englishNav = await page.getByRole('link', { name: 'Community', exact: true }).count();
const redundantJoinLabelCount = await page.getByText('Join now', { exact: true }).count();

await page.setViewportSize({ width: 390, height: 844 });
const mobileHeroDetailVisible = await page.getByText('Open communities, clear details', { exact: true }).isVisible();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
await mkdir('artifacts', { recursive: true });
await page.screenshot({ path: 'artifacts/community-discovery.png', fullPage: true });

const report = { baseUrl, englishNav, redundantJoinLabelCount, mobileHeroDetailVisible, overflow, apiRequests, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  !apiRequests.includes(`POST /api/communities/${approvalId}/join`)
  || englishNav !== 1
  || redundantJoinLabelCount !== 0
  || mobileHeroDetailVisible
  || overflow
  || consoleErrors.length
  || requestFailures.length
) process.exitCode = 1;
