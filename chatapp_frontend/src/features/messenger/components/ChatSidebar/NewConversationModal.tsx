import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, UserPlus, Check } from 'lucide-react';
import { searchUsers } from '../../api/users.api';
import { createConversation } from '../../api/messenger.api';
import type { User } from '../../types/messenger.types';
import { useMessenger } from '../../hooks/useMessenger';
import { useAuthStore } from '@/store/authStore';

interface NewConversationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

    const { selectConversation, conversations } = useMessenger();
    const { user: currentUser } = useAuthStore();

    // Debounced search
    useEffect(() => {
        const fetchUsers = async () => {
            if (searchTerm.trim().length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const results = await searchUsers(searchTerm);
                // Filter out current user
                setSearchResults(results.filter(u => u.userId !== currentUser?.userId));
            } catch (error) {
                console.error("Failed to search users", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(fetchUsers, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, currentUser?.userId]);

    const handleToggleUser = (user: User) => {
        setSelectedUsers(prev => {
            const isSelected = prev.some(u => u.userId === user.userId);
            if (isSelected) {
                return prev.filter(u => u.userId !== user.userId);
            } else {
                return [...prev, user];
            }
        });
    };

    const handleCreateConversation = async () => {
        if (selectedUsers.length === 0) return;

        setIsCreating(true);
        try {
            // Check if DM already exists with this user (simplification for 1-1)
            if (selectedUsers.length === 1) {
                const targetUserId = selectedUsers[0].userId;
                const existingDm = conversations.find(c =>
                    c.type === 'dm' &&
                    c.otherParticipant?.userId === targetUserId
                );

                if (existingDm) {
                    void selectConversation(existingDm.conversationId);
                    handleClose();
                    return;
                }
            }

            const type = selectedUsers.length === 1 ? 'dm' : 'group';
            // Default naming for groups if more than 1 user selected
            const name = type === 'group'
                ? `${currentUser?.displayName}, ${selectedUsers.map(u => u.displayName).join(', ')}`
                : undefined;

            const newConv = await createConversation({
                type,
                name,
                memberIds: selectedUsers.map(u => u.userId)
            });

            // Note: Currently we're missing setConversations from useMessenger hooks.
            // Ideally, we'd add the new conv to the store here so it appears instantly.
            // For now, depending on WebSocket to push the new conversation if supported,
            // or we might need to refresh conversations.

            // Select and close
            void selectConversation(newConv.conversationId);
            handleClose();

        } catch (error) {
            console.error("Failed to create conversation", error instanceof Error ? error.message : String(error));
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        setSearchTerm('');
        setSelectedUsers([]);
        setSearchResults([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in"
                onClick={handleClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-card/50 glass rounded-3xl neo-shadow overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-border/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-gradient">Kết nối mới</h2>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Tìm kiếm và bắt đầu trò chuyện</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-background/80 rounded-full transition-colors"
                    >
                        <X size={20} className="text-muted-foreground hover:text-primary transition-colors" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Search Input */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Nhập username để tìm kiếm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-background border-2 border-border/50 rounded-2xl py-3 pl-12 pr-10 focus:ring-0 focus:border-primary transition-all outline-none font-medium placeholder:font-normal placeholder:opacity-50"
                            autoFocus
                        />
                        {isSearching && (
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-primary">
                                <Loader2 size={16} className="animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Selected Users Pills */}
                    {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {selectedUsers.map(user => (
                                <div key={user.userId} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-bold animate-in zoom-in slide-in-from-bottom-2">
                                    <span>{user.displayName}</span>
                                    <button
                                        onClick={() => handleToggleUser(user)}
                                        className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Search Results */}
                    <div className="min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar -mx-2 px-2">
                        {searchResults.length > 0 ? (
                            <div className="space-y-1">
                                {searchResults.map(user => {
                                    const isSelected = selectedUsers.some(u => u.userId === user.userId);
                                    return (
                                        <button
                                            key={user.userId}
                                            onClick={() => handleToggleUser(user)}
                                            className={`w-full flex items-center p-3 rounded-2xl transition-all ${isSelected
                                                ? 'bg-primary/10 border-2 border-primary/50'
                                                : 'hover:bg-background/80 border-2 border-transparent'
                                                }`}
                                        >
                                            <div className="relative mr-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border-2 transition-colors ${isSelected ? 'border-primary' : 'border-primary/20 bg-primary/5'
                                                    }`}>
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-primary font-black text-lg uppercase">{user.displayName?.charAt(0)}</span>
                                                    )}
                                                </div>
                                                {isSelected && (
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-2 border-background animate-in zoom-in">
                                                        <Check size={12} strokeWidth={4} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-bold text-foreground">{user.displayName}</p>
                                                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">@{user.userName}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : searchTerm.length >= 2 && !isSearching ? (
                            <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-3 pt-8">
                                <UserPlus size={40} className="text-muted-foreground" />
                                <div>
                                    <p className="font-bold uppercase tracking-widest text-sm">Không tìm thấy ai</p>
                                    <p className="text-xs mt-1">Hãy thử một username khác</p>
                                </div>
                            </div>
                        ) : searchTerm.length < 2 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center opacity-30 space-y-3 pt-8">
                                <Search size={40} className="text-muted-foreground" />
                                <p className="font-bold uppercase tracking-widest text-sm">Nhập ít nhất 2 ký tự</p>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-border/50 bg-background/20">
                    <button
                        onClick={() => void handleCreateConversation()}
                        disabled={selectedUsers.length === 0 || isCreating}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${selectedUsers.length > 0
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] neo-shadow'
                            : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                            }`}
                    >
                        {isCreating ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Đang tạo...</span>
                            </>
                        ) : (
                            <>
                                <span>Bắt đầu trò chuyện</span>
                                {selectedUsers.length > 0 && (
                                    <span className="bg-background/20 px-2 py-0.5 rounded-full text-xs">
                                        {selectedUsers.length}
                                    </span>
                                )}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
