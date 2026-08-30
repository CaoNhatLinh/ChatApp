import React, { useRef, useState } from 'react';
import { X, Plus, Trash2, BarChart3, Clock, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { motion } from 'framer-motion';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import type { CreatePollRequest } from '../../types/messenger.types';
import { localizeText } from '@/shared/i18n';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

            {/* Modal */}
            <motion.div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-poll-title"
                className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-card"
                initial={UI_MOTION_CONFIG.initialState}
                animate={UI_MOTION_CONFIG.animateState}
                variants={UI_MOTION_VARIANTS.zoomReveal}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <BarChart3 size={20} className="text-primary" />
                        </div>
                        <h3 id="create-poll-title" className="text-lg font-black tracking-tight">{localizeText('Tạo bình chọn')}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={localizeText('Đóng cửa sổ tạo bình chọn')}
                        className="p-2 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-foreground transition-[color,background-color,border-color,box-shadow,transform,opacity]"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="max-h-[65vh] space-y-5 overflow-y-auto p-6">
                    {/* Question */}
                    <div>
                        <label htmlFor="poll-question" className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                            {localizeText('Câu hỏi')}
                        </label>
                        <textarea
                            id="poll-question"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder={localizeText('Nhập câu hỏi bình chọn...')}
                            className="w-full bg-background/60 border border-border/50 rounded-2xl px-4 py-3 text-sm font-medium placeholder:text-muted-foreground/40 focus:ring-2 ring-primary/20 focus:border-primary/30 outline-none transition-[color,background-color,border-color,box-shadow,transform,opacity] resize-none"
                            rows={2}
                            maxLength={500}
                        />
                        <p className="text-[10px] text-muted-foreground/50 mt-1 text-right">{question.length}/500</p>
                    </div>

                    {/* Options */}
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
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
                                        className="flex-1 bg-background/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm font-medium placeholder:text-muted-foreground/40 focus:ring-2 ring-primary/20 focus:border-primary/30 outline-none transition-[color,background-color,border-color,box-shadow,transform,opacity]"
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
                                className="mt-2 flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition-[color,background-color,border-color,box-shadow,transform,opacity] w-full justify-center border border-dashed border-primary/30"
                            >
                                <Plus size={14} />
                                {localizeText('Thêm lựa chọn')}
                            </button>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                            {localizeText('Cài đặt')}
                        </p>

                        {/* Multiple choice toggle */}
                        <button
                            type="button"
                            aria-pressed={isMultipleChoice}
                            onClick={() => setIsMultipleChoice(!isMultipleChoice)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-background/60 transition-[color,background-color,border-color,box-shadow,transform,opacity] border border-border/30"
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
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-background/60 transition-[color,background-color,border-color,box-shadow,transform,opacity] border border-border/30"
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
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-background/60 transition-[color,background-color,border-color,box-shadow,transform,opacity] border border-border/30"
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
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40 bg-background/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground rounded-xl hover:bg-background/60 transition-[color,background-color,border-color,box-shadow,transform,opacity]"
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
};

