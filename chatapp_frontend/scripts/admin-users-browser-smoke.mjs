import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3117';
const api = 'http://localhost:8084/api';
const actor = { userId: '00000000-0000-0000-0000-000000000010', username: 'operator', displayName: 'Operator', accountStatus: 'ACTIVE' };
const person = { userId: '00000000-0000-0000-0000-000000000020', username: 'linh', displayName: 'Linh Cao', avatarUrl: '/noi-default-avatar.webp', accountStatus: 'ACTIVE' };
const second = { ...person, userId: '00000000-0000-0000-0000-000000000021', username: 'minh', displayName: 'Minh với tên hiển thị dài để kiểm tra bố cục trên điện thoại', avatarUrl: `${base}/fixture-user-broken.webp` };
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const session = { tokenId: '00000000-0000-0000-0000-000000000050', issuedAt: '8e931800-911b-11f1-8000-000000000000', expiresAt: '2026-12-01T00:00:00Z', revokedAt: null };
const device = { deviceId: '00000000-0000-0000-0000-000000000060', deviceName: 'Chrome laptop', platform: 'WEB', active: true, lastSeenAt: '2026-10-23T08:00:00Z' };
let permissions = ['USER_READ', 'SESSION_REVOKE'];
const roles = new Map([[person.userId, []], [second.userId, [{ userId: second.userId, grantId: 'second-support', roleCode: 'SUPPORT', grantedAt: '2026-10-23T00:00:00Z' }]], [actor.userId, [{ userId: actor.userId, grantId: 'own-bootstrap', roleCode: 'SUPER_ADMIN', grantedAt: '2026-10-23T00:00:00Z' }]]]);
let sessions = [{ ...session }], devices = [{ ...device }], writeMode = 'normal', readFailure = false;
let heldSearch, releaseSearch, heldRoles, releaseRoles, heldWrite, releaseWrite, heldAuthority, releaseAuthority;
let authorityFailure = false;
const writes = [], checks = [], captures = [], errors = [], consoleErrors = [], failures = [], reads = [];
const output = '.impeccable/review/admin-users';
const captureEnabled = process.env.SMOKE_CAPTURE !== 'false';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  await mkdir(output, { recursive: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url }); });
  page.on('requestfailed', request => failures.push({ url: request.url(), reason: request.failure()?.errorText }));
  await page.route('**/fixture-user-broken.webp', route => route.fulfill({ contentType: 'image/webp', body: 'invalid-image-fixture' }));
  await page.route(`${api}/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    const json = body => route.fulfill({ json: body });
    if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
    if (path.endsWith('/auth/me')) return json(actor);
    if (path === '/api/devices') return json({ deviceId: 'fixture' });
    if (path.startsWith('/api/devices/')) return json({});
    if (path.endsWith('/admin/overview')) {
      if (authorityFailure) { authorityFailure = false; return route.fulfill({ status: 500, json: {} }); }
      if (heldAuthority) await heldAuthority;
      return json({ actorId: actor.userId, roles: ['SUPPORT'], permissions, availableRoleCodes: ['SUPPORT', 'AUDITOR'] });
    }
    if (path.endsWith('/admin/reports')) return json([{ reportId: '00000000-0000-0000-0000-000000000070',
      createdAtKey: `${new Date().toISOString().slice(0, 10)}T03:00:00Z`, reportDay: new Date().toISOString().slice(0, 10), status: 'OPEN',
      reporterId: actor.userId, targetUserId: second.userId, targetType: 'USER', reasonCode: 'SPAM', description: 'Synthetic report to protect a separate draft' }]);
    if (path.endsWith('/health')) return json({ cassandra: 'UP' });
    if (path.endsWith('/users/search')) {
      const query = new URL(route.request().url()).searchParams.get('q');
      if (query === 'old' && heldSearch) { await heldSearch; return json({ content: [person], hasNext: false }).catch(() => {}); }
      if (query === 'bad') return route.fulfill({ status: 500, json: {} });
      return json({ content: query === 'empty' ? [] : query === 'self' ? [actor] : query === 'new' || query === 'minh' ? [second] : query === 'linh' ? [person] : [person, second], hasNext: false });
    }
    const target = path.match(/\/admin\/users\/([^/]+)/)?.[1];
    if (route.request().method() === 'GET') {
      reads.push(path);
      if (path.endsWith('/app-roles')) {
        if (target === person.userId && heldRoles) { await heldRoles; return json(roles.get(target)).catch(() => {}); }
        if (readFailure) return route.fulfill({ status: 500, json: {} });
        return json(roles.get(target));
      }
      if (path.endsWith('/sessions')) return json(target === person.userId ? sessions : []);
      if (path.includes('/admin/users/') && path.endsWith('/devices')) return json(target === person.userId ? devices : []);
      return json([]);
    }
    const method = route.request().method();
    const body = route.request().postData() ? route.request().postDataJSON() : null;
    writes.push({ path, method, body, reason: new URL(route.request().url()).searchParams.get('reason') });
    const loseAcknowledgement = writeMode === 'lost';
    if (loseAcknowledgement) writeMode = 'normal';
    if (writeMode === 'forbidden') { writeMode = 'normal'; return route.fulfill({ status: 403, json: {} }); }
    if (path.endsWith('/app-roles') && method === 'POST') roles.set(target, [...roles.get(target), { userId: target, roleCode: body.roleCode, grantId: crypto.randomUUID(), grantedAt: '2026-10-23T00:00:00Z' }]);
    if (method === 'DELETE' && path.includes('/app-roles/')) roles.set(target, roles.get(target).filter(role => !path.endsWith(`/${role.roleCode}`)));
    if (path.endsWith('/status')) (target === person.userId ? person : second).accountStatus = body.accountStatus;
    if (path.includes('/sessions/')) sessions = sessions.map(item => ({ ...item, revokedAt: '2026-10-23T08:00:00Z' }));
    if (path.includes('/devices/')) devices = devices.map(item => ({ ...item, active: false }));
    if (loseAcknowledgement) return route.fulfill({ status: 503, json: {} });
    if (heldWrite) await heldWrite;
    return json({});
  });
  await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
  await page.goto(`${base}/admin`);
  await page.getByRole('button', { name: 'Quản lý người dùng', exact: true }).click();
  const workspace = page.getByRole('region', { name: /^(Quản lý người dùng|User management)$/ });
  await workspace.waitFor({ timeout: 5000 });
  assert.equal(await workspace.getByRole('form', { name: 'Tìm người dùng', exact: true }).count(), 1);
  const profile = page.getByRole('region', { name: /^(Hồ sơ quản trị người dùng|User administration profile)$/ });
  const search = async query => {
    await workspace.getByRole('textbox', { name: 'Tìm người dùng quản trị', exact: true }).fill(query);
    await workspace.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  };
  const choose = async name => { await workspace.getByRole('button', { name }).click(); await profile.getByRole('heading', { level: 3 }).waitFor(); };
  const confirm = async (title, reason) => {
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await dialog.getByRole('textbox', { name: 'Lý do (bắt buộc)', exact: true }).fill(reason);
    return dialog;
  };
  await search('empty'); await workspace.getByText('Không có người dùng khớp tìm kiếm.', { exact: true }).waitFor();
  await search('bad'); await workspace.getByRole('alert').waitFor();
  await search('both'); await choose(/Linh Cao/);
  assert.equal(await profile.getByRole('button', { name: 'Cấp vai trò', exact: true }).count(), 0);
  assert.equal(await profile.getByRole('button', { name: 'Trạng thái tài khoản', exact: true }).count(), 0);
  await profile.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await profile.getByRole('button', { name: 'Thu hồi thiết bị: Chrome laptop', exact: true }).click();
  let dialog = await confirm('Thu hồi thiết bị', 'Thiết bị bị mất');
  assert.equal(await dialog.getByRole('textbox').isEnabled(), true, 'SESSION_REVOKE without role management can enter its own reason');
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await profile.getByText('WEB · Đã thu hồi', { exact: true }).waitFor();
  assert.equal(writes.at(-1).reason, 'Thiết bị bị mất');
  checks.push('separate empty/error search and session-only operation reason');

  heldRoles = new Promise(resolve => { releaseRoles = resolve; });
  await search('both'); await choose(/Linh Cao/);
  await page.waitForFunction(() => document.querySelector('[aria-label="Hồ sơ quản trị người dùng"]') !== null);
  await choose(/Minh với tên/); await profile.getByText('Hỗ trợ', { exact: true }).waitFor();
  releaseRoles(); heldRoles = null;
  assert.ok(reads.includes(`/api/admin/users/${person.userId}/sessions`) && reads.includes(`/api/admin/users/${person.userId}/devices`), 'security reads start without waiting for roles');
  assert.equal(await profile.getByRole('heading', { level: 3 }).textContent(), second.displayName);
  checks.push('parallel details and late/canceled old-user reads fenced');
  heldSearch = new Promise(resolve => { releaseSearch = resolve; });
  await search('old');
  await workspace.getByRole('textbox', { name: 'Tìm người dùng quản trị', exact: true }).fill('new');
  await workspace.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await workspace.getByRole('button', { name: /Minh với tên/ }).waitFor();
  releaseSearch(); heldSearch = null;
  assert.equal(await workspace.getByRole('button', { name: /Linh Cao/ }).count(), 0);
  checks.push('new search owns results');

  permissions = ['USER_READ', 'APP_ROLE_MANAGE', 'SESSION_REVOKE', 'USER_SUSPEND'];
  await page.reload(); await page.getByRole('button', { name: 'Quản lý người dùng', exact: true }).click();
  await search('both'); await choose(/Linh Cao/);
  await profile.getByRole('button', { name: 'Cấp vai trò', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Cấp vai trò', exact: true });
  await dialog.getByLabel('Vai trò', { exact: true }).selectOption('SUPPORT');
  await dialog.getByLabel('Lý do (bắt buộc)', { exact: true }).fill('Hỗ trợ cộng đồng');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  await workspace.getByRole('button', { name: /Minh với tên/ }).click();
  const discard = page.getByRole('dialog', { name: 'Bỏ thao tác đang giữ?', exact: true });
  await discard.waitFor(); await page.keyboard.press('Escape'); await discard.waitFor({ state: 'hidden' });
  await workspace.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  assert.equal(await dialog.getByRole('textbox', { name: 'Lý do (bắt buộc)', exact: true }).inputValue(), 'Hỗ trợ cộng đồng');
  heldWrite = new Promise(resolve => { releaseWrite = resolve; });
  await dialog.getByRole('button', { name: 'Cấp vai trò', exact: true }).click();
  await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true);
  releaseWrite(); heldWrite = null; await dialog.waitFor({ state: 'hidden' });
  await profile.getByText('Hỗ trợ', { exact: true }).waitFor();
  assert.equal(await profile.getByRole('heading', { level: 3 }).evaluate(element => element === document.activeElement), true, 'ack returns focus to stable profile heading');
  assert.equal(writes.at(-1).body.reason, 'Hỗ trợ cộng đồng');
  await profile.getByRole('button', { name: 'Trạng thái tài khoản', exact: true }).click();
  dialog = await confirm('Đổi trạng thái tài khoản', 'Kiểm tra bảo mật');
  await dialog.getByRole('combobox').selectOption('SUSPENDED');
  assert.equal(await dialog.locator('option[value="ACTIVE"]:not([disabled])').count(), 0, 'no restore destination without USER_RESTORE');
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await profile.getByText('Tạm khóa', { exact: true }).waitFor();
  assert.equal(writes.at(-1).body.reason, 'Kiểm tra bảo mật');
  checks.push('owned role/status drafts, replacement guard, pending lock, stable focus and destination permissions');
  readFailure = true; await profile.getByRole('button', { name: 'Tải lại hồ sơ', exact: true }).click();
  await profile.getByText('Chưa tải được vai trò.', { exact: true }).waitFor();
  readFailure = false; await profile.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await profile.getByText('Hỗ trợ', { exact: true }).waitFor();
  await profile.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await profile.getByRole('button', { name: /Thu hồi phiên đăng nhập:/ }).click();
  dialog = await confirm('Thu hồi phiên đăng nhập', 'Kết thúc phiên cũ');
  writeMode = 'lost'; const beforeUnknown = writes.length;
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog.getByText('Chưa xác nhận được kết quả. Không gửi lại; tải dữ liệu để kiểm tra.', { exact: true }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).count(), 0);
  await dialog.getByRole('button', { name: 'Tải dữ liệu để kiểm tra', exact: true }).click();
  await page.waitForFunction(element => !element.disabled, await dialog.getByRole('button', { name: 'Tải dữ liệu để kiểm tra', exact: true }).elementHandle());
  assert.equal(writes.length, beforeUnknown + 1, 'inspection does not retry mutation');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Về ứng dụng', exact: true }).click();
  const leave = page.getByRole('dialog', { name: 'Rời thao tác người dùng?', exact: true });
  await leave.waitFor(); await page.keyboard.press('Escape'); await leave.waitFor({ state: 'hidden' });
  await workspace.getByRole('button', { name: 'Bỏ thao tác', exact: true }).click();
  await discard.getByRole('button', { name: 'Bỏ thao tác', exact: true }).click(); await discard.waitFor({ state: 'hidden' });
  assert.equal(writes.length, beforeUnknown + 1);
  checks.push('partial read failure/retry, unknown write locked against duplicate submission, app exit and explicit discard');

  await page.setViewportSize({ width: 320, height: 1000 });
  await profile.getByRole('button', { name: 'Trạng thái tài khoản', exact: true }).click();
  dialog = await confirm('Đổi trạng thái tài khoản', 'Nháp trên điện thoại');
  await dialog.getByRole('combobox').selectOption('BANNED');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  await profile.getByRole('button', { name: 'Danh sách người dùng', exact: true }).click();
  await discard.waitFor(); await page.keyboard.press('Escape'); await discard.waitFor({ state: 'hidden' });
  await workspace.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  assert.equal(await dialog.getByRole('textbox').inputValue(), 'Nháp trên điện thoại');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false);
  checks.push('mobile Back keeps the exact draft until explicit Cancel');

  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await profile.getByRole('heading', { level: 3 }).isVisible(), true);
      const file = `${output}/profile-${theme}-${width}.png`;
      if (captureEnabled) await page.screenshot({ path: file, fullPage: true, animations: 'disabled' }); captures.push(file);
      if (width < 1024) {
        await profile.getByRole('button', { name: 'Danh sách người dùng', exact: true }).click();
        assert.equal(await workspace.getByRole('textbox').evaluate(element => element === document.activeElement), true);
        await choose(/Linh Cao/); await profile.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      }
    }
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await profile.getByRole('button', { name: 'Trạng thái tài khoản', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Đổi trạng thái tài khoản', exact: true });
      const file = `${output}/operation-${theme}-${width}.png`;
      if (captureEnabled) await dialog.screenshot({ path: file, animations: 'disabled' }); captures.push(file);
      await dialog.evaluate(async element => { await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))); });
      const bounds = await dialog.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= 1000);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    }
  }
  checks.push('eight profile theme/width cases, four operation captures, mobile single pane/focus');
  await page.setViewportSize({ width: 1440, height: 1000 });
  permissions = ['USER_READ', 'USER_RESTORE'];
  await page.reload(); await page.getByRole('button', { name: 'Quản lý người dùng', exact: true }).click();
  await search('linh'); await choose(/Linh Cao/);
  await profile.getByRole('button', { name: 'Trạng thái tài khoản', exact: true }).click();
  dialog = await confirm('Đổi trạng thái tài khoản', 'Khôi phục sau kiểm tra');
  await dialog.getByRole('combobox').selectOption('ACTIVE');
  assert.equal(await dialog.locator('option[value="BANNED"]').count(), 0);
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await profile.getByText('Đang hoạt động', { exact: true }).waitFor();
  assert.equal(await profile.getByRole('button', { name: 'Trạng thái tài khoản', exact: true }).count(), 0, 'restore-only ACTIVE has no dead-end operation');
  permissions = ['USER_READ', 'APP_ROLE_MANAGE', 'USER_SUSPEND', 'SESSION_REVOKE'];
  await page.reload(); await page.getByRole('button', { name: 'Quản lý người dùng', exact: true }).click();
  await search('self'); await choose(/Operator/);
  await profile.getByText('Quản trị cấp cao', { exact: true }).waitFor();
  assert.equal(await profile.getByRole('button', { name: 'Trạng thái tài khoản', exact: true }).count(), 0);
  assert.equal(await profile.getByRole('button', { name: 'Thu hồi vai trò: SUPER_ADMIN', exact: true }).isDisabled(), true);
  permissions = ['USER_READ', 'APP_ROLE_MANAGE', 'REPORT_MANAGE'];
  await page.reload(); await page.getByRole('button', { name: 'Quản lý người dùng', exact: true }).click();
  await search('both'); await choose(/Linh Cao/);
  await profile.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  assert.equal(await profile.getByRole('button', { name: /Thu hồi phiên đăng nhập:|Thu hồi thiết bị:/ }).count(), 0);
  await profile.getByRole('button', { name: 'Vai trò', exact: true }).click();
  await profile.getByRole('button', { name: 'Cấp vai trò', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Cấp vai trò', exact: true });
  await dialog.getByLabel('Vai trò', { exact: true }).selectOption('AUDITOR');
  await dialog.getByLabel('Lý do (bắt buộc)', { exact: true }).fill('Thử thời hạn vai trò');
  await dialog.getByLabel('Hết hạn (tuỳ chọn)', { exact: true }).fill('2020-01-01T10:00');
  assert.equal(await dialog.getByRole('button', { name: 'Cấp vai trò', exact: true }).isDisabled(), true);
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await profile.getByRole('button', { name: 'Cấp vai trò', exact: true }).click();
  assert.equal(await dialog.getByLabel('Lý do (bắt buộc)', { exact: true }).inputValue(), '', 'new operation cannot inherit a discarded reason');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  checks.push('restore-only/role-only permissions, own-account/bootstrap protection, invalid role expiry and discarded reason isolation');
  await page.getByRole('button', { name: 'Báo cáo', exact: true }).click();
  const reports = page.getByRole('region', { name: 'Hộp báo cáo', exact: true });
  await reports.getByRole('button', { name: /Spam hoặc lừa đảo/ }).click();
  await reports.getByRole('button', { name: 'Giải quyết', exact: true }).click();
  const reportDialog = page.getByRole('dialog', { name: 'Xác nhận cập nhật báo cáo', exact: true });
  await reportDialog.getByLabel('Lý do quyết định', { exact: true }).fill('Keep this independent report draft');
  await page.keyboard.press('Escape');
  await reportDialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Quản lý người dùng', exact: true }).click();
  await page.getByRole('button', { name: 'Chuyển sang tiếng Anh', exact: true }).click();
  await profile.getByRole('button', { name: 'Roles', exact: true }).click();
  await profile.getByRole('button', { name: 'Revoke role: SUPPORT', exact: true }).click();
  const english = page.getByRole('dialog', { name: 'Revoke role', exact: true });
  await english.getByRole('textbox').fill('Permission revoked'); writeMode = 'forbidden';
  await english.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByText('Permissions changed. Reload user access to continue.', { exact: true }).waitFor();
  assert.equal(await profile.count(), 0);
  const writesBeforeRecovery = writes.length;
  const recovery = workspace.getByRole('button', { name: 'Reload user access', exact: true });
  authorityFailure = true; await recovery.press('Enter');
  await workspace.getByText('Could not reload access. Retry.', { exact: true }).waitFor();
  heldAuthority = new Promise(resolve => { releaseAuthority = resolve; });
  const authorityRequest = page.waitForRequest(request => request.url().endsWith('/admin/overview'));
  await recovery.click(); await authorityRequest;
  assert.equal(await recovery.isDisabled(), true);
  assert.equal(await profile.count(), 0);
  permissions = ['USER_READ', 'REPORT_MANAGE']; releaseAuthority(); heldAuthority = null;
  await workspace.getByRole('textbox', { name: 'Search admin users', exact: true }).waitFor();
  assert.equal(await workspace.getByRole('textbox', { name: 'Search admin users', exact: true }).inputValue(), '');
  assert.equal(await workspace.locator('.admin-room-entry').count(), 0, 'private list cleared on denial');
  await workspace.getByRole('textbox', { name: 'Search admin users', exact: true }).fill('linh');
  await workspace.getByRole('button', { name: 'Search', exact: true }).click(); await choose(/Linh Cao/);
  await profile.getByText('Support', { exact: true }).waitFor();
  assert.equal(await profile.getByRole('button', { name: /Grant role|Revoke role:/ }).count(), 0, 'new authority replaces stale role-management controls');
  assert.equal(writes.length, writesBeforeRecovery, 'authority recovery never repeats the denied mutation');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByRole('region', { name: 'Report inbox', exact: true }).getByRole('button', { name: 'Resume', exact: true }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Confirm report update', exact: true }).getByLabel('Decision reason', { exact: true }).inputValue(), 'Keep this independent report draft');
  checks.push('English denial clears private user state; keyboard authority recovery handles failure/pending, replaces permissions without resubmitting or losing a separate report draft');
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors.filter(item => !item.url.startsWith(api) || !/500|503|403/.test(item.text)), []);
  assert.deepEqual(failures.filter(item => !/ERR_ABORTED/.test(item.reason ?? '')), []);
  const report = { checks, captures, writes, errors, expectedHttpErrors: consoleErrors, expectedCanceledReads: failures,
    boundary: 'Isolated production Chromium with synthetic canonical transport; not live backend/Cassandra or full navigation recovery' };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
