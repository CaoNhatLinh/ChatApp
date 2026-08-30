import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const ownerId = '00000000-0000-0000-0000-000000000040';
const memberId = '00000000-0000-0000-0000-000000000041';
const conversationId = '00000000-0000-0000-0000-000000000042';
const ownerRoleId = '00000000-0000-0000-0000-000000000043';
const moderatorRoleId = '00000000-0000-0000-0000-000000000044';
const createdRoleId = '00000000-0000-0000-0000-000000000045';
const now = '2026-08-29T08:00:00Z';
const operator = {
  userId: ownerId,
  username: 'owner',
  email: 'owner@example.com',
  displayName: 'Room Owner',
  accountStatus: 'ACTIVE',
};
const conversation = {
  conversationId,
  conversationType: 'GROUP',
  name: 'Product Studio',
  description: 'Product collaboration room',
  createdBy: ownerId,
  ownerId,
  createdAt: now,
  updatedAt: now,
  isDeleted: false,
  lastActivityAt: now,
  memberCount: 2,
  defaultNotificationLevel: 'ALL',
  chatMode: 'OPEN',
  slowModeSeconds: 0,
};
const conversationListItem = (item) => ({
  conversation: item,
  pinned: false,
  unreadCount: 0,
  joinedAt: now,
  notificationOverride: 'INHERIT',
  lastMessage: null,
});
const sidebarConversations = [
  conversation,
  ...Array.from({ length: 29 }, (_, index) => ({
    ...conversation,
    conversationId: `10000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    name: `Project room ${String(index + 1).padStart(2, '0')}`,
    memberCount: index + 3,
  })),
];
const secondPageConversation = {
  ...conversation,
  conversationId: '20000000-0000-0000-0000-000000000001',
  name: 'Loaded on demand',
  memberCount: 8,
};
const baseRoles = [
  {
    conversationId,
    rolePosition: 1,
    roleId: ownerRoleId,
    roleCode: 'OWNER',
    displayName: 'Owner',
    colorHex: '#F59E0B',
    permissions: ['MESSAGE_SEND', 'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE', 'ROLE_ASSIGN', 'MEMBER_KICK'],
    isDefault: false,
    isSystem: true,
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now,
  },
  {
    conversationId,
    rolePosition: 20,
    roleId: moderatorRoleId,
    roleCode: 'PRODUCT_STEWARD',
    displayName: 'Product steward',
    colorHex: '#4F46E5',
    permissions: ['MEMBER_KICK'],
    isDefault: false,
    isSystem: false,
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now,
  },
];
const members = [
  { userId: ownerId, conversationId, role: 'owner', roleIds: [ownerRoleId], joinedAt: now, username: 'owner', displayName: 'Room Owner', mutedUntil: null, messageIntervalSeconds: null },
  { userId: memberId, conversationId, role: 'member', roleIds: [], joinedAt: now, username: 'linh', displayName: 'Linh Tran', mutedUntil: null, messageIntervalSeconds: null },
  ...Array.from({ length: 119 }, (_, index) => ({
    userId: `00000000-0000-0000-1000-${String(index + 1).padStart(12, '0')}`,
    conversationId,
    role: 'member',
    roleIds: [],
    joinedAt: now,
    username: `member-${index}`,
    displayName: `Member ${index}`,
    mutedUntil: null,
    messageIntervalSeconds: null,
  })),
];
const directoryMembers = [members[0], ...members.slice(2, 101), members[1], ...members.slice(101)];

let roles = [...baseRoles];
let inviteLinks = Array.from({ length: 5 }, (_, index) => ({
  linkId: `30000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
  linkToken: `room-invite-${index + 1}`,
  conversationId,
  createdBy: ownerId,
  createdAt: now,
  inviteKind: index === 1 ? 'QR' : 'LINK',
  joinPolicy: index === 0 ? 'REQUEST_APPROVAL' : 'DIRECT_JOIN',
  displayName: index === 1 ? 'QR phòng chat' : `Link phòng chat ${index + 1}`,
  expiresAt: '2026-09-05T08:00:00Z',
  isActive: true,
  maxUses: null,
  usedCount: index,
  revokedBy: null,
  revokedAt: null,
}));
let joinRequests = Array.from({ length: 5 }, (_, index) => ({
  conversationId,
  requestedAt: `40000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
  requestId: `50000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
  userId: `60000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
  linkId: inviteLinks[0].linkId,
  status: 'PENDING',
  resolvedBy: null,
  resolvedAt: null,
}));
const roleAssignments = [];
const ownershipTransfers = [];
const createdRoles = [];
const updatedRoles = [];
const roomPolicies = [];
const memberPolicies = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10_000);
const consoleErrors = [];
const requestFailures = [];
const apiRequests = [];
const conversationPageCursors = [];
const memberPageLimits = [];
const inviteCommands = [];

page.on('console', (message) => {
  const location = message.location();
  if (message.type() === 'error' && !location.url.includes('/ws/') && !message.text().includes('/ws/')) {
    consoleErrors.push({ text: message.text(), url: location.url });
  }
});
page.on('requestfailed', (request) => {
  if (!request.url().includes('/ws/')) requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});
page.on('request', (request) => {
  if (request.url().startsWith(apiBaseUrl)) {
    const requestUrl = new URL(request.url());
    apiRequests.push(`${request.method()} ${requestUrl.pathname}`);
    if (requestUrl.pathname.endsWith('/conversations') && request.method() === 'GET') {
      conversationPageCursors.push(requestUrl.searchParams.get('cursor'));
    }
    if (requestUrl.pathname.endsWith(`/conversations/${conversationId}/members`) && request.method() === 'GET') {
      memberPageLimits.push(requestUrl.searchParams.get('limit'));
    }
  }
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const method = request.method();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(operator);
  if (path.endsWith('/devices')) return json({ deviceId: 'device-room-management' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations') && method === 'GET') {
    const cursor = new URL(request.url()).searchParams.get('cursor');
    return cursor === 'conversation-cursor-1'
      ? json({ content: [conversationListItem(secondPageConversation)], nextCursor: null, hasNext: false })
      : json({ content: sidebarConversations.map(conversationListItem), nextCursor: 'conversation-cursor-1', hasNext: true });
  }
  if (path.endsWith(`/conversations/${conversationId}/notification-policy`)) {
    return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  }
  if (path.endsWith(`/conversations/${conversationId}/members`) && method === 'GET') {
    const afterUserId = new URL(request.url()).searchParams.get('afterUserId');
    const pageSize = Number(new URL(request.url()).searchParams.get('limit'));
    const startIndex = afterUserId
      ? directoryMembers.findIndex((member) => member.userId === afterUserId) + 1
      : 0;
    const content = directoryMembers.slice(startIndex, startIndex + pageSize);
    const hasNext = startIndex + content.length < directoryMembers.length;
    return json({ content, nextCursor: hasNext ? content.at(-1).userId : null, hasNext });
  }
  if (path.endsWith(`/conversations/${conversationId}/roles`) && method === 'GET') return json(roles);
  if (path.endsWith(`/conversations/${conversationId}/permissions`)) {
    return json({ permissions: ['MESSAGE_SEND', 'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE', 'ROLE_ASSIGN', 'MEMBER_KICK', 'MEMBER_MUTE', 'ROOM_UPDATE', 'ROOM_AUDIT_READ'], owner: true });
  }
  if (path.endsWith(`/conversations/${conversationId}/audit`) && method === 'GET') {
    return json({
      content: [{
        eventId: 'c8a4f8b0-65df-11f1-8000-000000000001',
        eventType: 'ROLE_UPDATED',
        actorId: ownerId,
        targetUserId: null,
        messageBucket: null,
        messageId: null,
        reasonCode: null,
        metadata: { displayName: 'Product lead' },
        createdAt: now,
      }],
      nextCursor: null,
      hasNext: false,
    });
  }
  if (path.endsWith(`/conversations/${conversationId}/roles`) && method === 'POST') {
    const payload = request.postDataJSON();
    createdRoles.push(payload);
    const created = {
      conversationId,
      rolePosition: 30,
      roleId: createdRoleId,
      roleCode: payload.roleCode,
      displayName: payload.displayName,
      colorHex: payload.colorHex,
      permissions: payload.permissionCodes,
      isDefault: payload.isDefault,
      isSystem: false,
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    };
    roles = [...roles, created];
    return json(created, 201);
  }
  if (path.endsWith(`/conversations/${conversationId}/roles/${moderatorRoleId}`) && method === 'PUT') {
    const payload = request.postDataJSON();
    updatedRoles.push(payload);
    const updated = {
      ...roles.find((role) => role.roleId === moderatorRoleId),
      rolePosition: payload.rolePosition,
      displayName: payload.displayName,
      colorHex: payload.colorHex,
      permissions: payload.permissionCodes,
      isDefault: payload.isDefault,
      updatedAt: '2026-08-29T09:00:00Z',
    };
    roles = roles.map((role) => role.roleId === moderatorRoleId ? updated : role);
    return json(updated);
  }
  if (path.endsWith(`/conversations/${conversationId}/chat-policy`) && method === 'PUT') {
    roomPolicies.push(request.postDataJSON());
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith(`/conversations/${conversationId}/members/${memberId}/chat-policy`) && method === 'PUT') {
    memberPolicies.push(request.postDataJSON());
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith(`/conversations/${conversationId}/members/${memberId}/roles`) && method === 'POST') {
    roleAssignments.push(request.postDataJSON());
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith(`/conversations/${conversationId}/ownership/${memberId}`) && method === 'POST') {
    ownershipTransfers.push(path);
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith(`/invites/conversation/${conversationId}/requests`) && method === 'GET') return json(joinRequests);
  if (path.includes(`/invites/conversation/${conversationId}/requests/`) && path.endsWith('/resolve') && method === 'POST') {
    const requestId = path.split('/').at(-2);
    const payload = request.postDataJSON();
    inviteCommands.push({ type: 'resolve', requestId, payload });
    joinRequests = joinRequests.map(request => request.requestId === requestId
      ? { ...request, status: payload.decision === 'APPROVE' ? 'APPROVED' : 'DECLINED', resolvedBy: ownerId, resolvedAt: now }
      : request);
    return json(joinRequests.find(request => request.requestId === requestId));
  }
  if (path.endsWith(`/invites/conversation/${conversationId}`) && method === 'GET') return json(inviteLinks);
  if (path.endsWith('/invites') && method === 'POST') {
    const payload = request.postDataJSON();
    inviteCommands.push({ type: 'create', payload });
    const invite = {
      ...inviteLinks[0],
      linkId: '70000000-0000-0000-0000-000000000001',
      linkToken: 'created-room-invite',
      inviteKind: payload.inviteKind,
      joinPolicy: payload.joinPolicy,
      displayName: payload.displayName,
      usedCount: 0,
    };
    inviteLinks = [invite, ...inviteLinks];
    return json({ invite, joinUrl: `${baseUrl}/join/${invite.linkToken}` }, 201);
  }
  if (path.includes('/invites/') && method === 'DELETE') {
    const linkToken = path.split('/').at(-1);
    inviteCommands.push({ type: 'revoke', linkToken });
    inviteLinks = inviteLinks.map(link => link.linkToken === linkToken ? { ...link, isActive: false, revokedBy: ownerId, revokedAt: now } : link);
    return route.fulfill({ status: 204 });
  }
  if (path.includes('/messages')) return json({ content: [], interactions: [], polls: [], nextCursor: null, hasNext: false });
  if (path.includes('/friendships/requests')) return json({ content: [], userDetails: [], hasNext: false });
  if (path.includes('/notifications')) return json({ content: [], hasNext: false });
  return json({ content: [], userDetails: [], hasNext: false });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
const loadMoreConversationsButton = page.getByRole('button', { name: 'Tải thêm cuộc trò chuyện' });
await loadMoreConversationsButton.waitFor();
const conversationCursorRequestsBeforeScroll = conversationPageCursors.filter(Boolean).length;
const nextConversationPageResponse = page.waitForResponse((response) => {
  const responseUrl = new URL(response.url());
  return responseUrl.pathname.endsWith('/conversations')
    && responseUrl.searchParams.get('cursor') === 'conversation-cursor-1';
});
await loadMoreConversationsButton.scrollIntoViewIfNeeded();
await nextConversationPageResponse;
await page.getByText('Loaded on demand', { exact: true }).waitFor();
await page.getByText('Product Studio', { exact: true }).first().click();
const conversationInfoButton = page.getByRole('button', { name: 'Mở thông tin cuộc trò chuyện' });
try {
  await conversationInfoButton.click();
} catch (error) {
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/room-management-open-info-failure.png', fullPage: true });
  throw new Error(`Conversation info button unavailable. Visible headings: ${(await page.getByRole('heading').allTextContents()).join(' | ')}. Console: ${JSON.stringify(consoleErrors)}. API: ${JSON.stringify(apiRequests)}`, { cause: error });
}
await page.getByRole('button', { name: 'Tùy chọn cuộc trò chuyện', exact: true }).click();
await page.getByRole('heading', { name: 'Thành viên & vai trò' }).waitFor();
await page.getByRole('button', { name: 'Tải thêm thành viên' }).scrollIntoViewIfNeeded();
await page.getByText('Member 50', { exact: true }).waitFor();
const renderedMemberRows = await page.locator('[data-room-member-id]').count();
const loadedMemberRowsAfterSecondPage = 100;
await page.getByRole('button', { name: 'Tải thêm thành viên' }).scrollIntoViewIfNeeded();
await page.getByText('Linh Tran', { exact: true }).waitFor();
const memberPageRequestsAfterLazyLoad = apiRequests.filter((request) => request === `GET /api/conversations/${conversationId}/members`).length;
await page.getByLabel('Danh sách thành viên').evaluate((scroller, targetMemberId) => {
  const target = scroller.querySelector(`[data-room-member-id="${targetMemberId}"]`);
  if (!(target instanceof HTMLElement)) throw new Error('Target member row is not rendered');
  target.scrollIntoView({ block: 'center' });
}, memberId);

const memberSection = page.locator('details').filter({ hasText: 'Linh Tran' });
await memberSection.locator('summary').click();
await memberSection.getByLabel('Tắt tiếng đến').fill('2026-08-30T12:00');
await memberSection.getByLabel('Thời gian chờ riêng').fill('120');
await memberSection.getByLabel('Lý do kiểm duyệt').fill('Lặp lại nội dung quảng cáo');
await memberSection.getByRole('button', { name: 'Lưu chính sách thành viên' }).click();
await memberSection.getByRole('button', { name: 'Product steward', exact: true }).click();
await memberSection.getByRole('button', { name: 'Chuyển quyền chủ phòng', exact: true }).click();
await page.getByRole('dialog', { name: 'Chuyển quyền sở hữu' }).getByRole('button', { name: 'Chuyển quyền', exact: true }).click();
await page.getByRole('dialog', { name: 'Chuyển quyền sở hữu' }).waitFor({ state: 'detached' });

await page.getByText('Nhật ký phòng', { exact: true }).click();
await page.getByText('Đã cập nhật vai trò', { exact: true }).waitFor();

const chatPolicyLabel = page.getByText('Chính sách chat', { exact: true });
const chatPolicySection = chatPolicyLabel.locator('..').locator('..');
await chatPolicyLabel.click();
await chatPolicySection.getByLabel('Ai có thể gửi tin nhắn').selectOption('READ_ONLY');
await chatPolicySection.getByLabel('Thời gian chờ giữa hai tin nhắn').fill('30');
await chatPolicySection.getByRole('button', { name: 'Lưu chính sách chat' }).click();

const rolesSection = page.locator('details').filter({ hasText: 'Vai trò của phòng' });
await rolesSection.locator('summary').click();
await rolesSection.getByRole('button', { name: 'Tạo vai trò', exact: true }).click();
await rolesSection.getByLabel('Tên vai trò').fill('Reviewer');
await rolesSection.getByLabel('Mã vai trò').fill('REVIEWER');
await rolesSection.getByText('Gửi tin nhắn', { exact: true }).click();
await rolesSection.getByRole('button', { name: 'Tạo vai trò', exact: true }).click();
await rolesSection.getByText('Reviewer', { exact: true }).waitFor();
await rolesSection.getByRole('button', { name: 'Chỉnh sửa vai trò Product steward' }).click();
await rolesSection.getByLabel('Tên vai trò').fill('Product lead');
await rolesSection.getByText('Gửi tin nhắn', { exact: true }).click();
await rolesSection.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
await rolesSection.getByText('Product lead', { exact: true }).waitFor();

const inviteManager = page.locator('section[aria-labelledby="invite-manager-title"]');
await inviteManager.getByRole('heading', { name: 'Đang chờ duyệt · 5' }).waitFor();
if (await inviteManager.locator('p[title^="60000000"]:visible').count() !== 3) throw new Error('Invite requests were not progressively disclosed');
await inviteManager.getByRole('button', { name: 'Xem thêm' }).first().click();
if (await inviteManager.locator('p[title^="60000000"]:visible').count() !== 5) throw new Error('Invite request expansion did not reveal the next items');
await inviteManager.getByRole('button', { name: 'Tạo lời mời', exact: true }).click();
await inviteManager.getByRole('button', { name: 'QR', exact: true }).click();
await inviteManager.getByLabel('Cách tham gia').selectOption('REQUEST_APPROVAL');
await inviteManager.getByRole('button', { name: 'Tạo lời mời 7 ngày' }).click();
await inviteManager.getByText('Lời mời đã sẵn sàng', { exact: true }).waitFor();
const activeInviteDisclosure = inviteManager.locator('details');
await activeInviteDisclosure.locator('summary').click();
await activeInviteDisclosure.getByRole('button', { name: 'Thu hồi lời mời' }).first().click();
await page.getByRole('dialog', { name: 'Thu hồi lời mời?' }).getByRole('button', { name: 'Thu hồi', exact: true }).click();
await page.getByRole('dialog', { name: 'Thu hồi lời mời?' }).waitFor({ state: 'detached' });
await inviteManager.getByRole('button', { name: 'Duyệt yêu cầu' }).first().click();
await inviteManager.getByRole('heading', { name: 'Đang chờ duyệt · 4' }).waitFor();

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await page.getByRole('heading', { name: 'Members & roles' }).waitFor();
await inviteManager.getByRole('heading', { name: 'Invitations & join requests' }).waitFor();
const englishAuditEvent = page.getByText('Role updated', { exact: true });
if (!await englishAuditEvent.isVisible()) await page.getByText('Room audit log', { exact: true }).click();
await englishAuditEvent.waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
const visibleToastCount = await page.locator('[role="status"]:visible').count();
const memberPageRequests = apiRequests.filter((request) => request === `GET /api/conversations/${conversationId}/members`).length;
await mkdir('artifacts', { recursive: true });
await page.screenshot({ path: 'artifacts/room-management.png', fullPage: true });

const report = { baseUrl, createdRoles, updatedRoles, roomPolicies, memberPolicies, roleAssignments, ownershipTransfers, inviteCommands, overflow, visibleToastCount, renderedMemberRows, loadedMemberRowsAfterSecondPage, totalFixtureMembers: directoryMembers.length, memberPageLimits, conversationCursorRequestsBeforeScroll, conversationPageCursors, memberPageRequestsAfterLazyLoad, memberPageRequests, apiRequests, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  createdRoles[0]?.roleCode !== 'REVIEWER'
  || !createdRoles[0]?.permissionCodes?.includes('MESSAGE_SEND')
  || updatedRoles[0]?.displayName !== 'Product lead'
  || updatedRoles[0]?.expectedUpdatedAt !== now
  || !updatedRoles[0]?.permissionCodes?.includes('MESSAGE_SEND')
  || roomPolicies[0]?.chatMode !== 'READ_ONLY'
  || roomPolicies[0]?.slowModeSeconds !== 30
  || memberPolicies[0]?.messageIntervalSeconds !== 120
  || memberPolicies[0]?.reason !== 'Lặp lại nội dung quảng cáo'
  || !memberPolicies[0]?.mutedUntil
  || roleAssignments[0]?.roleIds?.[0] !== moderatorRoleId
  || ownershipTransfers.length !== 1
  || inviteCommands.filter((command) => command.type === 'create').length !== 1
  || inviteCommands.filter((command) => command.type === 'revoke').length !== 1
  || inviteCommands.filter((command) => command.type === 'resolve').length !== 1
  || overflow
  || visibleToastCount > 1
  || renderedMemberRows >= loadedMemberRowsAfterSecondPage
  || memberPageLimits.some((limit) => limit !== '50')
  || conversationCursorRequestsBeforeScroll !== 0
  || conversationPageCursors.filter((cursor) => cursor === 'conversation-cursor-1').length !== 1
  || memberPageRequestsAfterLazyLoad !== 3
  || consoleErrors.length
  || requestFailures.length
) process.exitCode = 1;
