import React, { useEffect } from 'react';
import { useMessenger, useMessengerSetup } from '@/features/messenger/model/useMessenger';
import { ChatSidebar } from '@/widgets/chat-sidebar/ChatSidebar';
import { ChatWindow } from '@/widgets/chat-window/ChatWindow';
import { ContactListView } from '@/features/relationships/components/Contacts/ContactListView';
import { Menu, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export const MessengerLayout: React.FC = () => {
    const {
        initMessenger,
        loading,
        error,
        activeView,
        activeConversationId,
        isSidebarOpen,
        setSidebarOpen,
    } = useMessenger();

    useMessengerSetup(initMessenger);

    useEffect(() => {
        if (activeConversationId && window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, [activeConversationId, setSidebarOpen]);

    if (loading && !error) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-20">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-foreground/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                <div className="flex flex-col items-center gap-4 z-10">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
                        Đang tải dữ liệu...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background p-6 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-destructive/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-destructive/5 rounded-full blur-[120px]" />
                </div>

                <div className="glass p-8 rounded-[2rem] neo-shadow border-destructive/20 text-center max-w-sm z-10">
                    <h2 className="text-xl font-black uppercase text-destructive mb-4">System Error</h2>
                    <p className="text-sm font-medium mb-6 text-muted-foreground">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-primary text-primary-foreground font-black uppercase rounded-xl neo-shadow"
                    >
                        Reboot System
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex bg-background overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0 opacity-20 dark:opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-foreground/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-primary/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="md:hidden fixed top-4 right-4 z-[60] w-12 h-12 glass rounded-2xl flex items-center justify-center neo-shadow text-primary"
            >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div
                className={cn(
                    'fixed inset-0 z-40 md:relative md:inset-auto md:flex transition-transform duration-300 ease-in-out',
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
                )}
            >
                <ChatSidebar />
            </div>

            <div className="flex-1 h-full overflow-hidden relative">
                {activeView === 'contacts' ? <ContactListView /> : <ChatWindow />}
            </div>
        </div>
    );
};

export default MessengerLayout;
