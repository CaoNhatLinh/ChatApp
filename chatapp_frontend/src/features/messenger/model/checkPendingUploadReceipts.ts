import type { MediaUploadInspection } from '../api/messenger.api';
import type { Attachment, SendMessageRequest } from '../types/messenger.types';

type ReceiptCheck = 'ready' | 'unavailable' | 'unconfirmed';
type InspectUpload = (uploadId: string, signal: AbortSignal) => Promise<MediaUploadInspection | null>;

async function checkReceipt(
  attachment: Attachment,
  uploadId: string,
  inspect: InspectUpload,
  signal: AbortSignal,
): Promise<ReceiptCheck> {
  const receipt = await inspect(uploadId, signal).catch(() => null);
  if (!receipt || receipt.uploadId !== uploadId.toLowerCase()) return 'unconfirmed';
  if (receipt.status === 'PENDING') return 'unconfirmed';
  if (receipt.status !== 'READY') return 'unavailable';
  return attachment.assetId && attachment.attachmentId
    && receipt.file.assetId === attachment.assetId && receipt.file.attachmentId === attachment.attachmentId
    ? 'ready' : 'unconfirmed';
}

export async function checkPendingUploadReceipts(
  request: Readonly<SendMessageRequest>,
  uploadIds: readonly string[],
  inspect: InspectUpload,
  signal: AbortSignal,
): Promise<ReceiptCheck> {
  signal.throwIfAborted();
  const attachments = request.attachments;
  if (!attachments?.length || attachments.length !== uploadIds.length || uploadIds.some(id => !id)) {
    return 'unconfirmed';
  }

  const checks = await Promise.all(attachments.map((attachment, index) =>
    checkReceipt(attachment, uploadIds[index], inspect, signal)));
  signal.throwIfAborted();
  if (checks.includes('unavailable')) return 'unavailable';
  return checks.every(check => check === 'ready') ? 'ready' : 'unconfirmed';
}
