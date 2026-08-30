import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, BarChart3, Clock, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { motion } from 'framer-motion';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import type { CreatePollRequest } from '../../types/messenger.types';
import { localizeText } from '@/shared/i18n';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { dismissFeedback } from '@/shared/lib/notification';

interface CreatePollModalProps {
    conversationId: string;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreatePollRequest) => Promise<void>;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
    conversationId,
    isOpen,
    onClose,
    onSubmit
}) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [isMultipleChoice, setIsMultipleChoice] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [hasDeadline, setHasDeadline] = useState(false);
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('23:59');
    const [clientMessageId, setClientMessageId] = useState(() => crypto.randomUUID());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    useFocusTrap(isOpen, dialogRef, onClose, isSubmitting);

    useEffect(() => {
        if (isOpen) dismissFeedback();
    }, [isOpen]);

    const addOption = () => {
        if (options.length >= 10) return;
        setOptions([...options, '']);
    };

    const removeOption = (index: number) => {
        if (options.length <= 2) return;
        setOptions(options.filter((_, i) => i !== index));
    };

    const updateOption = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const validOptions = options.map(option => option.trim()).filter(Boolean);
    const hasDuplicateOptions = new Set(validOptions.map(option => option.toLocaleLowerCase())).size
        !== validOptions.length;
    const expiresAt = hasDeadline && deadlineDate
        ? new Date(`${deadlineDate}T${deadlineTime}`).toISOString()
        : undefined;
    const deadlineIsFuture = !expiresAt || new Date(expiresAt).getTime() > Date.now();

    const resetForm = () => {
        setQuestion('');
        setOptions(['', '']);
        setIsMultipleChoice(false);
        setIsAnonymous(false);
        setHasDeadline(false);
        setDeadlineDate('');
        setDeadlineTime('23:59');
        setClientMessageId(crypto.randomUUID());
    };

    const handleSubmit = async () => {
        const validOptions = options.filter(o => o.trim());
        if (!isValid || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onSubmit({
                conversationId,
                clientMessageId,
                question: question.trim(),
                options: validOptions.map(option => option.trim()),
                isMultipleChoice,
                isAnonymous,
                expiresAt,
            });
            resetForm();
            onClose();
        } catch {
            // The caller owns user-facing error reporting; keep the draft open for recovery.
        } finally {
            setIsSubmitting(false);
        }
    };

    const isValid = question.trim().length > 0
        && validOptions.length >= 2
        && !hasDuplicateOptions
        && (!hasDeadline || Boolean(deadlineDate))
        && deadlineIsFuture;

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />

            {/* Modal */}
            <motion.div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-poll-title"
                className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col overflow-hidden border-0 bg-[#101720] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-[1.5rem] sm:border sm:border-white/10"
                initial={UI_MOTION_CONFIG.initialState}
                animate={UI_MOTION_CONFIG.animateState}
                variants={UI_MOTION_VARIANTS.zoomReveal}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/15 p-2">
                            <BarChart3 size={20} className="text-primary" />
                        </div>
                        <h3 id="create-poll-title" className="text-lg font-bold tracking-tight text-white">{localizeText('Tạo bình chọn')}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={localizeText('Đóng cửa sổ tạo bình chọn')}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 sm:max-h-[65vh] sm:flex-none">
                    {/* Question */}
                    <div>
                        <label htmlFor="poll-question" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {localizeText('Câu hỏi')}
                        </label>
                        <textarea
                            id="poll-question"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder={localizeText('Nhập câu hỏi bình chọn...')}
                            className="w-full resize-none rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-medium text-white outline-none transition-[color,box-shadow] placeholder:text-slate-500 focus:ring-2 focus:ring-primary/30"
                            rows={2}
                            maxLength={500}
                        />
                        <p className="mt-1 text-right text-[10px] text-slate-500">{question.length}/500</p>
                    </div>

                    {/* Options */}
                    <div>
                        <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {localizeText('Các lựa chọn')} ({options.length}/10)
                        </p>
                        <div className="space-y-2">
                            {options.map((option, index) => (
                                <div key={index} className="flex items-center gap-2 group">
                                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-black flex items-center justify-center flex-shrink-0">
                                        {index + 1}
                                    </span>
                                    <input
                                        id={`poll-option-${index}`}
                                        type="text"
                                        aria-label={`${localizeText('Lựa chọn')} ${index + 1}`}
                                        value={option}
                                        onChange={(e) => updateOption(index, e.target.value)}
                                        placeholder={localizeText('Lựa chọn') + ` ${index + 1}`}
                                        className="flex-1 rounded-xl bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white outline-none transition-[color,box-shadow] placeholder:text-slate-500 focus:ring-2 focus:ring-primary/30"
                                        maxLength={200}
                                    />
                                    {options.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => removeOption(index)}
                                            aria-label={`${localizeText('Xóa lựa chọn')} ${index + 1}`}
                                            className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-[color,background-color,border-color,box-shadow,transform,opacity] opacity-60 hover:opacity-100 focus-visible:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {hasDuplicateOptions && (
                            <p role="alert" className="mt-2 text-xs text-destructive">
                                {localizeText('Các lựa chọn không được trùng nhau.')}
                            </p>
                        )}

                        {options.length < 10 && (
                            <button
                                type="button"
                                onClick={addOption}
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                            >
                                <Plus size={14} />
                                {localizeText('Thêm lựa chọn')}
                            </button>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="space-y-3">
                        <p className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {localizeText('Cài đặt')}
                        </p>

                        {/* Multiple choice toggle */}
                        <button
                            type="button"
                            aria-pressed={isMultipleChoice}
                            onClick={() => setIsMultipleChoice(!isMultipleChoice)}
                            className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.06]"
                        >
                            {isMultipleChoice ? (
                                <CheckSquare size={18} className="text-primary" />
                            ) : (
                                <Square size={18} className="text-muted-foreground" />
                            )}
                            <span className="text-sm font-bold text-left flex-1">{localizeText('Chọn nhiều đáp án')}</span>
                        </button>

                        {/* Anonymous poll toggle */}
                        <button
                            type="button"
                            aria-pressed={isAnonymous}
                            onClick={() => setIsAnonymous(!isAnonymous)}
                            className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.06]"
                        >
                            {isAnonymous ? (
                                <CheckSquare size={18} className="text-primary" />
                            ) : (
                                <Square size={18} className="text-muted-foreground" />
                            )}
                            <span className="text-sm font-bold text-left flex-1">{localizeText('Bình chọn ẩn danh')}</span>
                        </button>

                        {/* Deadline toggle */}
                        <button
                            type="button"
                            aria-pressed={hasDeadline}
                            onClick={() => setHasDeadline(!hasDeadline)}
                            className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.06]"
                        >
                            {hasDeadline ? (
                                <CheckSquare size={18} className="text-primary" />
                            ) : (
                                <Square size={18} className="text-muted-foreground" />
                            )}
                            <span className="text-sm font-bold text-left flex-1">{localizeText('Thời hạn bình chọn')}</span>
                            <Clock size={16} className={cn("transition-colors", hasDeadline ? "text-primary" : "text-muted-foreground/40")} />
                        </button>

                        {/* Deadline datetime inputs */}
                        {hasDeadline && (
                            <motion.div
                                className="flex flex-wrap gap-2 pl-9"
                                initial={UI_MOTION_CONFIG.initialState}
                                animate={UI_MOTION_CONFIG.animateState}
                                variants={UI_MOTION_VARIANTS.slideInFromTop}
                            >
                                <input
                                    aria-label={localizeText('Ngày kết thúc')}
                                    type="date"
                                    value={deadlineDate}
                                    onChange={(e) => setDeadlineDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="flex-1 bg-background/60 border border-border/50 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 ring-primary/20 outline-none"
                                />
                                <input
                                    aria-label={localizeText('Giờ kết thúc')}
                                    type="time"
                                    value={deadlineTime}
                                    onChange={(e) => setDeadlineTime(e.target.value)}
                                    className="w-28 bg-background/60 border border-border/50 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 ring-primary/20 outline-none"
                                />
                                {!deadlineDate && (
                                    <p role="alert" className="basis-full text-xs text-destructive">
                                        {localizeText('Vui lòng chọn ngày kết thúc.')}
                                    </p>
                                )}
                                {deadlineDate && !deadlineIsFuture && (
                                    <p role="alert" className="basis-full text-xs text-destructive">
                                        {localizeText('Thời hạn phải ở tương lai.')}
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-white/[0.07] bg-white/[0.025] px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white"
                    >
                        {localizeText('Hủy')}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={!isValid || isSubmitting}
                        className="min-h-11 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-40"
                    >
                        {localizeText(isSubmitting ? 'Đang tạo...' : 'Tạo bình chọn')}
                    </button>
                </div>
            </motion.div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

