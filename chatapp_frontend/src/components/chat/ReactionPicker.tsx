// src/components/chat/ReactionPicker.tsx
// Emoji reaction picker for chat messages

import React, { useState, useRef, useEffect } from 'react';
import { SmilePlus } from 'lucide-react';
import { addReaction } from '@/api/messageApi';
import { logger } from '@/common/lib/logger';

// Standard reaction emojis matching backend: "like", "love", "laugh", "angry", "sad", "wow"
const REACTIONS = [
    { emoji: '👍', key: 'like', label: 'Like' },
    { emoji: '❤️', key: 'love', label: 'Love' },
    { emoji: '😂', key: 'laugh', label: 'Laugh' },
    { emoji: '😮', key: 'wow', label: 'Wow' },
    { emoji: '😢', key: 'sad', label: 'Sad' },
    { emoji: '😡', key: 'angry', label: 'Angry' },
] as const;

interface ReactionPickerProps {
    conversationId: string;
    messageId: string;
    onReactionAdded?: () => void;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
    conversationId,
    messageId,
    onReactionAdded,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleReaction = async (emojiKey: string) => {
        if (loading) return;
        setLoading(true);

        try {
            await addReaction(conversationId, messageId, emojiKey);
            onReactionAdded?.();
            setIsOpen(false);
        } catch (err) {
            logger.error('[ReactionPicker] Failed to add reaction:', err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div ref={pickerRef} className="relative inline-flex">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Add reaction"
            >
                <SmilePlus className="w-4 h-4" />
            </button>

            {/* Picker popup */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-1 flex gap-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    {REACTIONS.map(({ emoji, key, label }) => (
                        <button
                            key={key}
                            onClick={() => void handleReaction(key)}
                            disabled={loading}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all hover:scale-125 disabled:opacity-50"
                            title={label}
                        >
                            <span className="text-lg">{emoji}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Display reactions under a message
interface ReactionDisplayProps {
    reactions: Array<{
        emoji: string;
        count: number;
        reactedByCurrentUser: boolean;
    }>;
    conversationId: string;
    messageId: string;
    onToggle?: () => void;
}

// Map backend keys to emoji characters
const EMOJI_MAP: Record<string, string> = {
    like: '👍',
    love: '❤️',
    laugh: '😂',
    wow: '😮',
    sad: '😢',
    angry: '😡',
};

export const ReactionDisplay: React.FC<ReactionDisplayProps> = ({
    reactions,
    conversationId,
    messageId,
    onToggle,
}) => {
    if (!reactions || reactions.length === 0) return null;

    const handleToggle = async (emojiKey: string) => {
        try {
            await addReaction(conversationId, messageId, emojiKey);
            onToggle?.();
        } catch (err) {
            logger.error('[ReactionDisplay] Toggle failed:', err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {reactions.map(({ emoji, count, reactedByCurrentUser }) => {
                const displayEmoji = EMOJI_MAP[emoji] || emoji;
                return (
                    <button
                        key={emoji}
                        onClick={() => void handleToggle(emoji)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${reactedByCurrentUser
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        <span>{displayEmoji}</span>
                        <span>{count}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default ReactionPicker;
