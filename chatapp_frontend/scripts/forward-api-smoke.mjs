import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';

const source = await readFile(new URL('../src/features/messenger/api/forward.api.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const scope = { conversationId: 'source-room', messageBucket: '2026-10-20-08:03', messageId: 'source-id' };
const message = { ...scope, senderId: 'source-sender', content: 'Actual source', contentFormat: 'PLAIN', revision: 0, messageType: 'TEXT',
  isDeleted: false, hasAttachments: false, hasMentions: false, isPinned: false, forwarded: false, createdAt: '2026-10-20T08:00:00Z' };
let data = { message, attachments: [] }, error;
const calls = [], exports = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`)(exports, name => {
  assert.equal(name, '@/shared/api/apiClient');
  return { __esModule: true, default: {
    get: async (...args) => { calls.push(['GET', ...args]); if (error) throw error; return { data }; },
    post: async (...args) => { calls.push(['POST', ...args]); if (error) throw error; return { data }; },
  } };
});
const signal = new AbortController().signal;
const draft = await exports.getForwardDraft(scope, signal);
assert.equal(calls[0][1], '/conversations/source-room/messages/source-id/forward-draft');
assert.equal(calls[0][2].params.bucket, scope.messageBucket); assert.equal(calls[0][2].signal, signal);
const command = exports.createForwardCommand('actor', 'target', 'client-command', draft);
assert.equal(command.payload.forwardedFromConversationId, scope.conversationId);
assert.equal(command.payload.forwardedFromMessageId, scope.messageId);
assert.equal(command.payload.forwardedFromMessageBucket, scope.messageBucket);
assert.equal(command.payload.replyToMessageId, undefined); assert.equal(command.payload.mentionEveryone, false);
draft.message.content = 'changed locally';
assert.equal(command.payload.content, 'Actual source', 'attempt owns a frozen snapshot');
assert.throws(() => { command.payload.content = 'tampered'; });
data = { ...message, content: command.payload.content, conversationId: 'target', clientMessageId: 'client-command', senderId: 'actor', forwarded: true };
error = new Error('uncertain transport');
await assert.rejects(exports.sendForward(command));
error = undefined; await exports.sendForward(command);
assert.equal(calls.at(-2)[2], calls.at(-1)[2], 'uncertain retry uses exactly the same payload object');
assert.equal(calls.at(-1)[1], '/conversations/target/messages');
const confirmed = data;
data = { ...confirmed, isDeleted: true, forwarded: false, content: '' };
assert.equal((await exports.sendForward(command)).isDeleted, true, 'committed retry may acknowledge a destination tombstone without resending');
data = { ...confirmed, content: 'wrong acknowledged copy' }; await assert.rejects(exports.sendForward(command));
data = confirmed;
data = { ...data, conversationId: 'other' }; await assert.rejects(exports.sendForward(command));
data = { available: false }; assert.equal((await exports.getForwardSource(scope, signal)).source, null);
data = { available: false, source: message }; await assert.rejects(exports.getForwardSource(scope, signal));
data = { available: true, source: { ...message, content: 'readable source' } };
assert.equal((await exports.getForwardSource(scope, signal)).source.content, 'readable source');
const validDraft = { message: { ...message, content: 'Actual source' }, attachments: [] };
for (const invalid of [
  { ...validDraft, message: { ...message, conversationId: 'other' } },
  { ...validDraft, message: { ...message, isDeleted: true } },
  { ...validDraft, message: { ...message, messageType: 'POLL' } },
  { ...validDraft, message: { ...message, hasAttachments: true } },
  { ...validDraft, attachments: [{ assetId: 'arbitrary' }] },
  { ...validDraft, message: { ...message, forwardedFromConversationId: 'private' } },
  { ...validDraft, message: { ...message, messageType: 'GIF', gif: { provider: 'GIPHY' } } },
]) { data = invalid; await assert.rejects(exports.getForwardDraft(scope, signal)); }
data = { message: { ...message, hasAttachments: true }, attachments: [{ attachmentId: 'attachment', assetId: 'asset',
  storageProvider: 'CLOUDINARY', storageKey: 'key', fileName: null, mimeType: null, byteSize: null, width: 320, height: 180 }] };
const nullableDraft = await exports.getForwardDraft(scope, signal);
assert.equal(nullableDraft.attachments[0].byteSize, null);
assert.equal(exports.createForwardCommand('actor', 'target', 'client-2', nullableDraft).payload.attachments[0].width, 320);
const attachmentCommand = exports.createForwardCommand('actor', 'target', 'client-attachment', nullableDraft);
nullableDraft.attachments[0].width = 999;
assert.equal(attachmentCommand.payload.attachments[0].width, 320);
assert.throws(() => { attachmentCommand.payload.attachments[0].width = 999; });
data = { ...nullableDraft.message, conversationId: 'target', senderId: 'actor', clientMessageId: 'client-attachment', forwarded: true };
await exports.sendForward(attachmentCommand);
assert.equal(calls.at(-1)[2].attachments[0].width, 320);
assert.equal(calls.at(-1)[2].attachments[0].byteSize, null);
for (const media of [
  { messageType: 'GIF', gif: { provider: 'GIPHY', providerGifId: 'valid-id' }, stickerId: null },
  { messageType: 'STICKER', gif: null, stickerId: '00000000-0000-0000-0000-000000000701' },
]) {
  data = { message: { ...message, ...media, content: '', hasAttachments: false }, attachments: [] };
  const mediaDraft = await exports.getForwardDraft(scope, signal);
  const mediaCommand = exports.createForwardCommand('actor', 'target', `client-${media.messageType}`, mediaDraft);
  data = { ...mediaDraft.message, conversationId: 'target', senderId: 'actor', clientMessageId: mediaCommand.payload.clientMessageId, forwarded: true };
  await exports.sendForward(mediaCommand);
  assert.equal(calls.at(-1)[2].content, '');
  assert.equal(calls.at(-1)[2].stickerId, media.stickerId);
  assert.equal(calls.at(-1)[2].gif?.providerGifId, media.gif?.providerGifId);
}
console.log(JSON.stringify({ passed: 23, boundary: 'Production forward adapter and frozen command with controlled HTTP; not UI/live backend' }));
