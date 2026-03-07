import React, { useState, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/common/lib/utils';
import { Check, Clock, Lock, BarChart3, Users, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { votePoll, closePoll, removePollVote } from '../../api/poll.api';
import type { PollData } from '../../types/messenger.types';
import { formatDistanceToNow, isPast } from 'date-fns';
import { vi } from 'date-fns/locale';

interface PollCardProps {
    poll: PollData;
    onUpdate?: (updatedPoll: PollData) => void;
}

import { useMessengerStore } from '@/store/messengerStore';

export const PollCard: React.FC<PollCardProps> = ({ poll, onUpdate: _onUpdate }) => {
    const currentUser = useAuthStore(state => state.user);
    const updatePollData = useMessengerStore(state => state.updatePollData);
    const [selectedOptions, setSelectedOptions] = useState<string[]>(poll.currentUserVotes ?? []);
    const [isVoting, setIsVoting] = useState(false);
    const [showVoters, setShowVoters] = useState(false);
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
            const updatedPoll = await votePoll(localPoll.pollId, selectedOptions);

            // Update central store FIRST — this is the authoritative source
            updatePollData(localPoll.conversationId, updatedPoll);

            // Synchronize local state with fresh server data
            setSelectedOptions(updatedPoll.currentUserVotes ?? []);
            setLocalPoll(updatedPoll);
        } catch (err) {
            console.error('[PollCard] Vote failed:', err);
        } finally {
            isVotingRef.current = false;
            setIsVoting(false);
        }
    }, [selectedOptions, localPoll.pollId, localPoll.conversationId, isClosed, updatePollData]);

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
        } catch (err) {
            console.error('[PollCard] Remove vote failed:', err);
        } finally {
            isVotingRef.current = false;
            setIsVoting(false);
        }
    }, [localPoll.pollId, localPoll.conversationId, updatePollData]);

    const handleClosePoll = useCallback(async () => {
        try {
            await closePoll(localPoll.pollId);
            setLocalPoll(prev => ({ ...prev, isClosed: true }));
        } catch (err) {
            console.error('[PollCard] Close poll failed:', err);
        }
    }, [localPoll.pollId]);

    return (
        <div className="w-full max-w-md bg-card/70 backdrop-blur-xl border border-border/40 rounded-xl overflow-hidden transition-all duration-300 hover:border-primary/20 neo-shadow group/poll">
            {/* Poll Header */}
            <div className="relative px-5 pt-5 pb-3 bg-gradient-to-b from-primary/5 to-transparent">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BarChart3 size={14} className="text-primary/70" />
                            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-primary/60">
                                Bình chọn
                            </span>
                        </div>
                        <span className="text-[8px] font-bold text-muted-foreground/50 uppercase">
                            Tạo bởi {localPoll.createdByUsername || 'Hệ thống'}
                        </span>
                    </div>
                    <h4 className="text-sm font-bold leading-tight text-foreground/90">
                        {localPoll.question}
                    </h4>
                </div>

                <div className="flex flex-wrap items-center gap-1 mt-3">
                    <div className={cn(
                        "px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase border transition-all",
                        localPoll.isMultipleChoice
                            ? "bg-blue-500/5 text-blue-500 border-blue-500/10"
                            : "bg-primary/5 text-primary border-primary/10"
                    )}>
                        {localPoll.isMultipleChoice ? 'Nhiều lựa chọn' : 'Một lựa chọn'}
                    </div>

                    {localPoll.expiresAt && (
                        <div className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase border",
                            isExpired
                                ? "bg-destructive/5 text-destructive border-destructive/10"
                                : "bg-amber-500/5 text-amber-500 border-amber-500/10"
                        )}>
                            <Clock size={8} />
                            {isExpired ? 'Hết hạn' : formatDistanceToNow(new Date(localPoll.expiresAt), { locale: vi, addSuffix: true })}
                        </div>
                    )}

                    {isClosed && !isExpired && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase bg-muted/20 text-muted-foreground border border-border/20">
                            <Lock size={8} /> Đã đóng
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
                            key={option.option}
                            onClick={() => toggleOption(option.option)}
                            disabled={isClosed}
                            className={cn(
                                "w-full relative overflow-hidden rounded-lg transition-all duration-200 text-left border",
                                isClosed ? "cursor-default" : "cursor-pointer active:scale-[0.99]",
                                isSelected && !isClosed ? "border-primary/40 bg-primary/5" : "border-border/10 hover:border-primary/20 bg-background/20",
                                isUserVoted && "ring-1 ring-inset ring-primary/20"
                            )}
                        >
                            {/* Simple progress bar */}
                            <div
                                className={cn(
                                    "absolute inset-y-0 left-0 transition-all duration-700 ease-out",
                                    isWinning && showResults ? "bg-primary/15" : "bg-primary/5"
                                )}
                                style={{ width: `${showResults ? option.percentage : 0}%` }}
                            />

                            <div className="relative flex items-center justify-between gap-3 px-3 py-2.5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border transition-all duration-300",
                                        isSelected || isUserVoted
                                            ? "bg-primary border-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                                            : "border-border/60 bg-background/60"
                                    )}>
                                        {(isSelected || isUserVoted) && <Check size={10} strokeWidth={4} />}
                                    </div>
                                    <span className={cn(
                                        "text-[12.5px] font-semibold tracking-tight truncate transition-colors duration-200",
                                        isWinning && showResults ? "text-primary font-bold" : "text-foreground/85"
                                    )}>
                                        {option.option}
                                    </span>
                                </div>
                                {showResults && (
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                        <span className="text-[9px] font-bold text-muted-foreground/60 tabular-nums">
                                            {option.voteCount}
                                        </span>
                                        <span className={cn(
                                            "text-[9px] font-black tabular-nums",
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
                    "px-1.5 py-0.5 rounded-[4px] text-[7px] font-bold uppercase border transition-all",
                    localPoll.isAnonymous
                        ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        : "bg-green-500/10 text-green-500 border-green-500/20"
                )}>
                    {localPoll.isAnonymous ? 'Bình chọn ẩn danh' : 'Bình chọn công khai'}
                </div>
            </div>

            {/* Compact Footer */}
            <div className="px-5 py-2.5 border-t border-border/10 flex items-center justify-between bg-muted/5">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                        <Users size={9} />
                        {localPoll.totalVotes} PHIẾU
                    </div>

                    {localPoll.totalVotes > 0 && (
                        <button
                            onClick={() => setShowVoters(!showVoters)}
                            className="text-[8px] font-black text-primary/70 hover:text-primary uppercase tracking-tighter"
                        >
                            {showVoters ? 'ẨN' : 'CHI TIẾT'}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {hasVoted && !isClosed && (
                        <button
                            onClick={() => void handleRemoveVote()}
                            disabled={isVoting}
                            className="p-1 hover:bg-destructive/5 rounded transition-colors text-destructive/40 hover:text-destructive"
                            title="Hủy phiếu"
                        >
                            <XCircle size={12} />
                        </button>
                    )}

                    {!isClosed && selectedOptions.length > 0 && (
                        <button
                            onClick={() => void handleVote()}
                            disabled={isVoting}
                            className="px-3 py-1 text-[9px] font-black uppercase bg-primary text-primary-foreground rounded-md shadow-sm hover:shadow active:scale-95 transition-all disabled:opacity-40"
                        >
                            {isVoting ? '...' : hasVoted ? 'ĐỔI' : 'GỬI'}
                        </button>
                    )}

                    {isCreator && !isClosed && (
                        <button
                            onClick={() => void handleClosePoll()}
                            className="p-1 hover:bg-amber-500/5 rounded transition-colors text-amber-500/60 hover:text-amber-500"
                            title="Đóng poll"
                        >
                            <Lock size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Voter Details Area */}
            {showVoters && (
                <div className="px-4 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="bg-background/10 rounded-xl p-1.5 space-y-1">
                        {sortedOptions.filter(o => o.voteCount > 0).map(option => (
                            <div key={option.option} className="flex flex-col gap-1.5 p-2 border-b border-border/5 last:border-0 bg-muted/5 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-foreground/80">{option.option}</span>
                                    <span className="text-[9px] font-black tabular-nums text-primary/60">{option.voteCount} PHIẾU</span>
                                </div>
                                {!localPoll.isAnonymous && option.voterNames && option.voterNames.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {option.voterNames.map((name, i) => (
                                            <span
                                                key={i}
                                                className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[8px] font-bold"
                                            >
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
