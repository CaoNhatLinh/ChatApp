import React, { useCallback, useEffect, useState } from "react";
import { useMessenger, useMessengerSetup } from "@/features/messenger/model/useMessenger";
import { useSearchParams } from "next/navigation";
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

  useMessengerSetup(initMessenger);
  const searchParams = useSearchParams();
  const conversationIdFromQuery = searchParams.get("conversationId");
  const isNotificationInboxRequested = searchParams.get("notifications") === "1";
  const isCreateRoomRequested = searchParams.get("createRoom") === "1";

  const openChatList = useCallback(() => {
    setActiveView("chat");
    setSidebarOpen(true);
  }, [setActiveView, setSidebarOpen]);

  const openFriendsList = useCallback(() => {
    setActiveView("contacts");
    setSidebarOpen(window.innerWidth >= 768);
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
    if (conversationIdFromQuery && conversationIdFromQuery !== activeConversationId) {
      void selectConversation(conversationIdFromQuery);
    }
  }, [conversationIdFromQuery, activeConversationId, selectConversation]);

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
            onOpenFriendsList={openFriendsList}
          />
        )}
        sidebar={<ChatSidebar />}
      >
        {activeView === "contacts" ? <ContactListView /> : <ChatWindow />}
      </MessengerLayoutShell>
      <CreateRoomModal isOpen={isCreateRoomOpen} onClose={() => setIsCreateRoomOpen(false)} />
    </>
  );
};

export default MessengerLayout;
