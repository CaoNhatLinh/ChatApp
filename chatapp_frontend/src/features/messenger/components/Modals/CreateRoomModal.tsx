import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, Users, Check, Hash, LayoutGrid, ArrowRight, Camera } from 'lucide-react';
import { searchUsers } from '../../api/users.api';
import { createConversation } from '../../api/messenger.api';
import type { User, ConversationType } from '../../types/messenger.types';
import { useMessenger } from '../../hooks/useMessenger';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/common/lib/utils';

interface CreateRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'settings' | 'members';

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState<Step>('settings');
    const [roomName, setRoomName] = useState('');
    const [description, setDescription] = useState('');
    const [roomType, setRoomType] = useState<ConversationType>('group');

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

    const [isCreating, setIsCreating] = useState(false);

    const { selectConversation, hoistConversation } = useMessenger();
    const { user: currentUser } = useAuthStore();

    // Reset state when opened/closed
    useEffect(() => {
        if (!isOpen) {
            setStep('settings');
            setRoomName('');
            setDescription('');
            setRoomType('group');
            setSearchTerm('');
            setSelectedUsers([]);
            setSearchResults([]);
        }
    }, [isOpen]);

    // Debounced search
    useEffect(() => {
        if (step !== 'members') return;

        const fetchUsers = async () => {
            if (searchTerm.trim().length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const results = await searchUsers(searchTerm);
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
    }, [searchTerm, currentUser?.userId, step]);

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

    const handleCreateRoom = async () => {
        if (!roomName.trim()) return;

        setIsCreating(true);
        try {
            const newRoom = await createConversation({
                type: roomType,
                name: roomName,
                description: description,
                memberIds: selectedUsers.map(u => u.userId)
            });

            hoistConversation(newRoom);
            void selectConversation(newRoom.conversationId);
            onClose();
        } catch (error) {
            console.error("Failed to create room", error);
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/40 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-2xl h-[80vh] max-h-[700px] bg-card/60 glass rounded-[2.5rem] neo-shadow flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 z-10">

                {/* Header */}
                <div className="p-8 border-b border-border/50 flex justify-between items-center bg-background/20 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary neo-shadow">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-gradient">Tạo Phòng Mới</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                    step === 'settings' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>1. Thiết lập</span>
                                <div className="w-4 h-px bg-border/50" />
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                    step === 'members' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>2. Thành viên</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-primary/10 rounded-full transition-colors group"
                    >
                        <X size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {step === 'settings' ? (
                        <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                            {/* Avatar Placeholder */}
                            <div className="flex flex-col items-center">
                                <div className="relative group cursor-pointer">
                                    <div className="w-28 h-28 rounded-3xl bg-primary/5 border-4 border-dashed border-primary/20 flex flex-col items-center justify-center text-primary/40 hover:border-primary/50 hover:bg-primary/10 transition-all neo-shadow group-hover:scale-105">
                                        <Camera size={32} className="mb-2" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-center px-4 leading-tight">Ảnh đại diện phòng</span>
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-xl flex items-center justify-center neo-shadow border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight size={16} />
                                    </div>
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Tên phòng chat</label>
                                    <input
                                        type="text"
                                        placeholder="VD: Team Frontend, Coffee Group..."
                                        value={roomName}
                                        onChange={(e) => setRoomName(e.target.value)}
                                        className="w-full bg-background/50 border-2 border-border/50 rounded-2xl px-6 py-4 focus:border-primary focus:ring-0 transition-all font-bold outline-none"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Mô tả (Không bắt buộc)</label>
                                    <textarea
                                        placeholder="Phòng này dùng để làm gì?"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        className="w-full bg-background/50 border-2 border-border/50 rounded-2xl px-6 py-4 focus:border-primary focus:ring-0 transition-all font-bold outline-none resize-none"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Loại hình</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setRoomType('group')}
                                            className={cn(
                                                "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                                                roomType === 'group' ? "border-primary bg-primary/10" : "border-border/30 bg-background/40 hover:border-primary/50"
                                            )}
                                        >
                                            <div className={cn("p-2 rounded-xl", roomType === 'group' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                                                <LayoutGrid size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-sm uppercase tracking-tight">Nhóm Chat</p>
                                                <p className="text-[10px] text-muted-foreground font-medium italic">Riêng tư, bảo mật</p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setRoomType('channel')}
                                            className={cn(
                                                "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                                                roomType === 'channel' ? "border-primary bg-primary/10" : "border-border/30 bg-background/40 hover:border-primary/50"
                                            )}
                                        >
                                            <div className={cn("p-2 rounded-xl", roomType === 'channel' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                                                <Hash size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-sm uppercase tracking-tight">Kênh (Channel)</p>
                                                <p className="text-[10px] text-muted-foreground font-medium italic">Công khai, thông báo</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
                            {/* Selected Chips */}
                            <div className="flex flex-wrap gap-2 min-h-[42px] p-2 rounded-2xl bg-primary/5 border border-dashed border-primary/20">
                                {selectedUsers.length > 0 ? (
                                    selectedUsers.map(user => (
                                        <div key={user.userId} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-tighter neo-shadow animate-in zoom-in">
                                            <span>{user.displayName}</span>
                                            <button onClick={() => handleToggleUser(user)} className="hover:bg-white/20 rounded-lg p-0.5 transition-colors">
                                                <X size={12} strokeWidth={4} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest flex items-center justify-center w-full italic">Chưa chọn thành viên nào</p>
                                )}
                            </div>

                            {/* Search */}
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm bạn bè theo tên đăng nhập..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-background/50 border-2 border-border/50 rounded-2xl py-4 pl-14 pr-12 focus:border-primary focus:ring-0 transition-all font-bold outline-none"
                                />
                                {isSearching && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-primary" size={20} />}
                            </div>

                            {/* Results */}
                            <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                {searchResults.map(user => {
                                    const isSelected = selectedUsers.some(u => u.userId === user.userId);
                                    return (
                                        <button
                                            key={user.userId}
                                            onClick={() => handleToggleUser(user)}
                                            className={cn(
                                                "w-full flex items-center gap-4 p-3 rounded-2xl transition-all border-2",
                                                isSelected ? "bg-primary/10 border-primary" : "hover:bg-background/80 border-transparent"
                                            )}
                                        >
                                            <div className="relative">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border-2",
                                                    isSelected ? "border-primary" : "border-primary/20 bg-primary/5"
                                                )}>
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
                                                <p className="font-black text-sm uppercase tracking-tight">{user.displayName}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">@{user.userName}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-border/50 bg-background/30 flex gap-4">
                    {step === 'members' && (
                        <button
                            onClick={() => setStep('settings')}
                            className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-muted text-muted-foreground hover:bg-muted/80 transition-all"
                        >
                            Quay lại
                        </button>
                    )}

                    {step === 'settings' ? (
                        <button
                            onClick={() => setStep('members')}
                            disabled={!roomName.trim()}
                            className="flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed neo-shadow flex items-center justify-center gap-2 group"
                        >
                            <span>Tiếp theo</span>
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    ) : (
                        <button
                            onClick={() => void handleCreateRoom()}
                            disabled={isCreating}
                            className="flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed neo-shadow flex items-center justify-center gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Đang tạo phòng...</span>
                                </>
                            ) : (
                                <>
                                    <span>Tạo phòng ngay</span>
                                    <Check size={20} />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
