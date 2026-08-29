import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/shared/lib/cn';
import { motion } from 'framer-motion';
import { Users, AtSign, Loader2 } from 'lucide-react';
import type { ConversationMember } from '../../types/messenger.types';
import { getConversationMembers } from '../../api/messenger.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { usePresenceByUserIds } from '@/features/presence/model/presence.store';
import { useTrackPresence } from '@/features/presence/hooks/useTrackPresence';
import { StatusDot } from '@/features/presence/ui/StatusSelector';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';

interface MentionMenuProps {
    conversationId: string;
    query: string | null;      // Current text after '@', null = menu closed
    onSelect: (userId: string, displayName: string) => void;
    onClose: () => void;
    position?: { top: number; left: number };
}

interface AllMembersOption {
    userId: 'all';
    displayName: string;
    username: string;
    avatarUrl?: string;
}

type MentionItem = ConversationMember | AllMembersOption;

export const MentionMenu: React.FC<MentionMenuProps> = ({
    conversationId,
    query,
    onSelect,
    onClose,
    position
}) => {
    const [members, setMembers] = useState<ConversationMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retryToken, setRetryToken] = useState(0);
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
            setLoadError(null);
            try {
                const page = await getConversationMembers(conversationId, undefined, 500);
                if (!cancelled) {
                    lastConvId.current = conversationId;
                    setHasFetched(true);
                    // Exclude current user from the list
                    const filtered = page.content.filter((member) => member.userId !== currentUser?.userId);
                    setMembers(filtered);
                }
            } catch (err: unknown) {
                logger.error('[MentionMenu] Failed to load members', err instanceof Error ? err.message : String(err));
                if (!cancelled) {
                    setHasFetched(true);
                    setMembers([]);
                    setLoadError(getUserFacingErrorMessage(err, localizeText('Không thể tải thành viên phòng. Vui lòng thử lại.')));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchMembers();
        return () => { cancelled = true; };
    }, [conversationId, query, currentUser?.userId, hasFetched, members.length, retryToken]);

    // Filter members by query
    const filteredItems = useMemo(() => {
        const normalizedQuery = (query ?? '').toLowerCase().trim();

        // Always show @all at the top
        const allOption: MentionItem = {
            userId: 'all',
            displayName: MESSENGER_COPY.mentionMenu.allMembersLabel,
            username: 'all',
        };

        const matchedMembers = normalizedQuery
            ? members.filter(m =>
                m.displayName.toLowerCase().includes(normalizedQuery) ||
                m.username.toLowerCase().includes(normalizedQuery)
            )
            : members;

        // Filter @all by query too
        const showAll = !normalizedQuery ||
            'all'.includes(normalizedQuery) ||
            MESSENGER_COPY.mentionMenu.allMembersLabel.toLowerCase().includes(normalizedQuery) ||
            'everyone'.includes(normalizedQuery);

        return [
            ...(showAll ? [allOption] : []),
            ...matchedMembers.slice(0, 8) // Limit to prevent overflow
        ];
    }, [members, query]);
    const visibleMemberIds = useMemo(
        () => filteredItems
            .filter((item): item is ConversationMember => item.userId !== 'all')
            .map((member) => member.userId),
        [filteredItems],
    );
    const presences = usePresenceByUserIds(visibleMemberIds);
    useTrackPresence(query === null ? [] : visibleMemberIds);

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
                    onSelect(item.userId, item.displayName);
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
        <motion.div
            ref={menuRef}
            className="absolute z-50 w-72 max-h-80 overflow-y-auto custom-scrollbar bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl neo-shadow"
            style={position ? { bottom: position.top, left: position.left } : { bottom: '100%', left: 0, marginBottom: '8px' }}
            initial={UI_MOTION_CONFIG.initialState}
            animate={UI_MOTION_CONFIG.animateState}
            variants={UI_MOTION_VARIANTS.slideInFromBottom}
        >
            {/* Header */}
            <div className="sticky top-0 bg-card/95 backdrop-blur-xl px-4 py-3 border-b border-border/40 flex items-center gap-2">
                <AtSign size={14} className="text-primary" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {MESSENGER_COPY.mentionMenu.title}
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
                    <motion.span
                      initial={UI_MOTION_CONFIG.initialState}
                      animate={UI_MOTION_CONFIG.animateState}
                      variants={UI_MOTION_VARIANTS.loadingSpin}
                      className="text-primary"
                    >
                        <Loader2 size={20} />
                    </motion.span>
                </div>
            )}

            {!loading && loadError && (
                <div className="space-y-3 px-4 py-6 text-center" role="alert">
                    <p className="text-xs font-medium text-destructive">{loadError}</p>
                    <button
                        type="button"
                        onClick={() => setRetryToken((current) => current + 1)}
                        className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                        {localizeText('Thử lại')}
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!loading && !loadError && filteredItems.length === 0 && (
                <div className="py-6 text-center">
                    <p className="text-xs text-muted-foreground font-medium">{MESSENGER_COPY.mentionMenu.noMembers}</p>
                </div>
            )}

            {/* Member List */}
            {!loading && filteredItems.length > 0 && (
                <div className="p-1.5">
                    {filteredItems.map((member, index) => {
                        const isAll = member.userId === 'all';
                        const presence = presences[member.userId] ?? null;
                        const isOnline = presence?.isOnline ?? false;
                        const status = presence?.status ?? 'OFFLINE';
                        return (
                            <button
                                key={member.userId}
                                type="button"
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 text-left",
                                    index === selectedIndex
                                        ? "bg-primary/15 text-foreground"
                                        : "hover:bg-primary/8 text-foreground/80"
                                )}
                                onClick={() => onSelect(member.userId, member.displayName)}
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
                                            : member.displayName.charAt(0)
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "text-sm font-bold truncate",
                                        isAll && "text-amber-500"
                                    )}>
                                        {isAll ? '@all' : member.displayName}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {isAll ? MESSENGER_COPY.mentionMenu.allMembersHint : `@${member.username}`}
                                    </p>
                                </div>

                                {/* Online indicator */}
                                {!isAll && (
                                    <StatusDot status={status} isOnline={isOnline} size="sm" className="flex-shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );
};

