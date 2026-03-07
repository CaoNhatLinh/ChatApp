// src/components/room/NotificationSettingsModal.tsx

import { useState } from 'react';
import { X, Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import type { Conversation } from '@/types/conversation';

interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  mentions: boolean;
  directMessages: boolean;
  muteUntil?: string;
}

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentSettings?: NotificationSettings;
  onSave: (settings: NotificationSettings) => Promise<void>;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  conversation,
  currentSettings = {
    enabled: true,
    sound: true,
    desktop: true,
    mentions: true,
    directMessages: true
  },
  onSave
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(currentSettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      await onSave(settings);
      onClose();
    } catch (err) {
      setError('Có lỗi xảy ra khi lưu cài đặt');
      console.error('Error saving notification settings:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSettings(currentSettings);
      setError('');
      onClose();
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    if (key === 'muteUntil') return; // Handle separately
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleMuteOptions = (duration: string) => {
    const now = new Date();
    let muteUntil: string | undefined;

    switch (duration) {
      case '1h':
        muteUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
        break;
      case '8h':
        muteUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
        break;
      case '24h':
        muteUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'forever':
        muteUntil = '9999-12-31T23:59:59.999Z';
        break;
      case 'unmute':
      default:
        muteUntil = undefined;
        break;
    }

    setSettings(prev => ({
      ...prev,
      muteUntil,
      enabled: !muteUntil // Disable notifications when muted
    }));
  };

  const isMuted = settings.muteUntil && new Date(settings.muteUntil) > new Date();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Cài đặt thông báo</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Room Info */}
          <div className="mb-6 p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {conversation.name?.charAt(0)?.toUpperCase() || "C"}
              </div>
              <div>
                <h3 className="text-white font-medium">{conversation.name}</h3>
                <p className="text-gray-400 text-sm">
                  {conversation.type === 'group' ? 'Nhóm chat' : 'Tin nhắn trực tiếp'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Mute Options */}
          <div className="mb-6">
            <h3 className="text-white font-medium mb-3">Tắt tiếng nhanh</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleMuteOptions('1h')}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm transition-colors"
              >
                1 giờ
              </button>
              <button
                type="button"
                onClick={() => handleMuteOptions('8h')}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm transition-colors"
              >
                8 giờ
              </button>
              <button
                type="button"
                onClick={() => handleMuteOptions('24h')}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm transition-colors"
              >
                1 ngày
              </button>
              <button
                type="button"
                onClick={() => handleMuteOptions('forever')}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm transition-colors"
              >
                Vĩnh viễn
              </button>
            </div>
            {isMuted && (
              <button
                type="button"
                onClick={() => handleMuteOptions('unmute')}
                className="mt-2 w-full p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
              >
                Bỏ tắt tiếng
              </button>
            )}
          </div>

          {/* Notification Settings */}
          <div className="space-y-4">
            <h3 className="text-white font-medium">Chi tiết thông báo</h3>

            {/* Overall notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {settings.enabled ? (
                  <Bell className="w-5 h-5 text-green-500" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <p className="text-white text-sm">Nhận thông báo</p>
                  <p className="text-gray-400 text-xs">Bật/tắt tất cả thông báo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('enabled')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enabled ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            {/* Sound notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {settings.sound ? (
                  <Volume2 className="w-5 h-5 text-blue-500" />
                ) : (
                  <VolumeX className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <p className="text-white text-sm">Âm thanh</p>
                  <p className="text-gray-400 text-xs">Phát âm thanh khi có thông báo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('sound')}
                disabled={!settings.enabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.sound && settings.enabled ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.sound && settings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            {/* Desktop notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-white text-sm">Thông báo desktop</p>
                  <p className="text-gray-400 text-xs">Hiển thị popup trên màn hình</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('desktop')}
                disabled={!settings.enabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.desktop && settings.enabled ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.desktop && settings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-600 bg-opacity-20 border border-red-600 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
