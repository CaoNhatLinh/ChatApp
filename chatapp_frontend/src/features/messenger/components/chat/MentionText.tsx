import React, { useMemo } from 'react';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/features/auth/model/auth.store';

/**
 * Mention format from backend: @[DisplayName|UUID]
 * Special: @[all|all] for mentioning everyone
 *
 * This component parses message content and renders mention tags
 * as highlighted inline chips.
 */

// Regex to match @[DisplayName|UUID] patterns (same as MentionParser.java)
const MENTION_REGEX = /@\[([^|]*?)\|([^\]]*?)\]/g;

interface MentionSegment {
    type: 'text' | 'mention';
    value: string;
    userId?: string;
    displayName?: string;
    isSelf?: boolean;
    isAll?: boolean;
}

interface MentionTextProps {
    content: string;
    className?: string;
    isOwnMessage?: boolean;
}

export const MentionText: React.FC<MentionTextProps> = ({ content, className, isOwnMessage = false }) => {
    const currentUser = useAuthStore(state => state.user);

    const segments = useMemo((): MentionSegment[] => {
        const result: MentionSegment[] = [];
        let lastIndex = 0;

        // Reset regex state
        MENTION_REGEX.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = MENTION_REGEX.exec(content)) !== null) {
            // Push text before the mention
            if (match.index > lastIndex) {
                result.push({
                    type: 'text',
                    value: content.slice(lastIndex, match.index)
                });
            }

            const displayName = match[1];
            const userId = match[2];
            const isAll = userId === 'all';
            const isSelf = !isAll && userId === currentUser?.userId;

            result.push({
                type: 'mention',
                value: `@${displayName}`,
                userId,
                displayName,
                isSelf,
                isAll
            });

            lastIndex = match.index + match[0].length;
        }

        // Push remaining text
        if (lastIndex < content.length) {
            result.push({
                type: 'text',
                value: content.slice(lastIndex)
            });
        }

        return result;
    }, [content, currentUser?.userId]);

    // No mentions found — return plain text
    const hasMentions = segments.some(s => s.type === 'mention');
    if (!hasMentions) {
        return <span className={className}>{content}</span>;
    }

    return (
        <span className={className}>
            {segments.map((segment, index) => {
                if (segment.type === 'text') {
                    return <span key={index}>{segment.value}</span>;
                }

                // Mention chip
                return (
                    <span
                        key={index}
                        className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded-md font-bold text-xs cursor-pointer transition-all duration-200",
                            segment.isAll
                                ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
                                : segment.isSelf
                                    ? isOwnMessage
                                        ? "bg-white/25 text-white hover:bg-white/35 border border-white/30"
                                        : "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 ring-1 ring-primary/20"
                                    : isOwnMessage
                                        ? "bg-white/15 text-white/90 hover:bg-white/25"
                                        : "bg-primary/10 text-primary/80 hover:bg-primary/20"
                        )}
                        title={segment.isAll ? 'Mọi người' : segment.displayName}
                    >
                        {segment.value}
                    </span>
                );
            })}
        </span>
    );
};

