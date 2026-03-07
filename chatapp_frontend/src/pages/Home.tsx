import { useCallback, useEffect, useState } from 'react';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Navbar } from '@/components/Navbar';
import { MainLayout } from '@/layouts/MainLayout';
import FriendsPage from './FriendsPage';
import { connectWebSocket, disconnectWebSocket } from '@/services/websocketService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/common/lib/logger';

const HomePage = () => {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'chat' | 'friends'>('chat');

  // WebSocket connection
  useEffect(() => {
    if (!token) {
      logger.warn('No token found, cannot connect to WebSocket');
      return;
    }

    connectWebSocket(token)
      .catch((error: unknown) => {
        logger.error('WebSocket connection failed in HomePage:', error instanceof Error ? error.message : String(error));
      });

    return () => {
      disconnectWebSocket();
    };
  }, [token]);

  // Tab change handler
  const handleTabChange = useCallback((tab: 'chat' | 'friends') => {
    setActiveTab(tab);
  }, []);

  return (
    <MainLayout>
      <div className="flex h-full">
        <aside className="w-80 border-r border-border flex flex-col">
          <Navbar
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </aside>

        <main className="flex-1 flex flex-col">
          {activeTab === 'chat' && <ChatWindow />}
          {activeTab === 'friends' && <FriendsPage />}
        </main>
      </div>
    </MainLayout>
  );
};

export default HomePage;