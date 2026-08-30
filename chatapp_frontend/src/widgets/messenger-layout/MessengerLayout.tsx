import React, { useEffect } from "react";
import { useMessenger, useMessengerSetup } from "@/features/messenger/model/useMessenger";
import { useSearchParams } from "next/navigation";
import { ChatSidebar } from "@/widgets/chat-sidebar/ChatSidebar";
import { ChatWindow } from "@/widgets/chat-window/ChatWindow";
import { ContactListView } from "@/features/relationships/components/Contacts/ContactListView";
import { MessengerErrorState } from "@/widgets/messenger-layout/components/MessengerErrorState";
import { MessengerLoadingState } from "@/widgets/messenger-layout/components/MessengerLoadingState";
import { MessengerLayoutShell } from "@/widgets/messenger-layout/components/MessengerLayoutShell";
import { WorkspaceNavigationRail } from "@/widgets/messenger-layout/components/WorkspaceNavigationRail";

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
  } = useMessenger();

  useMessengerSetup(initMessenger);
  const searchParams = useSearchParams();
  const conversationIdFromQuery = searchParams.get("conversationId");
  const isNotificationInboxRequested = searchParams.get("notifications") === "1";

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
    <MessengerLayoutShell
      isSidebarOpen={isSidebarOpen}
      setSidebarOpen={setSidebarOpen}
      mobileSidebarFullScreen={!activeConversationId && activeView !== "contacts"}
      showMobileMenu={!activeConversationId}
      navigationRail={<WorkspaceNavigationRail />}
      sidebar={<ChatSidebar />}
    >
      {activeView === "contacts" ? <ContactListView /> : <ChatWindow />}
    </MessengerLayoutShell>
  );
};

export default MessengerLayout;
