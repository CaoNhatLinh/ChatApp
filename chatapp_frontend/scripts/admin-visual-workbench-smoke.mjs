import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { resolve } from 'node:path';

// Synthetic fixtures only. These checks do not establish live API/database acceptance.
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3117';
const api = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const actor = { userId: '00000000-0000-0000-0000-000000000010', username: 'operator', displayName: 'Operator', accountStatus: 'ACTIVE' };
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const template = { conversationType: 'CHANNEL', visibility: 'COMMUNITY', joinPolicy: 'OPEN', ownerId: actor.userId, memberCount: 21, chatMode: 'OPEN', slowModeSeconds: 0, deleted: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', members: [{ userId: actor.userId }] };
const rooms = [
  { ...template, conversationId: '00000000-0000-0000-0000-000000000001', name: 'Đà Nẵng hôm nay', avatarUrl: `${base}/noi-default-avatar.webp`, description: 'Hẹn nhau một ly cà phê và chia sẻ những góc phố mình thích.' },
  { ...template, conversationId: '00000000-0000-0000-0000-000000000002', name: 'Chuyện của những người thích chụp ảnh và đi bộ cuối tuần', avatarUrl: `${base}/admin-room-image-broken.png`, memberCount: 1 },
  { ...template, conversationId: '00000000-0000-0000-0000-000000000003', name: 'Góc cũ', deleted: true },
];
const points = Array.from({ length: 12 }, (_, index) => ({ eventId: String(index), eventDay: new Date(Date.now() - (index < 3 ? 2 : index < 7 ? 1 : 0) * 86400000).toISOString().slice(0, 10), eventType: index % 2 ? 'MESSAGE_SENT' : 'ROOM_JOINED' }));
const report = { reportId: 'fixture-report', createdAtKey: '2026-10-01T00:00:00Z', reportDay: '2026-10-01', status: 'OPEN', targetType: 'USER', targetUserId: actor.userId, reporterId: actor.userId, reasonCode: 'SPAM', description: 'Gửi cùng một đường link liên tục trong cộng đồng.' };
const people = [
  { userId: '00000000-0000-0000-0000-000000000021', username: 'an', displayName: 'An', avatarUrl: '/noi-default-avatar.webp', accountStatus: 'ACTIVE' },
  { userId: '00000000-0000-0000-0000-000000000022', username: 'minh', displayName: 'Minh', avatarUrl: `${base}/admin-fixture-avatar-invalid.png`, accountStatus: 'ACTIVE' },
];
const errors = [], consoleErrors = [], expectedHttpErrors = [], warnings = [], failures = [], checks = [], captures = [];
const permissions = ['ROOM_READ', 'ROOM_MODERATE', 'REPORT_MANAGE', 'USER_READ', 'AUDIT_READ', 'ANALYTICS_READ', 'SYSTEM_OPERATE'];
let roomFailure = false, analyticsFailure = false, failDetail = false, heldId;
let auditFailure = false, auditExportFailure = false;
const auditMonth = '2026-09';
const auditExports = [];
let releaseDetail;
let heldDetail;
let recoverRoomImage = false, brokenImageReads = 0;
const browser = await chromium.launch({ headless: true });
await mkdir('artifacts/ui-audit/current', { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
await context.route('**/admin-fixture-avatar-invalid.png', route => route.fulfill({ contentType: 'image/png', body: 'invalid-image-fixture' }));
await context.route('**/admin-room-image-broken.png', route => {
  brokenImageReads++;
  return recoverRoomImage ? route.fulfill({ path: resolve('public/noi-default-avatar.webp'), contentType: 'image/webp' })
    : route.fulfill({ contentType: 'image/png', body: 'invalid-room-image-fixture' });
});
page.setDefaultTimeout(12000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') (message.text().includes('500') ? expectedHttpErrors : consoleErrors).push(message.text());
  if (message.type() === 'warning') warnings.push(message.text());
});
page.on('requestfailed', request => failures.push(request.url()));
await context.route(`${api}/**`, async route => {
  const { pathname: path, searchParams } = new URL(route.request().url());
  const json = body => route.fulfill({ json: body });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(actor);
  if (path.endsWith('/devices')) {
    const payload = route.request().postDataJSON();
    return json({ deviceId: payload.deviceId, platform: 'WEB', pushProvider: 'WEB_PUSH', deviceName: null, appVersion: null, active: true, createdAt: '2026-10-23T00:00:00Z', lastSeenAt: '2026-10-23T00:00:00Z' });
  }
  if (path.endsWith('/admin/overview')) return json({ actorId: actor.userId, roles: ['APP_ADMIN'], permissions, availableRoleCodes: [] });
  if (path.endsWith('/health')) return json({ status: 'UP', cassandra: 'UP', timestamp: '2026-10-23T08:00:00Z' });
  if (path.endsWith('/admin/conversations')) return roomFailure ? route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } }) : json(rooms);
  if (path.includes('/admin/conversations/')) {
    const id = path.split('/').at(-1);
    if (id === heldId) await heldDetail;
    if (failDetail) return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
    return json(rooms.find(room => room.conversationId === id));
  }
  if (path.endsWith('/admin/reports')) {
    const status = new URL(route.request().url()).searchParams.get('status');
    return json([status === 'RESOLVED' ? { ...report, status } : report]);
  }
  if (path.endsWith('/users/search')) return json({ content: people, hasNext: false });
  if (path.endsWith('/admin/audit/export')) {
    if (auditExportFailure) return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
    auditExports.push(searchParams.get('month'));
    return route.fulfill({ contentType: 'text/csv', body: 'eventMonth,eventId,action\n' });
  }
  if (path.endsWith('/admin/audit')) {
    if (searchParams.get('month') !== auditMonth) return json([]);
    if (auditFailure) return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
    return json(['SUCCESS', 'FAILED', 'UNRECOGNIZED'].map((outcome, index) => ({
      eventMonth: auditMonth, eventId: `00000000-0000-4000-8000-00000000000${index}`,
      action: ['MEMBER_BAN', 'MEMBER_UNBAN', 'FUTURE_ACTION'][index], resourceType: 'conversation',
      resourceId: rooms[0].conversationId, actorId: actor.userId, outcome,
      createdAt: index === 2 ? 'invalid' : '2026-09-03T00:00:00Z',
    })));
  }
  if (path.endsWith('/admin/analytics')) return analyticsFailure ? route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } }) : json(points);
  return json({ content: [], hasNext: false });
});
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
const navigate = async (value, label) => {
  if (page.viewportSize().width < 768) await page.getByRole('combobox', { name: 'Khu vực quản trị', exact: true }).selectOption(value);
  else await page.locator('.admin-workspace-nav').getByRole('button', { name: label, exact: true }).click();
};
const capture = async name => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const path = `artifacts/ui-audit/current/admin-visual-${name}.png`;
  await page.screenshot({ path, fullPage: true, animations: 'disabled' }); captures.push(path);
};
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
try {
  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Tổng quan', exact: true, level: 1 }).waitFor();
  await page.getByRole('region', { name: 'Phòng đã tải', exact: true }).getByRole('button', { name: /Đà Nẵng/ }).waitFor();
  assert.equal(await page.locator('.admin-overview-actions').count(), 0);
  checks.push('overview shows actual loaded rooms/reports, not duplicate menu tiles');
  await page.getByRole('button', { name: 'Xem báo cáo', exact: true }).press('Enter');
  await page.waitForFunction(() => document.activeElement?.matches('.admin-pagebar[data-workspace="safety"] h1'));
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('RESOLVED');
  await navigate('overview', 'Tổng quan');
  await page.getByText('1 · Đã giải quyết', { exact: true }).waitFor();
  await navigate('safety', 'Báo cáo');
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('OPEN');
  await navigate('overview', 'Tổng quan');
  checks.push('overview shortcut moves keyboard focus and summary follows the loaded report filter');
  const overviewReports = page.getByRole('region', { name: 'Báo cáo đã tải', exact: true });
  const reportShortcut = overviewReports.getByRole('button', { name: /Spam hoặc lừa đảo/ });
  await reportShortcut.press('Enter');
  await page.locator('.admin-report-detail').getByRole('heading', { name: 'Spam hoặc lừa đảo', exact: true }).waitFor();
  await navigate('overview', 'Tổng quan');
  await page.setViewportSize({ width: 320, height: 1000 });
  await reportShortcut.click();
  await page.locator('.admin-report-detail').getByRole('button', { name: 'Danh sách báo cáo', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Tìm trong báo cáo đã tải', exact: true }).waitFor();
  await navigate('overview', 'Tổng quan'); await reportShortcut.click();
  await page.locator('.admin-report-detail').getByRole('heading', { name: 'Spam hoặc lừa đảo', exact: true }).waitFor();
  checks.push('localized overview report opens exact detail by keyboard/touch, including reopening after mobile Back');
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForFunction(theme => document.documentElement.getAttribute('data-theme') === (theme === 'dark' ? 'dark' : null), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await navigate('overview', 'Tổng quan'); await noOverflow();
      assert.ok(await page.locator('.admin-room-gallery .admin-room-portrait').first().evaluate(element => element.getBoundingClientRect().width) >= 100, 'overview imagery is large enough to recognize');
      if (width === 320 || width === 1440) await capture(`overview-${theme}-${width}`);
      await navigate('rooms', 'Phòng');
      const roomArtwork = page.locator('.admin-pagebar[data-workspace="rooms"] .admin-workspace-art');
      assert.equal(await roomArtwork.isVisible(), true);
      assert.equal(await roomArtwork.getAttribute('aria-hidden'), 'true');
      const directory = page.getByRole('region', { name: 'Quản lý toàn bộ phòng', exact: true });
      if (width < 1024 && await directory.getByRole('button', { name: 'Danh sách phòng', exact: true }).isVisible()) await directory.getByRole('button', { name: 'Danh sách phòng', exact: true }).click();
      assert.equal(await directory.getByLabel('Tháng tạo phòng (UTC)', { exact: true }).evaluate(element => getComputedStyle(element).colorScheme), theme);
      await directory.getByRole('searchbox').fill('da nang');
      assert.equal(await directory.locator('.admin-room-entry').count(), 1);
      await directory.getByRole('searchbox').fill('');
      await directory.getByRole('button', { name: 'Lưu trữ', exact: true }).click();
      assert.equal(await directory.locator('.admin-room-entry').count(), 1);
      await directory.getByRole('button', { name: 'Tất cả', exact: true }).click();
      assert.equal(await directory.locator('.admin-room-entry').count(), 3);
      await noOverflow(); await capture(`rooms-${theme}-${width}`);
      await directory.getByRole('button', { name: /Đà Nẵng hôm nay/ }).click();
      await directory.getByRole('heading', { name: 'Đà Nẵng hôm nay', exact: true }).waitFor();
      assert.equal(await directory.getByLabel('Lý do kiểm toán', { exact: true }).isVisible(), false);
      assert.equal(await directory.locator('.admin-directory-list').isVisible(), width >= 1024);
      assert.equal(await directory.getByRole('heading', { name: 'Đà Nẵng hôm nay' }).evaluate(element => element === document.activeElement), true);
      await noOverflow(); await capture(`detail-${theme}-${width}`);
      const pictureButton = directory.getByRole('button', { name: 'Xem ảnh phòng', exact: true });
      await pictureButton.press('Enter');
      const imageDialog = page.getByRole('dialog', { name: 'Ảnh phòng', exact: true });
      await imageDialog.getByRole('img', { name: 'Ảnh đại diện phòng', exact: true }).waitFor();
      await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="dialog"] img')).some(image => image.naturalWidth > 0 && getComputedStyle(image).visibility === 'visible'));
      await imageDialog.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined))));
      const imageBox = await imageDialog.boundingBox();
      assert.ok(imageBox.x >= 0 && imageBox.y >= 0 && imageBox.x + imageBox.width <= width && imageBox.y + imageBox.height <= 1000, JSON.stringify({ theme, width, imageBox }));
      await capture(`room-image-${theme}-${width}`);
      await page.keyboard.press('Escape'); await imageDialog.waitFor({ state: 'hidden' });
      assert.equal(await pictureButton.evaluate(element => element === document.activeElement), true);
      if (width < 1024) {
        await directory.getByRole('button', { name: 'Danh sách phòng', exact: true }).click();
        await directory.getByRole('searchbox').waitFor();
        await page.waitForFunction(() => document.activeElement?.getAttribute('type') === 'search');
      }
      checks.push(`${theme}/${width}: accent-free search, archive filter, overflow, disclosure, focus, mobile list/detail`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await navigate('rooms', 'Phòng');
  const directory = page.getByRole('region', { name: 'Quản lý toàn bộ phòng', exact: true });
  heldId = rooms[0].conversationId; heldDetail = new Promise(resolve => { releaseDetail = resolve; });
  await directory.getByRole('button', { name: /Đà Nẵng hôm nay/ }).click();
  await directory.getByRole('status', { name: 'Đang mở phòng' }).waitFor();
  await directory.getByRole('button', { name: /Chuyện của những người/ }).click();
  await directory.getByRole('heading', { name: rooms[1].name, exact: true }).waitFor();
  const staleResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(rooms[0].conversationId));
  releaseDetail(); heldId = undefined;
  await staleResponse;
  assert.equal(await directory.getByRole('heading', { name: rooms[1].name, exact: true }).isVisible(), true);
  checks.push('late detail cannot replace the newer selection');
  failDetail = true;
  await directory.getByRole('button', { name: /Đà Nẵng hôm nay/ }).click();
  await directory.getByRole('alert').waitFor();
  assert.equal(await directory.locator('.admin-directory-detail h3').count(), 0);
  failDetail = false;
  await directory.getByRole('button', { name: /Đà Nẵng hôm nay/ }).click();
  await directory.getByRole('heading', { name: rooms[0].name, exact: true }).waitFor();
  checks.push('failed detail clears the previous room; explicit selection retries');
  await page.setViewportSize({ width: 320, height: 1000 });
  await directory.locator('summary').filter({ hasText: 'Điều chỉnh phòng' }).click();
  await directory.getByLabel('Lý do kiểm toán', { exact: true }).fill('Giữ bản nháp khi quay lại');
  await directory.getByRole('button', { name: 'Xem ảnh phòng', exact: true }).click();
  await page.getByRole('dialog', { name: 'Ảnh phòng', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await directory.getByLabel('Lý do kiểm toán', { exact: true }).inputValue(), 'Giữ bản nháp khi quay lại');
  await directory.getByRole('button', { name: 'Danh sách phòng', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Bỏ thay đổi của phòng?', exact: true });
  await discard.waitFor(); await page.keyboard.press('Escape'); await discard.waitFor({ state: 'hidden' });
  assert.equal(await directory.getByLabel('Lý do kiểm toán', { exact: true }).inputValue(), 'Giữ bản nháp khi quay lại');
  await directory.getByRole('button', { name: 'Danh sách phòng', exact: true }).click();
  await discard.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  await directory.getByRole('searchbox').waitFor();
  checks.push('mobile Back protects a dirty room draft; Escape keeps it, explicit discard returns to search');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await directory.getByRole('button', { name: /Chuyện của những người/ }).click();
  await directory.getByRole('heading', { name: rooms[1].name, exact: true }).waitFor();
  await directory.getByRole('button', { name: 'Xem ảnh phòng', exact: true }).click();
  const failedPicture = page.getByRole('dialog', { name: 'Ảnh phòng', exact: true });
  await failedPicture.getByRole('alert').waitFor();
  const attempts = brokenImageReads;
  recoverRoomImage = true;
  await failedPicture.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="dialog"] img')).some(image => image.naturalWidth > 0 && getComputedStyle(image).visibility === 'visible'));
  assert.ok(brokenImageReads > attempts);
  await page.keyboard.press('Escape');
  rooms[1].avatarUrl = `${base}/noi-default-avatar.webp?revision=2`;
  await directory.getByRole('button', { name: /Chuyện của những người/ }).click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.admin-room-entry img')).some(image => image.src.endsWith('?revision=2') && image.getAttribute('data-loaded') === 'true'));
  checks.push('room images: all widths/themes, keyboard viewer/focus, corrupt-image retry, changed URL resets failure, draft preserved');
  await navigate('insights', 'Nhật ký');
  const auditPanel = page.locator('details').filter({
    has: page.getByRole('heading', { name: 'Nhật ký kiểm toán toàn ứng dụng', exact: true }),
  });
  await auditPanel.getByRole('heading').click();
  const emptyAudit = auditPanel.getByRole('status').filter({ hasText: 'Chưa có sự kiện kiểm toán trong tháng này.' });
  await auditPanel.getByLabel('Tháng kiểm toán (UTC)', { exact: true }).fill('2026-08');
  await emptyAudit.locator('svg[aria-hidden="true"]').waitFor();
  await capture('audit-empty');

  auditFailure = true;
  await auditPanel.getByLabel('Tháng kiểm toán (UTC)', { exact: true }).fill(auditMonth);
  await auditPanel.getByRole('alert').waitFor();
  auditFailure = false;
  await auditPanel.getByRole('button', { name: 'Thử lại', exact: true }).press('Enter');
  const ban = auditPanel.getByRole('listitem').filter({ hasText: /Cấm thành viên/ });
  await ban.locator('summary').press('Enter');
  await ban.getByText(`Người thao tác: ${actor.userId}`, { exact: true }).waitFor();
  await ban.getByText('Thành công', { exact: true }).waitFor({ state: 'attached' });
  await auditPanel.getByText('Thất bại', { exact: true }).waitFor({ state: 'attached' });
  const unknownEvent = auditPanel.getByRole('listitem').filter({ hasText: 'FUTURE_ACTION' });
  await unknownEvent.locator('[data-outcome="UNKNOWN"]').waitFor();
  assert.equal(await unknownEvent.getByText('Không xác định', { exact: true }).count(), 2);
  assert.equal(await unknownEvent.locator('time').count(), 0);
  assert.equal(await auditPanel.getByText('Hiển thị tối đa 50 sự kiện trong tháng.', { exact: true }).count(), 0);
  auditExportFailure = true;
  await auditPanel.getByRole('button', { name: 'Xuất CSV', exact: true }).click();
  await auditPanel.getByRole('alert').waitFor();
  auditExportFailure = false;
  const [auditDownload] = await Promise.all([
    page.waitForEvent('download'),
    auditPanel.getByRole('button', { name: 'Xuất CSV', exact: true }).click(),
  ]);
  assert.equal(auditDownload.suggestedFilename(), `noi-audit-${auditMonth}.csv`);
  assert.deepEqual(auditExports, [auditMonth]);
  assert.equal(await auditPanel.getByRole('alert').count(), 0);
  for (const [theme, width] of [['light', 1440], ['dark', 320]]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 });
    await noOverflow(); await capture(`audit-${theme}-${width}`);
  }
  await auditPanel.getByRole('heading').click();
  checks.push('audit illustration, month-scoped retry and CSV, keyboard disclosure and outcome labels in both themes');

  const chart = page.getByRole('figure', { name: 'Sự kiện đã tải theo ngày', exact: true });
  await chart.waitFor();
  await chart.getByRole('button', { name: /: 4 sự kiện/ }).press('Enter');
  assert.equal(await chart.locator('figcaption strong').innerText(), '4');
  await chart.getByText('Chọn ngày để xem', { exact: true }).waitFor();
  for (const [theme, width] of [['light', 1440], ['dark', 320]]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 });
    await capture(`activity-selected-${theme}-${width}`);
  }
  await chart.getByRole('button', { name: 'Tất cả ngày', exact: true }).click();
  assert.equal(await chart.locator('figcaption strong').innerText(), '12');
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await noOverflow(); await capture(`activity-${theme}-${width}`);
    }
  }
  checks.push('keyboard day selection updates loaded-event breakdown; reset restores all loaded events');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.ok(await chart.locator('.admin-activity-bar > span').first().evaluate(element => parseFloat(getComputedStyle(element).transitionDuration) <= 0.00001));
  assert.equal(await page.locator('.admin-workspace-art-subject').evaluate(element => getComputedStyle(element).animationName), 'none');
  checks.push('reduced-motion suppresses the new state transitions');
  await page.setViewportSize({ width: 1440, height: 1000 });
  analyticsFailure = true;
  await page.getByLabel('Từ ngày (UTC)', { exact: true }).fill('2026-10-01');
  const analyticsPanel = page.locator('details').filter({ has: page.getByRole('heading', { name: 'Số liệu vận hành', exact: true }) });
  await analyticsPanel.getByRole('alert').waitFor();
  assert.equal(await chart.count(), 0, 'failed reads cannot show previous chart as current');
  analyticsFailure = false; await analyticsPanel.getByRole('button', { name: 'Thử lại', exact: true }).click(); await chart.waitFor();
  roomFailure = true; await navigate('rooms', 'Phòng');
  await directory.getByLabel('Tháng tạo phòng (UTC)', { exact: true }).fill('2026-09');
  await directory.getByRole('alert').waitFor();
  assert.equal(await directory.locator('.admin-room-entry').count(), 0);
  await navigate('overview', 'Tổng quan');
  const overviewRooms = page.getByRole('region', { name: 'Phòng đã tải', exact: true });
  await overviewRooms.getByRole('alert').waitFor();
  roomFailure = false;
  await overviewRooms.getByRole('button', { name: 'Tải lại phòng', exact: true }).press('Enter');
  await overviewRooms.getByRole('button', { name: /Đà Nẵng hôm nay/ }).waitFor();
  checks.push('directory and analytics failures clear stale data and can be retried, including rooms from overview');
  for (const [theme, width] of [['light', 1440], ['dark', 320]]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 });
    await navigate('access', 'Quản lý người dùng');
    await page.getByRole('textbox', { name: 'Tìm người dùng quản trị', exact: true }).fill('anh');
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).press('Enter');
    const availableAvatar = page.getByRole('button', { name: /An @an/ });
    const missingAvatar = page.getByRole('button', { name: /Minh @minh/ });
    await availableAvatar.locator('img').waitFor();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('img')).some(image => image.src.endsWith('/noi-default-avatar.webp') && image.naturalWidth > 0));
    await missingAvatar.getByText('MI', { exact: true }).waitFor();
    assert.equal(await availableAvatar.locator('img').getAttribute('referrerpolicy'), 'no-referrer');
    await noOverflow(); await capture(`user-avatars-${theme}-${width}`);
  }
  checks.push('authorized avatarUrl renders; unavailable image has a monogram fallback; no referrer sent');
  await page.setViewportSize({ width: 1440, height: 1000 }); await navigate('rooms', 'Phòng');
  await page.getByRole('button', { name: 'Chuyển sang tiếng Anh', exact: true }).click();
  await page.getByRole('heading', { name: 'Rooms', level: 1, exact: true }).waitFor();
  await page.getByRole('searchbox', { name: 'Search this month', exact: true }).waitFor();
  assert.equal(await page.getByText('1 member', { exact: true }).count(), 1);
  checks.push('English labels and singular member count');
  const unexpectedWarnings = warnings.filter(message => !/API request rejected|Admin request failed/.test(message));
  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(failures, []); assert.deepEqual(unexpectedWarnings, []);
  const result = { scope: 'controlled browser fixtures, not live backend', checks, captures, errors, consoleErrors, failures, unexpectedWarnings, expectedHttpErrors, expectedNegativePathWarnings: warnings };
  await writeFile('artifacts/ui-audit/current/admin-visual-report.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
