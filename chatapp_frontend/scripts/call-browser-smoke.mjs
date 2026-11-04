import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { switchLocaleInSettings } from './switch-locale-in-settings.mjs';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3117';
const actor = '00000000-0000-0000-0000-000000000801', peer = '00000000-0000-0000-0000-000000000802';
const room = '00000000-0000-0000-0000-000000000803';
const at = new Date().toISOString(), token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.signature';
const user = { userId: actor, username: 'caller', displayName: 'Người gọi', email: 'caller@example.test', accountStatus: 'ACTIVE' };
const peerUser = { ...user, userId: peer, username: 'peer', displayName: 'Người nhận' };
const conversation = { conversationId: room, conversationType: 'DM', name: 'Call verification', ownerId: actor,
  createdBy: actor, createdAt: at, updatedAt: at, lastActivityAt: at, memberCount: 2, isDeleted: false,
  defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 };
const alternateConversation = { ...conversation, conversationId: '00000000-0000-0000-0000-000000000804', conversationType: 'GROUP', name: 'Hội thoại khác' };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(12000);
const errors = [], failures = [], commands = [], pendingIce = [], summaryRequests = []; let socket, subscriptions, state, rejectStart = true, connections = 0, holdIce = false, uncertainIceOnce = false, custom = false, lookup = null, lookupError = false, hideDirectory = true;
let summaryStatus = 503;
let summaryDelay = 0;
const snapshot = (callId = randomUUID(), incoming = false) => ({ conversationId: room, callId, callerId: incoming ? peer : actor, calleeId: incoming ? actor : peer,
  callType: 'VOICE', status: 'RINGING', createdAt: at, acceptedAt: null, endedAt: null, deadline: new Date(Date.now() + 45000).toISOString(), revision: randomUUID(), version: 1 });
const deliver = (destination, payload, targetSocket = socket, targetSubscriptions = subscriptions) => {
  const id = targetSubscriptions?.get(destination); assert.ok(id, `subscription ${destination}`);
  targetSocket.send(`a${JSON.stringify([`MESSAGE\nsubscription:${id}\nmessage-id:${randomUUID()}\ncontent-type:application/json\n\n${JSON.stringify(payload)}\0`])}`);
};
const event = (action, signal, actorId = peer, view = state) => deliver(`/topic/conversation/${room}/calls`, {
  conversationId: room, callId: view.callId, occurredAt: at, state: view,
  ...(action === 'SIGNAL' ? { action, actorId, targetUserId: actorId === actor ? peer : actor, signal } : { action: 'STATE' }),
});
page.on('pageerror', error => errors.push(error.message));
page.on('console', entry => { if (entry.type() === 'error' && !entry.text().includes('Failed to load resource')) errors.push(entry.text()); });
page.on('requestfailed', request => { if (!request.url().includes('/ws/') && request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
await page.routeWebSocket('**/ws/**', ws => {
  connections++;
  const sessionSubscriptions = new Map();
  const trace = [];
  socket = ws; subscriptions = sessionSubscriptions;
  ws.onMessage(raw => {
    for (const frame of JSON.parse(raw.toString())) {
      if (frame.startsWith('CONNECT')) { ws.send(`a${JSON.stringify(['CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0'])}`); continue; }
      const destination = frame.match(/\ndestination:([^\n]+)/)?.[1];
      trace.push(`${frame.split('\n')[0]} ${destination ?? ''}`);
      if (frame.startsWith('SUBSCRIBE')) { sessionSubscriptions.set(destination, frame.match(/\nid:([^\n]+)/)?.[1]); continue; }
      if (!frame.startsWith('SEND') || !destination?.startsWith('/app/call.')) continue;
      const body = JSON.parse(frame.slice(frame.indexOf('\n\n') + 2).replace(/\0$/, ''));
      const action = destination.split('.').at(-1).toUpperCase(); commands.push({ action, body });
      assert.ok(sessionSubscriptions.has('/user/queue/call-results'), `reply subscription before ${action}: ${JSON.stringify(trace.slice(-20))}`);
      if (holdIce && action === 'SIGNAL' && body.signal?.kind === 'ice') { pendingIce.push(body); continue; }
      let errorCode = null;
      if (uncertainIceOnce && action === 'SIGNAL' && body.signal?.kind === 'ice') { uncertainIceOnce = false; errorCode = 'UNAVAILABLE'; }
      if (action === 'START') {
        if (rejectStart) { rejectStart = false; errorCode = 'FORBIDDEN'; }
        else if (!state || state.callId !== body.callId) state = snapshot(body.callId);
      } else if (!state || state.callId !== body.callId) errorCode = 'NOT_FOUND';
      else if (action === 'JOIN') state = { ...state, status: 'ACCEPTED', acceptedAt: at, revision: randomUUID(), version: state.version + 1 };
      else if (['END', 'LEAVE', 'FAIL'].includes(action)) state = { ...state, status: action === 'FAIL' ? 'FAILED' : state.status === 'ACCEPTED' ? 'ENDED' : state.callerId === actor ? 'CANCELLED' : 'DECLINED', endedAt: at, revision: randomUUID(), version: state.version + 1 };
      else if (action === 'HEARTBEAT') state = { ...state, revision: randomUUID(), version: state.version + 1 };
      deliver('/user/queue/call-results', { requestId: body.requestId, conversationId: room, callId: body.callId, action, accepted: !errorCode, errorCode, state: errorCode ? null : state }, ws, sessionSubscriptions);
    }
  });
  ws.send('o');
});
await page.route('**/*', async route => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith('/api/') && !path.includes('/ws/')) return route.continue();
  const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  if (path.endsWith('/calls/incoming')) return json({ content: [], nextCursor: null, hasNext: false });
  if (path.endsWith('/calls/active')) return lookupError ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"INTERNAL_ERROR"}' }) : lookup ? json(lookup) : route.fulfill({ status: 204 });
  if (path.endsWith('/auth/refresh')) return json({ accessToken: token });
  if (path.endsWith('/auth/me')) return json(user);
  if (path.endsWith('/devices')) return json({ deviceId: 'call-device' });
  if (path.endsWith('/preferences/chat')) return json({ defaultThemeId: 'system', defaultBubbleStyleId: 'tiktok', rooms: custom ? [{ conversationId: room, themeId: 'aurora', customBackgroundUrl: 'https://assets.example.test/call-bg.svg', updatedAt: at }] : [] });
  if (path.endsWith('/conversations')) return json({ content: [
    ...(hideDirectory ? [] : [{ conversation, peer: peerUser, pinned: false, unreadCount: 0, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null }]),
    { conversation: alternateConversation, peer: null, pinned: false, unreadCount: 0, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null },
  ], hasNext: false, nextCursor: null });
  if (path.endsWith(`/conversations/${room}/summary`)) {
    summaryRequests.push(path);
    if (summaryDelay) await new Promise(resolve => setTimeout(resolve, summaryDelay));
    if (summaryStatus) return route.fulfill({ status: summaryStatus, json: { code: 'INTERNAL_ERROR' } });
    return json({ conversation, peer: peerUser, pinned: true, unreadCount: 4, joinedAt: at, notificationOverride: 'INHERIT', lastMessage: null });
  }
  if (path.endsWith(`/conversations/${room}`)) return json(conversation);
  if (path.endsWith('/read-state')) return json({ joinedAt: at });
  if (path.endsWith('/notification-policy')) return json({ defaultNotificationLevel: 'ALL', notificationOverride: 'INHERIT' });
  if (path.includes('/users/')) return json(peerUser);
  if (path.includes('/unread/count')) return json({ count: 0 });
  if (path.includes('/friends/status/')) return json([]);
  if (path.endsWith('/info')) return json({ websocket: true, cookie_needed: false, origins: ['*:*'], entropy: 1 });
  return json({ content: [], userDetails: [], hasNext: false, nextCursor: null, polls: [], interactions: [] });
});
await page.route('https://assets.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><path fill="white" d="M0 0h800v800H0z"/></svg>' }));
await page.addInitScript(() => {
  document.cookie = 'novachat_session=1; Path=/; SameSite=Lax';
  const stats = { acquired: 0, offers: 0, answers: 0, stopped: 0, closed: 0, remote: [], peers: [], hold: false, release: null, denyNext: false };
  window.__callMedia = stats;
  const stream = () => ({ getTracks: () => [{ kind: 'audio', enabled: true, stop: () => { stats.stopped++; } }], getAudioTracks: () => [], getVideoTracks: () => [] });
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
    stats.acquired++;
    if (stats.denyNext) { stats.denyNext = false; throw new DOMException('denied', 'NotAllowedError'); }
    return stats.hold ? new Promise(resolve => { stats.release = () => resolve(stream()); }) : stream();
  } });
  window.RTCPeerConnection = class {
    localDescription = null; remoteDescription = null; connectionState = 'new';
    constructor() { stats.peers.push(this); }
    addTrack() {}
    async createOffer() { stats.offers++; return { type: 'offer', sdp: 'v=0\r\n' }; }
    async createAnswer() { stats.answers++; return { type: 'answer', sdp: 'v=0\r\n' }; }
    async setLocalDescription(description) { this.localDescription = description; }
    async setRemoteDescription(description) { this.remoteDescription = description; stats.remote.push(description); }
    async addIceCandidate() {}
    close() { stats.closed++; }
  };
});
await page.goto(`${baseUrl}/app?conversationId=${room}`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Chưa mở được cuộc trò chuyện', exact: true, level: 2 }).waitFor();
assert.equal(await page.getByRole('button', { name: 'Gọi thoại', exact: true }).count(), 0, 'failed entry never exposes call controls');
assert.equal(await page.locator('.chat-composer-dock textarea').count(), 0, 'failed entry never exposes a composer');
await mkdir('artifacts/ui-audit/current', { recursive: true });
for (const theme of ['light', 'dark']) {
  await page.evaluate(theme => localStorage.setItem('themePreference', theme), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Chưa mở được cuộc trò chuyện', exact: true, level: 2 }).waitFor();
  await page.waitForFunction(() => {
    const panel = document.querySelector('section[aria-label="Mở cuộc trò chuyện"]');
    if (!panel) return false;
    let opacity = 1;
    for (let node = panel; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity > .99;
  });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const entry = page.getByRole('region', { name: 'Mở cuộc trò chuyện', exact: true });
    assert.equal(await entry.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true);
    await page.screenshot({ path: `artifacts/ui-audit/current/conversation-entry-error-${theme}-${width}.png`, fullPage: true });
  }
}
summaryStatus = 403; summaryDelay = 400;
await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
await page.getByRole('status').filter({ hasText: 'Đang mở cuộc trò chuyện...' }).waitFor();
assert.equal(await page.getByRole('button', { name: 'Thử lại', exact: true }).count(), 0, 'pending retry cannot be submitted twice');
await page.getByText('Bạn không có quyền xem cuộc trò chuyện này.', { exact: true }).waitFor();
summaryDelay = 0;
assert.equal(await page.getByRole('button', { name: 'Thử lại', exact: true }).count(), 0, 'permission denial is not presented as a transient error');
await page.getByRole('button', { name: 'Hội thoại khác', exact: true }).click();
await page.getByRole('heading', { name: 'Hội thoại khác', exact: true, level: 2 }).waitFor();
await page.waitForURL(url => url.searchParams.get('conversationId') === alternateConversation.conversationId);
await page.goto(`${baseUrl}/app?conversationId=${room}`, { waitUntil: 'domcontentloaded' });
await page.getByText('Bạn không có quyền xem cuộc trò chuyện này.', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Danh sách hội thoại', exact: true }).click();
await page.waitForURL(url => !url.searchParams.has('conversationId'));
assert.equal(await page.getByRole('textbox', { name: 'Tìm kiếm cuộc trò chuyện', exact: true }).evaluate(node => node === document.activeElement), true, 'leaving entry restores list search focus');
summaryStatus = 404;
await page.goto(`${baseUrl}/app?conversationId=${room}`, { waitUntil: 'domcontentloaded' });
await page.getByText('Cuộc trò chuyện này không còn khả dụng.', { exact: true }).waitFor();
assert.equal(await page.getByRole('button', { name: 'Thử lại', exact: true }).count(), 0);
const beforeLocale = summaryRequests.length;
await switchLocaleInSettings(page);
await page.getByRole('heading', { name: 'Could not open this conversation', exact: true, level: 2 }).waitFor();
await page.getByText('This conversation is no longer available.', { exact: true }).waitFor();
assert.equal(summaryRequests.length, beforeLocale, 'changing locale translates retained errors without another room request');
await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
const localeDialog = page.getByRole('dialog');
await localeDialog.locator('button:visible').filter({ hasText: 'Language' }).first().click();
await localeDialog.locator('button:visible').filter({ hasText: 'Vietnamese' }).first().click();
await page.keyboard.press('Escape');
await localeDialog.waitFor({ state: 'hidden' });
summaryStatus = 409;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Thử lại', exact: true }).waitFor();
summaryStatus = 0;
await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
await page.getByRole('heading', { name: 'Người nhận', exact: true, level: 2 }).waitFor();
await page.getByRole('button', { name: 'Gọi thoại', exact: true }).first().click({ trial: true });
assert.ok(summaryRequests.length > 0, 'a DM absent from the loaded directory opens via the member summary endpoint');
assert.equal(await page.evaluate(() => window.__callMedia.acquired), 0, 'opening a deep link never acquires devices');
hideDirectory = false;
await page.waitForFunction(() => document.querySelector('.chat-composer-dock textarea'));
const composer = page.locator('.chat-composer-dock textarea'); await composer.fill('Bản nháp vẫn ở đây.');
await page.getByRole('button', { name: 'Gọi thoại', exact: true }).first().click();
await page.getByText('Không thể tiếp tục cuộc gọi. Kiểm tra kết nối và quyền gọi.', { exact: true }).waitFor();
assert.ok(await page.evaluate(() => window.__callMedia.stopped > 0));
await page.getByRole('button', { name: 'Gọi thoại', exact: true }).first().click();
await page.getByText(/Gọi thoại · Đang gọi/).waitFor();
assert.equal(commands.filter(c => c.action === 'START').length, 2);
const starts = commands.filter(c => c.action === 'START');
assert.equal(starts[0].body.callId, starts[1].body.callId); assert.notEqual(starts[0].body.requestId, starts[1].body.requestId);
assert.equal(starts[1].body.mediaRegion, undefined); assert.equal(starts[1].body.maxParticipants, undefined);
state = { ...state, status: 'ACCEPTED', acceptedAt: at, version: 2, revision: randomUUID() };
event('JOIN'); event('JOIN');
await page.waitForFunction(() => window.__callMedia.offers === 1);
await page.waitForTimeout(100); assert.equal(await page.evaluate(() => window.__callMedia.offers), 1);
event('START', null, peer, { ...state, status: 'RINGING', acceptedAt: null, version: 1 });
event('SIGNAL', { kind: 'sdp', description: { type: 'answer', sdp: 'v=0\r\n' } });
await page.waitForFunction(() => window.__callMedia.remote.length === 1);
await page.evaluate(() => { const peer = window.__callMedia.peers.at(-1); peer.connectionState = 'connected'; peer.onconnectionstatechange(); });
const stoppedBeforeUncertain = await page.evaluate(() => window.__callMedia.stopped);
uncertainIceOnce = true;
await page.evaluate(() => window.__callMedia.peers.at(-1).onicecandidate({ candidate: { toJSON: () => ({ candidate: 'candidate:uncertain' }) } }));
for (let tries = 0; tries < 100 && !commands.some(c => c.action === 'SYNC'); tries++) await page.waitForTimeout(10);
assert.ok(commands.some(c => c.action === 'SYNC'));
assert.equal(await page.evaluate(() => window.__callMedia.stopped), stoppedBeforeUncertain, 'uncertain ICE ack reconciles authority instead of killing a working media peer');
const connectionCount = connections, beforeHeartbeat = commands.filter(c => c.action === 'HEARTBEAT').length;
socket.close({ code: 1001, reason: 'controlled reconnect' });
await page.waitForFunction(() => document.querySelector('.chat-composer-dock textarea'));
for (let tries = 0; tries < 100 && connections === connectionCount; tries++) await page.waitForTimeout(100);
assert.ok(connections > connectionCount);
for (let tries = 0; tries < 100 && commands.filter(c => c.action === 'HEARTBEAT').length === beforeHeartbeat; tries++) await page.waitForTimeout(100);
assert.ok(commands.filter(c => c.action === 'HEARTBEAT').length > beforeHeartbeat);
assert.equal(await page.evaluate(() => window.__callMedia.offers), 1, 'reconnect authority sync does not duplicate SDP offer');
await page.getByRole('button', { name: 'Kết thúc cuộc gọi', exact: true }).click();
await page.getByText(/(Gọi thoại|Voice call) ·/).waitFor({ state: 'hidden' });
assert.equal(await composer.inputValue(), 'Bản nháp vẫn ở đây.');
const closed = state;
event('START', null, peer, { ...closed, status: 'RINGING', acceptedAt: null, endedAt: null, version: 1 });
await page.waitForTimeout(100); assert.equal(await page.getByText(/(Gọi thoại|Voice call) ·/).count(), 0);

// A local retry keeps server identity, but old async errors must not own its new media peer.
await page.getByRole('button', { name: 'Gọi thoại', exact: true }).first().click();
await page.getByText(/Gọi thoại · Đang gọi/).waitFor();
state = { ...state, status: 'ACCEPTED', acceptedAt: at, version: 2, revision: randomUUID() }; event('JOIN');
await page.waitForFunction(() => window.__callMedia.offers === 2);
holdIce = true;
await page.evaluate(() => {
  const peer = window.__callMedia.peers.at(-1);
  for (let i = 0; i < 2; i++) peer.onicecandidate({ candidate: { toJSON: () => ({ candidate: `candidate:${i}` }) } });
});
for (let tries = 0; tries < 100 && pendingIce.length < 2; tries++) await page.waitForTimeout(10);
assert.equal(pendingIce.length, 2);
const rejectIce = body => deliver('/user/queue/call-results', { requestId: body.requestId, conversationId: room, callId: body.callId, action: 'SIGNAL', accepted: false, errorCode: 'FORBIDDEN', state: null });
rejectIce(pendingIce[0]);
await page.getByText('Không thể tiếp tục cuộc gọi. Kiểm tra kết nối và quyền gọi.', { exact: true }).waitFor();
const heldId = state.callId;
await page.getByRole('button', { name: 'Gọi thoại', exact: true }).first().click();
await page.waitForFunction(() => window.__callMedia.offers === 3);
assert.equal(commands.filter(c => c.action === 'START').at(-1).body.callId, heldId);
rejectIce(pendingIce[1]); await page.waitForTimeout(100);
assert.equal(await page.getByText('Không thể tiếp tục cuộc gọi. Kiểm tra kết nối và quyền gọi.', { exact: true }).count(), 0);
await page.getByRole('button', { name: 'Kết thúc cuộc gọi', exact: true }).click(); holdIce = false;
await page.getByText(/(Gọi thoại|Voice call) ·/).waitFor({ state: 'hidden' });

state = snapshot(randomUUID(), true); event('START');
await page.getByRole('button', { name: 'Nhận cuộc gọi', exact: true }).waitFor();
await page.evaluate(() => { window.__callMedia.hold = true; });
const joinsBeforePermission = commands.filter(c => c.action === 'JOIN').length;
await page.getByRole('button', { name: 'Nhận cuộc gọi', exact: true }).click();
assert.equal(await page.getByRole('button', { name: 'Nhận cuộc gọi', exact: true }).count(), 0, 'accept must immediately lock while device permission is pending');
await page.evaluate(() => { window.__callMedia.release(); window.__callMedia.hold = false; });
for (let tries = 0; tries < 100 && commands.filter(c => c.action === 'JOIN').length === joinsBeforePermission; tries++) await page.waitForTimeout(10);
event('SIGNAL', { kind: 'sdp', description: { type: 'offer', sdp: 'v=0\r\n' } });
await page.waitForFunction(() => window.__callMedia.answers === 1);
await page.getByRole('button', { name: 'Kết thúc cuộc gọi', exact: true }).click();
await page.getByText(/(Gọi thoại|Voice call) ·/).waitFor({ state: 'hidden' });

await page.evaluate(() => { window.__callMedia.hold = true; });
const before = commands.filter(c => c.action === 'START').length;
await page.getByRole('button', { name: 'Gọi thoại', exact: true }).first().click();
await page.getByRole('button', { name: 'Kết thúc cuộc gọi', exact: true }).click();
await page.evaluate(() => { window.__callMedia.release(); window.__callMedia.hold = false; });
await page.waitForTimeout(100); assert.equal(commands.filter(c => c.action === 'START').length, before);

state = snapshot(randomUUID(), true); event('START');
await page.getByRole('button', { name: 'Nhận cuộc gọi', exact: true }).waitFor();
await page.evaluate(() => { window.__callMedia.denyNext = true; });
const beforeDenied = commands.filter(c => c.action === 'FAIL').length;
await page.getByRole('button', { name: 'Nhận cuộc gọi', exact: true }).click();
await page.getByText('Trình duyệt chưa cấp quyền camera hoặc microphone.', { exact: true }).waitFor();
assert.ok(commands.filter(c => c.action === 'FAIL').length > beforeDenied, 'failed recipient media acquisition must not leave the caller ringing until a false missed outcome');
await page.getByRole('button', { name: 'Đóng', exact: true }).first().click();

const matrix = []; await mkdir('artifacts/ui-audit/current', { recursive: true });
for (const theme of ['light', 'dark']) {
  await page.evaluate(theme => localStorage.setItem('themePreference', theme), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Người nhận', { exact: true }).first().click();
  state = snapshot(randomUUID(), true); event('START');
  await page.getByRole('button', { name: 'Nhận cuộc gọi', exact: true }).waitFor();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const panel = page.locator('[role="status"]').filter({ hasText: 'đang gọi cho bạn' });
    assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await page.screenshot({ path: `artifacts/ui-audit/current/call-${theme}-${width}.png`, fullPage: true }); matrix.push({ theme, width });
  }
  await page.getByRole('button', { name: 'Từ chối cuộc gọi', exact: true }).click();
}
custom = true;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByText('Người nhận', { exact: true }).first().click();
state = snapshot(randomUUID(), true); event('START');
await page.getByRole('button', { name: 'Nhận cuộc gọi', exact: true }).waitFor();
for (const width of [320, 1440]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.screenshot({ path: `artifacts/ui-audit/current/call-custom-${width}.png`, fullPage: true });
}
await page.getByRole('button', { name: 'Từ chối cuộc gọi', exact: true }).click();
await switchLocaleInSettings(page);
// A system timeout has no actor and must clear an incoming prompt immediately.
state = snapshot(randomUUID(), true); event('STATE');
await page.getByRole('button', { name: 'Answer call', exact: true }).waitFor();
const beforeServerTimeout = commands.length;
state = { ...state, status: 'MISSED', endedAt: at, version: 2, revision: randomUUID() };
event('STATE');
await page.getByRole('button', { name: 'Answer call', exact: true }).waitFor({ state: 'hidden' });
assert.equal(commands.length, beforeServerTimeout, 'server expiry must not impersonate a participant command');
// Retired control-event shapes are not a second supported protocol.
const retired = snapshot(randomUUID(), true);
deliver(`/topic/conversation/${room}/calls`, { conversationId: room, callId: retired.callId, actorId: peer, targetUserId: actor,
  action: 'START', callType: 'VOICE', occurredAt: at, state: retired });
await page.waitForTimeout(100);
assert.equal(await page.getByRole('button', { name: 'Answer call', exact: true }).count(), 0);
// Reload discovers server authority without devices, START, JOIN or invented IDs.
state = snapshot(randomUUID(), true); lookup = state;
let beforeDiscovery = commands.length;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByText('Người nhận', { exact: true }).first().click();
await page.getByRole('button', { name: 'Answer call', exact: true }).waitFor();
assert.equal(await page.evaluate(() => window.__callMedia.acquired), 0);
const discoveryCommands = commands.slice(beforeDiscovery);
assert.ok(discoveryCommands.every(command => command.action === 'SYNC' && command.body.callId === state.callId),
  'entry/reconnect may read the same authority, never START/JOIN/HEARTBEAT or change its identity');
// Merely leaving a recovered incoming prompt must not decline it on another tab.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByText('Người nhận', { exact: true }).first().click();
await page.getByRole('button', { name: 'Answer call', exact: true }).waitFor();
assert.equal(commands.filter(command => ['END', 'LEAVE', 'JOIN', 'START'].includes(command.action)).length,
  commands.slice(0, beforeDiscovery).filter(command => ['END', 'LEAVE', 'JOIN', 'START'].includes(command.action)).length);
state = { ...snapshot(randomUUID(), true), status: 'ACCEPTED', acceptedAt: at, version: 2 }; lookup = state;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByText('Người nhận', { exact: true }).first().click();
await page.getByText('This call is still open. This tab has no microphone or camera connection.', { exact: true }).waitFor();
assert.equal(await page.evaluate(() => window.__callMedia.acquired), 0);
assert.equal(await page.getByRole('button', { name: 'Answer call', exact: true }).count(), 0);
const recoveredId = state.callId;
for (const theme of ['light', 'dark']) {
  await page.evaluate(theme => localStorage.setItem('themePreference', theme), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Người nhận', { exact: true }).first().click();
  await page.getByText('This call is still open. This tab has no microphone or camera connection.', { exact: true }).waitFor();
  await page.waitForFunction(text => {
    const node = [...document.querySelectorAll('p')].find(node => node.textContent === text);
    if (!node) return false;
    let opacity = 1;
    for (let parent = node; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
    return opacity > 0.99;
  }, 'This call is still open. This tab has no microphone or camera connection.');
  assert.ok(await page.getByText('This call is still open. This tab has no microphone or camera connection.', { exact: true }).evaluate(node => {
    let opacity = 1;
    for (let parent = node; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
    return opacity;
  }) > 0.99, 'recovery screenshots must contain painted UI, not only DOM under a transparent motion ancestor');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: `artifacts/ui-audit/current/call-recovered-${theme}-${width}.png`, fullPage: true });
  }
}
await page.getByRole('button', { name: 'End call', exact: true }).click();
await page.getByText('This call is still open. This tab has no microphone or camera connection.', { exact: true }).waitFor({ state: 'hidden' });
assert.equal(commands.filter(command => command.action === 'END').at(-1).body.callId, recoveredId);
lookup = null; lookupError = true;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByText('Người nhận', { exact: true }).first().click();
await page.getByText('Could not check for an active call. Try again before starting another.', { exact: true }).waitFor();
assert.equal(await page.getByRole('button', { name: 'Voice call', exact: true }).first().isDisabled(), true);
lookupError = false;
await page.getByRole('button', { name: 'Try again', exact: true }).click();
await page.getByRole('button', { name: 'Voice call', exact: true }).first().click({ trial: true });
assert.equal(await page.getByRole('button', { name: 'Voice call', exact: true }).first().isEnabled(), true);
// Install the synthetic clock last: persisted clock instrumentation across reloads
// distorts the existing motion timeline and cannot serve as screenshot evidence.
await page.getByRole('button', { name: 'Voice call', exact: true }).first().click();
await page.getByText(/Voice call · Calling/).waitFor();
await page.clock.install();
const beforeTimeout = commands.filter(c => c.action === 'FAIL').length;
await page.clock.fastForward(30001);
assert.equal(commands.filter(c => c.action === 'FAIL').length, beforeTimeout, 'ringing does not start the negotiation timeout');
state = { ...state, status: 'ACCEPTED', acceptedAt: at, version: 2, revision: randomUUID() }; event('JOIN');
await page.waitForFunction(() => window.__callMedia.offers === 1);
await page.clock.fastForward(30001);
await page.getByText('The media connection failed. Try calling again.', { exact: true }).waitFor();
assert.ok(commands.filter(c => c.action === 'FAIL').length > beforeTimeout);
await page.getByRole('button', { name: 'Close', exact: true }).first().click();
assert.deepEqual(errors, []); assert.deepEqual(failures, []);
await browser.close();
console.log(JSON.stringify({ passed: 32, matrix, boundary: 'Production browser with controlled HTTP/STOMP and fake media, not live calls/Cassandra' }));
