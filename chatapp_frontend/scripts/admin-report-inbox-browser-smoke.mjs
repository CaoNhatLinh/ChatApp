import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Controlled synthetic fixtures only; no real user, API write, or investigation.
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3117';
const api = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const actor = { userId: '00000000-0000-0000-0000-000000000010', username: 'operator', displayName: 'Operator', accountStatus: 'ACTIVE' };
const day = new Date().toISOString().slice(0, 10);
const previousDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const template = { createdAtKey: '30e58e00-9121-11ef-8000-000000000001', reportDay: day, status: 'OPEN', reporterId: actor.userId, targetUserId: '00000000-0000-0000-0000-000000000011', resolutionCode: null };
let reports = [
  { ...template, reportId: '00000000-0000-0000-0000-000000000001', targetType: 'USER', reasonCode: 'SPAM', description: 'Gửi cùng một đường link liên tục trong cộng đồng.' },
  { ...template, reportId: '00000000-0000-0000-0000-000000000002', targetType: 'MESSAGE', reasonCode: 'HARASSMENT', description: 'Người này quấy rối và gửi lời đe doạ.' },
  { ...template, reportId: '00000000-0000-0000-0000-000000000003', targetType: 'CONVERSATION', reasonCode: 'CUSTOM_REASON', description: null },
];
const errors = [], consoleErrors = [], warnings = [], failures = [], writes = [], authorityReads = [], sanctionWrites = [], checks = [], captures = [];
let mode = 'normal', queueError = false, releaseWrite, releaseRead, heldDay, releaseSanctions;
const oldUserId = '00000000-0000-0000-0000-000000000022';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(12000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
page.on('requestfailed', request => failures.push(request.url()));
await context.route(`${api}/**`, async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  const json = body => route.fulfill({ json: body });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature' });
  if (path.endsWith('/auth/me')) return json(actor);
  if (path.endsWith('/devices') && request.method() === 'POST') { const payload = request.postDataJSON(); return json({ deviceId: payload.deviceId, platform: 'WEB', pushProvider: 'WEB_PUSH', active: true, deviceName: null, appVersion: null, createdAt: `${day}T00:00:00Z`, lastSeenAt: `${day}T00:00:00Z` }); }
  if (path.endsWith('/admin/overview')) return json({ actorId: actor.userId, roles: ['APP_ADMIN'], permissions: ['REPORT_MANAGE', 'USER_READ'], availableRoleCodes: [] });
  if (path.endsWith('/health')) return json({ status: 'UP', cassandra: 'UP', timestamp: `${day}T00:00:00Z` });
  if (path.endsWith('/users/search')) return json({ content: [{ userId: oldUserId, username: 'oldtarget', displayName: 'Old Target', accountStatus: 'ACTIVE' }], hasNext: false });
  if (path.endsWith(`/admin/users/${oldUserId}/sanctions`)) {
    await new Promise(resolve => { releaseSanctions = resolve; });
    return json([{ userId: oldUserId, sanctionId: 'old-sanction', status: 'ACTIVE', sanctionType: 'WARNING', scope: 'APP', reasonText: 'Old target history must not replace new target', startsAt: `${day}T00:00:00Z`, imposedAt: `${day}T00:00:00Z`, imposedBy: actor.userId }]);
  }
  if (path.endsWith('/admin/reports')) {
    const requestedDay = url.searchParams.get('day'), status = url.searchParams.get('status');
    const snapshot = reports.filter(report => report.reportDay === requestedDay && report.status === status).map(report => ({ ...report }));
    if (requestedDay === heldDay) await new Promise(resolve => { releaseRead = resolve; });
    return queueError ? route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } }) : json(snapshot);
  }
  if (path.includes('/admin/reports/') && request.method() === 'PUT') {
    const payload = request.postDataJSON(), id = path.split('/').at(-1); writes.push({ id, ...payload });
    if (mode === 'held') await new Promise(resolve => { releaseWrite = resolve; });
    if (mode === 'concurrent') {
      reports = reports.map(report => report.reportId === id ? { ...report, status: 'IN_REVIEW' } : report);
      return route.fulfill({ status: 409, json: { code: 'CONFLICT' } });
    }
    reports = reports.map(report => report.reportId === id ? { ...report, status: payload.nextStatus, resolutionCode: payload.resolutionCode } : report);
    return mode === 'ambiguous' ? route.fulfill({ status: 503, json: { code: 'INTERNAL_ERROR' } }) : json(reports.find(report => report.reportId === id));
  }
  if (path.includes('/admin/reports/') && request.method() === 'GET') {
    const key = { reportId: path.split('/').at(-1), reporterId: url.searchParams.get('reporterId'), createdAtKey: url.searchParams.get('createdAtKey') };
    authorityReads.push(key);
    const report = reports.find(row => row.reportId === key.reportId && row.reporterId === key.reporterId && row.createdAtKey === key.createdAtKey);
    return report ? json(report) : route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
  }
  if (path.endsWith('/admin/sanctions')) sanctionWrites.push(request.postDataJSON());
  return json([]);
});
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
await mkdir('artifacts/ui-audit/current', { recursive: true });
const capture = async name => { const path = `artifacts/ui-audit/current/admin-reports-${name}.png`; await page.screenshot({ path, fullPage: true, animations: 'disabled' }); captures.push(path); };
const inbox = () => page.getByRole('region', { name: 'Hộp báo cáo', exact: true });
const dialog = () => page.getByRole('dialog', { name: 'Xác nhận cập nhật báo cáo', exact: true });
const backToList = async () => {
  if (page.viewportSize().width >= 1024) return;
  if (await inbox().getByRole('button', { name: 'Danh sách báo cáo', exact: true }).isVisible()) await inbox().getByRole('button', { name: 'Danh sách báo cáo', exact: true }).click();
  await inbox().getByRole('searchbox', { name: 'Tìm trong báo cáo đã tải', exact: true }).waitFor({ state: 'visible' });
};
const chooseSpam = async () => { await backToList(); await inbox().getByRole('button', { name: /Spam hoặc lừa đảo/ }).click(); };
const discard = async () => { await dialog().getByRole('button', { name: 'Bỏ bản nháp', exact: true }).click(); const confirm = page.getByRole('dialog', { name: 'Bỏ quyết định đang soạn?', exact: true }); await confirm.getByRole('button', { name: 'Bỏ bản nháp', exact: true }).click(); await confirm.waitFor({ state: 'hidden' }); await dialog().waitFor({ state: 'hidden' }); };
try {
  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Báo cáo', exact: true }).click();
  await inbox().getByRole('button', { name: /Spam hoặc lừa đảo/ }).waitFor();
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForFunction(theme => document.documentElement.getAttribute('data-theme') === (theme === 'dark' ? 'dark' : null), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await backToList();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await capture(`list-${theme}-${width}`);
      await chooseSpam(); await inbox().getByRole('heading', { name: 'Spam hoặc lừa đảo', level: 3, exact: true }).waitFor();
      assert.equal(await inbox().getByText(reports[0].reportId, { exact: true }).isVisible(), false);
      await capture(`detail-${theme}-${width}`);
      await inbox().getByRole('button', { name: 'Giải quyết', exact: true }).press('Enter');
      await dialog().getByLabel('Lý do quyết định', { exact: true }).fill(`Evidence ${theme}/${width}`);
      await dialog().getByLabel('Mã kết quả', { exact: true }).fill('CONFIRMED_SPAM');
      await dialog().evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined))));
      const bounds = await dialog().boundingBox(); assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1);
      await capture(`decision-${theme}-${width}`);
      await page.keyboard.press('Escape'); await inbox().getByRole('button', { name: 'Tiếp tục', exact: true }).click();
      assert.equal(await dialog().getByLabel('Lý do quyết định', { exact: true }).inputValue(), `Evidence ${theme}/${width}`);
      await discard();
      checks.push(`${theme}/${width}: loaded list, identity disclosure, single pane, decision bounds, keyboard, retained draft, explicit discard`);
    }
  }
  assert.equal(writes.length, 0);
  await page.setViewportSize({ width: 1440, height: 1000 }); await chooseSpam();
  await inbox().getByRole('button', { name: 'Chọn người dùng mục tiêu', exact: true }).click();
  await page.locator('#admin-moderation-reason').fill('Only a sanction draft, never the report reason');
  await inbox().getByRole('button', { name: 'Giải quyết', exact: true }).click();
  assert.equal(await dialog().getByLabel('Lý do quyết định', { exact: true }).inputValue(), '');
  await dialog().getByLabel('Lý do quyết định', { exact: true }).fill('This report decision only');
  await dialog().getByLabel('Mã kết quả', { exact: true }).fill('REVIEWED');
  assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click(); await page.getByRole('button', { name: 'Báo cáo', exact: true }).click();
  await inbox().getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  assert.equal(await dialog().getByLabel('Lý do quyết định', { exact: true }).inputValue(), 'This report decision only');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Về ứng dụng', exact: true }).click();
  const exitDialog = page.getByRole('dialog', { name: 'Rời bản nháp báo cáo?', exact: true });
  await page.keyboard.press('Escape'); await exitDialog.waitFor({ state: 'hidden' });
  await inbox().getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await dialog().evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined))));
  mode = 'held'; await dialog().getByRole('button', { name: 'Xác nhận', exact: true }).dblclick({ force: true });
  await page.waitForFunction(() => document.querySelector('.admin-report-dialog [type="submit"]')?.disabled === true);
  assert.equal(writes.length, 1); await page.keyboard.press('Escape'); assert.equal(await dialog().isVisible(), true);
  releaseWrite(); await dialog().waitFor({ state: 'hidden' }); mode = 'normal';
  assert.equal(writes[0].reason, 'This report decision only'); assert.equal(writes[0].resolutionCode, 'REVIEWED');
  assert.equal(writes[0].currentStatus, 'OPEN'); assert.equal(writes[0].reportDay, day); assert.equal(writes[0].createdAtKey, template.createdAtKey);
  assert.equal(await page.locator('#admin-moderation-reason').inputValue(), 'Only a sanction draft, never the report reason');
  assert.deepEqual(sanctionWrites, []);
  assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false);
  checks.push('report/sanction reasons isolated, workspace/Back retain draft, busy Escape/repeated-click guard, exact payload, no sanction side effect');
  await inbox().getByRole('searchbox', { name: 'Tìm trong báo cáo đã tải', exact: true }).fill('quay roi');
  assert.equal(await inbox().locator('.admin-report-entry').count(), 1);
  await inbox().getByRole('button', { name: /Quấy rối hoặc bắt nạt/ }).click();
  await inbox().getByRole('button', { name: 'Giải quyết', exact: true }).click();
  await dialog().getByLabel('Lý do quyết định', { exact: true }).fill('Lost acknowledgement evidence');
  await dialog().getByLabel('Mã kết quả', { exact: true }).fill('REVIEWED');
  mode = 'ambiguous'; await dialog().getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog().getByRole('alert').waitFor(); assert.equal(await dialog().getByRole('button', { name: 'Xác nhận', exact: true }).isDisabled(), true);
  await capture('uncertain-dark-1440');
  await dialog().getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
  await dialog().getByText(/Trạng thái hiện tại:.*Giải quyết/i).waitFor();
  assert.deepEqual(authorityReads, [{ reportId: writes[1].id, reporterId: actor.userId, createdAtKey: template.createdAtKey }]);
  await page.keyboard.press('Escape'); await inbox().getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  assert.equal(await dialog().getByLabel('Lý do quyết định', { exact: true }).inputValue(), 'Lost acknowledgement evidence');
  assert.equal(writes.length, 2); await discard(); mode = 'normal';
  checks.push('unknown result verifies exact current state, retains frozen draft, and never resubmits');
  await inbox().getByRole('searchbox', { name: 'Tìm trong báo cáo đã tải', exact: true }).fill('');
  queueError = true; await inbox().getByRole('button', { name: 'Tải lại', exact: true }).click(); await inbox().getByRole('alert').waitFor();
  assert.equal(await inbox().locator('.admin-report-entry').count(), 0);
  queueError = false; await inbox().getByRole('button', { name: 'Thử lại', exact: true }).click();
  await inbox().getByRole('button', { name: /CUSTOM_REASON/ }).waitFor();
  checks.push('unknown reason code remains honest text; failed reads clear stale rows and explicitly retry');
  heldDay = previousDay;
  const heldRequest = page.waitForRequest(request => request.url().includes('/admin/reports?') && new URL(request.url()).searchParams.get('day') === previousDay);
  await inbox().getByLabel('Ngày báo cáo (UTC)', { exact: true }).fill(previousDay); await heldRequest;
  await inbox().getByLabel('Ngày báo cáo (UTC)', { exact: true }).fill(day); await inbox().getByRole('button', { name: /CUSTOM_REASON/ }).waitFor();
  const lateResponse = page.waitForResponse(response => response.url().includes('/admin/reports?') && new URL(response.url()).searchParams.get('day') === previousDay);
  releaseRead(); heldDay = undefined; await lateResponse;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await inbox().getByRole('button', { name: /CUSTOM_REASON/ }).count(), 1);
  await inbox().getByRole('button', { name: /CUSTOM_REASON/ }).click();
  await inbox().getByRole('button', { name: 'Giải quyết', exact: true }).click();
  await dialog().getByLabel('Lý do quyết định', { exact: true }).fill('Draft must survive another moderator taking the report');
  await dialog().getByLabel('Mã kết quả', { exact: true }).fill('REVIEWED');
  mode = 'concurrent'; await dialog().getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await dialog().getByRole('alert').waitFor();
  await dialog().getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
  await dialog().getByText(/Trạng thái hiện tại:.*(duyệt|xem xét)/i).waitFor();
  assert.equal(await dialog().getByLabel('Lý do quyết định', { exact: true }).inputValue(), 'Draft must survive another moderator taking the report');
  assert.equal(await dialog().getByRole('button', { name: 'Xác nhận', exact: true }).isDisabled(), true);
  assert.deepEqual(authorityReads[1], { reportId: writes[2].id, reporterId: actor.userId, createdAtKey: template.createdAtKey });
  assert.equal(writes.length, 3);
  await dialog().getByRole('button', { name: 'Mở hàng đợi hiện tại', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  assert.equal(await inbox().getByLabel('Trạng thái', { exact: true }).inputValue(), 'IN_REVIEW');
  await inbox().getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  assert.equal(await dialog().getByLabel('Lý do quyết định', { exact: true }).inputValue(), 'Draft must survive another moderator taking the report');
  await discard(); mode = 'normal';
  checks.push('concurrent status change is read outside the old queue without reapplying the draft');
  await inbox().getByLabel('Trạng thái', { exact: true }).selectOption('RESOLVED');
  await inbox().getByRole('button', { name: /Spam hoặc lừa đảo/ }).click(); assert.equal(await inbox().getByRole('button', { name: 'Giải quyết', exact: true }).count(), 0);
  checks.push('late previous-day result cannot replace newer queue; terminal report is read-only');
  await page.getByRole('button', { name: 'Chuyển sang tiếng Anh', exact: true }).click();
  await page.getByRole('region', { name: 'Report inbox', exact: true }).getByRole('heading', { name: 'Spam or scams', exact: true }).waitFor();
  const englishInbox = page.getByRole('region', { name: 'Report inbox', exact: true });
  await englishInbox.getByRole('searchbox', { name: 'Search loaded reports', exact: true }).fill('scams');
  assert.equal(await englishInbox.locator('.admin-report-entry').count(), 1);
  await englishInbox.getByRole('searchbox', { name: 'Search loaded reports', exact: true }).fill('');
  await capture('terminal-english-dark-1440'); checks.push('English state, reason and terminal detail labels');
  await page.getByRole('button', { name: 'User management', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search admin users', exact: true }).fill('oldtarget');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const oldHistoryRequest = page.waitForRequest(request => request.url().includes(`/admin/users/${oldUserId}/sanctions`));
  await page.getByRole('button', { name: /Old Target @oldtarget/ }).click();
  await page.getByRole('region', { name: 'User administration profile', exact: true }).getByRole('button', { name: 'Sanctions', exact: true }).click(); await oldHistoryRequest;
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByRole('region', { name: 'Report inbox', exact: true }).getByRole('button', { name: 'Select target user', exact: true }).click();
  const oldHistoryResponse = page.waitForResponse(response => response.url().includes(`/admin/users/${oldUserId}/sanctions`));
  releaseSanctions(); await oldHistoryResponse;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#admin-sanction-user').inputValue(), template.targetUserId);
  assert.equal(await page.getByText('Old target history must not replace new target', { exact: true }).count(), 0);
  checks.push('late sanction history from another selected user cannot populate the new report target');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  assert.deepEqual(consoleErrors.filter(message => !/409|500|503/.test(message)), []);
  assert.deepEqual(warnings.filter(message => !/Admin request failed|API request rejected/.test(message)), []);
  const result = { scope: 'controlled fixtures, not live datastore or concurrent moderation acceptance', checks, captures, writes, sanctionWrites, errors, consoleErrors, warnings, failures };
  await writeFile('artifacts/ui-audit/current/admin-reports-report.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/ui-audit/current/admin-reports-failure.png', fullPage: true, animations: 'disabled' });
  console.error(JSON.stringify({ writes, controls: await page.locator('.admin-report-dialog').innerText().catch(() => 'No report dialog') }));
  throw error;
} finally { releaseWrite?.(); releaseRead?.(); releaseSanctions?.(); await browser.close(); }
