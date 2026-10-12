import type { SendMessageRequest } from '../types/messenger.types';
import { logger } from '@/shared/lib/logger';

interface SendAttempt {
  clientMessageId: string;
  fingerprint: string;
}

const storageKey = (userId: string, conversationId: string) =>
  `noi:message-send:v1:${encodeURIComponent(userId)}:${encodeURIComponent(conversationId)}`;

const readAttempt = (key: string): SendAttempt | undefined => {
  const stored = window.sessionStorage.getItem(key);
  if (!stored) return undefined;
  const value: unknown = JSON.parse(stored);
  if (!value || typeof value !== 'object'
    || !('clientMessageId' in value) || typeof value.clientMessageId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.clientMessageId)
    || !('fingerprint' in value) || typeof value.fingerprint !== 'string'
    || !/^[0-9a-f]{64}$/.test(value.fingerprint)) {
    throw new Error('The pending message send record is invalid');
  }
  return { clientMessageId: value.clientMessageId, fingerprint: value.fingerprint };
};

// Per-tab storage survives reload without merging independent sends from other tabs.
// Only the payload hash is stored, not another copy of message text or attachment URLs.
export const prepareMessageSend = async (
  userId: string,
  request: Omit<SendMessageRequest, 'clientMessageId'>,
): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(request)));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const key = storageKey(userId, request.conversationId);
  const previous = readAttempt(key);
  if (previous?.fingerprint === fingerprint) return previous.clientMessageId;
  const clientMessageId = crypto.randomUUID();
  // Fail before HTTP when storage is unavailable, rather than silently losing retry safety.
  window.sessionStorage.setItem(key, JSON.stringify({ clientMessageId, fingerprint }));
  return clientMessageId;
};

export const completeMessageSend = (userId: string, conversationId: string, clientMessageId: string): void => {
  try {
    const key = storageKey(userId, conversationId);
    if (readAttempt(key)?.clientMessageId === clientMessageId) window.sessionStorage.removeItem(key);
  } catch (error) {
    // Delivery is confirmed: cleanup failure must not report send failure.
    logger.warn('[MessageSendAttempt] Could not clear confirmed send', error instanceof Error ? error.message : String(error));
  }
};
