import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMessenger, useMessengerSetup } from "@/features/messenger/model/useMessenger";
import { useRouter, useSearchParams } from "next/navigation";
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { ConversationEntryState } from './components/ConversationEntryState';
import { ChatSidebar } from "@/widgets/chat-sidebar/ChatSidebar";
import { ChatWindow } from "@/widgets/chat-window/ChatWindow";
import { ContactListView } from "@/features/relationships/components/Contacts/ContactListView";
import { CreateRoomModal } from "@/features/messenger/components/Modals/CreateRoomModal";
import { MessengerErrorState } from "@/widgets/messenger-layout/components/MessengerErrorState";
import { MessengerLoadingState } from "@/widgets/messenger-layout/components/MessengerLoadingState";
import { MessengerLayoutShell } from "@/widgets/messenger-layout/components/MessengerLayoutShell";
import { AppNavigationRail } from "@/route-pages/shared/layout/AppNavigationRail";

export const MessengerLayout: React.FC = () => {
  const {
    initMessenger,
    loading,
    error,
    activeView,
    activeConversationId,
    selectConversation,
    isSidebarOpen,
    setSidebarOpen,
    setActiveView,
  } = useMessenger();
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const router = useRouter();
  const handledQuery = useRef<string | null | undefined>(undefined);
  const sidebar = useRef<HTMLDivElement>(null);
  const isInitialized = useMessengerStore(state => state.isInitialized);
  const conversationEntry = useMessengerStore(state => state.conversationEntry);
  const hasActiveConversation = useMessengerStore(state => state.conversations.some(room => room.conversationId === state.activeConversationId));

  useMessengerSetup(initMessenger);
  const searchParams = useSearchParams();
  const conversationIdFromQuery = searchParams.get("conversationId");
  const isNotificationInboxRequested = searchParams.get("notifications") === "1";
  const isCreateRoomRequested = searchParams.get("createRoom") === "1";

  const openChatList = useCallback(() => {
    setActiveView("chat");
    setSidebarOpen(true);
  }, [setActiveView, setSidebarOpen]);

  const openCreateRoom = useCallback(() => {
    setIsCreateRoomOpen(true);
  }, []);

  useEffect(() => {
    if (isCreateRoomRequested) {
      setIsCreateRoomOpen(true);
    }
  }, [isCreateRoomRequested]);

  useEffect(() => {
    if (isNotificationInboxRequested && window.innerWidth < 768) {
      setSidebarOpen(true);
      return;
    }
    if ((activeConversationId || activeView === "contacts") && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [activeConversationId, activeView, isNotificationInboxRequested, setSidebarOpen]);

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 767px)');
    const closeSidebarOnMobile = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      if (isNotificationInboxRequested) {
        setSidebarOpen(true);
      } else if (activeConversationId || activeView === "contacts") {
        setSidebarOpen(false);
      }
    };
    mobileViewport.addEventListener('change', closeSidebarOnMobile);
    return () => mobileViewport.removeEventListener('change', closeSidebarOnMobile);
  }, [activeConversationId, activeView, isNotificationInboxRequested, setSidebarOpen]);

  useEffect(() => {
    if (!isInitialized || loading) return;
    if (handledQuery.current !== conversationIdFromQuery) {
      handledQuery.current = conversationIdFromQuery;
      if (conversationIdFromQuery && conversationIdFromQuery !== activeConversationId) void selectConversation(conversationIdFromQuery);
      return;
    }
    // A handled deep link must not keep selecting its room after the user leaves it.
    if (conversationIdFromQuery && conversationIdFromQuery !== activeConversationId) {
      const query = new URLSearchParams(searchParams.toString());
      if (activeConversationId) query.set('conversationId', activeConversationId);
      else query.delete('conversationId');
      query.delete('messageId');
      router.replace(`/app${query.size ? `?${query}` : ''}`, { scroll: false });
    }
  }, [conversationIdFromQuery, activeConversationId, selectConversation, isInitialized, loading, router, searchParams]);

  const leaveEntry = () => {
    void selectConversation(null);
    setSidebarOpen(true);
    requestAnimationFrame(() => sidebar.current?.querySelector('input')?.focus({ preventScroll: true }));
  };

  if (loading && !error) {
    return <MessengerLoadingState />;
  }

  if (error) {
    return <MessengerErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <>
      <MessengerLayoutShell
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileSidebarFullScreen={!activeConversationId && activeView !== "contacts"}
        showMobileMenu={!activeConversationId}
        navigationRail={(
          <AppNavigationRail
            activeTarget={activeView === "contacts" ? "/friends" : "/app"}
            onCreateRoom={openCreateRoom}
            onOpenChatList={openChatList}
          />
        )}
        sidebar={<div ref={sidebar} className="h-full"><ChatSidebar /></div>}
      >
        {activeView === "contacts" ? <ContactListView /> : activeConversationId && !hasActiveConversation
          ? <ConversationEntryState entry={conversationEntry?.conversationId === activeConversationId ? conversationEntry : null}
            onRetry={() => void selectConversation(activeConversationId)} onBack={leaveEntry} />
          : <ChatWindow />}
      </MessengerLayoutShell>
      <CreateRoomModal isOpen={isCreateRoomOpen} onClose={() => setIsCreateRoomOpen(false)} />
    </>
  );
};

export default MessengerLayout;
