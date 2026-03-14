import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/shared/lib/cn';
import { Users, AtSign, Loader2 } from 'lucide-react';
import type { ConversationMember } from '../../types/messenger.types';
import { getConversationMembers } from '../../api/poll.api';
import { useAuthStore } from '@/features/auth/model/auth.store';

interface MentionMenuProps {
    conversationId: string;
    query: string | null;      // Current text after '@', null = menu closed
    onSelect: (userId: string, displayName: string) => void;
    onClose: () => void;
    position?: { top: number; left: number };
}

export const MentionMenu: React.FC<MentionMenuProps> = ({
    conversationId,
    query,
    onSelect,
    onClose,
    position
}) => {
    const [members, setMembers] = useState<ConversationMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [hasFetched, setHasFetched] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const currentUser = useAuthStore(state => state.user);
    const lastConvId = useRef<string>('');

    // Fetch members when menu opens (with caching per conversationId)
    useEffect(() => {
        if (query === null) return;
        // Don't re-fetch if we already have data for this conversation
        if (hasFetched && lastConvId.current === conversationId && members.length > 0) return;

        let cancelled = false;
        const fetchMembers = async () => {
            setLoading(true);
            try {
                const data = await getConversationMembers(conversationId);
                if (!cancelled) {
                    lastConvId.current = conversationId;
                    setHasFetched(true);
                    // Exclude current user from the list
                    const filtered = Array.isArray(data)
                        ? data.filter(m => m.userId !== currentUser?.userId)
                        : [];
                    setMembers(filtered);
                }
            } catch (err) {
                console.error('[MentionMenu] Failed to load members:', err);
                if (!cancelled) {
                    setHasFetched(true);
                    setMembers([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchMembers();
        return () => { cancelled = true; };
    }, [conversationId, query, currentUser?.userId, hasFetched, members.length]);

    // Filter members by query
    const filteredItems = useMemo(() => {
        const normalizedQuery = (query ?? '').toLowerCase().trim();

        // Always show @all at the top
        const allOption: ConversationMember = {
            userId: 'all',
            conversationId,
            role: 'member',
            joinedAt: '',
            displayName: 'Mọi người',
            username: 'all',
            isOnline: false
        };

        const matchedMembers = normalizedQuery
            ? members.filter(m =>
                (m.displayName ?? '').toLowerCase().includes(normalizedQuery) ||
                (m.username ?? '').toLowerCase().includes(normalizedQuery)
            )
            : members;

        // Filter @all by query too
        const showAll = !normalizedQuery ||
            'all'.includes(normalizedQuery) ||
            'mọi người'.includes(normalizedQuery) ||
            'everyone'.includes(normalizedQuery);

        return [
            ...(showAll ? [allOption] : []),
            ...matchedMembers.slice(0, 8) // Limit to prevent overflow
        ];
    }, [members, query, conversationId]);

    // Reset index when filtered items change
    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredItems.length]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (query === null) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                if (filteredItems[selectedIndex]) {
                    const item = filteredItems[selectedIndex];
                    onSelect(item.userId, item.displayName ?? item.username ?? 'User');
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [query, filteredItems, selectedIndex, onSelect, onClose]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [handleKeyDown]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Don't render if query is null (menu closed)
    if (query === null) return null;

    return (
        <div
            ref={menuRef}
            className="absolute z-50 w-72 max-h-80 overflow-y-auto custom-scrollbar bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl neo-shadow animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={position ? { bottom: position.top, left: position.left } : { bottom: '100%', left: 0, marginBottom: '8px' }}
        >
            {/* Header */}
            <div className="sticky top-0 bg-card/95 backdrop-blur-xl px-4 py-3 border-b border-border/40 flex items-center gap-2">
                <AtSign size={14} className="text-primary" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Nhắc đến
                </span>
                {query && (
                    <span className="ml-auto text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        &quot;{query}&quot;
                    </span>
                )}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-primary" />
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredItems.length === 0 && (
                <div className="py-6 text-center">
                    <p className="text-xs text-muted-foreground font-medium">Không tìm thấy thành viên</p>
                </div>
            )}

            {/* Member List */}
            {!loading && filteredItems.length > 0 && (
                <div className="p-1.5">
                    {filteredItems.map((member, index) => {
                        const isAll = member.userId === 'all';
                        return (
                            <button
                                key={member.userId}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left",
                                    index === selectedIndex
                                        ? "bg-primary/15 text-foreground"
                                        : "hover:bg-primary/8 text-foreground/80"
                                )}
                                onClick={() => onSelect(member.userId, member.displayName ?? member.username ?? 'User')}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                {/* Avatar */}
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black uppercase",
                                    isAll
                                        ? "bg-amber-500/20 text-amber-500"
                                        : "bg-primary/15 text-primary border border-primary/20"
                                )}>
                                    {isAll ? (
                                        <Users size={14} />
                                    ) : (
                                        member.avatarUrl
                                            ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                                            : (member.displayName ?? 'U').charAt(0)
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "text-sm font-bold truncate",
                                        isAll && "text-amber-500"
                                    )}>
                                        {isAll ? '@all' : (member.displayName ?? member.username)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {isAll ? 'Thông báo tất cả thành viên' : `@${member.username}`}
                                    </p>
                                </div>

                                {/* Online indicator */}
                                {!isAll && member.isOnline && (
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
