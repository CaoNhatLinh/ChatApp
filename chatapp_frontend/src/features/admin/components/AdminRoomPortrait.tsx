import { useState } from 'react';
import { Archive, Globe2, LockKeyhole } from 'lucide-react';
import type { AdminConversationSummary } from '../api/admin.api';
import { roomInitials } from '../model/room-directory';

function RoomPhoto({ url, fallback }: { url: string; fallback: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return <>
    {state !== 'ready' ? <span className="admin-room-monogram">{fallback}</span> : null}
    {state !== 'error' ? <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async"
      className="admin-room-photo" data-loaded={state === 'ready'} onLoad={() => setState('ready')} onError={() => setState('error')} /> : null}
  </>;
}

export function AdminRoomPortrait({ room, large = false }: { room: AdminConversationSummary; large?: boolean }) {
  const url = room.avatarUrl?.trim();
  return <span className={`admin-room-portrait${large ? ' admin-room-portrait-large' : ''}`} data-archived={room.deleted} aria-hidden="true">
    {url ? <RoomPhoto key={url} url={url} fallback={roomInitials(room)} /> : <span className="admin-room-monogram">{roomInitials(room)}</span>}
    <span className="admin-room-visibility">{room.deleted ? <Archive size={12} /> : room.visibility === 'COMMUNITY' ? <Globe2 size={12} /> : <LockKeyhole size={12} />}</span>
  </span>;
}
