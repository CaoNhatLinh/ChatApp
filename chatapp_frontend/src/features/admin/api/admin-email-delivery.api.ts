import type { EmailHistoryStatus } from '@/features/notifications/api/notifications.api';
import { emailDeliveryStatusLabels } from '@/features/notifications/model/email-delivery-status';
import api from '@/shared/api/apiClient';

export interface AdminEmailDeliveryKey {
  userId: string;
  month: string;
  notificationId: string;
}

export interface AdminEmailDelivery {
  status: EmailHistoryStatus;
  attempts: number;
  attemptedAt: string | null;
  retryAt: string | null;
  deliveredAt: string | null;
  reviewedAt: string | null;
}

export interface AdminEmailReviewEntry extends AdminEmailDeliveryKey {
  attempts: number;
  attemptedAt: string | null;
}

interface AdminEmailReviewPage {
  content: AdminEmailReviewEntry[];
  nextCursor: string | null;
}

const isTimestamp = (value: unknown): value is string | null =>
  value === null || typeof value === 'string' && Number.isFinite(Date.parse(value));

const isAttemptCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function parseDelivery(value: unknown): AdminEmailDelivery {
  if (!value || typeof value !== 'object') throw new Error('Invalid email delivery response');
  const { status, attempts, attemptedAt, retryAt, deliveredAt } = value as Record<string, unknown>;
  const reviewedAt: unknown = (value as Record<string, unknown>).reviewedAt ?? null;
  if (typeof status !== 'string' || !isAttemptCount(attempts)
    || !isTimestamp(attemptedAt) || !isTimestamp(retryAt) || !isTimestamp(deliveredAt) || !isTimestamp(reviewedAt)) {
    throw new Error('Invalid email delivery response');
  }
  return {
    status: Object.hasOwn(emailDeliveryStatusLabels, status) ? status as EmailHistoryStatus : 'UNKNOWN',
    attempts, attemptedAt, retryAt, deliveredAt, reviewedAt,
  };
}

const deliveryPath = (key: AdminEmailDeliveryKey) =>
  [key.userId, key.month, key.notificationId].map(encodeURIComponent).join('/');

export async function getAdminEmailDelivery(key: AdminEmailDeliveryKey, signal: AbortSignal): Promise<AdminEmailDelivery> {
  const response = await api.get(`/admin/email-deliveries/${deliveryPath(key)}`, { signal });
  return parseDelivery(response.data);
}

export interface EmailReviewCommand {
  commandId: string;
  reason: string;
}

export async function closeAdminEmailReview(
  key: AdminEmailDeliveryKey, command: EmailReviewCommand, signal: AbortSignal,
): Promise<string> {
  const { data } = await api.put(`/admin/email-review/${deliveryPath(key)}/disposition`, command, { signal });
  if (!data || typeof data !== 'object' || !('reviewedAt' in data)
    || typeof data.reviewedAt !== 'string' || !isTimestamp(data.reviewedAt)) {
    throw new Error('Invalid email review receipt');
  }
  return data.reviewedAt;
}
function parseReviewEntry(value: unknown): AdminEmailReviewEntry {
  if (!value || typeof value !== 'object') throw new Error('Invalid email review entry');
  const { userId, month, notificationId, attempts, attemptedAt } = value as Record<string, unknown>;
  if (typeof userId !== 'string' || typeof month !== 'string' || typeof notificationId !== 'string'
    || !isAttemptCount(attempts) || !isTimestamp(attemptedAt)) throw new Error('Invalid email review entry');
  return { userId, month, notificationId, attempts, attemptedAt };
}

export async function listAdminEmailReview(day: string, cursor: string | undefined, signal: AbortSignal): Promise<AdminEmailReviewPage> {
  const { data } = await api.get('/admin/email-review', { params: { day, cursor }, signal });
  if (!data || typeof data !== 'object') throw new Error('Invalid email review page');
  const { content, hasNext, nextCursor } = data as Record<string, unknown>;
  if (!Array.isArray(content) || typeof hasNext !== 'boolean'
    || (typeof nextCursor !== 'string' && nextCursor !== null)
    || (hasNext ? !nextCursor || nextCursor === cursor : nextCursor !== null)) {
    throw new Error('Invalid email review page');
  }
  return { content: content.map(parseReviewEntry), nextCursor };
}
