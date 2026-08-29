import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Search, X, Loader2, Users, Check, Hash, LayoutGrid, ArrowRight } from 'lucide-react';
import { createConversation } from '../../api/messenger.api';
import type { User, ConversationType } from '../../types/messenger.types';
import { useMessenger } from '../../model/useMessenger';
import { cn } from '@/shared/lib/cn';
import { useUserSearch } from '@/shared/hooks/useUserSearch';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';
import { notifyError } from '@/shared/lib/notification';

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
    const [visibility, setVisibility] = useState<'PRIVATE_LINK' | 'COMMUNITY'>('PRIVATE_LINK');
    const [joinPolicy, setJoinPolicy] = useState<'DIRECT_JOIN' | 'REQUEST_APPROVAL'>('DIRECT_JOIN');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

    const { searchResults, isSearching, searchError, setSearchResults } = useUserSearch(searchTerm);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [isCreating, setIsCreating] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const isCreatingRef = useRef(false);
    isCreatingRef.current = isCreating;

    const { selectConversation, hoistConversation } = useMessenger();
    // Reset state when opened/closed
    useEffect(() => {
        if (!isOpen) {
            setStep('settings');
            setRoomName('');
            setDescription('');
            setRoomType('group');
            setVisibility('PRIVATE_LINK');
            setJoinPolicy('DIRECT_JOIN');
            setSearchTerm('');
            setSelectedUsers([]);
            setErrorMessage(null);
            setSearchResults([]);
        }
    }, [isOpen, setSearchResults]);

    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (!isCreatingRef.current) onClose();
                return;
            }
            if (event.key !== 'Tab' || !modalRef.current) return;
            const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            ));
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus();
        };
    }, [isOpen, onClose]);

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
        setErrorMessage(null);
        try {
            const newRoom = await createConversation({
                type: roomType,
                name: roomName,
                description: description,
                memberIds: selectedUsers.map(u => u.userId),
                visibility: roomType === 'channel' ? visibility : 'PRIVATE_LINK',
                joinPolicy: roomType === 'channel' && visibility === 'COMMUNITY' ? joinPolicy : 'INVITE_ONLY',
            });

            hoistConversation(newRoom);
            void selectConversation(newRoom.conversationId).catch((error: unknown) => {
                logger.error('[CreateRoomModal] Failed to open newly created room', error instanceof Error ? error.message : String(error));
                notifyError(getUserFacingErrorMessage(error, localizeText('Không thể mở phòng mới. Vui lòng thử lại.')));
            });
            onClose();
        } catch (error: unknown) {
            logger.error('[CreateRoomModal] Failed to create room', error instanceof Error ? error.message : String(error));
            setErrorMessage(getUserFacingErrorMessage(error, localizeText("Không thể tạo phòng. Kiểm tra dữ liệu và thử lại.")));
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.button
                type="button"
                className="absolute inset-0 bg-background/40 backdrop-blur-md"
                onClick={isCreating ? undefined : onClose}
                aria-label={localizeText('Đóng cửa sổ tạo phòng')}
                initial={UI_MOTION_CONFIG.initialState}
                animate={UI_MOTION_CONFIG.animateState}
                variants={UI_MOTION_VARIANTS.fadeIn}
            />

            {/* Modal Container */}
            <motion.div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-room-title"
                aria-describedby={errorMessage ? 'create-room-error' : undefined}
                aria-busy={isCreating}
                tabIndex={-1}
                className="relative w-full max-w-2xl h-[80vh] max-h-[700px] bg-card/60 glass rounded-[2.5rem] neo-shadow flex flex-col overflow-hidden z-10"
                initial={UI_MOTION_CONFIG.initialState}
                animate={UI_MOTION_CONFIG.animateState}
                variants={UI_MOTION_VARIANTS.zoomReveal}
            >

                {/* Header */}
                <div className="p-8 border-b border-border/50 flex justify-between items-center bg-background/20 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary neo-shadow">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 id="create-room-title" className="text-2xl font-semibold tracking-tight text-primary">{MESSENGER_COPY.createRoomModal.title}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                    step === 'settings' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>{MESSENGER_COPY.createRoomModal.stepOneTitle}</span>
                                <div className="w-4 h-px bg-border/50" />
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                    step === 'members' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>{MESSENGER_COPY.createRoomModal.stepTwoTitle}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isCreating}
                        className="p-3 hover:bg-primary/10 rounded-full transition-colors group"
                        aria-label={MESSENGER_COPY.newConversationModal.closeAriaLabel}
                    >
                        <X size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {errorMessage ? (
                        <p id="create-room-error" role="alert" className="mb-5 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                            {errorMessage}
                        </p>
                    ) : null}
                    {step === 'settings' ? (
                        <motion.div
                            className="space-y-8"
                            initial={UI_MOTION_CONFIG.initialState}
                            animate={UI_MOTION_CONFIG.animateState}
                            variants={UI_MOTION_VARIANTS.slideInFromRight}
                        >
                            {/* Inputs */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label htmlFor="create-room-name" className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">{MESSENGER_COPY.createRoomModal.roomNameLabel}</label>
                                    <input
                                        id="create-room-name"
                                        type="text"
                                        placeholder={MESSENGER_COPY.createRoomModal.roomNamePlaceholder}
                                        value={roomName}
                                        onChange={(e) => setRoomName(e.target.value)}
                                        className="w-full bg-background/50 border-2 border-border/50 rounded-2xl px-6 py-4 focus:border-primary focus:ring-0 transition-[color,background-color,border-color,box-shadow,transform,opacity] font-bold outline-none"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="create-room-description" className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">{MESSENGER_COPY.createRoomModal.roomDescriptionLabel}</label>
                                    <textarea
                                        id="create-room-description"
                                        placeholder={MESSENGER_COPY.createRoomModal.roomDescriptionPlaceholder}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        className="w-full bg-background/50 border-2 border-border/50 rounded-2xl px-6 py-4 focus:border-primary focus:ring-0 transition-[color,background-color,border-color,box-shadow,transform,opacity] font-bold outline-none resize-none"
                                    />
                                </div>

                                <fieldset className="space-y-4">
                                    <legend className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">{MESSENGER_COPY.createRoomModal.roomTypeLabel}</legend>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRoomType('group');
                                                setVisibility('PRIVATE_LINK');
                                            }}
                                            className={cn(
                                                "flex items-center gap-4 p-4 rounded-2xl border-2 transition-[color,background-color,border-color,box-shadow,transform,opacity] text-left",
                                                roomType === 'group' ? "border-primary bg-primary/10" : "border-border/30 bg-background/40 hover:border-primary/50"
                                            )}
                                        >
                                            <div className={cn("p-2 rounded-xl", roomType === 'group' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                                                <LayoutGrid size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-sm uppercase tracking-tight">{MESSENGER_COPY.createRoomModal.roomTypeGroup}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium italic">{MESSENGER_COPY.createRoomModal.roomTypeGroupHint}</p>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRoomType('channel')}
                                            className={cn(
                                                "flex items-center gap-4 p-4 rounded-2xl border-2 transition-[color,background-color,border-color,box-shadow,transform,opacity] text-left",
                                                roomType === 'channel' ? "border-primary bg-primary/10" : "border-border/30 bg-background/40 hover:border-primary/50"
                                            )}
                                        >
                                            <div className={cn("p-2 rounded-xl", roomType === 'channel' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                                                <Hash size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-sm uppercase tracking-tight">{MESSENGER_COPY.createRoomModal.roomTypeChannel}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium italic">{MESSENGER_COPY.createRoomModal.roomTypeChannelHint}</p>
                                            </div>
                                        </button>
                                    </div>
                                </fieldset>

                                {roomType === 'channel' ? (
                                    <motion.div
                                        className="space-y-6 rounded-2xl border border-border/50 bg-background/35 p-5"
                                        initial={UI_MOTION_CONFIG.initialState}
                                        animate={UI_MOTION_CONFIG.animateState}
                                        variants={UI_MOTION_VARIANTS.panelReveal}
                                    >
                                        <fieldset className="space-y-3">
                                            <legend className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                                                {MESSENGER_COPY.createRoomModal.channelScopeLabel}
                                            </legend>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {([
                                                    ['PRIVATE_LINK', MESSENGER_COPY.createRoomModal.privateChannel, MESSENGER_COPY.createRoomModal.privateChannelHint],
                                                    ['COMMUNITY', MESSENGER_COPY.createRoomModal.communityChannel, MESSENGER_COPY.createRoomModal.communityChannelHint],
                                                ] as const).map(([value, label, hint]) => (
                                                    <label key={value} className={cn(
                                                        'cursor-pointer rounded-xl border p-4 transition-[color,background-color,border-color,box-shadow]',
                                                        visibility === value ? 'border-primary bg-primary/10' : 'border-border/50 hover:border-primary/45',
                                                    )}>
                                                        <input
                                                            type="radio"
                                                            name="channel-visibility"
                                                            value={value}
                                                            checked={visibility === value}
                                                            onChange={() => setVisibility(value)}
                                                            aria-label={label}
                                                            className="sr-only"
                                                        />
                                                        <span className="block text-sm font-bold">{label}</span>
                                                        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </fieldset>

                                        {visibility === 'COMMUNITY' ? (
                                            <fieldset className="space-y-3">
                                                <legend className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                                                    {MESSENGER_COPY.createRoomModal.joinPolicyLabel}
                                                </legend>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    {([
                                                        ['DIRECT_JOIN', MESSENGER_COPY.createRoomModal.directJoin, MESSENGER_COPY.createRoomModal.directJoinHint],
                                                        ['REQUEST_APPROVAL', MESSENGER_COPY.createRoomModal.approvalRequired, MESSENGER_COPY.createRoomModal.approvalRequiredHint],
                                                    ] as const).map(([value, label, hint]) => (
                                                        <label key={value} className={cn(
                                                            'cursor-pointer rounded-xl border p-4 transition-[color,background-color,border-color,box-shadow]',
                                                            joinPolicy === value ? 'border-primary bg-primary/10' : 'border-border/50 hover:border-primary/45',
                                                        )}>
                                                            <input
                                                                type="radio"
                                                                name="community-join-policy"
                                                                value={value}
                                                                checked={joinPolicy === value}
                                                                onChange={() => setJoinPolicy(value)}
                                                                aria-label={label}
                                                                className="sr-only"
                                                            />
                                                            <span className="block text-sm font-bold">{label}</span>
                                                            <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </fieldset>
                                        ) : null}
                                    </motion.div>
                                ) : null}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            className="space-y-6"
                            initial={UI_MOTION_CONFIG.initialState}
                            animate={UI_MOTION_CONFIG.animateState}
                            variants={UI_MOTION_VARIANTS.slideInFromLeft}
                        >
                            {/* Selected Chips */}
                            <div className="flex flex-wrap gap-2 min-h-[42px] p-2 rounded-2xl bg-primary/5 border border-dashed border-primary/20">
                                {selectedUsers.length > 0 ? (
                                    selectedUsers.map(user => (
                                        <motion.div
                                            key={user.userId}
                                            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-tighter neo-shadow"
                                            initial={UI_MOTION_CONFIG.initialState}
                                            animate={UI_MOTION_CONFIG.animateState}
                                            variants={UI_MOTION_VARIANTS.zoomReveal}
                                        >
                                            <span>{user.displayName}</span>
                                            <button type="button" onClick={() => handleToggleUser(user)} className="hover:bg-white/20 rounded-lg p-0.5 transition-colors" aria-label={`${MESSENGER_COPY.newConversationModal.removeChipAriaPrefix} ${user.displayName}`}>
                                                <X size={12} strokeWidth={4} />
                                            </button>
                                        </motion.div>
                                    ))
                                ) : (
                                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest flex items-center justify-center w-full italic">{MESSENGER_COPY.createRoomModal.membersEmpty}</p>
                                )}
                            </div>

                            {/* Search */}
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                                <input
                                    type="text"
                                    placeholder={MESSENGER_COPY.createRoomModal.searchPlaceholder}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-background/50 border-2 border-border/50 rounded-2xl py-4 pl-14 pr-12 focus:border-primary focus:ring-0 transition-[color,background-color,border-color,box-shadow,transform,opacity] font-bold outline-none"
                                />
                                {isSearching && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-primary" size={20} />}
                            </div>

                            {/* Results */}
                            <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                {searchError ? <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{searchError}</p> : null}
                                {!searchError && !isSearching && searchTerm.trim().length >= 2 && searchResults.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{localizeText('Không tìm thấy người dùng phù hợp.')}</p>
                                ) : null}
                                {searchResults.map(user => {
                                    const isSelected = selectedUsers.some(u => u.userId === user.userId);
                                    return (
                                        <button
                                            type="button"
                                            key={user.userId}
                                            onClick={() => handleToggleUser(user)}
                                            className={cn(
                                                "w-full flex items-center gap-4 p-3 rounded-2xl transition-[color,background-color,border-color,box-shadow,transform,opacity] border-2",
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
                                                <motion.div
                                                    className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-2 border-background"
                                                    initial={UI_MOTION_CONFIG.initialState}
                                                    animate={UI_MOTION_CONFIG.animateState}
                                                    variants={UI_MOTION_VARIANTS.zoomReveal}
                                                >
                                                        <Check size={12} strokeWidth={4} />
                                                </motion.div>
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
                        </motion.div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-border/50 bg-background/30 flex gap-4">
                    {step === 'members' && (
                        <button
                            type="button"
                            onClick={() => setStep('settings')}
                            className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-muted text-muted-foreground hover:bg-muted/80 transition-[color,background-color,border-color,box-shadow,transform,opacity]"
                        >
                            {MESSENGER_COPY.createRoomModal.backButton}
                        </button>
                    )}

                    {step === 'settings' ? (
                        <button
                            type="button"
                            onClick={() => setStep('members')}
                            disabled={!roomName.trim()}
                            className="flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-[color,background-color,border-color,box-shadow,transform,opacity] disabled:opacity-50 disabled:cursor-not-allowed neo-shadow flex items-center justify-center gap-2 group"
                        >
                            <span>{MESSENGER_COPY.createRoomModal.nextButton}</span>
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void handleCreateRoom()}
                            disabled={isCreating}
                            className="flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-[color,background-color,border-color,box-shadow,transform,opacity] disabled:opacity-50 disabled:cursor-not-allowed neo-shadow flex items-center justify-center gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>{MESSENGER_COPY.createRoomModal.createButtonLoading}</span>
                                </>
                            ) : (
                                <>
                                    <span>{MESSENGER_COPY.createRoomModal.createButton}</span>
                                    <Check size={20} />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

