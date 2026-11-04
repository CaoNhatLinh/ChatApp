import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

// Production UI, isolated browser, controlled canonical HTTP/STOMP. No real accounts or devices.
const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3117';
const actor = '00000000-0000-0000-0000-000000000851';
const peer = '00000000-0000-0000-0000-000000000852';
const room = '00000000-0000-0000-0000-000000000853';
const otherRoom = '00000000-0000-0000-0000-000000000854';
const unrelated = '00000000-0000-0000-0000-000000000855';
const inviteToken = 'incoming-call-boundary';
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const at = new Date().toISOString();
const user = { userId: actor, username: 'recipient', displayName: 'Người nhận', email: 'recipient@example.test', accountStatus: 'ACTIVE' };
const peerUser = { userId: peer, username: 'caller', displayName: 'Người gọi', avatarUrl: null };
const conversation = { conversationId: room, conversationType: 'DM', name: 'Direct call', ownerId: actor,
  createdBy: actor, createdAt: at, updatedAt: at, lastActivityAt: at, memberCount: 2, isDeleted: false,
  defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const alternate = { ...conversation, conversationId: otherRoom, conversationType: 'GROUP', name: 'Cộng đồng kiểm thử' };
const summary = { conversation, peer: peerUser, pinned: true, unreadCount: 3, joinedAt: at,
  notificationOverride: 'INHERIT', lastMessage: null };
const snapshot = (overrides = {}) => {
  const now = Date.now();
  return { conversationId: room, callId: randomUUID(), callerId: peer, calleeId: actor,
    callType: 'VOICE', status: 'RINGING', createdAt: new Date(now).toISOString(), acceptedAt: null,
    endedAt: null, deadline: new Date(now + 45000).toISOString(), revision: randomUUID(), version: 1, ...overrides };
};
const changed = (state, overrides) => ({ ...state, version: state.version + 1, revision: randomUUID(), ...overrides });
const envelope = state => ({ action: 'STATE', conversationId: state.conversationId, callId: state.callId,
  occurredAt: new Date().toISOString(), state });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(12000);
const errors = [], failures = [], commands = [], apiReads = [], matrix = [], lookupMatrix = [];
const incomingReads = [], transportEvents = [], expectedHttpErrors = new Set(), pendingReplies = [];
const incomingPage = (content = [], nextCursor = null) => ({ content, nextCursor, hasNext: nextCursor !== null });
let incomingReply = async () => ({ body: incomingPage() });
let socket, subscriptions, lookup = null;
let connection = 0;
let checks = 0;
const notice = () => page.locator('aside[aria-label="Cuộc gọi đến"], aside[aria-label="Incoming call"]');
const lookupNotice = () => page.getByLabel(/^(Kiểm tra cuộc gọi đến|Incoming call check)$/);
const countCheck = () => { checks++; };
const waitForSubscription = async (destination, previousSocket) => {
  for (let attempt = 0; attempt < 240 && (!subscriptions?.has(destination) || socket === previousSocket); attempt++) await page.waitForTimeout(50);
  assert.ok(subscriptions?.has(destination) && socket !== previousSocket, `subscribed to ${destination} on the current page session`);
};
const waitForIncomingRead = async previousCount => {
  for (let attempt = 0; attempt < 240 && incomingReads.length === previousCount; attempt++) await page.waitForTimeout(50);
  assert.ok(incomingReads.length > previousCount, 'protected entry/reconnect performs incoming discovery');
  assert.ok(incomingReads.slice(previousCount).every(read => read.privateSubscribed), 'private STATE subscription is restored before incoming HTTP starts');
};
const reloadProtected = async () => {
  const previousSocket = socket, previousReads = incomingReads.length;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForSubscription('/user/queue/calls', previousSocket);
  await waitForIncomingRead(previousReads);
  return previousReads;
};
const reconnect = async () => {
  const previousSocket = socket, previousReads = incomingReads.length;
  socket.close({ code: 1001, reason: 'controlled incoming discovery reconnect' });
  await waitForSubscription('/user/queue/calls', previousSocket);
  await waitForIncomingRead(previousReads);
  return previousReads;
};
const deferIncoming = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  pendingReplies.push(resolve);
  return { promise, resolve };
};
const assertPainted = async target => {
  await target.waitFor();
  for (let attempt = 0; attempt < 120; attempt++) {
    const painted = await target.evaluate(panel => {
      let opacity = 1;
      for (let parent = panel; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
      const style = getComputedStyle(panel), box = panel.getBoundingClientRect();
      return opacity > .99 && style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
    });
    if (painted) return;
    await page.waitForTimeout(50);
  }
  assert.fail('capture panel and its ancestors must be fully painted');
};
const assertFitsViewport = async (panel, theme, width) => {
  await assertPainted(panel);
  const box = await panel.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 1001,
    `panel is in the ${theme} ${width}px viewport`);
  assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, 'panel has no horizontal overflow');
};
const assertLookupInFlow = async () => {
  const banner = await lookupNotice().boundingBox();
  const content = await page.getByRole('main').boundingBox();
  assert.ok(banner && content && banner.y + banner.height <= content.y + 1, 'lookup reserves space above protected content');
  assert.equal(await lookupNotice().evaluate(node => getComputedStyle(node).position), 'relative', 'lookup is not a floating overlay');
};
const captureLookupMatrix = async state => {
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForFunction(theme => (document.documentElement.getAttribute('data-theme') === 'dark') === (theme === 'dark'), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await assertFitsViewport(lookupNotice(), theme, width);
      await assertLookupInFlow();
      await page.screenshot({ path: `artifacts/ui-audit/current/incoming-call-lookup-${state}-${theme}-${width}.png` });
      lookupMatrix.push({ state, theme, width }); countCheck();
    }
  }
};
const deliver = (destination, payload, targetSocket = socket, targetSubscriptions = subscriptions) => {
  const id = targetSubscriptions?.get(destination);
  assert.ok(id, `subscription ${destination}`);
  targetSocket.send(`a${JSON.stringify([`MESSAGE\nsubscription:${id}\nmessage-id:${randomUUID()}\ncontent-type:application/json\n\n${JSON.stringify(payload)}\0`])}`);
};
const privateState = state => deliver('/user/queue/calls', envelope(state));
const assertHidden = async () => { await notice().waitFor({ state: 'hidden' }); };
const assertNoDeviceOrMutation = async (fromCommand = 0) => {
  assert.equal(await page.evaluate(() => window.__incomingMedia.acquired), 0, 'notifications never request camera or microphone');
  assert.ok(commands.slice(fromCommand).every(command => command.action === 'SYNC'),
    `notification/entry must not START, JOIN, END, LEAVE, FAIL, HEARTBEAT or SIGNAL: ${JSON.stringify(commands.slice(fromCommand).map(command => command.action))}`);
};

page.on('pageerror', error => errors.push(error.message));
page.on('console', entry => {
  if (entry.type() !== 'error') return;
  if (entry.text().startsWith('Failed to load resource:') && expectedHttpErrors.has(entry.location().url)) return;
  errors.push(entry.text());
});
page.on('requestfailed', request => {
  if (!request.url().includes('/ws/') && request.failure()?.errorText !== 'net::ERR_ABORTED') {
    failures.push({ url: request.url(), error: request.failure()?.errorText });
  }
});
await page.routeWebSocket('**/ws/**', ws => {
  const sessionSubscriptions = new Map();
  const sessionConnection = ++connection;
  socket = ws; subscriptions = sessionSubscriptions;
  ws.onMessage(raw => {
    const data = raw.toString();
    if (data === '\n') return;
    for (const frame of JSON.parse(data)) {
      if (frame.startsWith('CONNECT')) { ws.send(`a${JSON.stringify(['CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'])}`); continue; }
      const destination = frame.match(/\ndestination:([^\n]+)/)?.[1];
      if (frame.startsWith('SUBSCRIBE')) {
        sessionSubscriptions.set(destination, frame.match(/\nid:([^\n]+)/)?.[1]);
        transportEvents.push({ kind: 'SUBSCRIBE', destination, connection: sessionConnection });
        continue;
      }
      if (frame.startsWith('UNSUBSCRIBE')) {
        const id = frame.match(/\nid:([^\n]+)/)?.[1];
        for (const [target, subscriptionId] of sessionSubscriptions) if (subscriptionId === id) sessionSubscriptions.delete(target);
        continue;
      }
      if (!frame.startsWith('SEND') || !destination?.startsWith('/app/call.')) continue;
      const body = JSON.parse(frame.slice(frame.indexOf('\n\n') + 2).replace(/\0$/, ''));
      const action = destination.split('.').at(-1).toUpperCase(); commands.push({ action, body });
      const accepted = action === 'SYNC' && lookup?.callId === body.callId;
      deliver('/user/queue/call-results', { requestId: body.requestId, conversationId: body.conversationId,
        callId: body.callId, action, accepted, errorCode: accepted ? null : 'NOT_FOUND', state: accepted ? lookup : null }, ws, sessionSubscriptions);
    }
  });
  ws.send('o');
});
await page.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url()), path = url.pathname;
  if (!path.startsWith('/api/') && !path.includes('/ws/')) return route.continue();
  if (request.method() === 'GET') apiReads.push(path);
  const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  if (path.endsWith('/calls/incoming')) {
    const read = { cursor: url.searchParams.get('cursor'), limit: url.searchParams.get('limit'), method: request.method(),
      connection, privateSubscribed: subscriptions?.has('/user/queue/calls') ?? false };
    incomingReads.push(read);
    transportEvents.push({ kind: 'GET', connection, cursor: read.cursor });
    const response = await incomingReply(url);
    if ((response.status ?? 200) >= 400) expectedHttpErrors.add(request.url());
    return route.fulfill({ status: response.status ?? 200, contentType: 'application/json', body: JSON.stringify(response.body) });
  }
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(user);
  if (path.endsWith(`/public/invites/${inviteToken}`)) return json({ status: 'ACTIVE', conversationId: otherRoom,
    conversationName: 'Kiểm chứng lời mời', conversationType: 'GROUP', createdBy: peer, displayName: 'Lời mời kiểm thử',
    joinPolicy: 'REQUEST_APPROVAL', expiresAt: new Date(Date.now() + 86400000).toISOString(), remainingUses: null });
  if (path.endsWith(`/invites/${inviteToken}/status`)) return json({ status: 'AVAILABLE', conversationId: otherRoom });
  if (path.endsWith('/devices')) return json({ deviceId: 'incoming-call-device' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'tiktok', rooms: [] });
  if (path.endsWith('/conversations')) return json({ content: [{ conversation: alternate, peer: null,
    pinned: false, unreadCount: 0, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null }], hasNext: false, nextCursor: null });
  if (path.endsWith(`/conversations/${room}/summary`)) return json(summary);
  if (path.endsWith(`/conversations/${room}/calls/active`)) return lookup ? json(lookup) : route.fulfill({ status: 204 });
  if (path.endsWith(`/conversations/${room}`)) return json(conversation);
  if (path.endsWith('/read-state')) return json({ joinedAt: at });
  if (path.endsWith('/notification-policy')) return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  if (path.includes('/friends/check-block/')) return json({ hasBlocked: false, isBlockedBy: false });
  if (path.includes('/friends/')) return json({ userId: actor, status: 'ACCEPTED', userDetails: [] });
  if (path.includes('/users/')) return json({ ...peerUser, accountStatus: 'ACTIVE' });
  if (path.includes('/unread/count')) return json({ count: 0 });
  if (path.endsWith('/info')) return json({ websocket: true, cookie_needed: false, origins: ['*:*'], entropy: 1 });
  return json({ content: [], userDetails: [], hasNext: false, nextCursor: null, polls: [], interactions: [] });
});
await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
  window.__incomingMedia = { acquired: 0 };
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
    window.__incomingMedia.acquired++;
    throw new Error('This notification test must never acquire a device');
  } });
});

try {
  // This public route restores a signed-in session, but must not mount the protected call UI.
  await page.goto(`${baseUrl}/join/${inviteToken}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Kiểm chứng lời mời', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Chấp nhận', exact: true }).waitFor();
  assert.ok(apiReads.some(path => path.endsWith(`/invites/${inviteToken}/status`)), 'public invite check uses the restored signed-in session');
  assert.equal(subscriptions?.has('/user/queue/calls') ?? false, false, 'signed-in public invite page never mounts the private incoming-call subscriber');
  assert.equal(incomingReads.length, 0, 'public invite restoration never performs protected incoming discovery');
  await assertHidden(); countCheck();

  const publicSocket = socket;
  await page.goto(`${baseUrl}/friends`, { waitUntil: 'domcontentloaded' });
  await waitForSubscription('/user/queue/calls', publicSocket);
  await waitForIncomingRead(0);
  await assertHidden(); countCheck();

  // A hard reload must discover an existing call without receiving another private STATE.
  let discoveryState = snapshot();
  incomingReply = async () => ({ body: incomingPage([discoveryState]) });
  const beforeReloadCommands = commands.length;
  const reloadStart = await reloadProtected();
  await notice().getByText('Cuộc gọi thoại đến', { exact: true }).waitFor();
  assert.equal(await notice().count(), 1, 'HTTP recovery produces one reminder without a fresh private STATE');
  assert.equal(incomingReads[reloadStart].cursor, null, 'a hard reload starts at the discovery head');
  await lookupNotice().waitFor({ state: 'hidden' });
  await assertNoDeviceOrMutation(beforeReloadCommands); countCheck();
  privateState(changed(discoveryState, { status: 'CANCELLED', endedAt: new Date().toISOString() }));
  await assertHidden();

  // Continuation is the complete last-scanned tuple, even when every first-page row was filtered.
  discoveryState = snapshot({ callType: 'VIDEO' });
  const tupleCursor = Buffer.from(JSON.stringify({ version: 1, actorId: actor, lowerBound: at,
    deadline: discoveryState.deadline, conversationId: room, callId: discoveryState.callId })).toString('base64url');
  incomingReply = async url => ({ body: url.searchParams.has('cursor')
    ? incomingPage([discoveryState]) : incomingPage([], tupleCursor) });
  const filteredStart = await reloadProtected();
  await notice().getByText('Cuộc gọi video đến', { exact: true }).waitFor();
  assert.deepEqual(incomingReads.slice(filteredStart).map(read => read.cursor), [null, tupleCursor], 'filtered empty pages preserve the opaque tuple cursor');
  await lookupNotice().waitFor({ state: 'hidden' }); countCheck();
  privateState(changed(discoveryState, { status: 'CANCELLED', endedAt: new Date().toISOString() }));
  await assertHidden();

  // Private terminal STATE wins against a delayed, older HTTP RINGING snapshot.
  const terminalGate = deferIncoming();
  discoveryState = snapshot();
  incomingReply = async () => terminalGate.promise;
  await reloadProtected();
  await lookupNotice().getByText('Đang kiểm tra cuộc gọi đến…', { exact: true }).waitFor();
  await captureLookupMatrix('loading');
  privateState(discoveryState); await notice().waitFor();
  privateState(changed(discoveryState, { status: 'CANCELLED', endedAt: new Date().toISOString() }));
  await assertHidden();
  const terminalResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/calls/incoming'));
  terminalGate.resolve({ body: incomingPage([discoveryState]) });
  await terminalResponse;
  await lookupNotice().waitFor({ state: 'hidden' });
  await page.waitForTimeout(100); await assertHidden(); countCheck();

  // Failure after a filtered page is actionable; retry always starts a new traversal.
  const failure = { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Controlled incoming lookup failure' } };
  incomingReply = async url => url.searchParams.has('cursor') ? failure : { body: incomingPage([], tupleCursor) };
  const failureStart = await reloadProtected();
  await lookupNotice().getByText('Chưa kiểm tra được cuộc gọi đến.', { exact: true }).waitFor();
  assert.equal(await page.getByText('Chưa kiểm tra được cuộc gọi đến.', { exact: true }).count(), 1, 'lookup failure has one local notice and no duplicate toast');
  assert.deepEqual(incomingReads.slice(failureStart).map(read => read.cursor), [null, tupleCursor]);
  await assertHidden(); countCheck();
  discoveryState = snapshot();
  incomingReply = async () => ({ body: incomingPage([discoveryState]) });
  const retryStart = incomingReads.length;
  await lookupNotice().getByRole('button', { name: 'Kiểm tra lại cuộc gọi', exact: true }).click();
  await notice().waitFor();
  assert.deepEqual(incomingReads.slice(retryStart).map(read => read.cursor), [null], 'retry discards a failed continuation and reads a fresh head');
  await lookupNotice().waitFor({ state: 'hidden' }); countCheck();

  // A reconnect restores subscriptions first, then rechecks HTTP while preserving local hide.
  const beforeDiscoveryHide = commands.length;
  await notice().getByRole('button', { name: 'Ẩn lời nhắc cuộc gọi', exact: true }).click();
  await assertHidden();
  discoveryState = changed(discoveryState, {});
  await reconnect();
  await lookupNotice().waitFor({ state: 'hidden' });
  await page.waitForTimeout(100); await assertHidden();
  assert.equal(commands.length, beforeDiscoveryHide, 'reconnect discovery and local hide do not mutate call authority'); countCheck();
  incomingReply = async () => failure;
  await reconnect();
  await lookupNotice().getByText('Chưa kiểm tra được cuộc gọi đến.', { exact: true }).waitFor();
  discoveryState = changed(discoveryState, {});
  incomingReply = async () => ({ body: incomingPage([discoveryState]) });
  await lookupNotice().getByRole('button', { name: 'Kiểm tra lại cuộc gọi', exact: true }).click();
  await lookupNotice().waitFor({ state: 'hidden' });
  await page.waitForTimeout(100); await assertHidden(); countCheck();
  discoveryState = snapshot({ callType: 'VIDEO' });
  await reconnect();
  await notice().getByText('Cuộc gọi video đến', { exact: true }).waitFor();
  assert.equal(await notice().count(), 1, 'reconnect discovers a new ringing call without a private STATE'); countCheck();
  incomingReply = async () => failure;
  await reconnect();
  await lookupNotice().getByText('Chưa kiểm tra được cuộc gọi đến.', { exact: true }).waitFor();
  assert.equal(await notice().count(), 1, 'lookup feedback preserves the existing call panel');
  await assertLookupInFlow();
  assert.ok(await notice().getByRole('button', { name: 'Mở cuộc trò chuyện', exact: true }).isEnabled(), 'lookup failure preserves the known ringing call action'); countCheck();
  const beforeErrorHide = commands.length;
  await lookupNotice().getByRole('button', { name: 'Ẩn thông báo lỗi cuộc gọi', exact: true }).click();
  await lookupNotice().waitFor({ state: 'hidden' });
  assert.ok(await notice().getByRole('button', { name: 'Mở cuộc trò chuyện', exact: true }).isEnabled());
  assert.equal(commands.length, beforeErrorHide, 'dismissing lookup feedback is local and preserves the incoming call'); countCheck();
  privateState(changed(discoveryState, { status: 'CANCELLED', endedAt: new Date().toISOString() }));
  await assertHidden();

  // Invalid page contracts and cursor loops are failures, never successful empty inboxes.
  incomingReply = async () => ({ body: { content: [], nextCursor: null, hasNext: true } });
  await reloadProtected();
  await lookupNotice().getByText('Chưa kiểm tra được cuộc gọi đến.', { exact: true }).waitFor();
  await assertHidden(); countCheck();
  incomingReply = async () => ({ body: incomingPage([], 'cycle-cursor') });
  const cycleStart = await reloadProtected();
  await lookupNotice().getByText('Chưa kiểm tra được cuộc gọi đến.', { exact: true }).waitFor();
  await page.waitForTimeout(100);
  assert.deepEqual(incomingReads.slice(cycleStart).map(read => read.cursor), [null, 'cycle-cursor'], 'cursor cycles stop after the first repeated continuation');
  await assertHidden(); countCheck();

  // Eight empty continuation pages leave an explicit unfinished check with a load-more action.
  discoveryState = snapshot();
  incomingReply = async url => {
    const cursor = url.searchParams.get('cursor');
    const scannedPages = cursor ? Number(cursor.replace('batch-', '')) : 0;
    return { body: scannedPages < 8 ? incomingPage([], `batch-${scannedPages + 1}`) : incomingPage([discoveryState]) };
  };
  const batchStart = await reloadProtected();
  await lookupNotice().getByText('Chưa kiểm tra hết cuộc gọi đến.', { exact: true }).waitFor();
  await captureLookupMatrix('more');
  await page.waitForTimeout(100);
  assert.deepEqual(incomingReads.slice(batchStart).map(read => read.cursor),
    [null, ...Array.from({ length: 7 }, (_, index) => `batch-${index + 1}`)], 'each automatic discovery batch stops after eight pages');
  await assertHidden(); countCheck();
  await lookupNotice().getByRole('button', { name: 'Tải tiếp cuộc gọi', exact: true }).click();
  await notice().getByText('Cuộc gọi thoại đến', { exact: true }).waitFor();
  assert.equal(incomingReads.at(-1).cursor, 'batch-8', 'load more resumes the saved complete-tuple continuation');
  assert.equal(incomingReads.length - batchStart, 9, 'load more scans the next page rather than restarting the head');
  await lookupNotice().waitFor({ state: 'hidden' }); countCheck();
  privateState(changed(discoveryState, { status: 'CANCELLED', endedAt: new Date().toISOString() }));
  await assertHidden();

  // Leaving the protected shell while lookup is pending cannot place its result on a public route.
  const routeGate = deferIncoming();
  incomingReply = async () => routeGate.promise;
  await reloadProtected();
  await lookupNotice().getByText('Đang kiểm tra cuộc gọi đến…', { exact: true }).waitFor();
  const beforePublicReads = incomingReads.length;
  await page.goto(`${baseUrl}/join/${inviteToken}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Kiểm chứng lời mời', exact: true }).waitFor();
  routeGate.resolve({ body: incomingPage([snapshot()]) });
  await page.waitForTimeout(100);
  await assertHidden(); await lookupNotice().waitFor({ state: 'hidden' });
  assert.equal(incomingReads.length, beforePublicReads, 'public route does not restart a superseded protected lookup'); countCheck();
  incomingReply = async () => ({ body: incomingPage() });
  const beforeReturnReads = incomingReads.length, routeSocket = socket;
  await page.goto(`${baseUrl}/friends`, { waitUntil: 'domcontentloaded' });
  await waitForSubscription('/user/queue/calls', routeSocket);
  await waitForIncomingRead(beforeReturnReads);
  await lookupNotice().waitFor({ state: 'hidden' });
  await assertNoDeviceOrMutation();

  // Malformed scopes and calls addressed to a different participant must not become UI.
  const invalid = snapshot();
  for (const payload of [
    { ...envelope(invalid), action: 'START' },
    { ...envelope(invalid), action: 'SIGNAL', signal: { kind: 'ice', candidate: 'not-a-notice' } },
    { ...envelope(invalid), conversationId: otherRoom },
    { ...envelope(invalid), callId: randomUUID() },
    envelope({ ...invalid, callerId: actor, calleeId: peer }),
    envelope({ ...invalid, calleeId: unrelated }),
    envelope({ ...invalid, revision: 'invalid' }),
  ]) deliver('/user/queue/calls', payload);
  await page.waitForTimeout(100);
  await assertHidden(); await assertNoDeviceOrMutation(); countCheck();

  const focusedSearch = page.getByPlaceholder('Nhập tên hoặc email', { exact: true });
  await focusedSearch.focus();
  let state = snapshot(); privateState(state);
  await notice().getByText('Cuộc gọi thoại đến', { exact: true }).waitFor();
  assert.equal(await focusedSearch.evaluate(node => node === document.activeElement), true, 'an incoming reminder never steals keyboard focus from the current task'); countCheck();
  assert.equal(await notice().count(), 1);
  privateState(state); privateState(state);
  await page.waitForTimeout(100);
  assert.equal(await notice().count(), 1, 'duplicate STATE never duplicates the notification'); countCheck();

  const beforeHide = commands.length;
  await notice().getByRole('button', { name: 'Ẩn lời nhắc cuộc gọi', exact: true }).click();
  await assertHidden();
  state = changed(state, {}); privateState(state);
  await page.waitForTimeout(100);
  await assertHidden();
  assert.equal(commands.length, beforeHide, 'hiding a local reminder never declines or ends a call'); countCheck();
  const closed = changed(state, { status: 'CANCELLED', endedAt: new Date().toISOString() });
  privateState(closed); privateState({ ...state, version: closed.version + 1, revision: randomUUID() });
  await page.waitForTimeout(100); await assertHidden(); countCheck();

  state = snapshot({ callType: 'VIDEO' }); privateState(state);
  await notice().getByText('Cuộc gọi video đến', { exact: true }).waitFor(); countCheck();
  const accepted = changed(state, { status: 'ACCEPTED', acceptedAt: new Date().toISOString() });
  privateState(accepted); await assertHidden();
  privateState({ ...state, version: accepted.version + 1, revision: randomUUID() });
  await page.waitForTimeout(100); await assertHidden(); countCheck();

  state = snapshot(); privateState(state);
  await notice().waitFor();
  privateState(changed(state, { status: 'MISSED', endedAt: new Date().toISOString() }));
  await assertHidden(); countCheck();

  // Native-route shell remounts must not discard a still-ringing call received elsewhere.
  state = snapshot(); privateState(state); await notice().waitFor();
  await page.getByRole('link', { name: 'Mở cộng đồng', exact: true }).filter({ visible: true }).first().click();
  await page.waitForURL(url => url.pathname === '/communities');
  await notice().getByText('Cuộc gọi thoại đến', { exact: true }).waitFor(); countCheck();
  lookup = state;
  const beforeOpen = commands.length;
  const beforeReads = apiReads.length;
  await notice().getByRole('button', { name: 'Mở cuộc trò chuyện', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/app' && url.searchParams.get('conversationId') === room);
  await page.getByRole('heading', { name: 'Người gọi', exact: true, level: 2 }).waitFor();
  await page.getByRole('button', { name: 'Nhận cuộc gọi', exact: true }).waitFor();
  await assertHidden();
  assert.ok(apiReads.slice(beforeReads).some(path => path.endsWith(`/conversations/${room}/summary`)), 'unknown DM loads canonical member/peer summary');
  assert.ok(apiReads.slice(beforeReads).some(path => path.endsWith(`/conversations/${room}/calls/active`)), 'opening the DM reads actual call authority');
  assert.ok(commands.slice(beforeOpen).every(command => command.body.callId === state.callId), 'entry never invents another call identity');
  await assertNoDeviceOrMutation(beforeOpen); countCheck();
  privateState(changed(state, { status: 'ENDED', endedAt: new Date().toISOString() }));
  lookup = null;

  // Each theme capture recovers a still-ringing call from HTTP after a full page reload.
  await mkdir('artifacts/ui-audit/current', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('themePreference', theme), theme);
    state = snapshot({ callType: theme === 'dark' ? 'VIDEO' : 'VOICE' });
    incomingReply = async () => ({ body: incomingPage([state]) });
    const previousSocket = socket;
    const previousReads = incomingReads.length;
    await page.goto(`${baseUrl}/friends`, { waitUntil: 'domcontentloaded' });
    await waitForSubscription('/user/queue/calls', previousSocket);
    await waitForIncomingRead(previousReads);
    await notice().waitFor();
    await lookupNotice().waitFor({ state: 'hidden' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme === 'dark' ? 'dark' : null);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await assertFitsViewport(notice(), theme, width);
      assert.ok(await notice().getByRole('button', { name: 'Mở cuộc trò chuyện', exact: true }).isEnabled());
      await page.screenshot({ path: `artifacts/ui-audit/current/incoming-call-${theme}-${width}.png`, fullPage: true });
      matrix.push({ theme, width }); countCheck();
    }
    privateState(changed(state, { status: 'CANCELLED', endedAt: new Date().toISOString() }));
    await assertHidden();
  }

  // Lookup error remains local, actionable and readable in both themes at each supported width.
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('themePreference', theme), theme);
    incomingReply = async () => failure;
    await reloadProtected();
    await lookupNotice().getByText('Chưa kiểm tra được cuộc gọi đến.', { exact: true }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme === 'dark' ? 'dark' : null);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await assertFitsViewport(lookupNotice(), theme, width);
      await assertLookupInFlow();
      assert.ok(await lookupNotice().getByRole('button', { name: 'Kiểm tra lại cuộc gọi', exact: true }).isEnabled());
      assert.equal(await page.getByText('Chưa kiểm tra được cuộc gọi đến.', { exact: true }).count(), 1, 'discovery error is not duplicated as a toast');
      await page.screenshot({ path: `artifacts/ui-audit/current/incoming-call-lookup-error-${theme}-${width}.png`, fullPage: true });
      lookupMatrix.push({ state: 'error', theme, width }); countCheck();
    }
  }
  incomingReply = async () => ({ body: incomingPage() });
  await lookupNotice().getByRole('button', { name: 'Kiểm tra lại cuộc gọi', exact: true }).click();
  await lookupNotice().waitFor({ state: 'hidden' });

  // Change language through the real settings UI, not storage or a synthetic provider override.
  state = snapshot(); privateState(state); await notice().waitFor();
  await switchLocaleInSettings(page);
  await notice().getByText('Incoming voice call', { exact: true }).waitFor();
  assert.equal(await notice().getAttribute('aria-label'), 'Incoming call');
  assert.ok(await notice().getByRole('button', { name: 'Open conversation', exact: true }).isEnabled());
  await notice().getByRole('button', { name: 'Hide call reminder', exact: true }).waitFor(); countCheck();
  privateState(changed(state, { status: 'CANCELLED', endedAt: new Date().toISOString() }));
  await assertHidden();
  state = snapshot({ callType: 'VIDEO' }); privateState(state);
  await notice().getByText('Incoming video call', { exact: true }).waitFor();
  const beforeEnglishHide = commands.length;
  await notice().getByRole('button', { name: 'Hide call reminder', exact: true }).click();
  await assertHidden();
  assert.equal(commands.length, beforeEnglishHide, 'English hide action is also local-only'); countCheck();

  incomingReply = async () => failure;
  await reconnect();
  await lookupNotice().getByText('Could not check incoming calls.', { exact: true }).waitFor();
  assert.equal(await lookupNotice().getAttribute('aria-label'), 'Incoming call check');
  assert.equal(await page.getByText('Could not check incoming calls.', { exact: true }).count(), 1);
  await lookupNotice().getByRole('button', { name: 'Hide call check error', exact: true }).waitFor();
  await assertFitsViewport(lookupNotice(), 'dark', 1440);
  await page.screenshot({ path: 'artifacts/ui-audit/current/incoming-call-lookup-error-en-dark-1440.png', fullPage: true });
  lookupMatrix.push({ state: 'error', locale: 'en', theme: 'dark', width: 1440 }); countCheck();
  state = snapshot();
  incomingReply = async () => ({ body: incomingPage([state]) });
  const englishRetryStart = incomingReads.length;
  await lookupNotice().getByRole('button', { name: 'Check calls again', exact: true }).click();
  await notice().getByText('Incoming voice call', { exact: true }).waitFor();
  assert.deepEqual(incomingReads.slice(englishRetryStart).map(read => read.cursor), [null]);
  await lookupNotice().waitFor({ state: 'hidden' }); countCheck();
  privateState(changed(state, { status: 'CANCELLED', endedAt: new Date().toISOString() }));
  await assertHidden();

  // Install clock only after all reloads/screenshots: fake time otherwise distorts motion painting.
  const now = await page.evaluate(() => Date.now());
  await page.clock.install({ time: new Date(now) });
  state = snapshot({ createdAt: new Date(now).toISOString(), deadline: new Date(now + 1000).toISOString() });
  privateState(state); await notice().waitFor();
  const beforeExpiry = commands.length;
  await page.clock.fastForward(1000);
  await assertHidden();
  assert.equal(commands.length, beforeExpiry, 'local deadline expiry never impersonates a backend terminal command'); countCheck();
  await assertNoDeviceOrMutation();
  assert.ok(incomingReads.every(read => read.method === 'GET' && read.limit === '50'), 'all discovery requests are bounded read-only GETs');
  for (let index = 0; index < transportEvents.length; index++) {
    const event = transportEvents[index];
    if (event.kind !== 'GET') continue;
    assert.ok(transportEvents.slice(0, index).some(previous => previous.kind === 'SUBSCRIBE'
      && previous.destination === '/user/queue/calls' && previous.connection === event.connection),
    'every discovery GET follows the current socket private SUBSCRIBE frame');
  }
  assert.deepEqual(errors, []); assert.deepEqual(failures, []); countCheck();
  console.log(JSON.stringify({ passed: checks, matrix, lookupMatrix, discoveryReads: incomingReads.length,
    boundary: 'Production browser with controlled canonical HTTP/STOMP reload/reconnect discovery; no live broker, Cassandra or media acceptance' }));
} finally {
  for (const resolve of pendingReplies) resolve({ body: incomingPage() });
  await browser.close();
}
