import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3117';
const apiUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const zero = '00000000-0000-0000-0000-000000000000';
const actor = { userId: '00000000-0000-0000-0000-000000000010', username: 'operator', displayName: 'Operator', accountStatus: 'ACTIVE' };
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
let settings = [
  { key: 'community.creationEnabled', type: 'BOOLEAN', value: true, defaultValue: true, min: null, max: null, revision: zero, updatedBy: null, updatedAt: null },
  { key: 'community.defaultMaxMembers', type: 'INTEGER', value: 10000, defaultValue: 10000, min: 2, max: 100000, revision: zero, updatedBy: null, updatedAt: null },
];
const writes = [];
const deliveryReads = [];
const reviewReads = [];
const dispositionWrites = [];
const reviewCursor = 'fixture-review-cursor';
const deliveryAccount = '00000000-0000-0000-0000-000000000011';
const deliveredNotification = '82af3a80-0a91-11ef-beb5-0242ac120002';
const missingNotification = '82af3814-0a91-11ef-beb5-0242ac120002';
const reviewNotification = '82af3a81-0a91-11ef-beb5-0242ac120002';
const deliveryMonth = '2026-10';
const dispositionAt = '2026-10-01T10:00:00Z';
let dispositionDay = null, dispositionReceipt = null;
let denyDelivery = false;
const commits = new Map();
let readMode = 'invalid', writeMode = 'normal', auditPending = false, canOperate = true, reads = 0;
let releaseHeld;
const held = new Promise(resolve => { releaseHeld = resolve; });
const matrix = [], errors = [], consoleErrors = [], requestFailures = [];
let stage = 'initial';
const externalRevision = '00000000-0000-0000-0000-000000000099';
const browser = await chromium.launch({ headless: true });
try {
  await mkdir('artifacts/ui-audit/current', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push({ stage, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url }); });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    const error = request.failure()?.errorText;
    // Navigating away can cancel a pending Next route fetch.
    if (request.method() === 'GET' && error === 'net::ERR_ABORTED' && url.origin === new URL(baseUrl).origin
      && url.pathname === '/admin' && url.searchParams.has('_rsc')) return;
    requestFailures.push({ url: request.url(), error });
  });
  await page.context().route(`${apiUrl}/**`, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const json = body => route.fulfill({ json: body });
    if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
    if (path.endsWith('/auth/me')) return json(actor);
    if (path.endsWith('/devices')) return json({ deviceId: 'system-settings-fixture' });
    if (path.endsWith('/admin/overview')) return json({ actorId: actor.userId, roles: ['APP_ADMIN'], permissions: canOperate ? ['SYSTEM_OPERATE'] : [], availableRoleCodes: [] });
    if (path.endsWith('/health')) return json({ status: 'UP', cassandra: 'UP' });
    if (path.endsWith('/admin/email-review')) {
      const day = url.searchParams.get('day'), cursor = url.searchParams.get('cursor');
      reviewReads.push({ method: request.method(), day, cursor });
      if (reviewReads.length === 1) return json({ content: [], hasNext: true, nextCursor: reviewCursor });
      if (cursor === reviewCursor) return json({
        content: [{ userId: deliveryAccount, month: deliveryMonth, notificationId: deliveredNotification,
          attempts: 10, attemptedAt: '2026-10-01T08:00:00Z' }],
        hasNext: false, nextCursor: null,
      });
      const content = day === dispositionDay && dispositionReceipt === null
        ? [{ userId: deliveryAccount, month: deliveryMonth, notificationId: reviewNotification, attempts: 10, attemptedAt: '2026-10-01T08:00:00Z' }]
        : [];
      return json({ content, hasNext: false, nextCursor: null });
    }
    if (path.endsWith(`/admin/email-review/${deliveryAccount}/${deliveryMonth}/${reviewNotification}/disposition`)) {
      const command = request.postDataJSON();
      dispositionWrites.push({ method: request.method(), command });
      if (dispositionReceipt === null) {
        dispositionReceipt = command;
        return route.abort('failed');
      }
      assert.deepEqual(command, dispositionReceipt, 'unknown disposition retry must replay the original command');
      return json({ reviewedAt: dispositionAt });
    }
    if (path.includes('/admin/email-deliveries/')) {
      deliveryReads.push({ method: request.method(), path });
      if (denyDelivery) return route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } });
      if (path.endsWith(`/${deliveryAccount}/${deliveryMonth}/${reviewNotification}`)) {
        return json({ status: 'REVIEW_REQUIRED', attempts: 10, attemptedAt: '2026-10-01T08:00:00Z', retryAt: null,
          deliveredAt: null, reviewedAt: dispositionReceipt ? dispositionAt : null });
      }
      if (!path.endsWith(`/${deliveryAccount}/${deliveryMonth}/${deliveredNotification}`)) {
        return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
      }
      return json({ status: 'DELIVERED', attempts: 2, attemptedAt: '2026-10-01T08:00:00Z', retryAt: null, deliveredAt: '2026-10-01T08:01:00Z' });
    }
    if (path.endsWith('/admin/system-settings')) { reads++; return json(readMode === 'invalid' ? [] : settings); }
    if (path.includes('/admin/system-settings/') && request.method() === 'PUT') {
      const command = request.postDataJSON(); writes.push(command);
      const key = path.split('/').at(-1);
      if (writeMode === 'forbidden') return route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } });
      if (writeMode === 'conflict') {
        settings = settings.map(setting => setting.key === key ? { ...setting, value: false, revision: externalRevision, updatedBy: actor.userId, updatedAt: '2026-10-23T09:01:00Z' } : setting);
        writeMode = 'normal'; return route.fulfill({ status: 409, json: { code: 'CONFLICT' } });
      }
      if (commits.has(command.commandId)) {
        assert.deepEqual(command, commits.get(command.commandId), 'replay payload must remain frozen');
        return json({ commandId: command.commandId, setting: settings.find(setting => setting.key === key), auditPending });
      }
      assert.equal(command.expectedRevision, settings.find(setting => setting.key === key).revision);
      settings = settings.map(setting => setting.key === key ? { ...setting, value: command.value, revision: command.commandId, updatedBy: actor.userId, updatedAt: '2026-10-23T09:00:00Z' } : setting);
      commits.set(command.commandId, command);
      if (writeMode === 'lost') { writeMode = 'normal'; return route.abort('failed'); }
      if (writeMode === 'held') { writeMode = 'normal'; await held; }
      return json({ commandId: command.commandId, setting: settings.find(setting => setting.key === key), auditPending });
    }
    return json({ content: [], hasNext: false });
  });
  await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
  await page.goto(`${baseUrl}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Cài đặt ứng dụng', exact: true }).first().click();
  const section = page.getByRole('region', { name: 'Cài đặt ứng dụng', exact: true });
  await section.getByText('Không tải được cài đặt. Thử lại để tiếp tục.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('form').count(), 0);
  readMode = 'ready'; await section.getByRole('button', { name: 'Thử lại', exact: true }).press('Enter');
  const booleanTitle = 'Cho phép tạo cộng đồng', numericTitle = 'Số thành viên mặc định';
  const editBoolean = section.getByRole('button', { name: `Chỉnh sửa ${booleanTitle}`, exact: true });
  const editNumeric = section.getByRole('button', { name: `Chỉnh sửa ${numericTitle}`, exact: true });
  const booleanRow = section.getByRole('article', { name: booleanTitle, exact: true });
  const numericRow = section.getByRole('article', { name: numericTitle, exact: true });
  await editBoolean.waitFor();
  const savedPreview = section.getByRole('figure', { name: 'Xem trước cài đặt đã lưu', exact: true });
  await savedPreview.locator('.community-settings-art img').waitFor();
  assert.equal(await savedPreview.getByRole('button', { name: 'Chỉnh quyền tạo cộng đồng', exact: true }).count(), 0, 'no duplicate preview controls');
  const editPreviewAccess = editBoolean;
  const beforePreviewWrites = writes.length;
  await editPreviewAccess.press('Enter');
  await page.getByRole('dialog', { name: booleanTitle, exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await editPreviewAccess.evaluate(element => element === document.activeElement), true, 'preview editor restores its own trigger');
  assert.equal(writes.length, beforePreviewWrites, 'visual preview cannot save without an explicit command');
  assert.equal(await page.getByRole('form').count(), 0, 'no permanent reason/save forms on the list');
  await page.screenshot({ path: 'artifacts/ui-audit/current/admin-settings-first-desktop.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.screenshot({ path: 'artifacts/ui-audit/current/admin-settings-first-mobile.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await editBoolean.click();
  const form = page.getByRole('form', { name: booleanTitle, exact: true });
  const dialog = page.getByRole('dialog', { name: booleanTitle, exact: true });
  await dialog.screenshot({ path: 'artifacts/ui-audit/current/system-setting-toggle-vi.png', animations: 'disabled' });
  const closeTarget = await dialog.getByRole('button', { name: 'Đóng', exact: true }).boundingBox();
  assert.ok(closeTarget?.width >= 44 && closeTarget.height >= 44, `dialog close has a44px touch target: ${JSON.stringify(closeTarget)}`);
  await form.getByRole('switch').focus(); await page.keyboard.press('Space');
  assert.equal(await form.getByRole('switch').isChecked(), false);
  await form.getByRole('textbox', { name: 'Lý do thay đổi', exact: true }).fill('Tạm dừng để bảo trì');
  writeMode = 'held';
  await form.getByRole('button', { name: 'Lưu thay đổi', exact: true }).press('Enter');
  await form.getByRole('button', { name: 'Lưu thay đổi', exact: true }).locator('[aria-hidden="true"]').waitFor();
  await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true, 'busy save cannot be dismissed');
  await dialog.screenshot({ path: 'artifacts/ui-audit/current/system-settings-pending-vi.png', animations: 'disabled' });
  releaseHeld(); await dialog.waitFor({ state: 'hidden' });
  await booleanRow.getByText('Đã lưu', { exact: true }).waitFor();
  assert.equal(await editBoolean.evaluate(element => element === document.activeElement), true, 'dialog returns focus to Edit');
  assert.equal(writes.length, 1); assert.equal(writes[0].value, false);
  assert.equal(await section.locator('figure').getAttribute('data-enabled'), 'false', 'preview follows saved policy');
  await editNumeric.click();
  const numeric = page.getByRole('form', { name: numericTitle, exact: true });
  const numericDialog = page.getByRole('dialog', { name: numericTitle, exact: true });
  const beforePresets = writes.length;
  for (const value of [50, 250, 1000]) {
    const preset = numeric.getByRole('button', { name: `Đặt giới hạn ${value} thành viên`, exact: true });
    await preset.press('Enter');
    assert.equal(await numeric.getByRole('spinbutton').inputValue(), String(value));
    assert.equal(await preset.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.system-setting-value[data-type="INTEGER"]').textContent(), '10.000', 'preset does not replace the saved value');
  }
  assert.equal(writes.length, beforePresets, 'presets cannot save without reason and explicit submission');
  for (const invalid of ['1', '2.5', '100001']) {
    await numeric.getByRole('spinbutton').fill(invalid);
    await numeric.getByRole('textbox').fill('Giới hạn cộng đồng mới');
    assert.equal(await numeric.getByRole('button', { name: 'Lưu thay đổi', exact: true }).isDisabled(), true);
  }
  await numeric.getByRole('spinbutton').fill('250');
  assert.equal(await page.locator('.community-preview').getByText('10.000', { exact: true }).count(), 1, 'unsaved draft cannot alter the preview');
  await page.keyboard.press('Escape'); await numericDialog.waitFor({ state: 'hidden' });
  await numericRow.getByText('Chưa lưu', { exact: true }).waitFor();
  assert.equal(await section.getByRole('button', { name: 'Tải lại cài đặt', exact: true }).isDisabled(), true, 'refresh cannot discard a retained draft');
  await page.getByRole('button', { name: 'Về ứng dụng', exact: true }).click();
  const exitDialog = page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?', exact: true });
  await exitDialog.waitFor();
  assert.equal(await exitDialog.getByRole('button', { name: 'Ở lại', exact: true }).evaluate(element => element === document.activeElement), true, 'safe action receives focus');
  await exitDialog.screenshot({ path: 'artifacts/ui-audit/current/system-settings-exit-draft-vi.png', animations: 'disabled' });
  await exitDialog.getByRole('button', { name: 'Ở lại', exact: true }).click();
  await exitDialog.waitFor({ state: 'hidden' });
  assert.equal(new URL(page.url()).pathname, '/admin', 'staying cannot navigate or lose the draft');
  assert.equal(await page.getByRole('button', { name: 'Về ứng dụng', exact: true }).evaluate(element => element === document.activeElement), true, 'stay returns focus to exit');
  assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), true, 'native reload warning is installed while a draft exists');
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).first().click();
  await page.getByRole('button', { name: 'Về ứng dụng', exact: true }).click();
  await exitDialog.waitFor(); await page.keyboard.press('Escape'); await exitDialog.waitFor({ state: 'hidden' });
  assert.equal(writes.length, 1, 'workspace switch or Stay/Escape cannot submit a draft');
  await page.getByRole('button', { name: 'Cài đặt ứng dụng', exact: true }).first().click();
  await editNumeric.click();
  assert.equal(await numeric.getByRole('spinbutton').inputValue(), '250');
  auditPending = true;
  await numeric.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await numericDialog.waitFor({ state: 'hidden' });
  await numericRow.getByText('Đã lưu · nhật ký đang cập nhật', { exact: true }).waitFor();
  await section.locator('figure').getByText('250', { exact: true }).waitFor();
  await editNumeric.click();
  await numeric.getByRole('button', { name: 'Dùng mặc định', exact: true }).click();
  assert.equal(await numeric.getByRole('spinbutton').inputValue(), '10000');
  await numeric.getByRole('button', { name: 'Hủy', exact: true }).click();
  await numericDialog.waitFor({ state: 'hidden' });
  await editNumeric.click(); assert.equal(await numeric.getByRole('spinbutton').inputValue(), '250');
  await page.keyboard.press('Escape'); await numericDialog.waitFor({ state: 'hidden' });
  await editBoolean.click();
  await form.getByRole('switch').check();
  await form.getByRole('textbox').fill('Mở lại cộng đồng');
  writeMode = 'conflict'; await form.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await form.getByText('Có bản mới. Nháp của bạn vẫn còn.', { exact: true }).waitFor();
  assert.equal(await form.getByRole('switch').isChecked(), true);
  assert.equal(await form.getByRole('textbox').inputValue(), 'Mở lại cộng đồng');
  assert.equal(await form.getByRole('button', { name: 'Lưu thay đổi', exact: true }).isDisabled(), true);
  await dialog.screenshot({ path: 'artifacts/ui-audit/current/system-settings-conflict-vi.png', animations: 'disabled' });
  readMode = 'invalid';
  await form.getByRole('button', { name: 'Tải bản mới, bỏ nháp', exact: true }).click();
  await form.getByText('Chưa tải được. Nháp vẫn còn.', { exact: true }).waitFor();
  assert.equal(await form.getByRole('textbox').inputValue(), 'Mở lại cộng đồng');
  readMode = 'ready';
  await form.getByRole('button', { name: 'Tải bản mới, bỏ nháp', exact: true }).click();
  await page.waitForFunction(element => element.getAttribute('aria-checked') === 'false', await form.getByRole('switch').elementHandle());
  assert.equal(await form.getByRole('textbox').count(), 0);
  await form.getByRole('switch').check(); await form.getByRole('textbox').fill('Mở sau bảo trì');
  writeMode = 'lost'; const beforeLost = commits.size;
  await form.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await form.getByText('Chưa nhận được xác nhận. Thử lại không tạo lần lưu mới.', { exact: true }).waitFor();
  assert.equal(await form.getByRole('textbox').isDisabled(), true);
  await dialog.screenshot({ path: 'artifacts/ui-audit/current/system-settings-uncertain-vi.png', animations: 'disabled' });
  const frozen = writes.at(-1);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await booleanRow.getByText('Chờ xác nhận', { exact: true }).waitFor();
  assert.equal(await section.getByRole('button', { name: 'Tải lại cài đặt', exact: true }).isDisabled(), true, 'unknown outcomes cannot be dropped by refresh');
  const unknownWrites = writes.length;
  await page.getByRole('button', { name: 'Về ứng dụng', exact: true }).click();
  const uncertainExit = page.getByRole('dialog', { name: 'Lần lưu chưa được xác nhận', exact: true });
  await uncertainExit.waitFor();
  const warningDescription = await uncertainExit.getAttribute('aria-describedby');
  assert.equal(await page.locator(`[id="${warningDescription}"]`).textContent(), 'Máy chủ có thể đã lưu. Rời trang không hủy lần lưu; bạn sẽ mất thông tin thử lại.');
  await uncertainExit.screenshot({ path: 'artifacts/ui-audit/current/system-settings-exit-uncertain-vi.png', animations: 'disabled' });
  await uncertainExit.getByRole('button', { name: 'Ở lại', exact: true }).press('Enter');
  await uncertainExit.waitFor({ state: 'hidden' });
  assert.equal(writes.length, unknownWrites, 'unknown-outcome exit warning cannot silently retry the command');
  await editNumeric.click(); await numeric.getByRole('spinbutton').fill('333'); await numeric.getByRole('textbox').fill('Nháp thứ hai');
  await page.keyboard.press('Escape'); await numericDialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Về ứng dụng', exact: true }).click();
  await uncertainExit.waitFor(); await uncertainExit.getByRole('button', { name: 'Ở lại', exact: true }).click();
  await uncertainExit.waitFor({ state: 'hidden' });
  await editNumeric.click(); await numeric.getByRole('button', { name: 'Hủy', exact: true }).click();
  await numericDialog.waitFor({ state: 'hidden' });
  assert.equal(await section.getByRole('button', { name: 'Tải lại cài đặt', exact: true }).isDisabled(), true, 'canceling one draft cannot clear another unknown save');
  await editBoolean.click();
  settings = settings.map(setting => setting.key === 'community.creationEnabled' ? { ...setting, value: false, revision: externalRevision } : setting);
  await form.getByRole('button', { name: 'Thử lại lần lưu', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await booleanRow.getByText('Đã tải bản mới', { exact: true }).waitFor();
  assert.deepEqual(writes.at(-1), frozen); assert.equal(commits.size, beforeLost + 1);
  assert.equal(await section.locator('figure').getAttribute('data-enabled'), 'false');
  auditPending = false;
  await editBoolean.click(); await form.getByRole('switch').check(); await form.getByRole('textbox').fill('Mở lại sau xác nhận');
  await form.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  stage = 'saved-reload'; await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Cài đặt ứng dụng', exact: true }).first().click();
  await editBoolean.waitFor();
  for (const value of [500, 250]) {
    settings = settings.map(setting => setting.key === 'community.defaultMaxMembers' ? { ...setting, value, revision: externalRevision, updatedAt: '2026-10-23T09:02:00Z', updatedBy: actor.userId } : setting);
    const beforeRefresh = reads;
    await section.getByRole('button', { name: 'Tải lại cài đặt', exact: true }).click();
    await section.locator('figure').getByText(String(value), { exact: true }).waitFor();
    assert.equal(reads, beforeRefresh + 1, 'settings refresh requests the actual catalog');
    await numericRow.getByText(String(value), { exact: true }).waitFor();
  }
  await page.getByRole('button', { name: 'Chuyển sang tiếng Anh', exact: true }).click();
  const english = page.getByRole('region', { name: 'Application settings', exact: true });
  const englishNumeric = page.getByRole('form', { name: 'Default member limit', exact: true });
  await english.getByRole('button', { name: 'Edit Default member limit', exact: true }).click();
  await englishNumeric.getByRole('spinbutton').fill('300'); await englishNumeric.getByRole('textbox').fill('Mobile workspace draft');
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 320, height: 1000 });
  assert.equal(await page.getByRole('button', { name: 'Back to app', exact: true }).count(), 1, 'mobile exit keeps its accessible name');
  await page.getByRole('combobox', { name: 'Administration workspace', exact: true }).selectOption('overview');
  await page.getByRole('combobox', { name: 'Administration workspace', exact: true }).selectOption('system-settings');
  await english.getByRole('button', { name: 'Edit Default member limit', exact: true }).click();
  assert.equal(await englishNumeric.getByRole('spinbutton').inputValue(), '300');
  assert.equal(await englishNumeric.getByRole('textbox').inputValue(), 'Mobile workspace draft');
  await englishNumeric.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const preview = english.getByRole('figure', { name: 'Saved settings preview', exact: true });
  const capacityPreview = english.getByRole('button', { name: 'Edit Default member limit', exact: true });
  await capacityPreview.press('Enter');
  await page.getByRole('dialog', { name: 'Default member limit', exact: true }).waitFor();
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await capacityPreview.evaluate(element => element === document.activeElement), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.ok(await preview.locator('.community-settings-art img').evaluate(element => parseFloat(getComputedStyle(element).transitionDuration) <= 0.00001));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForFunction(theme => document.documentElement.getAttribute('data-theme') === (theme === 'dark' ? 'dark' : null), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForFunction(() => scrollY === 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.getByRole('form').count(), 0);
      assert.equal(await page.locator('.admin-signal-strip, .admin-workspace-context, .page-kicker').count(), 0, 'no repeated hero, counters or breadcrumbs');
      const bottom = await english.getByRole('button', { name: 'Edit Default member limit', exact: true }).evaluate(element => element.getBoundingClientRect().bottom);
      assert.ok(bottom < 430, 'both actual settings actions are reachable in the first viewport');
      if (width >= 768) {
        const columns = await page.locator('.admin-workspace-nav button').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().left)));
        assert.equal(columns.length, 4, 'only destinations available to the system operator');
        assert.equal(new Set(columns).size, 1);
      }
      await page.screenshot({ path: `artifacts/ui-audit/current/system-settings-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
      await english.getByRole('button', { name: 'Edit Default member limit', exact: true }).click();
      const edit = page.getByRole('dialog', { name: 'Default member limit', exact: true });
      await edit.screenshot({ path: `artifacts/ui-audit/current/system-setting-editor-${theme}-${width}.png`, animations: 'disabled' });
      const box = await edit.evaluate(element => { const bounds = element.getBoundingClientRect(); return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: innerWidth, height: innerHeight }; });
      assert.ok(box.left >= 0 && box.right <= box.width && box.top >= 0 && box.bottom <= box.height, JSON.stringify({ theme, width, box }));
      await page.keyboard.press('Escape'); await edit.waitFor({ state: 'hidden' });
      await english.getByRole('button', { name: 'Edit Default member limit', exact: true }).click();
      await englishNumeric.getByRole('spinbutton').fill('300'); await englishNumeric.getByRole('textbox').fill('Exit layout check');
      await page.keyboard.press('Escape'); await edit.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Back to app', exact: true }).click();
      const leave = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
      await leave.screenshot({ path: `artifacts/ui-audit/current/system-settings-exit-${theme}-${width}.png`, animations: 'disabled' });
      const leaveBox = await leave.boundingBox();
      assert.ok(leaveBox.x >= 0 && leaveBox.y >= 0 && leaveBox.x + leaveBox.width <= width && leaveBox.y + leaveBox.height <= 1000, 'exit confirmation stays inside viewport');
      await page.keyboard.press('Escape'); await leave.waitFor({ state: 'hidden' });
      await english.getByRole('button', { name: 'Edit Default member limit', exact: true }).click();
      assert.equal(await englishNumeric.getByRole('spinbutton').inputValue(), '300');
      await englishNumeric.getByRole('button', { name: 'Cancel', exact: true }).click(); await edit.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false, 'cancel removes native warning');
      matrix.push({ theme, width, actionsBottom: Math.round(bottom) });
    }
  }
  await english.getByRole('button', { name: 'Edit Allow new communities', exact: true }).click();
  const englishForm = page.getByRole('form', { name: 'Allow new communities', exact: true });
  await englishForm.getByRole('switch').uncheck(); await englishForm.getByRole('textbox').fill('Permission recheck');
  writeMode = 'forbidden'; await englishForm.getByRole('button', { name: 'Save changes', exact: true }).click();
  await english.getByText('You do not have permission to change application settings.', { exact: true }).waitFor();
  await english.screenshot({ path: 'artifacts/ui-audit/current/system-settings-forbidden-en.png', animations: 'disabled' });
  assert.equal(await page.getByRole('form').count(), 0);
  assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false, 'revoked settings must clear unload protection and private drafts');
  writeMode = 'normal';
  await english.getByRole('button', { name: 'Retry', exact: true }).click();
  await english.getByRole('button', { name: 'Edit Default member limit', exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0, 'permission recovery cannot reopen an obsolete editor');
  const recoveredTrigger = english.getByRole('button', { name: 'Edit Default member limit', exact: true });
  await recoveredTrigger.click();
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await recoveredTrigger.evaluate(element => element === document.activeElement), true, 'recovered editor restores its current trigger');
  await context.route('**/noi-community-settings.webp', route => route.fulfill({ contentType: 'image/webp', body: 'invalid-image-fixture' }));
  await english.getByRole('button', { name: 'Refresh settings', exact: true }).click();
  await english.locator('.community-settings-art .brand-mark').waitFor();
  assert.equal(await english.getByRole('button', { name: 'Edit Default member limit', exact: true }).isEnabled(), true, 'artwork failure does not block operations');
  await context.unroute('**/noi-community-settings.webp');
  await english.getByRole('button', { name: 'Refresh settings', exact: true }).click();
  await page.waitForFunction(() => { const image = document.querySelector('.community-settings-art img'); return image?.complete && image.naturalWidth > 0; });
  stage = 'email-lookup';
  const lookupSummary = page.locator('summary').filter({ hasText: 'Email delivery lookup' });
  const accountField = page.getByLabel('Account ID', { exact: true });
  const monthField = page.getByLabel('Record month (UTC)', { exact: true });
  const notificationField = page.getByLabel('Notification ID', { exact: true });
  const lookupButton = page.getByRole('button', { name: 'Look up', exact: true });
  const delivered = page.getByText('Delivered', { exact: true });
  await lookupSummary.press('Enter');
  assert.equal(deliveryReads.length, 0, 'opening lookup does not read the ledger');
  await accountField.fill(deliveryAccount);
  await monthField.fill(deliveryMonth);
  await notificationField.fill(deliveredNotification);
  await lookupButton.press('Enter');
  await delivered.waitFor();
  await page.locator('time[datetime="2026-10-01T08:01:00Z"]').waitFor();
  assert.equal(await page.getByText('Attempts', { exact: true }).locator('..').locator('dd').textContent(), '2');
  await notificationField.fill(missingNotification);
  await delivered.waitFor({ state: 'hidden' });
  await lookupButton.click();
  await page.getByText('No email delivery matches these identifiers.', { exact: true }).waitFor();
  await notificationField.fill(deliveredNotification);
  denyDelivery = true;
  await lookupButton.click();
  await page.getByRole('alert').getByText('Your current session cannot look up deliveries.', { exact: true }).waitFor();
  assert.deepEqual(deliveryReads, [deliveredNotification, missingNotification, deliveredNotification].map(notification => ({
    method: 'GET',
    path: `${new URL(apiUrl).pathname}/admin/email-deliveries/${deliveryAccount}/${deliveryMonth}/${notification}`,
  })));
  await lookupSummary.press('Enter');
  await accountField.waitFor({ state: 'hidden' });
  stage = 'email-review';
  const reviewSummary = page.locator('summary').filter({ hasText: 'Emails to review' });
  assert.deepEqual(reviewReads, [], 'closed review queue must not fetch');
  await reviewSummary.press('Enter');
  await page.getByText('There are no entries on this page. You can load more.', { exact: true }).waitFor();
  const reviewDay = page.getByLabel('Email job date (UTC)', { exact: true });
  const initialDay = await reviewDay.inputValue();
  assert.match(initialDay, /^\d{4}-\d{2}-\d{2}$/);
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  const reviewRow = page.getByRole('button', { name: `Fill lookup for ${deliveredNotification}`, exact: true });
  await reviewRow.press('Enter');
  assert.equal(await accountField.inputValue(), deliveryAccount);
  assert.equal(await monthField.inputValue(), deliveryMonth);
  assert.equal(await notificationField.inputValue(), deliveredNotification);
  assert.equal(deliveryReads.length, 3, 'prefilling from review never reads the ledger without submission');
  denyDelivery = false;
  await lookupButton.click();
  await delivered.waitFor();
  assert.deepEqual(deliveryReads.at(-1), { method: 'GET',
    path: `${new URL(apiUrl).pathname}/admin/email-deliveries/${deliveryAccount}/${deliveryMonth}/${deliveredNotification}` });
  await page.getByRole('button', { name: 'Yesterday', exact: true }).click();
  await page.getByText('No emails to review for this date.', { exact: true }).waitFor();
  const priorDay = new Date(Date.parse(`${initialDay}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  assert.equal(await reviewDay.inputValue(), priorDay);
  assert.equal(await reviewRow.count(), 0, 'changing the review date clears old entries');
  assert.deepEqual(reviewReads, [
    { method: 'GET', day: initialDay, cursor: null },
    { method: 'GET', day: initialDay, cursor: reviewCursor },
    { method: 'GET', day: priorDay, cursor: null },
  ]);
  stage = 'email-review-disposition';
  dispositionDay = initialDay;
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  const dispositionRow = page.getByRole('button', { name: `Fill lookup for ${reviewNotification}`, exact: true });
  await dispositionRow.press('Enter');
  await lookupButton.click();
  const closeReview = page.getByRole('button', { name: 'Close review', exact: true });
  const dispositionReason = page.getByLabel('Reason for closing', { exact: true });
  await dispositionReason.fill('Verified in provider dashboard');
  await closeReview.click();
  const closeConfirmation = page.getByRole('dialog', { name: 'Close this review?', exact: true });
  await closeConfirmation.waitFor();
  await page.keyboard.press('Escape');
  await closeConfirmation.waitFor({ state: 'hidden' });
  assert.deepEqual(dispositionWrites, [], 'canceling confirmation must not write a disposition');
  await closeReview.click();
  await closeConfirmation.getByRole('button', { name: 'Confirm closure', exact: true }).click();
  const retryDisposition = page.getByRole('button', { name: 'Retry same closure', exact: true });
  await retryDisposition.waitFor();
  assert.equal(dispositionWrites.length, 1);
  assert.match(dispositionWrites[0].command.commandId, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  assert.equal(dispositionWrites[0].command.reason, 'Verified in provider dashboard');
  await retryDisposition.click();
  await page.getByText('Review closed', { exact: true }).waitFor();
  await dispositionRow.waitFor({ state: 'hidden' });
  assert.deepEqual(dispositionWrites, [dispositionWrites[0], dispositionWrites[0]]);
  assert.equal(dispositionWrites[0].method, 'PUT');
  assert.equal(await reviewDay.inputValue(), initialDay);
  assert.deepEqual(reviewReads.slice(3), [
    { method: 'GET', day: initialDay, cursor: null },
    { method: 'GET', day: initialDay, cursor: null },
  ]);
  canOperate = false; const previousReads = reads;
  stage = 'permission-reload'; await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Overview', exact: true, level: 1 }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Application settings', exact: true }).count(), 0);
  assert.equal(await lookupSummary.count(), 0, 'non-operators cannot open email lookup');
  assert.equal(await reviewSummary.count(), 0, 'non-operators cannot open email review');
  assert.equal(reads, previousReads);
  assert.deepEqual(errors, []); assert.equal(requestFailures.length, 2);
  assert.ok(requestFailures.some(failure => failure.url.includes('/admin/system-settings/')));
  assert.ok(requestFailures.some(failure => failure.url.endsWith('/disposition')));
  assert.deepEqual(consoleErrors.filter(error => {
    if (error.url.includes('/admin/email-deliveries/')) return !/404|403/.test(error.text);
    if (error.url.endsWith('/disposition')) return !/ERR_FAILED/.test(error.text);
    return !error.url.includes('/admin/system-settings/') || !/409|403|ERR_FAILED/.test(error.text);
  }), []);
  const exitCases = [];
  canOperate = true;
  for (const kind of ['clean', 'draft', 'uncertain']) {
    const exitPage = await page.context().newPage();
    await exitPage.goto(`${baseUrl}/admin`, { waitUntil: 'domcontentloaded' });
    await exitPage.getByRole('button', { name: 'Application settings', exact: true }).first().click();
    const exitSection = exitPage.getByRole('region', { name: 'Application settings', exact: true });
    await exitSection.getByRole('button', { name: 'Edit Default member limit', exact: true }).waitFor();
    const writesBefore = writes.length;
    if (kind !== 'clean') {
      await exitSection.getByRole('button', { name: 'Edit Default member limit', exact: true }).click();
      const editor = exitPage.getByRole('form', { name: 'Default member limit', exact: true });
      await editor.getByRole('spinbutton').fill('400'); await editor.getByRole('textbox').fill('Explicit exit check');
      if (kind === 'uncertain') {
        writeMode = 'lost';
        await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
        await editor.getByRole('button', { name: 'Retry this save', exact: true }).waitFor();
        assert.equal(await editor.getByRole('button', { name: 'Set limit to 50 members', exact: true }).isDisabled(), true, 'uncertain command locks presets too');
      }
      await exitPage.keyboard.press('Escape'); await exitPage.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await exitPage.getByRole('button', { name: 'Back to app', exact: true }).click();
    if (kind !== 'clean') {
      const confirmation = exitPage.getByRole('dialog', { name: kind === 'draft' ? 'Discard unsaved changes?' : 'Save not confirmed', exact: true });
      if (kind === 'uncertain') {
        const descriptionId = await confirmation.getAttribute('aria-describedby');
        assert.equal(await exitPage.locator(`[id="${descriptionId}"]`).textContent(), 'The server may have saved. Leaving does not cancel the save and loses the information needed to retry.');
        await confirmation.screenshot({ path: 'artifacts/ui-audit/current/system-settings-exit-uncertain-en.png', animations: 'disabled' });
      }
      await confirmation.getByRole('button', { name: 'Leave page', exact: true }).click();
    }
    await exitPage.waitForURL(`${baseUrl}/app`);
    assert.equal(writes.length, writesBefore + (kind === 'uncertain' ? 1 : 0), 'leaving never submits or retries a setting');
    exitCases.push(kind); await exitPage.close();
  }
  console.log(JSON.stringify({ passed: 41, matrix, exitCases, deliveryReads, reviewReads, dispositionWrites: dispositionWrites.length, writes: writes.length, commits: commits.size, expectedConsoleFailures: consoleErrors, errors, boundary: 'Production admin UI with controlled canonical transport and application-owned exit; not browser Back/Forward or live Cassandra' }));
} finally { await browser.close(); }
