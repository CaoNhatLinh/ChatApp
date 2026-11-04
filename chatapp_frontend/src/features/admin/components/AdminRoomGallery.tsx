import { ArrowUpRight, Archive, UsersRound } from 'lucide-react';
import type { AdminConversationSummary } from '../api/admin.api';
import { AdminRoomPortrait } from './AdminRoomPortrait';
import { useAppLocale } from '@/shared/i18n';
import styles from './AdminOverviewPanel.module.css';

export function AdminRoomGallery({ rooms, onRoom }: {
  rooms: AdminConversationSummary[]; onRoom: (room: AdminConversationSummary) => void;
}) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  return <div className="admin-room-gallery">
    {rooms.slice(0, 3).map((room, index) => <button key={room.conversationId} type="button"
      className="admin-room-gallery-entry" data-featured={index === 0 || undefined} onClick={() => onRoom(room)}>
      <span className={`admin-room-gallery-art ${styles.roomArt}`}><AdminRoomPortrait room={room} large /><ArrowUpRight size={18} aria-hidden="true" /></span>
      <span className="admin-room-gallery-caption">
        <strong>{room.name || room.conversationId}</strong>
        <span className="admin-room-gallery-meta">{room.deleted ? <Archive size={14} aria-hidden="true" /> : <UsersRound size={14} aria-hidden="true" />}
          {room.deleted ? copy('Đã lưu trữ', 'Archived') : `${room.memberCount.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} ${copy('thành viên', room.memberCount === 1 ? 'member' : 'members')}`}</span>
        {index === 0 && room.description ? <span className="admin-room-gallery-description">{room.description}</span> : null}
      </span>
    </button>)}
  </div>;
}
