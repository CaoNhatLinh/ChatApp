import { MessagesSquare, Search, UserRound } from 'lucide-react';

export function AdminDirectoryArt({ kind }: { kind: 'room' | 'person' }) {
  const Subject = kind === 'room' ? MessagesSquare : UserRound;

  return (
    <span className="admin-directory-art" data-kind={kind} aria-hidden="true">
      <svg viewBox="0 0 152 96" className="admin-directory-art-orbit">
        <ellipse cx="76" cy="47" rx="66" ry="26" transform="rotate(-20 76 47)" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="21" cy="68" r="4" fill="currentColor" />
        <circle cx="121" cy="20" r="3" fill="currentColor" />
      </svg>
      <span className="admin-directory-art-subject"><Subject size={34} strokeWidth={1.5} /></span>
      <span className="admin-directory-art-search"><Search size={17} strokeWidth={2} /></span>
    </span>
  );
}
