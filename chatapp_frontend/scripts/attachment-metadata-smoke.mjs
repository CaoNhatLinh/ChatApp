import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { isAxiosError } from 'axios';

const uploaded = {
  assetId: 'asset-a', attachmentId: 'attachment-a', storageProvider: 'CLOUDINARY', storageKey: 'chatapp/asset-a',
  url: 'https://res.cloudinary.com/test/image/upload/asset-a.png', fileName: 'photo.png', fileSize: 64,
  contentType: 'image/png', resourceType: 'image', publicId: 'chatapp/asset-a',
  width: 1280, height: 720, durationMs: null,
  thumbnailUrl: 'https://res.cloudinary.com/test/image/upload/small/asset-a.png',
};
const requests = [];
let uploadResponse = { success: true, file: uploaded };
let uploadInspection;
let uploadInspectionStatus = 200;
let failSend = false;
const response = { conversationId: 'room-a', messageBucket: '2026-10-23-08:00', messageId: 'message-a',
  senderId: 'actor-a', content: '', revision: 0, messageType: 'IMAGE', contentFormat: 'PLAIN', isDeleted: false,
  hasAttachments: true, createdAt: '2026-10-23T08:00:00Z' };
const source = await readFile(new URL('../src/features/messenger/api/messenger.api.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const api = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`, { FormData })(api, name => {
  if (name === '@/shared/api/apiClient') return { __esModule: true, default: { post: async (path, payload, config) => {
    requests.push({ path, payload, config });
    if (path.includes('/messages') && failSend) throw new Error('controlled send failure');
    return { data: path.startsWith('/files/upload') ? uploadResponse : response };
  }, get: async (path, config) => {
    requests.push({ path, config });
    if (!config.validateStatus(uploadInspectionStatus)) throw new Error(`HTTP ${uploadInspectionStatus}`);
    return { data: uploadInspection, status: uploadInspectionStatus };
  } } };
  if (name === '@/shared/i18n') return { localizeText: value => value };
  if (name === './poll.api') return { mapCanonicalPollView: value => value };
  throw new Error(`Unexpected dependency: ${name}`);
});

const controller = new AbortController();
const attachments = await api.uploadFiles([new File(['content'], 'photo.png', { type: 'image/png' })], controller.signal);
assert.equal(requests[0].config.signal, controller.signal, 'upload cancellation reaches the HTTP adapter');
assert.equal(requests[0].config.params, undefined, 'general uploads keep the default request');
assert.equal(attachments[0].width, 1280, 'upload mapper retains canonical width');
assert.equal(attachments[0].height, 720, 'upload mapper retains canonical height');
await api.sendMessageHttp({ conversationId: 'room-a', clientMessageId: 'attempt-a', content: '', type: 'IMAGE', attachments });
assert.equal(requests.at(-1).payload.attachments[0].width, 1280, 'send serializer retains canonical width');
assert.equal(requests.at(-1).payload.attachments[0].height, 720, 'send serializer retains canonical height');
const sentImage = requests.at(-1).payload.attachments[0];
assert.equal(sentImage.durationMs, null, 'unknown duration remains null, not zero');
assert.equal(sentImage.thumbnailUrl, uploaded.thumbnailUrl);

uploadResponse = { success: true, file: { ...uploaded, fileName: 'clip.mp4', contentType: 'video/mp4', resourceType: 'video', durationMs: 2301 } };
const video = await api.uploadFiles([new File(['video'], 'clip.mp4', { type: 'video/mp4' })]);
assert.equal(video[0].durationMs, 2301);
await api.sendMessageHttp({ conversationId: 'room-a', clientMessageId: 'video-attempt', content: '', type: 'VIDEO', attachments: video });
assert.equal(requests.at(-1).payload.attachments[0].durationMs, 2301);

uploadResponse = { success: true, file: { ...uploaded, contentType: 'audio/ogg', width: null, height: null, durationMs: 0, thumbnailUrl: null } };
const audio = await api.uploadFiles([new File(['audio'], 'audio.ogg', { type: 'audio/ogg' })]);
await api.sendMessageHttp({ conversationId: 'room-a', clientMessageId: 'audio-attempt', content: '', type: 'AUDIO', attachments: audio });
const audioPayload = requests.at(-1).payload.attachments[0];
assert.equal(audioPayload.durationMs, 0, 'known zero is retained');
assert.equal(audioPayload.width, null);
assert.equal(audioPayload.height, null);

uploadResponse = { success: true, uploadedFiles: [uploaded, { ...uploaded, assetId: 'asset-b', attachmentId: 'attachment-b', width: 640, height: 480 }] };
const multiple = await api.uploadFiles([new File(['a'], 'a.png'), new File(['b'], 'b.png')]);
assert.equal(requests.at(-1).path, '/files/upload/multiple');
assert.equal(multiple[0].width, 1280);
assert.equal(multiple[1].width, 640);
assert.equal(multiple[1].height, 480);

const firstUploadId = '00000000-0000-4000-8000-000000000001';
const secondUploadId = '00000000-0000-4000-8000-000000000002';
const firstFile = new File(['a'], 'a.png');
const secondFile = new File(['b'], 'b.png');
uploadResponse = { success: true, file: uploaded };
await api.uploadFiles([firstFile], controller.signal, [firstUploadId]);
assert.equal(requests.at(-1).config.params.uploadId, firstUploadId);
assert.equal(requests.at(-1).config.params.purpose, undefined, 'an upload ID alone does not opt into composer cleanup');
await api.uploadFiles([firstFile], controller.signal, [firstUploadId], 'COMPOSER');
assert.equal(requests.at(-1).config.params.uploadId, firstUploadId);
assert.equal(requests.at(-1).config.params.purpose, 'COMPOSER');
assert.equal(requests.at(-1).config.signal, controller.signal);
uploadResponse = { success: true, uploadedFiles: [uploaded, uploaded] };
await api.uploadFiles([firstFile, secondFile], undefined, [firstUploadId, secondUploadId], 'COMPOSER');
assert.equal(requests.at(-1).config.params.uploadIds, `${firstUploadId},${secondUploadId}`);
assert.equal(requests.at(-1).config.params.purpose, 'COMPOSER');
const requestCount = requests.length;
await assert.rejects(api.uploadFiles([firstFile, secondFile], undefined, [firstUploadId, firstUploadId]), /distinct upload ID/);
await assert.rejects(api.uploadFiles([firstFile], undefined, []), /distinct upload ID/);
assert.equal(requests.length, requestCount, 'invalid intent IDs never reach the upload endpoint');

uploadInspection = { uploadId: firstUploadId, status: 'PENDING', file: null };
const pending = await api.inspectMediaUpload(firstUploadId, controller.signal);
assert.equal(pending.status, 'PENDING');
assert.equal(pending.file, null);
assert.equal(requests.at(-1).path, `/files/uploads/${firstUploadId}`);
assert.equal(requests.at(-1).config.signal, controller.signal);
uploadInspection = { uploadId: firstUploadId, status: 'READY', file: uploaded };
const recovered = await api.inspectMediaUpload(firstUploadId);
assert.equal(recovered.file.assetId, uploaded.assetId);
assert.equal(recovered.file.thumbnailUrl, uploaded.thumbnailUrl);
await assert.rejects(api.inspectMediaUpload(secondUploadId), /different upload ID/);
uploadInspectionStatus = 404;
assert.equal(await api.inspectMediaUpload(secondUploadId), null);
uploadInspectionStatus = 403;
await assert.rejects(api.inspectMediaUpload(secondUploadId), /HTTP 403/);

const retry = { conversationId: 'room-a', clientMessageId: 'same-attempt', content: '', type: 'IMAGE', attachments };
failSend = true;
await assert.rejects(api.sendMessageHttp(retry), /controlled send failure/);
const failed = JSON.stringify(requests.at(-1).payload);
failSend = false;
await api.sendMessageHttp(retry);
assert.equal(JSON.stringify(requests.at(-1).payload), failed, 'retry retains exact metadata and idempotency identity');

// Exercise the real optimistic/error callback rather than reproducing its logic here.
const hookSource = await readFile(new URL('../src/features/messenger/model/useMessenger.ts', import.meta.url), 'utf8');
const tree = ts.createSourceFile('useMessenger.ts', hookSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let callback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'sendMessage' && node.initializer
    && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0];
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(callback);
const hookCode = ts.transpileModule(`const send = ${callback.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const optimistic = [], statuses = [], cleared = [];
class SessionChangedError extends Error {}
let generation = 1;
let transport = api.sendMessageHttp;
const send = vm.runInNewContext(`${hookCode}\nsend`, {
  activeConversationId: 'room-a', user: { userId: 'actor-a' }, getSessionGeneration: () => generation,
  prepareMessageSend: async () => 'optimistic-attempt', completeMessageSend: (...args) => cleared.push(args),
  addMessage: (room, message) => optimistic.push(message), upsertConversationFromMessage() {},
  updateMessageStatus: (...args) => statuses.push(args), logger: { error() {} }, SessionChangedError,
  sendMessageHttp: request => transport(request), isAxiosError, Date,
});
failSend = true;
await assert.rejects(send('', 'IMAGE', { attachments, mentions: ['peer-a'], mentionEveryone: true }), /controlled send failure/);
assert.equal(optimistic.at(-1).attachments[0].width, 1280);
assert.equal(optimistic.at(-1).attachments[0].height, 720);
assert.equal(statuses.at(-1)[2], 'failed');
assert.equal(cleared.length, 0);
const failedMessage = optimistic.at(-1);
assert.ok(failedMessage.pendingSend, 'failed optimistic message retains the original command, not only rendered fields');
assert.equal(failedMessage.pendingSend.mentions[0], 'peer-a');
assert.equal(failedMessage.pendingSend.mentionEveryone, true);
failSend = false;
await send(failedMessage.pendingSend.content, failedMessage.pendingSend.type, failedMessage.pendingSend);
assert.equal(requests.at(-1).payload.clientMessageId, failedMessage.clientMessageId);
assert.equal(requests.at(-1).payload.attachments[0].width, 1280);
assert.equal(requests.at(-1).payload.mentionedUserIds[0], 'peer-a');
assert.equal(requests.at(-1).payload.mentionEveryone, true);
assert.equal(JSON.stringify(requests.at(-1).payload).includes('pendingSend'), false, 'local retry state is not a backend field');
assert.equal(optimistic.at(-1).attachments[0].height, 720);
assert.equal(cleared.length, 1);
assert.equal(optimistic.at(-1).pendingSend, undefined, 'confirmed messages discard the unconfirmed command snapshot');

const mutableAttachments = attachments.map(row => ({ ...row }));
const mutableMentions = ['peer-before'];
const operation = send('', 'IMAGE', { attachments: mutableAttachments, mentions: mutableMentions });
mutableAttachments[0].width = 999;
mutableMentions[0] = 'peer-after';
await operation;
assert.equal(requests.at(-1).payload.attachments[0].width, 1280, 'the send snapshot is taken before asynchronous fingerprinting');
assert.equal(requests.at(-1).payload.mentionedUserIds[0], 'peer-before');

for (const succeed of [false, true]) {
  let finishPost;
  const posted = new Promise(resolve => {
    transport = () => new Promise((fulfill, reject) => {
      finishPost = () => succeed ? fulfill({ messageId: 'stale-server-message' }) : reject(new Error('late network failure'));
      resolve();
    });
  });
  const pending = send('', 'IMAGE', { attachments, clientMessageId: 'same-temp-id' });
  await posted;
  const previousStatusCount = statuses.length;
  const previousMessageCount = optimistic.length;
  const previousClearedCount = cleared.length;
  generation += 1;
  finishPost();
  await assert.rejects(pending, SessionChangedError);
  assert.equal(statuses.length, previousStatusCount, 'a late POST cannot fail a reused optimistic ID in another session');
  assert.equal(optimistic.length, previousMessageCount, 'a late POST cannot append a confirmed snapshot in another session');
  assert.equal(cleared.length, previousClearedCount, 'a late POST cannot clear another session’s send attempt');
}
console.log(JSON.stringify({ passed: 13, boundary: 'Production upload/send adapters + AST-extracted optimistic/error callback; controlled HTTP/store; no real provider/database/browser' }));
