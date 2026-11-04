import type { AdminConversationSummary } from '../api/admin.api';

export type RoomFilter = 'all' | 'active' | 'archived';

function searchable(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function filterAdminRooms(rooms: AdminConversationSummary[], query: string, filter: RoomFilter) {
  const needle = searchable(query.trim());
  return rooms.filter(room => (filter === 'all' || room.deleted === (filter === 'archived'))
    && searchable(`${room.name ?? ''} ${room.conversationId}`).includes(needle));
}

export function roomInitials(room: Pick<AdminConversationSummary, 'name'>) {
  return Array.from(room.name?.trim() || '#').slice(0, 2).join('').toLocaleUpperCase('vi');
}
