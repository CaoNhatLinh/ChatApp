import React, { useState, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/shared/lib/cn';
import { Check, Clock, Lock, BarChart3, Users, XCircle } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { votePoll, closePoll, removePollVote } from '../../api/poll.api';
import type { PollData } from '../../types/messenger.types';
import { formatDistanceToNow, isPast } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';
import { notifyError, notifySuccess } from '@/shared/lib/notification';

interface PollCardProps {
    poll: PollData;
}

import { useMessengerStore } from '@/features/messenger/model/messenger.store';

export const PollCard: React.FC<PollCardProps> = ({ poll }) => {
    const { locale } = useAppLocale();
    const currentUser = useAuthStore(state => state.user);
    const updatePollData = useMessengerStore(state => state.updatePollData);
    const [selectedOptions, setSelectedOptions] = useState<string[]>(poll.currentUserVotes ?? []);
    const [isVoting, setIsVoting] = useState(false);
    const [localPoll, setLocalPoll] = useState(poll);

    // Ref-based guard to prevent double-click and protect state during async operations
    const isVotingRef = useRef(false);

    // Sync with prop when it changes (e.g. from websocket)
    React.useEffect(() => {
        setLocalPoll(prev => {
            const incomingVotes = poll.currentUserVotes;
            const newUserVotes = (incomingVotes !== undefined && incomingVotes !== null)
                ? incomingVotes
                : prev.currentUserVotes;

            return { ...poll, currentUserVotes: newUserVotes };
        });

        // CRITICAL FIX: Do NOT sync selectedOptions while a vote is in-flight.
        // The WebSocket aggregate broadcast arrives BEFORE the API response and would
        // reset the user's selection mid-vote, causing visual glitches and wrong counts.
        if (!isVotingRef.current && poll.currentUserVotes !== undefined && poll.currentUserVotes !== null) {
            setSelectedOptions(poll.currentUserVotes);
        }
    }, [poll, currentUser]);

    const isCreator = currentUser?.userId === localPoll.createdBy;
    const hasVoted = (localPoll.currentUserVotes?.length ?? 0) > 0;
    const isExpired = localPoll.expiresAt ? isPast(new Date(localPoll.expiresAt)) : false;
    const isClosed = localPoll.isClosed || isExpired;
    const hasAnyVotes = localPoll.totalVotes > 0;

    // Show results when: the current user has voted, OR poll is closed, OR anyone has voted
    // This ensures OTHER users can see vote progress in real-time even before they vote
    const showResults = hasVoted || isClosed || hasAnyVotes;

    // Sort options by vote count descending for display
    const sortedOptions = useMemo(() =>
        [...localPoll.options].sort((a, b) => b.voteCount - a.voteCount),
        [localPoll.options]
    );

    // Find the winning option(s)
    const maxVotes = useMemo(() =>
        Math.max(...localPoll.options.map(o => o.voteCount), 0),
        [localPoll.options]
    );

    const toggleOption = (option: string) => {
        if (isClosed) return;

        if (localPoll.isMultipleChoice) {
            setSelectedOptions(prev =>
                prev.includes(option)
                    ? prev.filter(o => o !== option)
                    : [...prev, option]
            );
        } else {
            setSelectedOptions(prev =>
                prev.includes(option) ? [] : [option]
            );
        }
    };

    const handleVote = useCallback(async () => {
        // Ref-based guard prevents double-click (setState is async and unreliable for this)
        if (selectedOptions.length === 0 || isClosed || isVotingRef.current) return;
        isVotingRef.current = true;
        setIsVoting(true);
        try {
            const selectedOptionIndexes = selectedOptions
                .map(option => localPoll.options.findIndex(candidate => candidate.option === option))
                .filter(index => index >= 0);
            const updatedPoll = await votePoll(localPoll.pollId, selectedOptionIndexes);

            // Update central store FIRST — this is the authoritative source
            updatePollData(localPoll.conversationId, updatedPoll);

            // Synchronize local state with fresh server data
            setSelectedOptions(updatedPoll.currentUserVotes ?? []);
            setLocalPoll(updatedPoll);
            notifySuccess(localizeText('Đã ghi nhận bình chọn.'));
        } catch (error: unknown) {
            logger.error('[PollCard] Vote failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể cập nhật bình chọn.')));
        } finally {
            isVotingRef.current = false;
            setIsVoting(false);
        }
    }, [selectedOptions, localPoll.pollId, localPoll.conversationId, localPoll.options, isClosed, updatePollData]);

    const handleRemoveVote = useCallback(async () => {
        if (isVotingRef.current) return;
        isVotingRef.current = true;
        setIsVoting(true);
        try {
            const updatedPoll = await removePollVote(localPoll.pollId);

            // Update central store
            updatePollData(localPoll.conversationId, updatedPoll);

            setSelectedOptions([]);
            setLocalPoll(updatedPoll);
            notifySuccess(localizeText('Đã hủy bình chọn.'));
        } catch (error: unknown) {
            logger.error('[PollCard] Remove vote failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể cập nhật bình chọn.')));
        } finally {
            isVotingRef.current = false;
            setIsVoting(false);
        }
    }, [localPoll.pollId, localPoll.conversationId, updatePollData]);

    const handleClosePoll = useCallback(async () => {
        try {
            const updatedPoll = await closePoll(localPoll.pollId);
            updatePollData(localPoll.conversationId, updatedPoll);
            setLocalPoll(updatedPoll);
            notifySuccess(localizeText('Đã đóng bình chọn.'));
        } catch (error: unknown) {
            logger.error('[PollCard] Close poll failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể cập nhật bình chọn.')));
        }
    }, [localPoll.pollId, localPoll.conversationId, updatePollData]);

    return (
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-border/60 bg-card">
            {/* Poll Header */}
            <div className="relative px-5 pb-3 pt-5">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <BarChart3 size={14} />
                        <span>{localizeText('Bình chọn')}</span>
                    </div>
                    <h4 className="text-base font-bold leading-snug text-foreground">
                        {localPoll.question}
                    </h4>
                </div>

                <div className="flex flex-wrap items-center gap-1 mt-3">
                    <div className={cn(
                        "rounded-md border px-2 py-1 text-[11px] font-medium",
                        localPoll.isMultipleChoice
                            ? "bg-blue-500/5 text-blue-500 border-blue-500/10"
                            : "bg-primary/5 text-primary border-primary/10"
                    )}>
                        {localizeText(localPoll.isMultipleChoice ? 'Nhiều lựa chọn' : 'Một lựa chọn')}
                    </div>

                    {localPoll.expiresAt && (
                        <div className={cn(
                            "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium",
                            isExpired
                                ? "bg-destructive/5 text-destructive border-destructive/10"
                                : "bg-amber-500/5 text-amber-500 border-amber-500/10"
                        )}>
                            <Clock size={11} />
                            {isExpired ? localizeText('Hết hạn') : formatDistanceToNow(new Date(localPoll.expiresAt), { locale: locale === 'en' ? enUS : vi, addSuffix: true })}
                        </div>
                    )}

                    {isClosed && !isExpired && (
                        <div className="flex items-center gap-1 rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                            <Lock size={11} /> {localizeText('Đã đóng')}
                        </div>
                    )}
                </div>
            </div>

            {/* Options List */}
            <div className="px-4 py-2 space-y-1">
                {sortedOptions.map((option) => {
                    const isSelected = selectedOptions.includes(option.option);
                    const isUserVoted = (localPoll.currentUserVotes ?? []).includes(option.option);
                    const isWinning = option.voteCount === maxVotes && maxVotes > 0;

                    return (
                        <button
                            type="button"
                            key={option.option}
                            onClick={() => toggleOption(option.option)}
                            disabled={isClosed}
                            aria-pressed={isSelected}
                            className={cn(
                                "w-full relative overflow-hidden rounded-lg transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 text-left border",
                                isClosed ? "cursor-default" : "cursor-pointer active:scale-[0.99]",
                                isSelected && !isClosed ? "border-primary/40 bg-primary/5" : "border-border/10 hover:border-primary/20 bg-background/20",
                                isUserVoted && "ring-1 ring-inset ring-primary/20"
                            )}
                        >
                            {/* Simple progress bar */}
                            <div
                                className={cn(
                                    "absolute inset-y-0 left-0 transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-700 ease-out",
                                    isWinning && showResults ? "bg-primary/15" : "bg-primary/5"
                                )}
                                style={{ width: `${showResults ? option.percentage : 0}%` }}
                            />

                            <div className="relative flex items-center justify-between gap-3 px-3 py-2.5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-300",
                                        isSelected || isUserVoted
                                            ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                            : "border-border/60 bg-background/60"
                                    )}>
                                        {(isSelected || isUserVoted) && <Check size={10} strokeWidth={4} />}
                                    </div>
                                    <span className={cn(
                                        "truncate text-sm font-semibold transition-colors duration-200",
                                        isWinning && showResults ? "text-primary font-bold" : "text-foreground/85"
                                    )}>
                                        {option.option}
                                    </span>
                                </div>
                                {showResults && (
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                                            {option.voteCount}
                                        </span>
                                        <span className={cn(
                                            "text-xs font-bold tabular-nums",
                                            isWinning ? "text-primary" : "text-muted-foreground/80"
                                        )}>
                                            {option.percentage.toFixed(0)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Voting mode and secondary labels */}
            <div className="px-5 pb-2 flex flex-wrap items-center gap-1.5 grayscale-[0.5] opacity-60">
                <div className={cn(
                    "rounded-md border px-2 py-1 text-[11px] font-medium",
                    localPoll.isAnonymous
                        ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        : "bg-green-500/10 text-green-500 border-green-500/20"
                )}>
                    {localizeText(localPoll.isAnonymous ? 'Bình chọn ẩn danh' : 'Bình chọn công khai')}
                </div>
            </div>

            {/* Compact Footer */}
            <div className="px-5 py-2.5 border-t border-border/10 flex items-center justify-between bg-muted/5">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Users size={13} />
                        {localizeText(`${localPoll.totalVotes} phiếu`)}
                    </div>

                </div>

                <div className="flex items-center gap-2">
                    {hasVoted && !isClosed && (
                        <button
                            type="button"
                            onClick={() => void handleRemoveVote()}
                            disabled={isVoting}
                            aria-label={localizeText('Hủy phiếu')}
                            className="grid size-8 place-items-center rounded-md text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title={localizeText('Hủy phiếu')}
                        >
                            <XCircle size={16} />
                        </button>
                    )}

                    {!isClosed && selectedOptions.length > 0 && (
                        <button
                            type="button"
                            onClick={() => void handleVote()}
                            disabled={isVoting}
                            className="min-h-8 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground transition-opacity disabled:opacity-40"
                        >
                            {isVoting ? '...' : hasVoted ? localizeText('Đổi') : localizeText('Gửi')}
                        </button>
                    )}

                    {isCreator && !isClosed && (
                        <button
                            type="button"
                            onClick={() => void handleClosePoll()}
                            aria-label={localizeText('Đóng bình chọn')}
                            className="grid size-8 place-items-center rounded-md text-amber-600 transition-colors hover:bg-amber-500/10"
                            title={localizeText('Đóng bình chọn')}
                        >
                            <Lock size={16} />
                        </button>
                    )}
                </div>
            </div>

        </div>
    );
};

