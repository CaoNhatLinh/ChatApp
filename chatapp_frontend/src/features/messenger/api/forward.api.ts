import apiClient from '@/shared/api/apiClient';
import type { BackendMessage } from './messenger.api';
import type { MessageKey } from './thread.api';

export interface ForwardAttachment {
  attachmentId: string; assetId: string; storageProvider: string; storageKey: string;
  fileName: string | null; mimeType: string | null; byteSize: number | null;
  width?: number | null; height?: number | null; durationMs?: number | null;
  thumbnailUrl?: string | null; isSpoiler?: boolean | null;
}
export interface ForwardDraft { message: BackendMessage; attachments: ForwardAttachment[] }
export interface ForwardSource { available: boolean; source: BackendMessage | null }
export interface ForwardCommand {
  readonly actorId: string;
  readonly conversationId: string;
  readonly payload: Readonly<{
    clientMessageId: string; messageType: BackendMessage['messageType']; content: string; contentFormat: string;
    stickerId: string | null; gif: BackendMessage['gif'] | null;
    forwardedFromConversationId: string; forwardedFromMessageBucket: string; forwardedFromMessageId: string;
    attachments: readonly Readonly<ForwardAttachment>[]; mentionedUserIds: readonly string[]; mentionEveryone: false;
  }>;
}

const forwardTypes = new Set(['TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO', 'STICKER', 'GIF']);
const sourceKeys = ['forwardedFromConversationId', 'forwardedFromMessageBucket', 'forwardedFromMessageId'];
const invalid = () => new Error('Invalid canonical forward response');
function readMessage(value: unknown, allowDeleted = false): BackendMessage {
  if (!value || typeof value !== 'object') throw invalid();
  const row = value as Partial<BackendMessage>;
  if (sourceKeys.some(key => key in value) || typeof row.isDeleted !== 'boolean' || (!allowDeleted && row.isDeleted) || typeof row.forwarded !== 'boolean'
    || ['conversationId', 'messageBucket', 'messageId', 'senderId'].some(key => typeof row[key as keyof BackendMessage] !== 'string' || !row[key as keyof BackendMessage])
    || typeof row.content !== 'string' || row.content.length > 20000 || typeof row.contentFormat !== 'string'
    || typeof row.messageType !== 'string' || ![...forwardTypes, 'POLL', 'SYSTEM'].includes(row.messageType)
    || typeof row.hasAttachments !== 'boolean' || typeof row.hasMentions !== 'boolean' || typeof row.isPinned !== 'boolean'
    || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))) throw invalid();
  if (!row.isDeleted && row.messageType === 'GIF' && (!row.gif || row.gif.provider !== 'GIPHY'
    || typeof row.gif.providerGifId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.gif.providerGifId))) throw invalid();
  if (!row.isDeleted && row.messageType === 'STICKER' && typeof row.stickerId !== 'string') throw invalid();
  return row as BackendMessage;
}
function readAttachment(value: unknown): ForwardAttachment {
  if (!value || typeof value !== 'object') throw invalid();
  const row = value as Partial<ForwardAttachment>;
  if ((row.byteSize !== null && row.byteSize !== undefined && (typeof row.byteSize !== 'number' || !Number.isSafeInteger(row.byteSize) || row.byteSize < 0))
    || [row.fileName, row.mimeType].some(text => text !== null && text !== undefined && typeof text !== 'string')
    || [row.width, row.height, row.durationMs].some(number => number !== null && number !== undefined && (!Number.isSafeInteger(number) || number < 0))
    || (row.thumbnailUrl !== null && row.thumbnailUrl !== undefined && typeof row.thumbnailUrl !== 'string')
    || (row.isSpoiler !== null && row.isSpoiler !== undefined && typeof row.isSpoiler !== 'boolean')) throw invalid();
  const required = (key: 'attachmentId' | 'assetId' | 'storageProvider' | 'storageKey') => {
    const text = row[key]; if (typeof text !== 'string' || !text) throw invalid(); return text;
  };
  return { attachmentId: required('attachmentId'), assetId: required('assetId'), storageProvider: required('storageProvider'),
    storageKey: required('storageKey'), fileName: row.fileName ?? null, mimeType: row.mimeType ?? null, byteSize: row.byteSize ?? null,
    width: row.width ?? null, height: row.height ?? null, durationMs: row.durationMs ?? null,
    thumbnailUrl: row.thumbnailUrl ?? null, isSpoiler: row.isSpoiler ?? null };
}

export async function getForwardDraft(scope: MessageKey, signal: AbortSignal): Promise<ForwardDraft> {
  const { data } = await apiClient.get(`/conversations/${scope.conversationId}/messages/${scope.messageId}/forward-draft`, {
    params: { bucket: scope.messageBucket }, signal,
  });
  const draft = data as Partial<ForwardDraft> | null;
  const message = readMessage(draft?.message);
  if (message.conversationId !== scope.conversationId || message.messageId !== scope.messageId || message.messageBucket !== scope.messageBucket
    || !forwardTypes.has(message.messageType) || !Array.isArray(draft?.attachments) || draft.attachments.length > 50) throw invalid();
  const attachments = draft.attachments.map(readAttachment);
  if (new Set(attachments.map(row => row.attachmentId)).size !== attachments.length || message.hasAttachments !== (attachments.length > 0)) throw invalid();
  return { message, attachments };
}

export async function getForwardSource(scope: MessageKey, signal: AbortSignal): Promise<ForwardSource> {
  const { data } = await apiClient.get(`/conversations/${scope.conversationId}/messages/${scope.messageId}/forward-source`, {
    params: { bucket: scope.messageBucket }, signal,
  });
  const view = data as Partial<ForwardSource> | null;
  if (!view || typeof view.available !== 'boolean') throw invalid();
  if (!view.available) { if (view.source !== null && view.source !== undefined) throw invalid(); return { available: false, source: null }; }
  return { available: true, source: readMessage(view.source) };
}

/** One immutable payload per attempt; retry must not rebuild it from a refreshed source. */
export function createForwardCommand(actorId: string, conversationId: string, clientMessageId: string, draft: ForwardDraft): ForwardCommand {
  const message = draft.message;
  return Object.freeze({ actorId, conversationId, payload: Object.freeze({ clientMessageId,
    messageType: message.messageType, content: message.content, contentFormat: message.contentFormat,
    stickerId: message.stickerId ?? null, gif: message.gif ? Object.freeze({ ...message.gif }) : null,
    forwardedFromConversationId: message.conversationId, forwardedFromMessageBucket: message.messageBucket, forwardedFromMessageId: message.messageId,
    attachments: Object.freeze(draft.attachments.map(row => Object.freeze({ ...row }))),
    mentionedUserIds: Object.freeze([] as string[]), mentionEveryone: false as const,
  }) });
}

export async function sendForward(command: ForwardCommand): Promise<BackendMessage> {
  const { data } = await apiClient.post(`/conversations/${command.conversationId}/messages`, command.payload);
  const message = readMessage(data, true);
  if (message.conversationId !== command.conversationId || message.clientMessageId !== command.payload.clientMessageId
    || message.senderId !== command.actorId || (!message.isDeleted && !message.forwarded)) throw invalid();
  const expected = command.payload;
  if (!message.isDeleted && (message.content !== expected.content || message.messageType !== expected.messageType
    || message.contentFormat !== expected.contentFormat || (message.stickerId ?? null) !== expected.stickerId
    || message.gif?.provider !== expected.gif?.provider || message.gif?.providerGifId !== expected.gif?.providerGifId
    || message.hasAttachments !== (expected.attachments.length > 0) || message.hasMentions)) throw invalid();
  return message;
}
