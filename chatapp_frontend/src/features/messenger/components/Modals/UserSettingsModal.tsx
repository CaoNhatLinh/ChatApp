import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserCircle, Palette, Monitor, Moon, Sun, Camera, Save, LogOut, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '../../../../store/themeStore';
import { logout } from '@/api/authApi';
import { updateProfile } from '@/api/userApi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { presenceWsService } from '@/services/ws/presenceWsService';
import { disconnectWebSocket } from '@/services/websocketService';

interface UserSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'profile' | 'appearance';
}

type TabType = 'profile' | 'appearance';

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose, initialTab = 'profile' }) => {
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const { user, logout: logoutStore, updateUser } = useAuthStore();
    const { theme, setTheme } = useThemeStore();
    const navigate = useNavigate();

    // Profile State
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
    const [nickname, setNickname] = useState(user?.nickName || '');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSaveProfile = async () => {
        if (!displayName.trim()) {
            toast.error('Tên hiển thị không được để trống');
            return;
        }

        setIsSaving(true);
        try {
            const updatedUser = await updateProfile({
                displayName,
                avatarUrl,
                nickname
            });
            updateUser(updatedUser);
            toast.success('Cập nhật hồ sơ thành công!', {
                icon: '✅',
                style: {
                    borderRadius: '1rem',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                    fontWeight: 'bold'
                }
            });
        } catch (error) {
            console.error('Failed to update profile:', error);
            toast.error('Cập nhật thất bại. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            // Instant Presence Clean-up
            // 1. Tell backend to mark THIS session as offline immediately
            try {
                presenceWsService.sendLogout();
            } catch (e) {
                console.warn('Failed to send explicit logout:', e);
            }

            // 2. Clear server-side session
            await logout();

            // 3. Disconnect WebSocket cleanly
            disconnectWebSocket();

            // 4. Clear local state
            logoutStore();
            void navigate('/auth');
        } catch (error) {
            console.error('Logout failed:', error);
            // Fallback: still clear local state
            disconnectWebSocket();
            logoutStore();
            void navigate('/auth');
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/40 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-4xl h-[85vh] max-h-[850px] bg-card/60 glass rounded-[2.5rem] neo-shadow flex overflow-hidden animate-in zoom-in-95 duration-300 z-10">

                {/* Sidebar Menu */}
                <div className="w-64 border-r border-border/50 bg-background/30 flex flex-col hidden sm:flex">
                    <div className="p-6 pb-4">
                        <h2 className="text-xl font-black uppercase tracking-tight text-gradient mb-2">Cài đặt</h2>
                    </div>

                    <div className="flex-1 px-3 space-y-2">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${activeTab === 'profile'
                                ? 'bg-primary text-primary-foreground neo-shadow'
                                : 'hover:bg-primary/10 text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <UserCircle size={20} />
                            <span className="font-bold text-sm">Tài khoản & Hồ sơ</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('appearance')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${activeTab === 'appearance'
                                ? 'bg-primary text-primary-foreground neo-shadow'
                                : 'hover:bg-primary/10 text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Palette size={20} />
                            <span className="font-bold text-sm">Giao diện</span>
                        </button>
                    </div>

                    <div className="p-4 border-t border-border/50 mt-auto">
                        <button
                            onClick={() => void handleLogout()}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-destructive text-destructive hover:text-destructive-foreground transition-all neo-shadow active:scale-95 group"
                        >
                            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="font-bold text-sm uppercase tracking-widest">Đăng xuất</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-border/50 bg-background/20 sticky top-0 z-10">
                        <h3 className="text-lg font-black uppercase tracking-tight sm:hidden">
                            {activeTab === 'profile' ? 'Tài khoản' : 'Giao diện'}
                        </h3>
                        <div className="hidden sm:block"></div>

                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-primary/10 rounded-full transition-colors group"
                        >
                            <X size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
                        <div className="max-w-xl mx-auto animate-in slide-in-from-bottom-4 fade-in duration-300">
                            {activeTab === 'profile' && (
                                <div className="space-y-8">
                                    <div>
                                        <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Hồ sơ cá nhân</h1>
                                        <p className="text-muted-foreground text-sm font-medium">Quản lý cách mọi người nhìn thấy bạn trên nền tảng.</p>
                                    </div>

                                    <div className="flex items-center gap-6 p-6 rounded-3xl bg-background/40 border-2 border-border/50">
                                        <div className="relative group cursor-pointer" onClick={() => {
                                            const url = prompt('Nhập URL ảnh đại diện:', avatarUrl);
                                            if (url !== null) setAvatarUrl(url);
                                        }}>
                                            <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-background bg-primary/10 flex items-center justify-center neo-shadow transition-transform group-hover:scale-105">
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-4xl font-black text-primary uppercase">{user?.displayName?.charAt(0)}</span>
                                                )}
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Camera size={28} className="text-white" />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-bold text-lg">{user?.displayName}</p>
                                            <p className="text-primary font-bold tracking-widest uppercase text-xs">@{user?.userName}</p>
                                            <button
                                                className="mt-3 text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-4 py-2 rounded-xl transition-all"
                                                onClick={() => {
                                                    const url = prompt('Nhập URL ảnh đại diện:', avatarUrl);
                                                    if (url !== null) setAvatarUrl(url);
                                                }}
                                            >
                                                Thay đổi ảnh đại diện
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-2">Tên hiển thị</label>
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                className="w-full bg-background/50 border-2 border-border/50 rounded-2xl px-5 py-4 focus:border-primary focus:ring-0 transition-all font-bold outline-none"
                                                placeholder="Nhập tên hiển thị..."
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-2">Sinh nhật / Biệt danh (Nickname)</label>
                                            <input
                                                type="text"
                                                value={nickname}
                                                onChange={(e) => setNickname(e.target.value)}
                                                className="w-full bg-background/50 border-2 border-border/50 rounded-2xl px-5 py-4 focus:border-primary focus:ring-0 transition-all font-bold outline-none"
                                                placeholder="Biệt danh của bạn..."
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-2">Avatar URL (Thủ công)</label>
                                            <input
                                                type="text"
                                                value={avatarUrl}
                                                onChange={(e) => setAvatarUrl(e.target.value)}
                                                className="w-full bg-background/50 border-2 border-border/50 rounded-2xl px-5 py-4 focus:border-primary focus:ring-0 transition-all font-bold outline-none"
                                                placeholder="Link ảnh .jpg, .png..."
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 flex justify-end">
                                        <button
                                            onClick={() => void handleSaveProfile()}
                                            disabled={isSaving || (displayName === user?.displayName && nickname === user?.nickName && avatarUrl === user?.avatarUrl)}
                                            className="bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 neo-shadow"
                                        >
                                            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <><Save size={20} /><span>Lưu thay đổi</span></>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'appearance' && (
                                <div className="space-y-8">
                                    <div>
                                        <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Giao diện</h1>
                                        <p className="text-muted-foreground text-sm font-medium">Tuỳ chỉnh cách ứng dụng hiển thị theo sở thích của bạn.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <button onClick={() => setTheme('light')} className={`flex flex-col items-center gap-4 p-4 rounded-3xl border-2 transition-all ${theme === 'light' ? 'border-primary bg-primary/10' : 'border-border/50 bg-background/40 font-bold text-sm hover:border-primary/50'}`}>
                                            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-gray-200 flex items-center justify-center text-orange-500 shadow-sm"><Sun size={32} /></div>
                                            Sáng
                                        </button>
                                        <button onClick={() => setTheme('dark')} className={`flex flex-col items-center gap-4 p-4 rounded-3xl border-2 transition-all ${theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border/50 bg-background/40 font-bold text-sm hover:border-primary/50'}`}>
                                            <div className="w-16 h-16 rounded-2xl bg-gray-900 border-2 border-gray-700 flex items-center justify-center text-blue-400 shadow-sm"><Moon size={32} /></div>
                                            Tối
                                        </button>
                                        <button onClick={() => setTheme('system')} className={`flex flex-col items-center gap-4 p-4 rounded-3xl border-2 transition-all ${theme === 'system' ? 'border-primary bg-primary/10' : 'border-border/50 bg-background/40 font-bold text-sm hover:border-primary/50'}`}>
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white to-gray-900 border-2 border-gray-500 flex items-center justify-center text-gray-500 shadow-sm"><Monitor size={32} /></div>
                                            Hệ thống
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
