import { MAX_MESSAGE_CONTENT_LENGTH } from '@/features/messenger/constants/messageLimits';
import { logger } from '@/shared/lib/logger';

interface StoredMessageDraft {
  conversationId: string;
  text: string;
  updatedAt: number;
}

interface StoredMessageDraftCollection {
  version: 1;
  drafts: StoredMessageDraft[];
}

const STORAGE_KEY_PREFIX = 'novachat_message_drafts_v1:';
const STORAGE_VERSION = 1;
const MAX_STORED_DRAFTS = 50;
const DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

class InvalidMessageDraftCollectionError extends Error {}

const getStorageKey = (userId: string): string => `${STORAGE_KEY_PREFIX}${encodeURIComponent(userId)}`;

const isStoredMessageDraft = (value: unknown): value is StoredMessageDraft => {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.conversationId === 'string'
    && draft.conversationId.length > 0
    && typeof draft.text === 'string'
    && draft.text.length > 0
    && draft.text.length <= MAX_MESSAGE_CONTENT_LENGTH
    && Number.isSafeInteger(draft.updatedAt)
    && Number(draft.updatedAt) > 0;
};

const isStoredMessageDraftCollection = (value: unknown): value is StoredMessageDraftCollection => {
  if (!value || typeof value !== 'object') return false;
  const collection = value as Record<string, unknown>;
  if (collection.version !== STORAGE_VERSION
    || !Array.isArray(collection.drafts)
    || collection.drafts.length > MAX_STORED_DRAFTS
    || !collection.drafts.every(isStoredMessageDraft)) {
    return false;
  }

  const conversationIds = collection.drafts.map((draft) => draft.conversationId);
  return new Set(conversationIds).size === conversationIds.length;
};

const readStoredCollection = (storage: Storage, storageKey: string): StoredMessageDraftCollection => {
  const serializedCollection = storage.getItem(storageKey);
  if (!serializedCollection) return { version: STORAGE_VERSION, drafts: [] };

  try {
    const parsedCollection: unknown = JSON.parse(serializedCollection);
    if (isStoredMessageDraftCollection(parsedCollection)) return parsedCollection;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  throw new InvalidMessageDraftCollectionError('Stored message drafts do not match schema version 1');
};

const persistCollection = (
  storage: Storage,
  storageKey: string,
  collection: StoredMessageDraftCollection,
): void => {
  if (collection.drafts.length === 0) {
    storage.removeItem(storageKey);
    return;
  }
  storage.setItem(storageKey, JSON.stringify(collection));
};

const getBrowserStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
};

const removeCorruptedCollection = (storage: Storage, storageKey: string): void => {
  try {
    storage.removeItem(storageKey);
  } catch (error) {
    logger.warn(
      '[MessageDraftStorage] Failed to remove invalid draft collection',
      error instanceof Error ? error.message : String(error),
    );
  }
};

export const readMessageDraft = (userId?: string, conversationId?: string): string => {
  if (!userId || !conversationId) return '';

  let storage: Storage | undefined;
  const storageKey = getStorageKey(userId);
  try {
    storage = getBrowserStorage();
    if (!storage) return '';

    const collection = readStoredCollection(storage, storageKey);
    const expiresBefore = Date.now() - DRAFT_RETENTION_MS;
    const retainedDrafts = collection.drafts.filter((draft) => draft.updatedAt >= expiresBefore);
    if (retainedDrafts.length !== collection.drafts.length) {
      persistCollection(storage, storageKey, { version: STORAGE_VERSION, drafts: retainedDrafts });
    }
    return retainedDrafts.find((draft) => draft.conversationId === conversationId)?.text ?? '';
  } catch (error) {
    if (storage) removeCorruptedCollection(storage, storageKey);
    logger.warn(
      '[MessageDraftStorage] Failed to read message draft',
      error instanceof Error ? error.message : String(error),
    );
    return '';
  }
};

export const writeMessageDraft = (userId: string, conversationId: string, text: string): void => {
  if (!userId || !conversationId) return;
  if (text.length > MAX_MESSAGE_CONTENT_LENGTH) {
    throw new RangeError(`Message drafts cannot exceed ${MAX_MESSAGE_CONTENT_LENGTH} characters`);
  }

  let storage: Storage | undefined;
  const storageKey = getStorageKey(userId);
  try {
    storage = getBrowserStorage();
    if (!storage) return;

    const collection = readStoredCollection(storage, storageKey);
    const now = Date.now();
    const expiresBefore = now - DRAFT_RETENTION_MS;
    const otherDrafts = collection.drafts.filter(
      (draft) => draft.conversationId !== conversationId && draft.updatedAt >= expiresBefore,
    );
    const drafts = text.length === 0
      ? otherDrafts
      : [{ conversationId, text, updatedAt: now }, ...otherDrafts];
    persistCollection(storage, storageKey, {
      version: STORAGE_VERSION,
      drafts: drafts.slice(0, MAX_STORED_DRAFTS),
    });
  } catch (error) {
    if (storage && error instanceof InvalidMessageDraftCollectionError) {
      removeCorruptedCollection(storage, storageKey);
      try {
        persistCollection(storage, storageKey, {
          version: STORAGE_VERSION,
          drafts: text.length === 0 ? [] : [{ conversationId, text, updatedAt: Date.now() }],
        });
        logger.warn('[MessageDraftStorage] Replaced invalid draft collection');
        return;
      } catch (persistError) {
        logger.warn(
          '[MessageDraftStorage] Failed to replace invalid draft collection',
          persistError instanceof Error ? persistError.message : String(persistError),
        );
        return;
      }
    }
    logger.warn(
      '[MessageDraftStorage] Failed to write message draft',
      error instanceof Error ? error.message : String(error),
    );
  }
};
