import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path);
  const exports = {}; modules.set(path, exports);
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(`(function(exports,require){${code}})`, { Date, Map, Set, BigInt })(exports, name => {
    if (name.endsWith('auth.store')) return { useAuthStore: { getState: () => ({ user: { userId: 'actor' } }) } };
    if (name.endsWith('messengerCopy')) return { MESSENGER_COPY: { messageStatus: { deleted: 'Deleted' } } };
    if (name === '@/shared/api/apiClient') return { default: {} };
    if (name === '@/shared/i18n') return { localizeText: text => text };
    if (name === './poll.api') return { mapCanonicalPollView: value => value };
    if (name.startsWith('./')) return load(new URL(`${name}.ts`, new URL(path, import.meta.url)).href);
    throw new Error(`Unexpected module ${name}`);
  });
  return exports;
}
const { createMessageSlice } = load('../src/features/messenger/model/message.slice.ts');
const { createConversationSlice } = load('../src/features/messenger/model/conversation.slice.ts');
const { reconcileConversationPage } = load('../src/features/messenger/model/conversation-directory.ts');
let state = { conversations: [] };
const slice = createMessageSlice(change => { state = { ...state, ...change(state) }; });
state = { ...state, ...slice };
const conversations = createConversationSlice(change => { state = { ...state, ...change(state) }; });
const message = revision => ({ conversationId: 'room', messageBucket: '2026-10-23-08:00',
  messageId: '00000000-0000-1000-8000-000000000001', sender: { userId: 'peer' },
  content: `revision-${revision}`, type: 'TEXT', revision, createdAt: '2026-10-23T08:00:00Z',
  updatedAt: '2026-10-23T08:00:00Z', isDeleted: false, isForwarded: false, isPinned: false });
slice.addMessage('room', message(2));
slice.addMessage('room', message(0));
assert.equal(state.messages.room[0].revision, 2, 'older SEND cannot roll back a newer edit');
slice.updateMessage('room', message(1));
assert.equal(state.messages.room[0].revision, 2, 'out-of-order edit response cannot replace a later edit');
const beforeHistory = state.messages.room;
slice.applyMessagePinState({ conversationId: 'room', revision: '1', pins: [{ messageId: message(2).messageId, messageBucket: message(2).messageBucket }] });
slice.updateMessageReactions('room', message(2).messageId, { emoji: '❤️', userId: 'peer', action: 'ADD' });
slice.addMessage('room', message(3));
assert.equal(state.messages.room[0].isPinned, true, 'content snapshot cannot undo an independent pin event');
assert.equal(state.messages.room[0].reactions[0].count, 1, 'content snapshot preserves independent reactions');
slice.setMessages('room', [message(0)], { before: beforeHistory, hasNext: false, page: 0 });
assert.equal(state.messages.room[0].revision, 3, 'late history cannot roll back live content');
assert.equal(state.messages.room[0].isPinned, true, 'late history cannot undo a pin changed during its request');
assert.equal(state.messages.room[0].reactions[0].count, 1);
slice.addMessage('room', { ...message(4), isDeleted: true, content: '' });
slice.updateMessage('room', message(3));
assert.equal(state.messages.room[0].isDeleted, true);
assert.equal(state.messages.room[0].content, '');
state.conversations = [{ conversationId: 'room', isPinned: false, lastActivityAt: message(4).createdAt, unreadCount: 0 }];
conversations.upsertConversationFromMessage(state.messages.room[0]);
slice.addMessage('room', message(0));
conversations.upsertConversationFromMessage(message(0));
assert.equal(state.conversations[0].lastMessage.revision, 4, 'preview cannot use the discarded stale frame');
assert.equal(state.conversations[0].lastMessage.content, 'Deleted');
conversations.setConversations([{ ...state.conversations[0], lastMessage: { ...state.conversations[0].lastMessage, revision: undefined, content: 'old projection' } }], { hasNext: false, nextCursor: null });
assert.equal(state.conversations[0].lastMessage.content, 'Deleted', 'unversioned directory projection cannot overwrite known authority content');
const { mapToMessage } = load('../src/features/messenger/api/messenger.api.ts');
for (const revision of [undefined, null, -1, 0.5, NaN, Infinity, 2147483648, '1']) {
  assert.throws(() => mapToMessage({ revision }), /Canonical message revision is invalid/);
}
for (const revision of [0, 1, 2147483647]) {
  assert.equal(mapToMessage({ ...message(revision), revision }).revision, revision);
}
const beforePage = state.messages.room;
slice.prependMessages('room', [message(1)], { before: beforePage, hasNext: true, page: 1 });
assert.equal(state.messages.room.length, 1, 'duplicate history IDs are merged, not duplicated');
assert.equal(state.messages.room[0].revision, 4, 'older paginated snapshot cannot resurrect deletion');
slice.appendMessages('room', [message(2)], { before: state.messages.room, hasNext: false, page: 2 });
assert.equal(state.messages.room[0].revision, 4);
const beforeArrival = state.messages.room;
slice.addMessage('room', { ...message(0), messageId: 'arrival', content: 'Arrived during fetch' });
slice.setMessages('room', [message(4)], { before: beforeArrival, hasNext: false, page: 0 });
assert.ok(state.messages.room.some(item => item.messageId === 'arrival'), 'head refresh keeps arrivals during its request');
const pinnedBefore = state.messages.room;
slice.setMessages('room', [{ ...message(4), isDeleted: true, content: '', isPinned: false, reactions: [] }],
  { before: pinnedBefore, hasNext: false, page: 0 });
assert.equal(state.messages.room[0].isPinned, false, 'non-racing authoritative history can refresh independent state');
const latestId = '00000000-0000-1000-8000-000000000003';
conversations.upsertConversationFromMessage({ ...message(0), messageId: latestId });
conversations.upsertConversationFromMessage({ ...message(0), messageId: '00000000-0000-1000-8000-000000000002' });
assert.equal(state.conversations[0].lastMessage.messageId, latestId, 'same-millisecond arrivals use canonical timeuuid order');
conversations.appendConversations([{ ...state.conversations[0], lastMessage: { ...state.conversations[0].lastMessage, revision: undefined, content: 'stale append' } }], { hasNext: false, nextCursor: null });
assert.notEqual(state.conversations[0].lastMessage.content, 'stale append');
const currentConversation = state.conversations[0];
const conversationPage = { hasNext: false, nextCursor: null };
const olderPreview = { ...currentConversation.lastMessage, messageId: '00000000-0000-1000-8000-000000000002' };
const newerPreview = { ...currentConversation.lastMessage, messageId: '00000000-0000-1000-8000-000000000004' };
for (const merge of [conversations.setConversations, conversations.appendConversations]) {
  state.conversations = [currentConversation];
  merge([{ ...currentConversation, lastMessage: olderPreview, unreadCount: 2 }], conversationPage);
  assert.equal(state.conversations[0].lastMessage.messageId, latestId, 'older same-millisecond directory result cannot roll back a live preview');
  assert.equal(state.conversations[0].unreadCount, 2, 'preserving the preview does not keep unrelated stale directory metadata');
  merge([{ ...currentConversation, lastMessage: null }], conversationPage);
  assert.equal(state.conversations[0].lastMessage.messageId, latestId, 'empty same-activity directory result cannot erase a known canonical preview');
  merge([{ ...currentConversation, lastMessage: newerPreview }], conversationPage);
  assert.equal(state.conversations[0].lastMessage.messageId, newerPreview.messageId, 'a newer same-millisecond result must still advance the preview');
}
const optimisticPreview = { ...currentConversation.lastMessage, messageId: 'temp-pending', revision: undefined };
state.conversations = [{ ...currentConversation, lastMessage: optimisticPreview }];
conversations.setConversations([currentConversation], conversationPage);
assert.equal(state.conversations[0].lastMessage.messageId, latestId, 'a provisional ID does not block an equal-activity canonical result');
state.conversations = [];
const staleDuplicate = { ...currentConversation, lastMessage: olderPreview, unreadCount: 3 };
conversations.setConversations([currentConversation, staleDuplicate], conversationPage);
assert.equal(state.conversations.length, 1, 'default directory initialization deduplicates repeated rows');
assert.equal(state.conversations[0].lastMessage.messageId, latestId, 'the stale duplicate cannot replace the first preview');
assert.equal(state.conversations[0].unreadCount, 3, 'the latest non-preview metadata still applies');
const otherConversation = { ...currentConversation, conversationId: 'another-room' };
const filtered = reconcileConversationPage([currentConversation, otherConversation], [staleDuplicate], true);
assert.equal(filtered.map(item => item.conversationId).join(','), 'room,another-room', 'filtered continuation keeps first appearance order');
assert.equal(filtered[0].lastMessage.messageId, latestId, 'filtered pagination keeps newer previews for repeated IDs');
const filteredReload = reconcileConversationPage(filtered, [staleDuplicate], false);
assert.equal(filteredReload.length, 1, 'filtered replacement does not retain rooms absent from the new page');
assert.equal(filteredReload[0].lastMessage.messageId, latestId, 'same-filter reload also protects the preview');
const scoped = { ...message(0), conversationId: 'pins-room' };
slice.applyMessagePinState({ conversationId: 'pins-room', revision: '9007199254740993', pins: [{ messageId: scoped.messageId, messageBucket: scoped.messageBucket }] });
slice.addMessage('pins-room', scoped);
assert.equal(state.messages['pins-room'][0].isPinned, true, 'snapshot arriving before history applies to later messages');
slice.applyMessagePinState({ conversationId: 'pins-room', revision: '9007199254740992', pins: [] });
assert.equal(state.messages['pins-room'][0].isPinned, true, 'long versions compare without Number precision loss');
slice.applyMessagePinState({ conversationId: 'pins-room', revision: '9007199254740994', pins: [] });
slice.applyMessagePinState({ conversationId: 'pins-room', revision: '9007199254740993', pins: [{ messageId: scoped.messageId, messageBucket: scoped.messageBucket }] });
assert.equal(state.messages['pins-room'][0].isPinned, false, 'delayed PIN cannot undo newer UNPIN');
slice.setMessages('pins-room', [{ ...scoped, isPinned: true }], { before: state.messages['pins-room'], hasNext: false, page: 0 });
assert.equal(state.messages['pins-room'][0].isPinned, false, 'unversioned history pin flag cannot overwrite known full pin snapshot');
const deletedScope = { ...message(0), conversationId: 'deleted-pin-room' };
const deletedPin = { messageId: deletedScope.messageId, messageBucket: deletedScope.messageBucket };
slice.applyMessagePinState({ conversationId: deletedScope.conversationId, revision: '1', pins: [deletedPin] });
slice.addMessage(deletedScope.conversationId, deletedScope);
assert.equal(state.messages[deletedScope.conversationId][0].isPinned, true);
slice.addMessage(deletedScope.conversationId, { ...deletedScope, revision: 1, isDeleted: true, content: '' });
assert.equal(state.messages[deletedScope.conversationId][0].isPinned, false, 'deletion wins before its independent pin cleanup snapshot arrives');
slice.applyMessagePinState({ conversationId: deletedScope.conversationId, revision: '2', pins: [deletedPin] });
assert.equal(state.messages[deletedScope.conversationId][0].isPinned, false, 'even a newer delivered pin snapshot cannot pin an accepted tombstone');
slice.applyMessagePinState({ conversationId: deletedScope.conversationId, revision: '3', pins: [] });
slice.applyMessagePinState({ conversationId: deletedScope.conversationId, revision: '2', pins: [deletedPin] });
slice.updateMessage(deletedScope.conversationId, { ...deletedScope, isPinned: true });
slice.setMessages(deletedScope.conversationId, [{ ...deletedScope, isPinned: true }],
  { before: state.messages[deletedScope.conversationId], hasNext: false, page: 0 });
assert.equal(state.messages[deletedScope.conversationId][0].isDeleted, true, 'late pin response/history cannot undo deletion');
assert.equal(state.messages[deletedScope.conversationId][0].content, '');
assert.equal(state.messages[deletedScope.conversationId][0].isPinned, false);
const directoryBeforeDenial = state.conversations;
slice.setMessageHistoryUnavailable('room', true);
const late = { ...message(8), createdAt: '2026-10-23T09:00:00Z' };
slice.addMessage('room', late);
conversations.upsertConversationFromMessage(late);
assert.equal(state.messages.room, undefined, 'late message cannot refill a denied history');
assert.equal(state.conversations, directoryBeforeDenial, 'late message cannot update preview or unread counts after denial');
console.log(JSON.stringify({ passed: 27, boundary: 'Actual message/conversation stores, directory page reconciliation and strict adapter; controlled snapshots, not live Cassandra/realtime' }));
