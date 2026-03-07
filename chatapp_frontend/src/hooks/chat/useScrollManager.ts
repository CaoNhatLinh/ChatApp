// src/hooks/chat/useScrollManager.ts
// Extracted from MessageList.tsx - scroll position management and auto-scroll

import { useRef, useState, useEffect, useCallback } from 'react';

interface UseScrollManagerOptions {
    /** Total message count - triggers scroll decisions */
    messageCount: number;
    /** True when loading older messages (infinite scroll upward) */
    isLoadingOlder: boolean;
    /** True when initial fetch is in progress */
    isLoading: boolean;
    /** True when initial data has been loaded */
    isInitialLoadComplete: boolean;
}

interface UseScrollManagerReturn {
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    messagesContainerRef: React.RefObject<HTMLDivElement | null>;
    isLoadingOlder: boolean;
    setIsLoadingOlder: React.Dispatch<React.SetStateAction<boolean>>;
    isInitialLoadComplete: boolean;
    setIsInitialLoadComplete: React.Dispatch<React.SetStateAction<boolean>>;
    userHasScrolled: boolean;
    setUserHasScrolled: React.Dispatch<React.SetStateAction<boolean>>;
    scrollToBottom: (smooth: boolean) => void;
}

export function useScrollManager(options: UseScrollManagerOptions): UseScrollManagerReturn {
    const { messageCount, isLoadingOlder: initialLoadingOlder, isInitialLoadComplete: initialLoadComplete } = options;
    const [isLoadingOlder, setIsLoadingOlder] = useState(initialLoadingOlder);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(initialLoadComplete);
    const [userHasScrolled, setUserHasScrolled] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const lastMessageCount = useRef(messageCount);

    const scrollToBottom = useCallback((smooth: boolean) => {
        messagesEndRef.current?.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            block: 'end',
        });
    }, []);

    // Auto-scroll when new messages arrive
    useEffect(() => {
        if (isLoadingOlder) return;
        if (messageCount > lastMessageCount.current) {
            const container = messagesContainerRef.current;
            if (container) {
                const isNearBottom =
                    container.scrollHeight - container.scrollTop - container.clientHeight < 300;

                if (lastMessageCount.current === 0 || isNearBottom) {
                    setTimeout(() => scrollToBottom(true), 100);
                }
            }
        }
        lastMessageCount.current = messageCount;
    }, [messageCount, isLoadingOlder, scrollToBottom]);

    return {
        messagesEndRef,
        messagesContainerRef,
        isLoadingOlder,
        setIsLoadingOlder,
        isInitialLoadComplete,
        setIsInitialLoadComplete,
        userHasScrolled,
        setUserHasScrolled,
        scrollToBottom,
    };
}
