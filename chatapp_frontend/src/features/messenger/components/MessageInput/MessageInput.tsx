import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMessenger } from '@/features/messenger/hooks/useMessenger';
import { Send, Smile, Paperclip, Image, Mic, BarChart3 } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';
import { cn } from '@/common/lib/utils';
import { MentionMenu } from './MentionMenu';
import { getMentionQuery, insertMention } from '../../utils/mention.utils';
import { CreatePollModal } from '../Poll/CreatePollModal';
import { createPoll } from '../../api/poll.api';
import { friendApi } from '@/api/friendApi';
import { useMessengerStore } from '@/store/messengerStore';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import type { CreatePollRequest } from '../../types/messenger.types';

export const MessageInput: React.FC = () => {
    const [text, setText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showPollModal, setShowPollModal] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const { sendMessage, sendTyping, activeConversationId } = useMessenger();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Use ref instead of state to avoid re-triggering the typing useEffect on flag change
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Mention state
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);

    // Block state
    const [blockStatus, setBlockStatus] = useState<{ hasBlocked: boolean; isBlockedBy: boolean } | null>(null);
    const conversations = useMessengerStore(state => state.conversations);
    const user = useAuthStore(state => state.user);
    const unblockFriend = useFriendStore(state => state.unblockFriend);

    // Fetch block status when conversation changes
    useEffect(() => {
        let isMounted = true;
        if (!activeConversationId) {
            setBlockStatus(null);
            return;
        }
        const conv = conversations.find(c => c.conversationId === activeConversationId);
        if (conv?.type === 'dm' && conv.otherParticipant?.userId) {
            friendApi.checkBlockStatus(conv.otherParticipant.userId)
                .then(status => {
                    if (isMounted) setBlockStatus(status);
                })
                .catch(err => console.error("[MessageInput] Failed to check block status", err));
        } else {
            setBlockStatus(null);
        }

        return () => {
            isMounted = false;
        };
    }, [activeConversationId, conversations]);

    // Track cursor position for mention detection
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);

        // Detect mention query
        const cursorPos = e.target.selectionStart ?? newText.length;
        const query = getMentionQuery(newText, cursorPos);
        setMentionQuery(query);
    };

    // Handle mention selection from MentionMenu
    const handleMentionSelect = useCallback((userId: string, displayName: string) => {
        const textarea = textareaRef.current;
        const cursorPos = textarea?.selectionStart ?? text.length;

        const { newContent, newCursorPos } = insertMention(text, cursorPos, userId, displayName);
        setText(newContent);
        setMentionQuery(null);

        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(newCursorPos, newCursorPos);
            }
        });
    }, [text]);

    const handleMentionClose = useCallback(() => {
        setMentionQuery(null);
    }, []);

    // Typing effect: only depends on text + sendTyping, not on the flag itself
    useEffect(() => {
        if (text.length > 0) {
            if (!isTypingRef.current) {
                // First keystroke — announce typing
                isTypingRef.current = true;
                sendTyping(true);
            }
            // Reset 2-second inactivity timer
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                isTypingRef.current = false;
                sendTyping(false);
            }, 2000);
        } else {
            // Text cleared — stop typing immediately
            if (isTypingRef.current) {
                isTypingRef.current = false;
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                sendTyping(false);
            }
        }

        return () => {
            // Clear typing timeout on unmount to prevent memory leak
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [text, sendTyping]);

    const handleSend = useCallback(async () => {
        if (!text.trim()) return;

        // Stop typing indicator immediately when message is sent
        if (isTypingRef.current) {
            isTypingRef.current = false;
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            sendTyping(false);
        }
        setMentionQuery(null);

        await sendMessage(text);
        setText('');
        setShowEmojiPicker(false);

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [sendMessage, text, sendTyping]);

    const handleCreatePoll = useCallback(async (data: CreatePollRequest) => {
        try {
            await createPoll(data);
            showToast('Bình chọn đã được tạo');
        } catch (err) {
            console.error('[MessageInput] Failed to create poll:', err);
            showToast('Lỗi khi tạo bình chọn');
        }
    }, []);

    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const showFeaturePlaceholder = (featureName: string) => {
        showToast(`Tính năng ${featureName} đang phát triển`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Let MentionMenu handle keyboard when it's open
        if (mentionQuery !== null) {
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
                return; // MentionMenu's global keydown handler will catch this
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setText(prev => prev + emojiData.emoji);
    };

    const handleUnblock = async () => {
        const conv = conversations.find(c => c.conversationId === activeConversationId);
        if (conv?.otherParticipant?.userId && user?.userId) {
            await unblockFriend(user.userId, conv.otherParticipant.userId);
            // Refresh block status after unblocking
            const newStatus = await friendApi.checkBlockStatus(conv.otherParticipant.userId);
            setBlockStatus(newStatus);
        }
    };

    if (blockStatus?.hasBlocked) {
        return (
            <div className="flex flex-col items-center justify-center p-4 glass rounded-[2rem] neo-shadow gap-3">
                <span className="text-muted-foreground font-medium text-sm">Bạn đã chặn người dùng này.</span>
                <button
                    onClick={handleUnblock}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity text-sm shadow-md"
                >
                    Bỏ chặn
                </button>
            </div>
        );
    }

    if (blockStatus?.isBlockedBy) {
        return (
            <div className="flex items-center justify-center p-4 glass rounded-[2rem] neo-shadow">
                <span className="text-muted-foreground font-medium text-sm">Bạn không thể gửi tin nhắn cho người này.</span>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <div className="bg-card glass border border-border/50 neo-shadow px-6 py-3 rounded-2xl flex items-center gap-3">
                        <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
                    </div>
                </div>
            )}

            {/* Emoji Picker Popover */}
            {showEmojiPicker && (
                <div className="absolute bottom-full mb-4 left-0 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="neo-shadow rounded-2xl overflow-hidden glass border-2 border-border/50">
                        <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            theme={Theme.AUTO}
                            width={320}
                            height={400}
                            lazyLoadEmojis={true}
                            searchPlaceHolder="Tìm emoji..."
                        />
                    </div>
                    {/* Backdrop to close */}
                    <div className="fixed inset-0 z-[-1]" onClick={() => setShowEmojiPicker(false)} />
                </div>
            )}

            {/* Mention Menu */}
            {activeConversationId && (
                <MentionMenu
                    conversationId={activeConversationId}
                    query={mentionQuery}
                    onSelect={handleMentionSelect}
                    onClose={handleMentionClose}
                />
            )}

            {/* Poll Create Modal */}
            {activeConversationId && (
                <CreatePollModal
                    conversationId={activeConversationId}
                    isOpen={showPollModal}
                    onClose={() => setShowPollModal(false)}
                    onSubmit={handleCreatePoll}
                />
            )}

            <div className="glass p-2 rounded-[2rem] neo-shadow flex flex-col gap-2 transition-all duration-300 focus-within:ring-2 ring-primary/20">
                <div className="flex items-end gap-2 px-2">
                    {/* Attachment Options */}
                    <div className="flex gap-1 mb-1.5">
                        <button
                            onClick={() => showFeaturePlaceholder('Đính kèm File')}
                            className="p-2.5 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-primary transition-all"
                            title="Đính kèm file"
                        >
                            <Paperclip size={20} />
                        </button>
                        <button
                            onClick={() => showFeaturePlaceholder('Gửi Hình ảnh/Video')}
                            className="p-2.5 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-primary transition-all"
                            title="Gửi Ảnh / Video"
                        >
                            <Image size={20} />
                        </button>
                        <button
                            onClick={() => setShowPollModal(true)}
                            className="p-2.5 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-primary transition-all"
                            title="Tạo bình chọn"
                        >
                            <BarChart3 size={20} />
                        </button>
                    </div>

                    <div className="flex-1 px-2 py-1">
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={handleTextChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Viết tin nhắn của bạn... (Gõ @ để nhắc đến)"
                            rows={1}
                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium placeholder:text-muted-foreground/40 py-3 block resize-none custom-scrollbar max-h-32 outline-none"
                            style={{ height: 'auto' }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${target.scrollHeight}px`;
                            }}
                        />
                    </div>

                    <div className="flex items-center gap-1 mb-1.5">
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={cn(
                                "p-2.5 rounded-xl transition-all",
                                showEmojiPicker ? "bg-primary text-primary-foreground neo-shadow" : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
                            )}
                            title="Biểu tượng cảm xúc"
                        >
                            <Smile size={20} />
                        </button>
                        <button
                            onClick={() => showFeaturePlaceholder('Ghi âm')}
                            className="p-2.5 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-primary transition-all"
                            title="Ghi âm giọng nói"
                        >
                            <Mic size={20} />
                        </button>

                        <button
                            onClick={handleSend}
                            disabled={!text.trim()}
                            className="ml-2 w-11 h-11 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center neo-shadow hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-30 disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-none group"
                        >
                            <Send size={20} className="group-hover:rotate-12 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
