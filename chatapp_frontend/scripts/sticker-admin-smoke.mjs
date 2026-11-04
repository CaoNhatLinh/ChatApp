import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3115';
const apiUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const actor = { userId: '00000000-0000-0000-0000-000000000010', username: 'operator', displayName: 'Operator', accountStatus: 'ACTIVE' };
let packs = [];
const writes = [];
let failNext = false;
let conflictNext = true;
let stickers = [];
const assetId = '00000000-0000-0000-0000-000000000050';
const imageUrl = 'https://fixture.example/sticker.png';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6SAAAAABJRU5ErkJggg==', 'base64');
const itemWrites = [];
let catalogStage = 'initial';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12000);
const errors = [];
const consoleErrors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
await page.route(imageUrl, route => route.fulfill({ contentType: 'image/png', body: pixel }));
await page.route(`${apiUrl}/**`, async route => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token, user: actor });
  if (path.endsWith('/auth/me')) return json(actor);
  if (path.endsWith('/admin/overview')) return json({ actorId: actor.userId, roles: ['APP_ADMIN'], permissions: ['SYSTEM_OPERATE'], availableRoleCodes: [] });
  if (path.endsWith('/health')) return json({ status: 'UP', cassandra: 'UP' });
  if (path.endsWith('/devices')) return json({ deviceId: 'sticker-browser-fixture' });
  if (path.endsWith('/files/upload')) return json({ success: true, file: { assetId, attachmentId: assetId, storageProvider: 'CLOUDINARY', storageKey: 'fixture/sticker', url: imageUrl, fileName: 'sticker.png', fileSize: pixel.length, contentType: 'image/png', resourceType: 'image' } });
  if (path.endsWith('/admin/sticker-packs') && request.method() === 'GET') return json({ content: packs, nextCursor: null, hasNext: false });
  if (path.endsWith('/admin/sticker-packs') && request.method() === 'POST') {
    const command = request.postDataJSON();
    writes.push(command);
    if (failNext) { failNext = false; return route.abort('failed'); }
    const pack = { ...command, coverAssetId: null, cover: null, isActive: false, revision: '00000000-0000-0000-0000-000000000020', updatedAt: '2026-10-12T08:00:00Z' };
    packs = [pack];
    return json({ commandId: command.commandId, pack: { ...pack, coverAssetId: null }, sticker: null, auditPending: false });
  }
  if (path.endsWith('/stickers') && request.method() === 'GET') return json({ content: stickers, nextCursor: null, hasNext: false });
  if (path.endsWith('/stickers') && request.method() === 'POST') {
    const command = request.postDataJSON(); itemWrites.push(command);
    const sticker = { ...command, stickerPackId: packs[0].stickerPackId, revision: '00000000-0000-0000-0000-000000000030', image: { assetId, url: imageUrl, mimeType: 'image/png', width: 1, height: 1 } };
    stickers = [sticker]; packs[0].revision = '00000000-0000-0000-0000-000000000031';
    return json({ commandId: command.commandId, pack: packs[0], sticker: { ...sticker, assetId }, auditPending: false });
  }
  if (request.method() === 'GET' && path.includes('/stickers/')) return json({ packRevision: packs[0].revision, sticker: stickers[0] });
  if (request.method() === 'GET' && path.includes('/admin/sticker-packs/')) return json(packs[0]);
  if (request.method() === 'PUT' && path.includes('/admin/sticker-packs/')) {
    if (conflictNext) { conflictNext = false; packs[0].revision = '00000000-0000-0000-0000-000000000021'; return json({ message: 'stale' }, 409); }
    const command = request.postDataJSON();
    if (path.includes('/stickers/')) { itemWrites.push(command); stickers[0] = { ...stickers[0], ...command }; }
    else packs[0] = { ...packs[0], ...command };
    packs[0].revision = '00000000-0000-0000-0000-000000000040';
    return json({ commandId: command.commandId, pack: packs[0], sticker: null, auditPending: false });
  }
  return json({});
});
await page.addInitScript(() => { document.cookie = 'novachat_session=1; Path=/; SameSite=Lax'; });
try {
  await page.goto(`${baseUrl}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: 'Sticker', exact: true }).click();
  await page.getByText('Chưa có bộ sticker nào.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Tạo bộ sticker', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 1000 });
  const newPackTitle = page.getByRole('heading', { name: 'Bộ mới', exact: true });
  assert.equal(await newPackTitle.evaluate(element => element === document.activeElement), true, 'Create must visibly hand off focus to the editor');
  await page.getByRole('button', { name: 'Danh sách bộ sticker', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Tạo bộ sticker', exact: true }).evaluate(element => element === document.activeElement), true);
  await page.getByRole('button', { name: 'Tạo bộ sticker', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Tên bộ').fill('Letters');
  await page.getByLabel('Lý do thay đổi').fill('Approved artwork collection');
  failNext = true;
  await page.getByRole('button', { name: 'Lưu bộ', exact: true }).click();
  await page.getByText('Chưa xác nhận được kết quả lưu. Thử lưu lại cùng thao tác trước khi sửa tiếp.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Tên bộ').inputValue(), 'Letters');
  await page.getByRole('button', { name: 'Lưu bộ', exact: true }).click();
  await page.getByText('Đã lưu thay đổi.', { exact: true }).waitFor();
  assert.equal(writes.length, 2);
  assert.equal(writes[0].commandId, writes[1].commandId);
  assert.equal(writes[0].stickerPackId, writes[1].stickerPackId);
  await page.getByLabel('Tên bộ').fill('Edited draft');
  await page.getByLabel('Lý do thay đổi').fill('Update title');
  await page.getByRole('button', { name: 'Lưu bộ', exact: true }).click();
  await page.getByText('Bộ này đã thay đổi. Tải bản mới trước khi lưu; nội dung bạn nhập vẫn được giữ.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Tên bộ').inputValue(), 'Edited draft');
  await page.getByRole('button', { name: 'Tải bản mới', exact: true }).click();
  assert.equal(await page.getByLabel('Tên bộ').inputValue(), 'Edited draft');
  await page.getByRole('button', { name: 'Lưu bộ', exact: true }).click();
  await page.getByText('Đã lưu thay đổi.', { exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.getByText('Bộ này chưa có sticker.', { exact: true }).waitFor();
  assert.equal(await page.locator('section[aria-labelledby="sticker-inventory-title"] .admin-sticker-shelf-art').isVisible(), true);
  const addSticker = page.getByRole('button', { name: 'Thêm sticker', exact: true });
  await addSticker.press('Enter');
  const newStickerForm = page.getByRole('form', { name: 'Sticker mới', exact: true });
  assert.equal(await newStickerForm.getByRole('heading').evaluate(element => element === document.activeElement), true);
  await newStickerForm.getByRole('button', { name: 'Hủy', exact: true }).press('Enter');
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Thêm sticker');
  await addSticker.press('Enter');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Tên sticker', { exact: true }).fill('Wave');
  await page.getByLabel('Hình sticker', { exact: true }).setInputFiles({ name: 'sticker.png', mimeType: 'image/png', buffer: pixel });
  await page.getByLabel('Thứ tự trong bộ').fill('7');
  await page.getByLabel('Lý do chỉnh sticker').fill('Approved artwork');
  await page.getByLabel('Cho phép chọn sticker này').check();
  await page.getByLabel('Tôi đã kiểm tra hình và có quyền sử dụng.').check();
  await page.getByRole('button', { name: 'Lưu sticker', exact: true }).click();
  await page.getByText('Đã lưu sticker.', { exact: true }).waitFor();
  assert.equal(itemWrites[0].assetId, assetId);
  assert.equal(itemWrites[0].sortOrder, 7);
  assert.equal(itemWrites[0].artworkReviewed, true);
  const wave = page.getByRole('button', { name: 'Wave Đã công bố', exact: true });
  await wave.press('Enter');
  const editStickerForm = page.getByRole('form', { name: 'Chỉnh sửa sticker', exact: true });
  assert.equal(await editStickerForm.getByRole('heading').evaluate(element => element === document.activeElement), true);
  assert.equal(await editStickerForm.getByRole('img', { name: 'Wave', exact: true }).getAttribute('src'), imageUrl);
  await editStickerForm.getByRole('button', { name: 'Hủy', exact: true }).press('Enter');
  await page.waitForFunction(() => document.activeElement?.textContent?.trim().startsWith('Wave'));
  await wave.press('Enter');
  await page.getByLabel('Tên sticker', { exact: true }).fill('Draft wave');
  await page.getByLabel('Lý do chỉnh sticker').fill('Compare concurrent edit');
  conflictNext = true;
  await page.getByRole('button', { name: 'Lưu sticker', exact: true }).click();
  await page.getByRole('button', { name: 'Tải bản mới', exact: true }).click();
  await page.getByText('Sticker đang lưu trên máy chủ', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Tên sticker', { exact: true }).inputValue(), 'Draft wave');
  await mkdir('artifacts/ui-audit/current', { recursive: true });
  await page.addStyleTag({ content: 'nextjs-portal { visibility: hidden !important; }' });
  for (const theme of ['light', 'dark']) {
    await page.getByRole('button', { name: 'Đổi giao diện', exact: true }).click();
    await page.getByRole('menuitem', { name: theme === 'light' ? 'Sáng' : 'Tối', exact: true }).click();
    await page.waitForFunction(value => (document.documentElement.dataset.theme === 'dark') === (value === 'dark'), theme);
    await page.waitForTimeout(300);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `artifacts/ui-audit/current/admin-stickers-conflict-${theme}-${width}.png`, fullPage: true });
    }
  }
  await page.getByLabel('Tên sticker', { exact: true }).fill('Wave');
  await page.getByLabel('Cho phép chọn sticker này').uncheck();
  await page.getByLabel('Lý do chỉnh sticker').fill('Withdraw from picker');
  await page.getByRole('button', { name: 'Lưu sticker', exact: true }).click();
  await page.getByRole('dialog', { name: 'Gỡ sticker khỏi danh mục?' }).getByRole('button', { name: 'Gỡ khỏi danh mục', exact: true }).click();
  await page.getByRole('button', { name: 'Wave Chưa công bố', exact: true }).waitFor();
  assert.equal(itemWrites.at(-1).isActive, false);
  await mkdir('artifacts/ui-audit/current', { recursive: true });
  const backgrounds = [];
  // Only the development overlay is hidden; application/error UI stays visible.
  await page.addStyleTag({ content: 'nextjs-portal { visibility: hidden !important; }' });
  for (const theme of ['light', 'dark']) {
    await page.getByRole('button', { name: 'Đổi giao diện', exact: true }).click();
    await page.getByRole('menuitem', { name: theme === 'light' ? 'Sáng' : 'Tối', exact: true }).click();
    await page.waitForFunction(value => (document.documentElement.dataset.theme === 'dark') === (value === 'dark'), theme);
    await page.waitForTimeout(300);
    backgrounds.push(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no overflow ${theme}/${width}`);
      if (width >= 768) {
        const columns = await page.locator('.admin-workspace-nav button').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().left)));
        assert.equal(columns.length, 4, 'only destinations available to the system operator');
        assert.equal(new Set(columns).size, 1, 'destinations share one compact navigation column');
      }
      await page.screenshot({ path: `artifacts/ui-audit/current/admin-stickers-${theme}-${width}.png`, fullPage: true });
    }
  }
  assert.notEqual(backgrounds[0], backgrounds[1], 'theme evidence must use the real data-theme selector');
  await page.getByRole('button', { name: 'Chuyển sang tiếng Anh' }).click();
  await page.getByRole('heading', { name: 'Sticker packs', exact: true }).waitFor();
  await page.getByLabel('Pack name', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add sticker', exact: true }).waitFor();
  // Existing local brand assets are synthetic catalog imagery, not real packs.
  packs = [packs[0], ...[
    ['Orbit', `${baseUrl}/noi-default-avatar.webp`],
    ['Signal', `${baseUrl}/noi-signal-orbit.svg`],
    ['Unavailable', `${baseUrl}/fixture-invalid-cover.png`],
  ].map(([name, url], index) => ({ ...packs[0], stickerPackId: `00000000-0000-0000-0000-00000000008${index}`, name,
    isActive: true, coverAssetId: assetId, cover: { assetId, url, mimeType: 'image/png', width: 200, height: 200 } }))];
  await page.route('**/fixture-invalid-cover.png', route => route.fulfill({ contentType: 'image/png', body: 'invalid' }));
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.locator('.admin-sticker-shelf').getByRole('button', { name: 'Orbit Published', exact: true }).waitFor();
  const unavailableCover = page.locator('.admin-sticker-pack').filter({ hasText: 'Unavailable' });
  await unavailableCover.scrollIntoViewIfNeeded();
  await unavailableCover.getByLabel('No cover image').waitFor();
  for (const theme of ['light', 'dark']) {
    await page.getByRole('button', { name: 'Change theme', exact: true }).click();
    await page.getByRole('menuitem', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).click();
    await page.waitForFunction(value => (document.documentElement.dataset.theme === 'dark') === (value === 'dark'), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const backToPacks = page.getByRole('button', { name: 'Sticker pack list', exact: true });
      catalogStage = `${theme}/${width}`;
      if (width < 1024 && await page.locator('.admin-sticker-panel').getAttribute('data-editing') === 'true') await backToPacks.click();
      await page.locator('.admin-sticker-catalog').waitFor({ state: 'visible' });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('.admin-sticker-cover img').first().evaluate(image => image.decode());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `shelf fits ${theme}/${width}`);
      await page.screenshot({ path: `artifacts/ui-audit/current/admin-sticker-shelf-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
      if (width < 1024) {
        const coverTrigger = page.locator('.admin-sticker-shelf').getByRole('button', { name: 'Orbit Published', exact: true });
        await coverTrigger.press('Enter');
        const title = page.getByRole('heading', { name: 'Edit pack', exact: true });
        assert.equal(await title.evaluate(element => element === document.activeElement), true, 'cover selection focuses the real editor');
        assert.equal(await page.locator('.admin-sticker-catalog').isVisible(), false, 'mobile owns one pane');
        await page.getByLabel('Pack name', { exact: true }).fill(`Retained ${theme}/${width}`);
        await page.screenshot({ path: `artifacts/ui-audit/current/admin-sticker-editor-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
        await backToPacks.click();
        assert.equal(await coverTrigger.evaluate(element => element === document.activeElement), true, 'Back returns to the selected cover');
        await coverTrigger.press('Enter');
        assert.equal(await page.getByLabel('Pack name', { exact: true }).inputValue(), `Retained ${theme}/${width}`, 'Back and same-pack selection preserve the mounted draft');
        await backToPacks.click();
      }
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors.filter(message => !message.includes('net::ERR_FAILED') && !message.includes('409 (Conflict)')), [], 'no unexpected React/runtime console errors');
  console.log(JSON.stringify({ passed: 18, consoleErrors, boundary: 'Browser UI with isolated API fixtures; not live Cassandra/Cloudinary' }));
} catch (error) {
  await page.screenshot({ path: 'artifacts/ui-audit/current/admin-sticker-failure.png', fullPage: true, animations: 'disabled' });
  console.error(JSON.stringify({ catalogStage, shelf: await page.locator('.admin-sticker-shelf').innerText(), buttons: await page.locator('.admin-sticker-pack').evaluateAll(buttons => buttons.map(button => ({ text: button.textContent, disabled: button.disabled, pressed: button.getAttribute('aria-pressed') }))) }));
  throw error;
} finally { await browser.close(); }
