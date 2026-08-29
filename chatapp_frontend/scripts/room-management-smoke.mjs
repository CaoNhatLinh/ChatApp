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
];

let roles = [...baseRoles];
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
  if (request.url().startsWith(apiBaseUrl)) apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
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
    return json([{ conversation, pinned: false, unreadCount: 0, joinedAt: now, notificationOverride: 'INHERIT', lastMessage: null }]);
  }
  if (path.endsWith(`/conversations/${conversationId}/notification-policy`)) {
    return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  }
  if (path.endsWith(`/conversations/${conversationId}/members`) && method === 'GET') {
    const afterUserId = new URL(request.url()).searchParams.get('afterUserId');
    return afterUserId
      ? json({ content: [members[1]], nextCursor: null, hasNext: false })
      : json({ content: [members[0]], nextCursor: ownerId, hasNext: true });
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
  if (path.endsWith(`/invites/conversation/${conversationId}`)) return json([]);
  if (path.endsWith(`/invites/conversation/${conversationId}/requests`)) return json([]);
  if (path.includes('/messages/')) return json({ content: [], nextCursor: null, hasNext: false });
  if (path.includes('/friendships/requests')) return json({ content: [], userDetails: [], hasNext: false });
  if (path.includes('/notifications')) return json({ content: [], hasNext: false });
  return json({ content: [], userDetails: [], hasNext: false });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
await page.getByText('Product Studio', { exact: true }).first().click();
await page.getByRole('button', { name: 'Mở thông tin cuộc trò chuyện' }).click();
await page.getByRole('heading', { name: 'Thành viên & vai trò' }).waitFor();
await page.getByRole('button', { name: 'Tải thêm thành viên' }).click();
await page.getByText('Linh Tran', { exact: true }).waitFor();

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

const memberSection = page.locator('details').filter({ hasText: 'Linh Tran' });
await memberSection.locator('summary').click();
await memberSection.getByLabel('Tắt tiếng đến').fill('2026-08-30T12:00');
await memberSection.getByLabel('Thời gian chờ riêng').fill('120');
await memberSection.getByLabel('Lý do kiểm duyệt').fill('Lặp lại nội dung quảng cáo');
await memberSection.getByRole('button', { name: 'Lưu chính sách thành viên' }).click();
await memberSection.getByRole('button', { name: 'Product lead', exact: true }).click();
await memberSection.getByRole('button', { name: 'Chuyển quyền chủ phòng', exact: true }).click();
await page.getByRole('dialog', { name: 'Chuyển quyền sở hữu' }).getByRole('button', { name: 'Chuyển quyền', exact: true }).click();
await page.getByRole('dialog', { name: 'Chuyển quyền sở hữu' }).waitFor({ state: 'detached' });

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await page.getByRole('heading', { name: 'Members & roles' }).waitFor();
await page.getByText('Room audit log', { exact: true }).click();
await page.getByText('Role updated', { exact: true }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
await mkdir('artifacts', { recursive: true });
await page.screenshot({ path: 'artifacts/room-management.png', fullPage: true });

const report = { baseUrl, createdRoles, updatedRoles, roomPolicies, memberPolicies, roleAssignments, ownershipTransfers, overflow, apiRequests, consoleErrors, requestFailures };
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
  || overflow
  || consoleErrors.length
  || requestFailures.length
) process.exitCode = 1;
