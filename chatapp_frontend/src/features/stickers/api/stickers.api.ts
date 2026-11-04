import apiClient from '@/shared/api/apiClient';

export interface StickerImage {
  assetId: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface StickerPack {
  stickerPackId: string;
  name: string;
  description: string;
  coverAssetId: string | null;
  cover: StickerImage | null;
  isOfficial: boolean;
  isActive: boolean;
  revision: string;
  updatedAt: string;
}

export interface Sticker {
  stickerId: string;
  stickerPackId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  revision: string;
  image: StickerImage | null;
}

export interface StickerPage<T> {
  content: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface MessageStickerReference {
  conversationId: string;
  messageId: string;
  messageBucket: string;
}

export interface MessageStickerArtwork {
  stickerId: string;
  name: string;
  image: StickerImage | null;
}

export async function getMessageSticker(reference: MessageStickerReference, signal?: AbortSignal): Promise<MessageStickerArtwork> {
  const path = `/conversations/${encodeURIComponent(reference.conversationId)}/messages/${encodeURIComponent(reference.messageId)}/sticker`;
  const response = await apiClient.get<MessageStickerArtwork>(path, { params: { bucket: reference.messageBucket }, signal });
  return response.data;
}

export interface CreateStickerPackCommand {
  commandId: string;
  stickerPackId: string;
  name: string;
  description: string;
  coverAssetId: string | null;
  isOfficial: boolean;
  reason: string;
}

export interface UpdateStickerPackCommand extends Omit<CreateStickerPackCommand, 'stickerPackId'> {
  expectedRevision: string;
  isActive: boolean;
  artworkReviewed: boolean;
}

export interface UpdateStickerCommand {
  commandId: string;
  expectedRevision: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  artworkReviewed: boolean;
  reason: string;
}

export interface CreateStickerCommand extends UpdateStickerCommand {
  stickerId: string;
  assetId: string;
}

// Commands return a committed metadata snapshot, not a catalog read projection.
export interface StickerCommandResult {
  commandId: string;
  pack: Omit<StickerPack, 'cover'> & { coverAssetId: string | null };
  sticker: Omit<Sticker, 'image'> & { assetId: string } | null;
  auditPending: boolean;
}

async function page<T>(path: string, cursor?: string, signal?: AbortSignal): Promise<StickerPage<T>> {
  const response = await apiClient.get<StickerPage<T>>(path, { params: { cursor, limit: 25 }, signal });
  return response.data;
}

export const listStickerPacks = (cursor?: string, signal?: AbortSignal) =>
  page<StickerPack>('/sticker-packs', cursor, signal);
export const listStickers = (packId: string, cursor?: string, signal?: AbortSignal) =>
  page<Sticker>(`/sticker-packs/${encodeURIComponent(packId)}/stickers`, cursor, signal);
export const listAdminStickerPacks = (cursor?: string, signal?: AbortSignal) =>
  page<StickerPack>('/admin/sticker-packs', cursor, signal);
export async function getAdminStickerPack(packId: string, signal?: AbortSignal): Promise<StickerPack> {
  const response = await apiClient.get<StickerPack>(`/admin/sticker-packs/${encodeURIComponent(packId)}`, { signal });
  return response.data;
}
export const listAdminStickers = (packId: string, cursor?: string, signal?: AbortSignal) =>
  page<Sticker>(`/admin/sticker-packs/${encodeURIComponent(packId)}/stickers`, cursor, signal);
export async function getAdminSticker(packId: string, stickerId: string, signal?: AbortSignal): Promise<{ packRevision: string; sticker: Sticker }> {
  const response = await apiClient.get<{ packRevision: string; sticker: Sticker }>(`/admin/sticker-packs/${encodeURIComponent(packId)}/stickers/${encodeURIComponent(stickerId)}`, { signal });
  return response.data;
}

export async function createStickerPack(command: CreateStickerPackCommand): Promise<StickerCommandResult> {
  const response = await apiClient.post<StickerCommandResult>('/admin/sticker-packs', command);
  return response.data;
}

export async function updateStickerPack(packId: string, command: UpdateStickerPackCommand): Promise<StickerCommandResult> {
  const response = await apiClient.put<StickerCommandResult>(`/admin/sticker-packs/${encodeURIComponent(packId)}`, command);
  return response.data;
}

export async function createSticker(packId: string, command: CreateStickerCommand): Promise<StickerCommandResult> {
  const response = await apiClient.post<StickerCommandResult>(`/admin/sticker-packs/${encodeURIComponent(packId)}/stickers`, command);
  return response.data;
}

export async function updateSticker(packId: string, stickerId: string, command: UpdateStickerCommand): Promise<StickerCommandResult> {
  const response = await apiClient.put<StickerCommandResult>(`/admin/sticker-packs/${encodeURIComponent(packId)}/stickers/${encodeURIComponent(stickerId)}`, command);
  return response.data;
}
