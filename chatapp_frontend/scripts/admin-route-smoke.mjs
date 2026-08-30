import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const now = '2026-08-30T08:00:00Z';
const operatorId = '00000000-0000-0000-0000-000000000010';
const targetUserId = '00000000-0000-0000-0000-000000000011';
const roomId = '00000000-0000-0000-0000-000000000012';
const reportId = '00000000-0000-0000-0000-000000000013';
const operator = {
  userId: operatorId,
  username: 'operator',
  email: 'operator@example.com',
  displayName: 'Operator',
  accountStatus: 'ACTIVE',
};
const targetUser = {
  userId: targetUserId,
  username: 'linh',
  displayName: 'Linh Tran',
  accountStatus: 'ACTIVE',
  createdAt: now,
};
const permissions = [
  'ROOM_READ', 'ROOM_MODERATE', 'AUDIT_READ', 'REPORT_MANAGE', 'USER_READ',
  'USER_SUSPEND', 'USER_RESTORE', 'APP_ROLE_MANAGE', 'SESSION_REVOKE', 'ANALYTICS_READ',
];
let room = {
  conversationId: roomId,
  conversationType: 'CHANNEL',
  visibility: 'COMMUNITY',
  joinPolicy: 'REQUEST_APPROVAL',
  name: 'Safety Community',
  description: 'A room managed by global operators.',
  ownerId: targetUserId,
  memberCount: 2,
  chatMode: 'OPEN',
  slowModeSeconds: 0,
  deleted: false,
  createdAt: now,
  updatedAt: now,
  members: [
    { userId: targetUserId, joinedAt: now, mutedUntil: null, messageIntervalSeconds: null },
    { userId: operatorId, joinedAt: now, mutedUntil: null, messageIntervalSeconds: null },
  ],
};
let roles = [];
let sanctions = [];
let reports = [{
  reportId,
  createdAtKey: now,
  reportDay: '2026-08-30',
  status: 'OPEN',
  reporterId: operatorId,
  targetType: 'USER',
  targetUserId,
  conversationId: roomId,
  messageBucket: null,
  messageId: null,
  reasonCode: 'SPAM',
  description: 'Repeated unsolicited links.',
  assignedTo: null,
  resolvedAt: null,
  resolutionCode: null,
}];

const roomPolicyRequests = [];
const roomArchiveRequests = [];
const roomRestoreRequests = [];
const userStatusRequests = [];
const roleGrantRequests = [];
const sessionRevocations = [];
const deviceRevocations = [];
const reportResolutionRequests = [];
const sanctionRequests = [];
const sanctionRevocations = [];
const apiRequests = [];
const consoleErrors = [];
const requestFailures = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12_000);
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
    apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  }
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const method = request.method();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  if (path.endsWith('/auth/refresh')) return json({ accessToken: token, user: operator });
  if (path.endsWith('/auth/me')) return json(operator);
  if (path.endsWith('/admin/overview')) return json({
    actorId: operatorId,
    roles: ['APP_ADMIN'],
    permissions,
    availableRoleCodes: ['APP_ADMIN', 'TRUST_SAFETY', 'SUPPORT', 'ANALYST', 'AUDITOR'],
  });
  if (path.endsWith('/health')) return json({
    status: 'UP',
    service: 'chat-service',
    runtimeMode: 'cassandra-native',
    cassandra: 'UP',
    timestamp: now,
  });
  if (path.endsWith('/users/search') && method === 'GET') {
    return json({ content: [targetUser], nextCursor: null, hasNext: false });
  }
  if (path.endsWith(`/admin/users/${targetUserId}/app-roles`) && method === 'GET') return json(roles);
  if (path.endsWith(`/admin/users/${targetUserId}/app-roles`) && method === 'POST') {
    const payload = request.postDataJSON();
    roleGrantRequests.push(payload);
    roles = [...roles, {
      userId: targetUserId,
      roleCode: payload.roleCode,
      grantId: '00000000-0000-0000-0000-000000000014',
      grantedBy: operatorId,
      grantedAt: now,
      expiresAt: payload.expiresAt ?? null,
    }];
    return json(roles.at(-1), 201);
  }
  if (path.endsWith(`/admin/users/${targetUserId}/status`) && method === 'PUT') {
    userStatusRequests.push(request.postDataJSON());
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith(`/admin/users/${targetUserId}/sessions`) && method === 'GET') return json([
    {
      tokenId: 'refresh-token-001',
      issuedAt: now,
      deviceId: 'device-laptop',
      expiresAt: '2026-09-30T08:00:00Z',
      revokedAt: null,
      replacedByTokenId: null,
    },
    {
      tokenId: 'standalone-refresh-token-002',
      issuedAt: now,
      deviceId: null,
      expiresAt: '2026-09-30T08:00:00Z',
      revokedAt: null,
      replacedByTokenId: null,
    },
  ]);
  if (path.endsWith(`/admin/users/${targetUserId}/sessions/refresh-token-001`) && method === 'DELETE') {
    sessionRevocations.push(url.searchParams.get('reason'));
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith(`/admin/users/${targetUserId}/sessions/standalone-refresh-token-002`) && method === 'DELETE') {
    sessionRevocations.push(url.searchParams.get('reason'));
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith(`/admin/users/${targetUserId}/devices`) && method === 'GET') return json([{
    deviceId: 'device-laptop',
    platform: 'WINDOWS',
    pushProvider: null,
    deviceName: 'Chrome laptop',
    appVersion: '1.0.0',
    active: true,
    createdAt: now,
    lastSeenAt: now,
  }]);
  if (path.endsWith(`/admin/users/${targetUserId}/devices/device-laptop`) && method === 'DELETE') {
    deviceRevocations.push(url.searchParams.get('reason'));
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith(`/admin/users/${targetUserId}/sanctions`) && method === 'GET') return json(sanctions);
  if (path.endsWith('/admin/conversations') && method === 'GET') return json([room]);
  if (path.endsWith(`/admin/conversations/${roomId}`) && method === 'GET') return json(room);
  if (path.endsWith(`/admin/conversations/${roomId}/chat-policy`) && method === 'PUT') {
    const payload = request.postDataJSON();
    roomPolicyRequests.push(payload);
    room = { ...room, chatMode: payload.chatMode, slowModeSeconds: payload.slowModeSeconds, updatedAt: '2026-08-30T09:00:00Z' };
    return json(room);
  }
  if (path.endsWith(`/admin/conversations/${roomId}`) && method === 'DELETE') {
    roomArchiveRequests.push(url.searchParams.get('reason'));
    room = { ...room, deleted: true, updatedAt: '2026-08-30T10:00:00Z' };
    return json(room);
  }
  if (path.endsWith(`/admin/conversations/${roomId}/restore`) && method === 'POST') {
    roomRestoreRequests.push(url.searchParams.get('reason'));
    room = { ...room, deleted: false, updatedAt: '2026-08-30T10:30:00Z' };
    return json(room);
  }
  if (path.endsWith('/admin/audit/export')) {
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/csv; charset=UTF-8' }, body: 'eventMonth,eventId,action\n' });
  }
  if (path.endsWith('/admin/audit')) return json([]);
  if (path.endsWith('/admin/analytics')) return json([]);
  if (path.endsWith('/admin/reports') && method === 'GET') {
    return json(reports.filter((report) => report.status === url.searchParams.get('status')));
  }
  if (path.endsWith(`/admin/reports/${reportId}`) && method === 'PUT') {
    const payload = request.postDataJSON();
    reportResolutionRequests.push(payload);
    reports = reports.map((report) => report.reportId === reportId ? { ...report, status: payload.nextStatus } : report);
    return json(reports[0]);
  }
  if (path.endsWith('/admin/sanctions') && method === 'POST') {
    const payload = request.postDataJSON();
    sanctionRequests.push(payload);
    sanctions = [{
      userId: payload.userId,
      imposedAt: now,
      sanctionId: '00000000-0000-0000-0000-000000000015',
      scope: payload.scope,
      conversationId: payload.conversationId ?? null,
      sanctionType: payload.sanctionType,
      startsAt: now,
      expiresAt: payload.expiresAt ?? null,
      imposedBy: operatorId,
      reasonCode: payload.reasonCode ?? null,
      reasonText: payload.reasonText,
      status: 'ACTIVE',
      revokedBy: null,
      revokedAt: null,
    }];
    return json(sanctions[0], 201);
  }
  if (path.endsWith(`/admin/users/${targetUserId}/sanctions/00000000-0000-0000-0000-000000000015`) && method === 'DELETE') {
    sanctionRevocations.push(url.searchParams.get('reason'));
    sanctions = sanctions.map((sanction) => ({ ...sanction, status: 'REVOKED', revokedAt: now, revokedBy: operatorId }));
    return json(sanctions[0]);
  }
  if (path.endsWith('/devices') && method === 'POST') return json({ deviceId: 'device-admin-smoke' });
  return json({});
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await page.goto(`${baseUrl}/admin`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Điều hành toàn ứng dụng' }).waitFor();
await page.getByText('Safety Community', { exact: true }).waitFor();

await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
await page.getByRole('heading', { name: 'Global operations', exact: true }).waitFor();

const roomPanel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Manage all rooms' }) });
await roomPanel.getByRole('button', { name: /Safety Community/ }).click();
await roomPanel.getByText(roomId, { exact: true }).waitFor();
await roomPanel.getByLabel('Global chat policy').selectOption('READ_ONLY');
await roomPanel.getByLabel('Slow mode (seconds)').fill('45');
await roomPanel.getByLabel('Audit reason').fill('Emergency spam containment');
await roomPanel.getByRole('button', { name: 'Save policy' }).click();
await page.getByText('Global room policy updated.', { exact: true }).waitFor();
await roomPanel.getByLabel('Audit reason').fill('Archive confirmed abusive room');
await roomPanel.getByRole('button', { name: 'Archive room' }).click();
const archiveDialog = page.getByRole('dialog', { name: 'Archive room' });
await archiveDialog.getByRole('button', { name: 'Archive', exact: true }).click();
await roomPanel.getByText('Archived', { exact: true }).first().waitFor();
await roomPanel.getByLabel('Audit reason').fill('False positive cleared after review');
await roomPanel.getByRole('button', { name: 'Restore' }).click();
const restoreDialog = page.getByRole('dialog', { name: 'Restore room' });
await restoreDialog.getByRole('button', { name: 'Restore', exact: true }).click();
await roomPanel.getByText('Active', { exact: true }).waitFor();

const reportPanel = page.locator('details').filter({ hasText: 'Reports & sanctions' });
await reportPanel.getByText('Repeated unsolicited links.', { exact: true }).waitFor();
await reportPanel.getByRole('button', { name: 'Select target user' }).click();
await reportPanel.getByLabel('Reason code').fill('CONFIRMED_SPAM');
await reportPanel.getByLabel('Detailed reason (required)').fill('Evidence reviewed by trust and safety.');
await reportPanel.getByRole('button', { name: 'Resolve' }).click();
const resolveDialog = page.getByRole('dialog', { name: 'Confirm report update' });
await resolveDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
await reportPanel.getByText('No reports match the current filter.', { exact: true }).waitFor();

await reportPanel.getByLabel('Detailed reason (required)').fill('Apply account warning after confirmed spam.');
await reportPanel.getByLabel('Reason code').fill('CONFIRMED_SPAM');
await reportPanel.getByLabel('Sanction type').selectOption('WARNING');
await reportPanel.getByRole('button', { name: 'Apply sanction' }).click();
await reportPanel.getByText(/Warning · Active/).waitFor();
await reportPanel.getByLabel('Detailed reason (required)').fill('Warning reviewed and withdrawn.');
await reportPanel.getByRole('button', { name: 'Revoke', exact: true }).click();
const sanctionDialog = page.getByRole('dialog', { name: 'Revoke sanction' });
await sanctionDialog.getByRole('button', { name: 'Revoke', exact: true }).click();
await reportPanel.getByText(/Warning · Revoked/).waitFor();

const userSearchPanel = page.locator('details').filter({ hasText: 'Find a user' });
await userSearchPanel.getByLabel('Search admin users').fill('linh');
await userSearchPanel.getByRole('button', { name: 'Search', exact: true }).click();
await userSearchPanel.getByRole('button', { name: /Linh Tran/ }).click();
const userPanel = page.locator('details').filter({ hasText: 'Manage roles · @linh' });
await userPanel.getByText('Chrome laptop', { exact: true }).waitFor();
await userPanel.getByLabel('Role').selectOption('SUPPORT');
await userPanel.getByLabel('Reason (required)').fill('Community support assignment');
await userPanel.getByRole('button', { name: 'Grant role' }).click();
await userPanel.getByText('SUPPORT', { exact: true }).waitFor();
await userPanel.getByLabel('Account status').selectOption('SUSPENDED');
await userPanel.getByLabel('Reason (required)').fill('Security review in progress');
await userPanel.getByRole('button', { name: 'Update status' }).click();
const statusDialog = page.getByRole('dialog', { name: 'Change account status' });
await statusDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
await page.getByText('Account status updated to Suspended.', { exact: true }).waitFor();
await userPanel.getByLabel('Reason (required)').fill('End compromised refresh chain');
await userPanel.getByRole('button', { name: 'Revoke session: standalone-r…' }).click();
const sessionDialog = page.getByRole('dialog', { name: 'Revoke session' });
await sessionDialog.getByRole('button', { name: 'Revoke', exact: true }).click();
await page.getByText('Session revoked.', { exact: true }).waitFor();
await userPanel.getByLabel('Reason (required)').fill('Compromised browser session');
await userPanel.getByRole('button', { name: 'Revoke device: Chrome laptop' }).click();
const deviceDialog = page.getByRole('dialog', { name: 'Revoke device' });
await deviceDialog.getByRole('button', { name: 'Revoke', exact: true }).click();
await userPanel.getByText(/Revoked/).first().waitFor();

await page.locator('summary').filter({ hasText: 'Global audit timeline' }).click();
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Export audit CSV/ }).click(),
]);

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(250);
const quality = await page.evaluate(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  unnamedControls: Array.from(document.querySelectorAll('button, a[href]')).filter((element) => {
    const name = element.getAttribute('aria-label') || element.textContent?.trim() || element.getAttribute('title');
    return !name;
  }).length,
  unlabeledFields: Array.from(document.querySelectorAll('input, select, textarea')).filter((element) => (
    !element.getAttribute('aria-label')
      && !element.getAttribute('aria-labelledby')
      && !element.closest('label')
      && !(element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`))
  )).length,
}));
await mkdir('artifacts', { recursive: true });
await page.screenshot({ path: 'artifacts/admin-operations.png', fullPage: true });

const report = {
  baseUrl,
  exportedFilename: download.suggestedFilename(),
  roomPolicyRequests,
  roomArchiveRequests,
  roomRestoreRequests,
  reportResolutionRequests,
  sanctionRequests,
  sanctionRevocations,
  roleGrantRequests,
  userStatusRequests,
  sessionRevocations,
  deviceRevocations,
  quality,
  apiRequests,
  consoleErrors,
  requestFailures,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  roomPolicyRequests[0]?.chatMode !== 'READ_ONLY'
  || roomPolicyRequests[0]?.slowModeSeconds !== 45
  || roomPolicyRequests[0]?.reason !== 'Emergency spam containment'
  || roomArchiveRequests[0] !== 'Archive confirmed abusive room'
  || roomRestoreRequests[0] !== 'False positive cleared after review'
  || reportResolutionRequests[0]?.nextStatus !== 'RESOLVED'
  || reportResolutionRequests[0]?.resolutionCode !== 'CONFIRMED_SPAM'
  || sanctionRequests[0]?.sanctionType !== 'WARNING'
  || sanctionRequests[0]?.userId !== targetUserId
  || sanctionRevocations[0] !== 'Warning reviewed and withdrawn.'
  || roleGrantRequests[0]?.roleCode !== 'SUPPORT'
  || roleGrantRequests[0]?.reason !== 'Community support assignment'
  || userStatusRequests[0]?.accountStatus !== 'SUSPENDED'
  || userStatusRequests[0]?.reason !== 'Security review in progress'
  || sessionRevocations[0] !== 'End compromised refresh chain'
  || deviceRevocations[0] !== 'Compromised browser session'
  || quality.horizontalOverflow
  || quality.unnamedControls
  || quality.unlabeledFields
  || consoleErrors.length
  || requestFailures.length
  || !/^novachat-audit-\d{4}-\d{2}\.csv$/.test(report.exportedFilename)
) process.exitCode = 1;
