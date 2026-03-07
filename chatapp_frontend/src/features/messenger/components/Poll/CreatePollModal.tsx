import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart3, Clock, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import type { CreatePollRequest } from '../../types/messenger.types';

interface CreatePollModalProps {
    conversationId: string;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreatePollRequest) => void;
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

    const handleSubmit = () => {
        const validOptions = options.filter(o => o.trim());
        if (!question.trim() || validOptions.length < 2) return;

        let expiresAt: string | undefined;
        if (hasDeadline && deadlineDate) {
            expiresAt = new Date(`${deadlineDate}T${deadlineTime}`).toISOString();
        }

        onSubmit({
            conversationId,
            question: question.trim(),
            options: validOptions,
            isMultipleChoice,
            isAnonymous,
            expiresAt
        });

        // Reset form
        setQuestion('');
        setOptions(['', '']);
        setIsMultipleChoice(false);
        setIsAnonymous(false);
        setHasDeadline(false);
        setDeadlineDate('');
        setDeadlineTime('23:59');
        onClose();
    };

    const isValid = question.trim().length > 0 && options.filter(o => o.trim()).length >= 2;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg mx-4 bg-card border border-border/60 rounded-3xl neo-shadow animate-in zoom-in-95 fade-in duration-300 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <BarChart3 size={20} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight">Tạo bình chọn</h3>
                            <p className="text-xs text-muted-foreground">Tạo khảo sát để lấy ý kiến nhóm</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-foreground transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    {/* Question */}
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                            Câu hỏi
                        </label>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Nhập câu hỏi bình chọn..."
                            className="w-full bg-background/60 border border-border/50 rounded-2xl px-4 py-3 text-sm font-medium placeholder:text-muted-foreground/40 focus:ring-2 ring-primary/20 focus:border-primary/30 outline-none transition-all resize-none"
                            rows={2}
                            maxLength={500}
                        />
                        <p className="text-[10px] text-muted-foreground/50 mt-1 text-right">{question.length}/500</p>
                    </div>

                    {/* Options */}
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                            Các lựa chọn ({options.length}/10)
                        </label>
                        <div className="space-y-2">
                            {options.map((option, index) => (
                                <div key={index} className="flex items-center gap-2 group">
                                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-black flex items-center justify-center flex-shrink-0">
                                        {index + 1}
                                    </span>
                                    <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => updateOption(index, e.target.value)}
                                        placeholder={`Lựa chọn ${index + 1}`}
                                        className="flex-1 bg-background/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm font-medium placeholder:text-muted-foreground/40 focus:ring-2 ring-primary/20 focus:border-primary/30 outline-none transition-all"
                                        maxLength={200}
                                    />
                                    {options.length > 2 && (
                                        <button
                                            onClick={() => removeOption(index)}
                                            className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {options.length < 10 && (
                            <button
                                onClick={addOption}
                                className="mt-2 flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition-all w-full justify-center border border-dashed border-primary/30"
                            >
                                <Plus size={14} />
                                Thêm lựa chọn
                            </button>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                            Cài đặt
                        </label>

                        {/* Multiple choice toggle */}
                        <button
                            onClick={() => setIsMultipleChoice(!isMultipleChoice)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-background/60 transition-all border border-border/30"
                        >
                            {isMultipleChoice ? (
                                <CheckSquare size={18} className="text-primary" />
                            ) : (
                                <Square size={18} className="text-muted-foreground" />
                            )}
                            <div className="text-left flex-1">
                                <p className="text-sm font-bold">Chọn nhiều đáp án</p>
                                <p className="text-[10px] text-muted-foreground">Cho phép chọn nhiều hơn 1 lựa chọn</p>
                            </div>
                        </button>

                        {/* Anonymous poll toggle */}
                        <button
                            onClick={() => setIsAnonymous(!isAnonymous)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-background/60 transition-all border border-border/30"
                        >
                            {isAnonymous ? (
                                <CheckSquare size={18} className="text-primary" />
                            ) : (
                                <Square size={18} className="text-muted-foreground" />
                            )}
                            <div className="text-left flex-1">
                                <p className="text-sm font-bold">Bình chọn ẩn danh</p>
                                <p className="text-[10px] text-muted-foreground">Không ai có thể xem bạn bầu cho phương án nào</p>
                            </div>
                        </button>

                        {/* Deadline toggle */}
                        <button
                            onClick={() => setHasDeadline(!hasDeadline)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-background/60 transition-all border border-border/30"
                        >
                            {hasDeadline ? (
                                <CheckSquare size={18} className="text-primary" />
                            ) : (
                                <Square size={18} className="text-muted-foreground" />
                            )}
                            <div className="text-left flex-1">
                                <p className="text-sm font-bold">Thời hạn bình chọn</p>
                                <p className="text-[10px] text-muted-foreground">Tự động đóng poll sau thời gian quy định</p>
                            </div>
                            <Clock size={16} className={cn("transition-colors", hasDeadline ? "text-primary" : "text-muted-foreground/40")} />
                        </button>

                        {/* Deadline datetime inputs */}
                        {hasDeadline && (
                            <div className="flex gap-2 pl-9 animate-in slide-in-from-top-2 fade-in duration-200">
                                <input
                                    type="date"
                                    value={deadlineDate}
                                    onChange={(e) => setDeadlineDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="flex-1 bg-background/60 border border-border/50 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 ring-primary/20 outline-none"
                                />
                                <input
                                    type="time"
                                    value={deadlineTime}
                                    onChange={(e) => setDeadlineTime(e.target.value)}
                                    className="w-28 bg-background/60 border border-border/50 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 ring-primary/20 outline-none"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40 bg-background/30">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground rounded-xl hover:bg-background/60 transition-all"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isValid}
                        className="px-6 py-2.5 text-sm font-bold bg-primary text-primary-foreground rounded-xl neo-shadow hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-40 disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-none"
                    >
                        Tạo bình chọn
                    </button>
                </div>
            </div>
        </div>
    );
};
