// src/components/chat/MessageContextMenu.tsx
// Context menu with quick reactions and action buttons for messages

import React from 'react';
import { Smile, Reply, Trash2, Edit3 } from 'lucide-react';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { usePopupPosition } from '@/hooks/common/usePopupPosition';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];
const EMOJI_PICKER_DIMENSIONS = { width: 350, height: 450 };

interface MessageContextMenuProps {
    /** Position for the context menu */
    position: { x: number; y: number };
    /** Ref for click-outside detection */
    menuRef: React.RefObject<HTMLDivElement | null>;
    /** Whether message belongs to current user */
    isOwn: boolean;
    /** Callbacks */
    onReact: (emoji: string) => void;
    onReply?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onClose: () => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
    position,
    menuRef,
    isOwn,
    onReact,
    onReply,
    onEdit,
    onDelete,
    onClose,
}) => {
    const emojiPicker = usePopupPosition();
    const smileButtonRef = React.useRef<HTMLButtonElement>(null);

    const handleQuickReact = (emoji: string) => {
        onReact(emoji);
        onClose();
    };

    const handleAction = (action: (() => void) | undefined) => {
        action?.();
        onClose();
    };

    const openFullEmojiPicker = () => {
        if (!smileButtonRef.current) return;
        emojiPicker.openFromElement(smileButtonRef.current, EMOJI_PICKER_DIMENSIONS);
    };

    return (
        <>
            <div
                ref={menuRef}
                className="fixed z-[9999] min-w-[180px] bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-none border border-gray-200 dark:border-gray-700 overflow-hidden"
                style={{ left: `${position.x}px`, top: `${position.y}px` }}
            >
                {/* Quick reactions row */}
                <div className="flex items-center justify-between p-1 border-b border-gray-200 dark:border-gray-700">
                    {QUICK_REACTIONS.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => handleQuickReact(emoji)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-xl transition-all hover:scale-110"
                            title={`React with ${emoji}`}
                        >
                            {emoji}
                        </button>
                    ))}
                    <button
                        ref={smileButtonRef}
                        onClick={openFullEmojiPicker}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all hover:scale-110"
                        title="More reactions"
                    >
                        <Smile className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Action buttons */}
                <div className="py-1">
                    {onReply && (
                        <button
                            onClick={() => handleAction(onReply)}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <Reply className="w-4 h-4" />
                            <span>Reply</span>
                        </button>
                    )}
                    {isOwn && onEdit && (
                        <button
                            onClick={() => handleAction(onEdit)}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <Edit3 className="w-4 h-4" />
                            <span>Edit</span>
                        </button>
                    )}
                    {isOwn && onDelete && (
                        <button
                            onClick={() => handleAction(onDelete)}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Full emoji picker */}
            {emojiPicker.isOpen && emojiPicker.position && (
                <div
                    ref={emojiPicker.ref}
                    className="fixed z-[10000]"
                    style={{ left: `${emojiPicker.position.x}px`, top: `${emojiPicker.position.y}px` }}
                >
                    <EmojiPicker
                        onEmojiSelect={(emoji) => {
                            onReact(emoji);
                            emojiPicker.close();
                            onClose();
                        }}
                        onClose={() => { emojiPicker.close(); onClose(); }}
                        isVisible={true}
                    />
                </div>
            )}
        </>
    );
};
