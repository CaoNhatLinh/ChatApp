import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const realtimeBaseUrl = apiBaseUrl.replace(/\/api$/, '');
const outputDirectory = 'artifacts/ui-audit/current';
const accessToken = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const currentUser = {
  userId: '00000000-0000-0000-0000-000000000010',
  username: 'linh',
  email: 'linh@example.com',
  displayName: 'Linh Cao',
  accountStatus: 'ACTIVE',
};

const captures = [
  { slug: 'home', path: '/', authenticated: false },
  { slug: 'about', path: '/about', authenticated: false },
  { slug: 'help', path: '/help', authenticated: false },
  { slug: 'privacy', path: '/privacy', authenticated: false },
  { slug: 'terms', path: '/terms', authenticated: false },
  { slug: 'login', path: '/login', authenticated: false },
  { slug: 'register', path: '/register', authenticated: false },
  { slug: 'forbidden', path: '/403', authenticated: false },
  { slug: 'not-found', path: '/missing-route', authenticated: false },
  { slug: 'invite', path: '/join/design-audit', authenticated: false },
  { slug: 'workspace-empty', path: '/app', authenticated: true },
  { slug: 'workspace-conversation', path: '/app?conversationId=00000000-0000-0000-0000-000000000040', authenticated: true },
  { slug: 'workspace-composer-options', path: '/app?conversationId=00000000-0000-0000-0000-000000000040', authenticated: true, openComposerOptions: true },
  { slug: 'friends-empty', path: '/friends', authenticated: true },
  { slug: 'communities', path: '/communities', authenticated: true },
  { slug: 'search-empty', path: '/search', authenticated: true },
  { slug: 'profile', path: '/profile', authenticated: true },
  { slug: 'settings-profile', path: '/settings', authenticated: true },
  { slug: 'settings-notifications', path: '/settings?tab=notifications', authenticated: true },
  { slug: 'admin', path: '/admin', authenticated: true },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 960 },
  { name: 'mobile', width: 390, height: 844 },
];

const notificationSettings = {
  globalLevel: 'MENTIONS',
  pushEnabled: true,
  emailEnabled: false,
  desktopEnabled: true,
  soundEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: 'Asia/Ho_Chi_Minh',
};

const communities = [
  {
    conversationId: '00000000-0000-0000-0000-000000000020',
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
    conversationId: '00000000-0000-0000-0000-000000000021',
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

const workspaceConversation = {
  conversationId: '00000000-0000-0000-0000-000000000040',
  conversationType: 'GROUP',
  name: 'Design review',
  description: 'Bản xem trước cho audit giao diện.',
  createdBy: currentUser.userId,
  ownerId: currentUser.userId,
  createdAt: '2026-08-30T08:00:00Z',
  updatedAt: '2026-08-30T08:00:00Z',
  isDeleted: false,
  lastActivityAt: '2026-08-30T08:00:00Z',
  memberCount: 3,
  defaultNotificationLevel: 'ALL',
  chatMode: 'OPEN',
  slowModeSeconds: 0,
};

const workspaceConversationItem = {
  conversation: workspaceConversation,
  pinned: false,
  unreadCount: 2,
  joinedAt: '2026-08-30T08:00:00Z',
  notificationOverride: 'INHERIT',
  lastMessage: {
    messageId: '00000000-0000-0000-0000-000000000041',
    senderId: currentUser.userId,
    senderDisplayName: currentUser.displayName,
    contentPreview: 'Chuẩn bị bản thiết kế mới cho Nối.',
    messageType: 'TEXT',
    createdAt: '2026-08-30T08:00:00Z',
    deleted: false,
    hasAttachments: false,
  },
};

const adminOverview = {
  actorId: currentUser.userId,
  roles: ['APP_ADMIN'],
  permissions: ['USER_READ', 'APP_ROLE_MANAGE', 'SESSION_REVOKE', 'USER_SUSPEND', 'USER_RESTORE', 'ROOM_READ', 'ROOM_MODERATE', 'AUDIT_READ', 'ANALYTICS_READ', 'REPORT_MANAGE'],
  availableRoleCodes: ['APP_ADMIN', 'SUPPORT_AGENT'],
};

const adminRoom = {
  conversationId: workspaceConversation.conversationId,
  conversationType: 'COMMUNITY',
  visibility: 'PUBLIC',
  joinPolicy: 'REQUEST_APPROVAL',
  name: 'Design review',
  description: 'Không gian kiểm thử audit giao diện.',
  ownerId: currentUser.userId,
  memberCount: 3,
  chatMode: 'OPEN',
  slowModeSeconds: 0,
  deleted: false,
  createdAt: workspaceConversation.createdAt,
  updatedAt: workspaceConversation.updatedAt,
  members: [{ userId: currentUser.userId, joinedAt: workspaceConversation.createdAt }],
};

const json = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const fulfillApiRequest = async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const { pathname } = url;

  if (pathname.endsWith('/auth/refresh')) return json(route, { accessToken, user: currentUser });
  if (pathname.endsWith('/auth/me')) return json(route, currentUser);
  if (pathname.endsWith('/admin/overview')) return json(route, adminOverview);
  if (pathname.endsWith('/health')) return json(route, { status: 'UP', service: 'novachat-api', runtimeMode: 'audit', cassandra: 'UP', timestamp: '2026-08-30T08:00:00Z' });
  if (pathname.endsWith('/admin/conversations')) return json(route, [adminRoom]);
  if (pathname.endsWith(`/admin/conversations/${adminRoom.conversationId}`)) return json(route, adminRoom);
  if (pathname.endsWith('/admin/audit')) return json(route, []);
  if (pathname.endsWith('/admin/analytics')) return json(route, []);
  if (pathname.endsWith('/admin/reports')) return json(route, []);
  if (pathname.endsWith('/devices')) return json(route, { deviceId: '00000000-0000-0000-0000-000000000030' });
  if (pathname.includes('/devices/') && pathname.endsWith('/heartbeat')) return route.fulfill({ status: 204 });
  if (pathname.endsWith('/communities')) return json(route, { content: communities, nextCursor: null, hasNext: false });
  if (pathname.endsWith('/conversations')) return json(route, { content: [workspaceConversationItem], nextCursor: null, hasNext: false });
  if (pathname.endsWith(`/conversations/${workspaceConversation.conversationId}/messages`)) {
    return json(route, {
      content: [
        {
          messageId: '00000000-0000-0000-0000-000000000041',
          conversationId: workspaceConversation.conversationId,
          senderId: currentUser.userId,
          senderDisplayName: currentUser.displayName,
          content: 'Mình đã cập nhật hướng thiết kế cho Nối. Mời mọi người xem và góp ý ở đây nhé.',
          type: 'TEXT',
          createdAt: '2026-08-30T08:00:00Z',
          updatedAt: '2026-08-30T08:00:00Z',
          deleted: false,
          isPinned: false,
          attachments: [],
          reactions: [],
          readReceipts: [],
        },
      ],
      nextCursor: null,
      hasNext: false,
      interactions: [],
      polls: [],
    });
  }
  if (pathname.endsWith('/notifications/settings')) return json(route, notificationSettings);
  if (pathname.endsWith('/notifications/unread/count')) return json(route, { count: 0 });
  if (pathname.endsWith('/notifications/unread')) return json(route, []);
  if (pathname.endsWith('/notifications')) return json(route, { content: [], nextCursor: null, hasNext: false });
  if (pathname.endsWith('/preferences/chat')) {
    return json(route, { defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
  }
  if (pathname.endsWith('/reports/mine')) return json(route, []);
  if (pathname.endsWith('/users/search')) return json(route, { content: [], nextCursor: null, hasNext: false });
  if (pathname.includes('/friends/requests/')) {
    return json(route, { userId: currentUser.userId, status: 'PENDING', userDetails: [] });
  }
  if (pathname.endsWith('/friends') || pathname.includes('/friends/status/')) {
    return json(route, { userId: currentUser.userId, status: 'ACCEPTED', userDetails: [] });
  }
  if (pathname.includes('/friends/')) return json(route, { hasBlocked: false, isBlockedBy: false });
  if (pathname.endsWith('/public/invites/design-audit')) {
    return json(route, {
      status: 'ACTIVE', conversationId: communities[0].conversationId, conversationName: communities[0].name,
      conversationType: 'COMMUNITY', createdBy: currentUser.userId, displayName: 'Thiết kế cộng đồng',
      joinPolicy: 'REQUEST_APPROVAL', expiresAt: null, remainingUses: null,
    });
  }
  return json(route, {});
};

const captureRoute = async (browser, viewport, capture) => {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  if (capture.authenticated) await context.addCookies([{ name: 'novachat_session', value: '1', url: baseUrl }]);
  await context.route(`${realtimeBaseUrl}/ws/info**`, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ websocket: true, origins: ['*:*'], cookie_needed: false, entropy: 0 }),
  }));
  await context.routeWebSocket(new RegExp(`^ws${realtimeBaseUrl.startsWith('https:') ? 's' : ''}:${realtimeBaseUrl.slice(realtimeBaseUrl.indexOf('//'))}/ws/`), () => {});
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('/ws/')) consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' });
  });
  await page.route(`${apiBaseUrl}/**`, fulfillApiRequest);
  const response = await page.goto(`${baseUrl}${capture.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
  if (capture.openComposerOptions && viewport.name === 'mobile') {
    await page.locator('.chat-composer-dock').getByRole('button', { name: /Thêm nội dung|Tùy chọn khác/ }).click();
  }
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outputDirectory}/${capture.slug}-${viewport.name}.png`, fullPage: true });
  const result = {
    route: capture.path,
    viewport: viewport.name,
    status: response?.status() ?? 0,
    finalUrl: page.url(),
    consoleErrors,
    failedRequests,
    horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
  };
  await context.close();
  return result;
};

const requestedCaptures = process.env.AUDIT_CAPTURE
  ?.split(',')
  .map((capture) => capture.trim())
  .filter(Boolean);
const selectedCaptures = requestedCaptures?.length
  ? captures.filter((capture) => requestedCaptures.includes(capture.slug))
  : captures;
if (!selectedCaptures.length) throw new Error(`Unknown audit capture: ${requestedCaptures?.join(', ') ?? ''}`);

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
for (const viewport of viewports) {
  for (const capture of selectedCaptures) results.push(await captureRoute(browser, viewport, capture));
}
await browser.close();
console.log(JSON.stringify({ baseUrl, results }, null, 2));

if (results.some((result) => result.status !== 200 || result.consoleErrors.length || result.horizontalOverflow)) {
  process.exitCode = 1;
}
