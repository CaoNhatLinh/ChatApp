import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3100';
const apiBaseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://localhost:8084/api').replace(/\/$/, '');
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const firstUserId = '00000000-0000-0000-0000-000000000401';
const secondUserId = '00000000-0000-0000-0000-000000000402';
const alphaConversationId = '00000000-0000-0000-0000-000000000411';
const betaConversationId = '00000000-0000-0000-0000-000000000412';
const now = '2026-08-30T12:00:00Z';
const alphaDraft = 'Bản nháp riêng của phòng Alpha';
const betaDraft = 'Bản nháp riêng của phòng Beta';

const users = {
  first: {
    userId: firstUserId,
    username: 'draft-owner',
    email: 'draft-owner@example.com',
    displayName: 'Draft Owner',
    accountStatus: 'ACTIVE',
  },
  second: {
    userId: secondUserId,
    username: 'second-owner',
    email: 'second-owner@example.com',
    displayName: 'Second Owner',
    accountStatus: 'ACTIVE',
  },
};

const createConversation = (conversationId, name) => ({
  conversationId,
  conversationType: 'GROUP',
  name,
  description: `${name} draft verification`,
  createdBy: firstUserId,
  ownerId: firstUserId,
  createdAt: now,
  updatedAt: now,
  isDeleted: false,
  lastActivityAt: now,
  memberCount: 1,
  defaultNotificationLevel: 'ALL',
  chatMode: 'OPEN',
  slowModeSeconds: 0,
});

const alphaConversation = createConversation(alphaConversationId, 'Draft Alpha');
const betaConversation = createConversation(betaConversationId, 'Draft Beta');
const conversationItems = [alphaConversation, betaConversation].map((conversation) => ({
  conversation,
  pinned: false,
  unreadCount: 0,
  joinedAt: now,
  notificationOverride: 'INHERIT',
  lastMessage: null,
}));

let activeUser = users.first;
let betaSendAttempt = 0;
let browserClosing = false;
const sendRequests = [];
const consoleErrors = [];
const requestFailures = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

const configurePage = async (page) => {
  page.setDefaultTimeout(10_000);
  page.on('console', (entry) => {
    const location = entry.location();
    const isExpectedFailedSend = entry.text().includes('[useMessenger] Error sending message')
      || entry.text().includes('[MessageInput] Failed to send message');
    const isExpectedFailedSendResource = location.url.endsWith(`/conversations/${betaConversationId}/messages`)
      && entry.text().includes('503');
    if (entry.type() === 'error'
      && !location.url.includes('/ws/')
      && !entry.text().includes('/ws/')
      && !isExpectedFailedSend
      && !isExpectedFailedSendResource) {
      consoleErrors.push({ text: entry.text(), url: location.url });
    }
  });
  page.on('requestfailed', (request) => {
    const isCancelledNextRequest = request.url().startsWith(baseUrl)
      && request.failure()?.errorText === 'net::ERR_ABORTED';
    if (!browserClosing && !request.url().includes('/ws/') && !isCancelledNextRequest) {
      requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
    }
  });

  await page.route(`${apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const path = requestUrl.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
    if (path.endsWith('/auth/me')) return json(activeUser);
    if (path.endsWith('/devices')) return json({ deviceId: `device-${activeUser.userId}` });
    if (path.endsWith('/preferences/chat')) {
      return json({ defaultThemeId: 'aurora', defaultBubbleStyleId: 'tiktok', rooms: [] });
    }
    if (path.endsWith('/conversations') && method === 'GET') {
      return json({ content: conversationItems, nextCursor: null, hasNext: false });
    }
    if ((path.endsWith(`/conversations/${alphaConversationId}/messages`)
      || path.endsWith(`/conversations/${betaConversationId}/messages`)) && method === 'GET') {
      return json({ content: [], nextCursor: null, hasNext: false, interactions: [], polls: [] });
    }
    if (path.endsWith(`/conversations/${betaConversationId}/messages`) && method === 'POST') {
      const body = request.postDataJSON();
      sendRequests.push(body);
      betaSendAttempt += 1;
      if (betaSendAttempt === 1) {
        return json({ code: 'SERVICE_UNAVAILABLE', message: 'Temporary send failure' }, 503);
      }
      return json({
        conversationId: betaConversationId,
        messageBucket: now,
        messageId: '00000000-0000-0000-0000-000000000421',
        clientMessageId: body.clientMessageId,
        senderId: activeUser.userId,
        content: body.content,
        messageType: body.messageType,
        contentFormat: 'PLAIN_TEXT',
        isDeleted: false,
        hasAttachments: false,
        hasMentions: false,
        isPinned: false,
        createdAt: now,
      });
    }
    if (path.endsWith('/notification-policy')) {
      return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
    }
    if (path.includes('/friendships/requests')) return json({ content: [], userDetails: [], hasNext: false });
    if (path.includes('/friends/status/')) return json([]);
    if (path.includes('/notifications/unread/count')) return json({ count: 0 });
    if (path.includes('/notifications')) return json({ content: [], hasNext: false });
    if (path.includes('/invites/conversation/')) return json([]);
    return json({ content: [], userDetails: [], hasNext: false });
  });
};

const openConversation = async (page, name) => {
  await page.getByText(name, { exact: true }).first().click();
  await page.locator('textarea').waitFor();
};

const page = await context.newPage();
await configurePage(page);
await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });

await openConversation(page, 'Draft Alpha');
const composer = page.locator('textarea');
await composer.fill(alphaDraft);
await openConversation(page, 'Draft Beta');
await composer.fill(betaDraft);
await openConversation(page, 'Draft Alpha');
if (await composer.inputValue() !== alphaDraft) {
  throw new Error('Conversation Alpha did not restore its own draft');
}

await page.reload({ waitUntil: 'domcontentloaded' });
await openConversation(page, 'Draft Alpha');
if (await composer.inputValue() !== alphaDraft) {
  throw new Error('Conversation Alpha draft did not survive a full reload');
}

await openConversation(page, 'Draft Beta');
if (await composer.inputValue() !== betaDraft) {
  throw new Error('Conversation Beta did not restore its own draft after reload');
}
const failedSendResponse = page.waitForResponse((response) => (
  response.url().endsWith(`/conversations/${betaConversationId}/messages`)
  && response.request().method() === 'POST'
));
await composer.press('Enter');
if ((await failedSendResponse).status() !== 503 || await composer.inputValue() !== betaDraft) {
  throw new Error('A failed send cleared the active draft');
}

await page.reload({ waitUntil: 'domcontentloaded' });
await openConversation(page, 'Draft Beta');
if (await composer.inputValue() !== betaDraft) {
  throw new Error('A failed send did not preserve the draft after reload');
}
await composer.press('Enter');
await page.waitForFunction(() => document.querySelector('textarea')?.value === '');

await page.reload({ waitUntil: 'domcontentloaded' });
await openConversation(page, 'Draft Beta');
if (await composer.inputValue() !== '') {
  throw new Error('Sent draft was restored after reload');
}

const secondUserStorageKey = `novachat_message_drafts_v1:${secondUserId}`;
await page.evaluate((storageKey) => {
  window.localStorage.setItem(storageKey, JSON.stringify({ version: 0, drafts: [{ text: 'legacy value' }] }));
}, secondUserStorageKey);
activeUser = users.second;
const secondPage = await context.newPage();
await configurePage(secondPage);
await secondPage.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
});
await secondPage.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
await openConversation(secondPage, 'Draft Alpha');
const secondComposer = secondPage.locator('textarea');
if (await secondComposer.inputValue() !== '') {
  throw new Error('A draft leaked into another account on the same browser');
}
if (await secondComposer.getAttribute('maxlength') !== '20000') {
  throw new Error('Composer maximum length differs from the canonical message contract');
}
const invalidCollectionWasRemoved = await secondPage.evaluate(
  (storageKey) => window.localStorage.getItem(storageKey) === null,
  secondUserStorageKey,
);
if (!invalidCollectionWasRemoved) {
  throw new Error('An invalid draft schema remained in browser storage');
}
await secondPage.setViewportSize({ width: 390, height: 844 });
const hasMobileOverflow = await secondPage.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
);
if (hasMobileOverflow) {
  throw new Error('Draft composer overflows the 390px viewport');
}

const storedDrafts = await page.evaluate(() => Object.fromEntries(
  Object.entries(window.localStorage).filter(([key]) => key.startsWith('novachat_message_drafts_v1:')),
));
const report = {
  baseUrl,
  sendRequests,
  storedDrafts,
  invalidCollectionWasRemoved,
  hasMobileOverflow,
  consoleErrors,
  requestFailures,
};
console.log(JSON.stringify(report, null, 2));
browserClosing = true;
await browser.close();

if (
  sendRequests.length !== 2
  || sendRequests.some((request) => request.content !== betaDraft)
  || !Object.values(storedDrafts).some((value) => value.includes(alphaDraft))
  || Object.values(storedDrafts).some((value) => value.includes(betaDraft))
  || !invalidCollectionWasRemoved
  || consoleErrors.length
  || requestFailures.length
) process.exitCode = 1;
