import { memo, useState } from 'react';
import { ConversationList } from "@/components/conversation/ConversationList";
import { MessageCircle, Users, Settings, LogOut } from "lucide-react";
import { useAuthStore } from '@/store/authStore';
import NotificationList, { NotificationButton, useNotifications } from '@/components/notification/NotificationList';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

import { cn } from '@/lib/utils';
import { usePresenceStore } from '@/store/presenceStore';
import { StatusSelector, StatusDot } from '@/components/presence/StatusSelector';

interface NavbarProps {
  activeTab: 'chat' | 'friends';
  onTabChange: (tab: 'chat' | 'friends') => void;
}

const Navbar = memo(({ activeTab, onTabChange }: NavbarProps) => {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const [showNotifications, setShowNotifications] = useState(false);
  // no explicit open state; Radix manages dialog internally
  const {
    notifications,
    markAsRead,
    markAllAsRead
  } = useNotifications();

  const handleLogout = () => {
    logout();
  };

  const myStatus = usePresenceStore(state => state.myStatus);
  const isUserOnline = myStatus === 'ONLINE' || myStatus === 'DND';

  const handleConversationSelect = () => {
    if (activeTab !== 'chat') {
      onTabChange('chat');
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border shadow-sm ">
      <div className="p-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-lg">
              <MessageCircle className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold">ChatApp</h1>
              <p className="text-xs text-muted-foreground">Stay connected</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="p-3 border-b border-border">
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === 'chat' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onTabChange('chat')}
            className={cn("flex-1", activeTab !== 'chat' && "hover:bg-accent")}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            <span className="text-sm">Chats</span>
          </Button>

          <Button
            variant={activeTab === 'friends' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onTabChange('friends')}
            className={cn("flex-1", activeTab !== 'friends' && "hover:bg-accent")}
          >
            <Users className="w-4 h-4 mr-2" />
            <span className="text-sm">Friends</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-card">
        <ConversationList onConversationSelect={handleConversationSelect} />
      </div>

      <div className="bg-muted/30 border-t border-border p-3">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.avatarUrl} alt={user?.displayName || user?.userName} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {(user?.displayName || user?.userName || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <StatusDot
              status={usePresenceStore.getState().myStatus}
              isOnline={isUserOnline}
              size="md"
              className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {user?.displayName || user?.userName || "User"}
            </p>
            <div className="flex flex-col mt-0.5">
              <StatusSelector className="px-0 py-0 h-auto hover:bg-transparent justify-start -ml-1 text-xs" />
            </div>
          </div>

          <div className="flex space-x-1 relative">
            <div className="relative">
              <NotificationButton
                notifications={notifications}
                isOpen={showNotifications}
                onClick={() => setShowNotifications(!showNotifications)}
              />

              <NotificationList
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onNotificationClick={(_notification) => {
                  setShowNotifications(false);
                }}
              />
            </div>

            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export { Navbar };