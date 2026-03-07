import { useState } from 'react';
import { Search, Pin, Users } from 'lucide-react';
import { RoomMenuButton } from '@/components/room/RoomMenuButton';
import type { Conversation } from '@/types/conversation';
import { Avatar, AvatarFallback } from '@/components/ui/Avatar';

interface Props {
  conversation?: Conversation;
  title?: string;
  onShowSettings?: () => void;
  onShowMembers?: () => void;
  onShowPinnedMessages?: () => void;
  onLeaveRoom?: () => void;
  onDissolveRoom?: () => void;
  onSearchMessages?: (query: string) => void;
  currentUserRole?: 'admin' | 'moderator' | 'member';
}

export const ChatHeader = ({
  conversation,
  title,
  onShowSettings,
  onShowMembers,
  onShowPinnedMessages,
  onLeaveRoom,
  onDissolveRoom,
  onSearchMessages,
  currentUserRole = 'member'
}: Props) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const displayTitle = conversation?.name || title || "Chat";
  const displaySubtitle = conversation?.type === 'group'
    ? `${conversation.memberCount || 0} members`
    : 'Direct Message';

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (onSearchMessages) {
      onSearchMessages(query);
    }
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-card shadow-sm border-b border-border z-10 transition-colors">
      <div className="flex items-center space-x-4 min-w-0">
        <Avatar className="h-11 w-11 flex-shrink-0 transition-transform duration-200 hover:scale-105">
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {conversation?.conversationId?.charAt(0)?.toUpperCase() || displayTitle.charAt(0)?.toUpperCase() || "C"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-base font-semibold truncate text-card-foreground">{displayTitle}</div>
          {conversation && (
            <div className="text-sm text-muted-foreground mt-0.5">{displaySubtitle}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showSearch ? (
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onBlur={() => {
              if (!searchQuery) setShowSearch(false);
            }}
            placeholder="Search messages..."
            className="px-4 py-2 w-56 rounded-full bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all animate-in fade-in slide-in-from-right-4"
          />
        ) : (
          <button
            className="inline-flex items-center justify-center p-2.5 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setShowSearch(true)}
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        <button
          className="inline-flex items-center justify-center p-2.5 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-105 active:scale-95"
          onClick={onShowPinnedMessages}
          title="Pinned messages"
        >
          <Pin className="w-5 h-5" />
        </button>

        {conversation?.type === 'group' && (
          <button
            className="inline-flex items-center justify-center p-2.5 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={onShowMembers}
            title="Members"
          >
            <Users className="w-5 h-5" />
          </button>
        )}

        {conversation && onShowSettings && (
          <RoomMenuButton
            conversation={conversation}
            memberRole={currentUserRole}
            onShowSettings={onShowSettings}
            onShowMembers={onShowMembers || (() => { })}
            onShowPinnedMessages={onShowPinnedMessages || (() => { })}
            onLeaveRoom={onLeaveRoom || (() => { })}
            onDissolveRoom={onDissolveRoom}
          />
        )}
      </div>
    </div>
  );
};