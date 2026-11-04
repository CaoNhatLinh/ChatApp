import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const captureVisualAudit = process.env.VISUAL_AUDIT_CAPTURE === '1';
const pinLookupRecovery = process.env.PIN_LOOKUP_RECOVERY === '1';
let pinLookups = 0;
let releasePinRetry;
const pinRetryGate = new Promise(resolve => { releasePinRetry = resolve; });
const pinRecoveryMatrix = [];
const captureDirectory = 'artifacts/ui-audit/current';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const ownerId = '00000000-0000-0000-0000-000000000401';
const conversationId = '00000000-0000-0000-0000-000000000402';
const messageId = '40000000-0000-1000-8000-000000000403';
const messageBucket = '2026-08-30-12:03';
const createdAt = '2026-08-30T12:05:00Z';
const latestReadAt = '2026-08-30T12:08:00Z';
const firstReaderId = '40000000-0000-0000-0000-000000000404';
const secondReaderId = '40000000-0000-0000-0000-000000000405';
const mentionTargetId = '40000000-0000-0000-0000-000000000406';
const readReceiptRequests = [];
const mentionSendRequests = [];
const memberRequests = [];
const reportRequests = [];
let reportFailuresRemaining = 2;

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
  name: 'Message Interactions',
  description: 'Message interaction verification',
  createdBy: ownerId,
  ownerId,
  createdAt,
  updatedAt: createdAt,
  isDeleted: false,
  lastActivityAt: createdAt,
  memberCount: 2,
  defaultNotificationLevel: 'ALL',
  chatMode: 'OPEN',
  slowModeSeconds: 0,
};
let message = {
  conversationId,
  messageBucket,
  messageId,
  senderId: ownerId,
  content: 'Tin nhắn có tương tác bền vững',
  revision: 0, messageType: 'TEXT',
  contentFormat: 'PLAIN_TEXT',
  isDeleted: false,
  hasAttachments: false,
  hasMentions: false,
  isPinned: false,
  createdAt,
};
let reactions = [{ emoji: 'like', count: 3, reactedByCurrentUser: true }];
const peerMessage = { ...message, messageId: '40000001-0000-1000-8000-000000000403', senderId: firstReaderId,
  content: 'Tin nhắn của thành viên khác' };

const pinRequests = [];
let pinRevision = 0;
const pinState = () => ({ conversationId, revision: String(pinRevision), pins: message.isPinned ? [{ messageId, messageBucket }] : [] });
const reactionRequests = [];
const consoleErrors = [];
const requestFailures = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(10_000);

page.on('console', (entry) => {
  const location = entry.location();
  const expectedReportFailure = location.url.endsWith('/reports') && entry.text().includes('503');
  if (entry.type() === 'error' && !expectedReportFailure && !location.url.includes('/ws/') && !entry.text().includes('/ws/')) {
    consoleErrors.push({ text: entry.text(), url: location.url });
  }
});
page.on('requestfailed', (request) => {
  const error = request.failure()?.errorText;
  const isViewportAssetAbort = error === 'net::ERR_ABORTED' && request.resourceType() === 'image';
  if (!request.url().includes('/ws/') && !isViewportAssetAbort) requestFailures.push({ url: request.url(), error });
});

await page.route(`${apiBaseUrl}/**`, async (route) => {
  const request = route.request();
  const requestUrl = new URL(request.url());
  const path = requestUrl.pathname;
  const method = request.method();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(operator);
  if (path.endsWith(`/users/${firstReaderId}`)) return json({ userId: firstReaderId, username: 'first-reader', displayName: 'First Reader', accountStatus: 'ACTIVE' });
  if (path.endsWith(`/friends/check-block/${firstReaderId}`)) return json({ hasBlocked: false, isBlockedBy: false });
  if (path.endsWith(`/friends/mutual/${firstReaderId}`)) return json([]);
  if (path.endsWith('/devices')) return json({ deviceId: 'device-message-interactions' });
  if (path.endsWith('/reports') && method === 'POST') {
    const payload = request.postDataJSON();
    reportRequests.push({ payload, key: request.headers()['idempotency-key'] });
    if (reportFailuresRemaining > 0) {
      reportFailuresRemaining--;
      return json({ code: 'SERVICE_UNAVAILABLE', message: 'Retry shortly' }, 503);
    }
    return json({ ...payload, reportId: '00000000-0000-0000-0000-000000000451', reporterId: ownerId, status: 'OPEN' }, 201);
  }
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations') && method === 'GET') {
    return json({
      content: [{ conversation, pinned: false, unreadCount: 0, joinedAt: createdAt, notificationOverride: 'INHERIT', lastMessage: null }],
      nextCursor: null,
      hasNext: false,
    });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages`) && method === 'GET') {
    return json({
      content: [peerMessage, message],
      nextCursor: null,
      hasNext: false,
      interactions: [{ messageId, reactions, latestReadAt }],
      polls: [],
    });
  }
  if (path.endsWith(`/messages/${messageId}/replies`)) {
    return json({ parent: message, content: [], nextCursor: null, hasNext: false });
  }
  if (path.endsWith(`/conversations/${conversationId}/members`) && method === 'GET') {
    memberRequests.push(request.url());
    return json({
      content: [{
        userId: mentionTargetId,
        conversationId,
        role: 'member',
        roleIds: [],
        joinedAt: createdAt,
        username: 'mention-target',
        displayName: 'Mention Target',
        avatarUrl: null,
        mutedUntil: null,
        messageIntervalSeconds: null,
      }],
      nextCursor: null,
      hasNext: false,
    });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages`) && method === 'POST') {
    const payload = request.postDataJSON();
    mentionSendRequests.push(payload);
    return json({
      ...message,
      messageId: payload.replyToMessageId ? '40000000-0000-1000-8000-000000000408' : '40000000-0000-1000-8000-000000000407',
      clientMessageId: payload.clientMessageId,
      content: payload.content,
      hasMentions: true,
      replyToMessageId: payload.replyToMessageId,
      replyToMessageBucket: payload.replyToMessageBucket,
      replyToSenderId: payload.replyToMessageId ? ownerId : null,
    }, 201);
  }
  if (path.endsWith(`/conversations/${conversationId}/messages/${messageId}/read-receipts`) && method === 'GET') {
    const cursor = requestUrl.searchParams.get('cursor');
    readReceiptRequests.push({
      cursor,
      limit: requestUrl.searchParams.get('limit'),
    });
    return json(cursor
      ? {
        content: [{ readerId: secondReaderId, username: 'second-reader', displayName: 'Second Reader', avatarUrl: null, readAt: '2026-08-30T12:09:00Z' }],
        nextCursor: null,
        hasNext: false,
      }
      : {
        content: [{ readerId: firstReaderId, username: 'first-reader', displayName: 'First Reader', avatarUrl: null, readAt: latestReadAt }],
        nextCursor: firstReaderId,
        hasNext: true,
      });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages/${messageId}/pin`)) {
    const expectedRevision = request.postDataJSON().expectedRevision;
    if (expectedRevision !== String(pinRevision)) return json({ message: 'Pin conflict' }, 409);
    pinRequests.push({ method, bucket: requestUrl.searchParams.get('bucket'), expectedRevision });
    message = { ...message, isPinned: method === 'POST' };
    pinRevision++;
    return json({ message, pinState: pinState() });
  }
  if (path.endsWith(`/conversations/${conversationId}/messages/pins`)) {
    pinLookups++;
    if (pinLookupRecovery && pinLookups <= 2) {
      if (pinLookups === 2) await pinRetryGate;
      return json({ conversationId, revision: null, pins: [] });
    }
    return json(pinState());
  }
  if (path.endsWith(`/conversations/${conversationId}/messages/${messageId}/reactions`)) {
    const emoji = method === 'POST' ? request.postDataJSON().emoji : requestUrl.searchParams.get('emoji');
    reactionRequests.push({ method, bucket: requestUrl.searchParams.get('bucket'), emoji });
    if (method === 'DELETE' && emoji === 'like') {
      reactions = [{ emoji: 'like', count: 2, reactedByCurrentUser: false }];
    }
    if (method === 'POST' && emoji === 'love') {
      reactions = [...reactions, { emoji: 'love', count: 1, reactedByCurrentUser: true }];
    }
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith(`/conversations/${conversationId}/notification-policy`)) {
    return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  }
  if (path.includes('/friendships/requests')) return json({ content: [], userDetails: [], hasNext: false });
  if (path.includes('/friends/status/')) return json([]);
  if (path.includes('/notifications/unread/count')) return json({ count: 0 });
  if (path.includes('/notifications')) return json({ content: [], hasNext: false });
  if (path.includes('/invites/conversation/')) return json([]);
  return json({ content: [], userDetails: [], hasNext: false });
});

await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});

const openConversation = async () => {
  await page.getByText('Message Interactions', { exact: true }).first().click();
  const row = page.locator(`[data-message-id="${messageId}"]`);
  await row.getByText(message.content, { exact: true }).waitFor();
  return row;
};

await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
let messageRow = await openConversation();
const peerRow = page.locator(`[data-message-id="${peerMessage.messageId}"]`);
const openMessageReport = async () => {
  await peerRow.hover();
  await peerRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
  await page.getByRole('menuitem', { name: 'Báo cáo', exact: true }).click();
};
await openMessageReport();
const reportDialog = page.getByRole('dialog', { name: 'Báo cáo tin nhắn', exact: true });
const reportDescription = reportDialog.getByRole('textbox');
const sendReport = reportDialog.getByRole('button', { name: 'Gửi báo cáo', exact: true });
await reportDescription.fill('Đường dẫn giả mạo');
await sendReport.evaluate(button => { button.click(); button.click(); });
await reportDialog.getByRole('alert').waitFor();
assert.equal(reportRequests.length, 1, 'rapid repeated activation issues one request');
await reportDialog.getByRole('button', { name: 'Hủy', exact: true }).click();
await reportDialog.waitFor({ state: 'hidden' });
await openMessageReport();
await reportDescription.fill('  Đường dẫn giả mạo  ');
await sendReport.click();
await reportDialog.getByRole('alert').waitFor();
await reportDescription.fill('Đường dẫn giả mạo lần nữa');
await sendReport.click();
await reportDialog.waitFor({ state: 'hidden' });
const reportInput = { targetType: 'MESSAGE', conversationId, messageBucket,
  messageId: peerMessage.messageId, reasonCode: 'SPAM', description: 'Đường dẫn giả mạo' };
assert.deepEqual(reportRequests.map(({ payload }) => payload), [reportInput, reportInput,
  { ...reportInput, description: 'Đường dẫn giả mạo lần nữa' }]);
const [firstReport, retriedReport, changedReport] = reportRequests;
assert.match(firstReport.key, /^[0-9a-f-]{36}$/);
assert.equal(retriedReport.key, firstReport.key);
assert.match(changedReport.key, /^[0-9a-f-]{36}$/);
assert.notEqual(changedReport.key, firstReport.key);

await peerRow.getByAltText('Ảnh đại diện mặc định', { exact: true }).click();
const profile = page.getByRole('dialog', { name: 'First Reader', exact: true });
await profile.getByRole('button', { name: 'Báo cáo hồ sơ', exact: true }).click();
const userReportDialog = page.getByRole('dialog', { name: 'Báo cáo hồ sơ', exact: true });
const sendUserReport = userReportDialog.getByRole('button', { name: 'Gửi báo cáo', exact: true });
reportFailuresRemaining = 1;
await sendUserReport.click();
await userReportDialog.getByRole('alert').waitFor();
await sendUserReport.click();
await userReportDialog.waitFor({ state: 'hidden' });
const userReportInput = { targetType: 'USER', targetUserId: firstReaderId, reasonCode: 'SPAM' };
assert.deepEqual(reportRequests.slice(3).map(({ payload }) => payload), [userReportInput, userReportInput]);
assert.match(reportRequests[3].key, /^[0-9a-f-]{36}$/);
assert.equal(reportRequests[3].key, reportRequests[4].key);
assert.notEqual(reportRequests[3].key, changedReport.key);
await profile.waitFor({ state: 'hidden' });
if (pinLookupRecovery) {
  const feedback = page.getByRole('status').filter({ hasText: 'Chưa đồng bộ được tin nhắn ghim.' });
  await feedback.waitFor();
  await mkdir(captureDirectory, { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForFunction(theme => document.documentElement.getAttribute('data-theme') === (theme === 'dark' ? 'dark' : null), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const bounds = await feedback.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `${captureDirectory}/message-pin-retry-${theme}-${width}.png`, animations: 'disabled' });
      pinRecoveryMatrix.push({ theme, width });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await feedback.getByRole('button', { name: 'Thử lại', exact: true }).press('Enter');
  const pending = page.getByRole('status').filter({ hasText: 'Đang đồng bộ tin nhắn ghim…' });
  await pending.waitFor();
  assert.equal(await pending.getByRole('button', { name: 'Thử lại', exact: true }).isDisabled(), true);
  releasePinRetry();
  await feedback.waitFor();
  await feedback.getByRole('button', { name: 'Thử lại', exact: true }).press('Enter');
  await feedback.waitFor({ state: 'detached' });
  await pending.waitFor({ state: 'detached' });
  assert.equal(pinLookups, 3, 'initial lookup and exactly two explicit retries');
}
await messageRow.getByRole('button', { name: 'Thích: 3' }).waitFor();
await messageRow.getByRole('button', { name: 'Đã xem' }).waitFor();
await messageRow.getByRole('button', { name: 'Đã xem' }).click();
const readReceiptDialog = page.getByRole('dialog');
await readReceiptDialog.getByRole('heading', { name: 'Danh sách người đã xem' }).waitFor();
await readReceiptDialog.getByText('First Reader', { exact: true }).waitFor();
await readReceiptDialog.getByRole('button', { name: 'Tải thêm người đã xem' }).click();
await readReceiptDialog.getByText('Second Reader', { exact: true }).waitFor();
await readReceiptDialog.getByRole('button', { name: 'Đóng' }).first().click();
if (JSON.stringify(readReceiptRequests) !== JSON.stringify([
  { cursor: null, limit: '25' },
  { cursor: firstReaderId, limit: '25' },
])) {
  throw new Error(`Unexpected read receipt requests: ${JSON.stringify(readReceiptRequests)}`);
}

const composer = page.locator('textarea').last();
await composer.fill('@mention');
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Mention Target/ }).click();
await composer.fill(`${await composer.inputValue()}hello`);
await page.getByRole('button', { name: 'Gửi tin' }).click();
await page.waitForTimeout(250);
const sentMention = mentionSendRequests.at(-1);
if (!sentMention
  || sentMention.mentionedUserIds?.length !== 1
  || sentMention.mentionedUserIds[0] !== mentionTargetId
  || sentMention.mentionEveryone !== false
  || !sentMention.content.includes(`|${mentionTargetId}]`)) {
  throw new Error(`Mention payload was not canonical: ${JSON.stringify(sentMention)}`);
}

await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Ghim' }).click();
await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Bỏ ghim' }).waitFor();
await page.keyboard.press('Escape');

await page.waitForTimeout(3_000);
await messageRow.getByRole('button', { name: 'Thích: 3' }).click();
await messageRow.getByRole('button', { name: 'Thêm cảm xúc' }).click();
if (captureVisualAudit) {
  await mkdir(captureDirectory, { recursive: true });
  await page.screenshot({ path: `${captureDirectory}/message-reaction-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await messageRow.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${captureDirectory}/message-reaction-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
}
await page.getByRole('button', { name: 'Yêu thích' }).click();

await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Trả lời', exact: true }).click();
if (captureVisualAudit) {
  await page.screenshot({ path: `${captureDirectory}/message-reply-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await messageRow.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${captureDirectory}/message-reply-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
}

await composer.fill('Đã nhận, mình trả lời ở đây.');
await page.getByRole('button', { name: 'Gửi tin' }).click();
const replyReference = page.getByRole('button', { name: 'Xem tin nhắn gốc', exact: true });
await replyReference.waitFor();
const sentReply = mentionSendRequests.at(-1);
if (sentReply.replyToMessageId !== messageId || sentReply.replyToMessageBucket !== messageBucket || sentReply.replyToSenderId !== undefined) {
  throw new Error(`Reply key was not preserved: ${JSON.stringify(sentReply)}`);
}
if (captureVisualAudit) {
  await page.screenshot({ path: `${captureDirectory}/reply-confirmed-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.waitForFunction(() => {
    const sidebar = document.querySelector('.messenger-workspace .-translate-x-full');
    return sidebar && sidebar.getBoundingClientRect().right <= 1;
  });
  await replyReference.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${captureDirectory}/reply-confirmed-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
}
await replyReference.click();
const threadDialog = page.getByRole('dialog', { name: 'Trả lời tin nhắn', exact: true });
await threadDialog.getByText(message.content, { exact: true }).waitFor();
await threadDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
await page.reload({ waitUntil: 'domcontentloaded' });
messageRow = await openConversation();
await messageRow.getByRole('button', { name: 'Thích: 2' }).waitFor();
await messageRow.getByRole('button', { name: 'Yêu thích: 1' }).waitFor();
await messageRow.hover();
await messageRow.getByRole('button', { name: 'Tùy chọn khác' }).click();
await page.getByRole('menuitem', { name: 'Bỏ ghim' }).click();

const retryStorageKey = 'noi:report-retry:v1';
const reloadDraft = 'Mô tả chỉ dùng để kiểm tra lần tải lại';
const sendReloadDraft = async () => {
  await openMessageReport();
  await reportDescription.fill(reloadDraft);
  await sendReport.click();
};
reportFailuresRemaining = 1;
await sendReloadDraft();
await reportDialog.getByRole('alert').waitFor();
const pendingKey = reportRequests.at(-1).key;
const persisted = await page.evaluate(key => sessionStorage.getItem(key), retryStorageKey);
assert.ok(!persisted.includes(reloadDraft) && !persisted.includes(peerMessage.messageId) && !persisted.includes(ownerId));
const storedAttempt = JSON.parse(persisted).find(entry => entry.key === pendingKey);
assert.deepEqual(Object.keys(storedAttempt).sort(), ['createdAt', 'fingerprint', 'key']);
assert.match(storedAttempt.fingerprint, /^[0-9a-f]{64}$/);
await page.reload({ waitUntil: 'domcontentloaded' });
messageRow = await openConversation();
await sendReloadDraft();
await reportDialog.waitFor({ state: 'hidden' });
assert.equal(reportRequests.at(-1).key, pendingKey, 'reload in the same tab retains the unconfirmed report identity');
const remaining = await page.evaluate(key => sessionStorage.getItem(key), retryStorageKey);
assert.ok(!remaining?.includes(pendingKey), 'success removes the confirmed key');
await sendReloadDraft();
await reportDialog.waitFor({ state: 'hidden' });
assert.notEqual(reportRequests.at(-1).key, pendingKey, 'an intentional new report after confirmation gets a new identity');

const oldestSeedKey = await page.evaluate(({ key, expired }) => {
  const now = Date.now();
  const seeds = Array.from({ length: 12 }, (_, index) => ({
    fingerprint: index.toString(16).padStart(64, '0'), key: crypto.randomUUID(), createdAt: now - index,
  }));
  sessionStorage.setItem(key, JSON.stringify([{ ...expired, createdAt: now - 24 * 60 * 60 * 1000 - 1 }, ...seeds]));
  return seeds.at(-1).key;
}, { key: retryStorageKey, expired: storedAttempt });
reportFailuresRemaining = 1;
await sendReloadDraft();
await reportDialog.getByRole('alert').waitFor();
const boundedKeys = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).map(entry => entry.key), retryStorageKey);
assert.equal(boundedKeys.length, 12, 'new pending attempts are capped per tab');
assert.ok(!boundedKeys.includes(oldestSeedKey) && !boundedKeys.includes(pendingKey), 'expired and over-cap keys are dropped');
assert.notEqual(reportRequests.at(-1).key, pendingKey, 'an expired retry does not reuse its stored key');
await reportDialog.getByRole('button', { name: 'Hủy', exact: true }).click();
await reportDialog.waitFor({ state: 'hidden' });

await page.evaluate(key => {
  const getItem = Storage.prototype.getItem;
  window.addEventListener('restore-report-retry-storage', () => { Storage.prototype.getItem = getItem; }, { once: true });
  Storage.prototype.getItem = function (name) {
    if (name === key) throw new DOMException('Storage is unavailable', 'SecurityError');
    return getItem.call(this, name);
  };
}, retryStorageKey);
reportFailuresRemaining = 1;
await sendReloadDraft();
await reportDialog.getByRole('alert').waitFor();
const fallbackKey = reportRequests.at(-1).key;
await sendReport.click();
await reportDialog.waitFor({ state: 'hidden' });
assert.equal(reportRequests.at(-1).key, fallbackKey, 'storage denial preserves in-form retry identity');
await page.evaluate(() => window.dispatchEvent(new Event('restore-report-retry-storage')));

await switchLocaleInSettings(page);
await messageRow.getByRole('button', { name: 'Like: 2' }).waitFor();
await messageRow.hover();
await messageRow.getByRole('button', { name: 'More options' }).click();
await page.getByRole('menuitem', { name: 'Pin' }).waitFor();

await page.keyboard.press('Escape');
assert.ok(await page.evaluate(key => sessionStorage.getItem(key), retryStorageKey));
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true }).click();
await page.waitForFunction(key => sessionStorage.getItem(key) === null, retryStorageKey);

const report = { baseUrl, pinLookupRecovery, pinLookups, pinRecoveryMatrix, pinRequests, reactionRequests, readReceiptRequests, mentionSendRequests, reportRequests, consoleErrors, requestFailures };
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (
  pinRequests.length !== 2
  || pinRequests[0].method !== 'POST'
  || pinRequests[1].method !== 'DELETE'
  || pinRequests.some((request) => request.bucket !== messageBucket)
  || reactionRequests.length !== 2
  || reactionRequests[0].method !== 'DELETE'
  || reactionRequests[0].emoji !== 'like'
  || reactionRequests[1].method !== 'POST'
  || reactionRequests[1].emoji !== 'love'
  || reactionRequests.some((request) => request.bucket !== messageBucket)
  || JSON.stringify(readReceiptRequests) !== JSON.stringify([
    { cursor: null, limit: '25' },
    { cursor: firstReaderId, limit: '25' },
  ])
  || mentionSendRequests.length !== 2
  || mentionSendRequests[0].mentionedUserIds?.[0] !== mentionTargetId
  || mentionSendRequests[0].mentionEveryone !== false
  || consoleErrors.length
  || requestFailures.length
) process.exitCode = 1;
