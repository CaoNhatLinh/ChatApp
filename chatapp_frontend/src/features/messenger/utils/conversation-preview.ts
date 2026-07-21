import type { Conversation } from '@/features/messenger/types/messenger.types';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';

const MESSAGE_TYPES = ['TEXT', 'IMAGE', 'FILE', 'NOTIFICATION', 'POLL'] as const;
type NormalizedMessageType = (typeof MESSAGE_TYPES)[number];
const EMPTY_PREVIEW = MESSENGER_COPY.conversationPreview.emptyMessage;

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const normalizeMessageType = (type?: string): NormalizedMessageType => {
  const normalized = (type ?? '').trim().toUpperCase();
  return (MESSAGE_TYPES as readonly string[]).includes(normalized)
    ? (normalized as NormalizedMessageType)
    : 'TEXT';
};

const trimText = (value: string | null | undefined): string => value?.trim() ?? '';
const pickActor = (senderName?: string): string => (senderName?.trim() ? `${senderName}: ` : '');
const isUuidLike = (value: string): boolean => {
  return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value);
};

const formatNotificationPreview = (content: string): string => {
  const lower = stripDiacritics(content);
  const has = (term: string) => lower.includes(term);

  if (!lower) return MESSENGER_COPY.conversationPreview.updatedNotification;
  if (has('join') || has('tham gia') || has('joined')) {
    return MESSENGER_COPY.conversationPreview.joined;
  }
  if (has('leave') || has('roi') || has('left') || has('da roi')) {
    return MESSENGER_COPY.conversationPreview.left;
  }
  if (
    has('promoted')
    || has('thang')
    || has('quyen')
    || has('owner')
    || has('thang quyen')
    || has('phan quyen')
    || has('thang pho')
    || has('pho')
    || has('set owner')
  ) {
    return MESSENGER_COPY.conversationPreview.promoted;
  }
  if (
    has('removed')
    || has('kick')
    || has('loai')
    || has('mat quyen')
    || has('bo thanh vien')
    || has('xoa thanh vien')
    || has('remove member')
  ) {
    return MESSENGER_COPY.conversationPreview.membershipUpdated;
  }
  if (has('pinned') || has('ghim')) {
    return MESSENGER_COPY.conversationPreview.pinned;
  }
  if (has('unpinned') || has('bo ghim')) {
    return MESSENGER_COPY.conversationPreview.unpinned;
  }
  if (
    has('create poll')
    || has('tao binh chon')
    || has('tao bo phieu')
    || has('tao binh chon moi')
    || has('new poll')
  ) {
    return MESSENGER_COPY.conversationPreview.pollCreated;
  }
  if (has('vote') || has('voted') || has('binh chon') || has('da binh chon')) {
    return MESSENGER_COPY.conversationPreview.pollVoted;
  }
  if (
    has('dinh kem')
    || has('dinh kem file')
    || has('attachment')
    || has('attachment file')
    || has('file')
    || has('media')
    || has('img')
    || has('anh')
  ) {
    return MESSENGER_COPY.conversationPreview.attachment;
  }

  return MESSENGER_COPY.conversationPreview.updatedNotification;
};

export const getConversationLastMessagePreview = (conversation: Conversation): string => {
  const message = conversation.lastMessage;
  if (!message) {
    return EMPTY_PREVIEW;
  }

  const actor = pickActor(message.senderName);
  const normalizedType = normalizeMessageType(message.type);
  const rawContent = trimText(message.content);
  const contentWithPrefix = actor + rawContent;

  switch (normalizedType) {
    case 'IMAGE':
      return actor + MESSENGER_COPY.conversationPreview.imageMessage;
    case 'FILE':
      return isUuidLike(rawContent)
        ? actor + MESSENGER_COPY.conversationPreview.fileMessage
        : actor + MESSENGER_COPY.conversationPreview.fileMessageWithName + rawContent;
    case 'POLL':
      return actor + MESSENGER_COPY.conversationPreview.poll + (rawContent ? ': ' + rawContent : '');
    case 'NOTIFICATION':
      return actor + formatNotificationPreview(rawContent);
    default:
      if (!rawContent) {
        return actor + MESSENGER_COPY.conversationPreview.newMessageFallback;
      }
      return contentWithPrefix;
  }
};
