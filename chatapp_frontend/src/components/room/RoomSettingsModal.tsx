// src/components/room/RoomSettingsModal.tsx

import React, { useState, useEffect } from 'react';
import { X, Upload, Users, Settings, Save } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { Conversation } from '@/types/conversation';
import type { RoomSettings } from '@/types/roomActions';

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onSave: (settings: Partial<RoomSettings>) => Promise<void>;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  conversation,
  onSave
}) => {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<Partial<RoomSettings>>({
    name: conversation.name,
    description: conversation.description || '',
    backgroundUrl: conversation.backgroundUrl || '',
  });
  const [loading, setSaving] = useState(false);
  const [backgroundPreview, setBackgroundPreview] = useState<string>('');

  const isAdmin = conversation.createdBy === user?.userId;

  useEffect(() => {
    if (isOpen) {
      setSettings({
        name: conversation.name,
        description: conversation.description || '',
        backgroundUrl: conversation.backgroundUrl || '',
      });
      setBackgroundPreview(conversation.backgroundUrl || '');
    }
  }, [isOpen, conversation]);

  const handleSave = async () => {
    if (!isAdmin) return;

    setSaving(true);
    try {
      await onSave(settings);
      onClose();
    } catch (error) {
      console.error('Error saving room settings:', error instanceof Error ? error.message : error);
    } finally {
      setSaving(false);
    }
  };

  const handleBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setBackgroundPreview(dataUrl);
        setSettings(prev => ({ ...prev, backgroundUrl: dataUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Room Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Room Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room Name
            </label>
            <input
              type="text"
              value={settings.name || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
              disabled={!isAdmin}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              placeholder="Enter room name..."
            />
          </div>

          {/* Room Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={settings.description || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
              disabled={!isAdmin}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
              placeholder="Enter room description..."
            />
          </div>

          {/* Background Image */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Background Image
            </label>

            {/* Current/Preview Background */}
            {backgroundPreview && (
              <div className="mb-3 relative">
                <img
                  src={backgroundPreview}
                  alt="Background preview"
                  className="w-full h-32 object-cover rounded-lg"
                />
                {isAdmin && (
                  <button
                    onClick={() => {
                      setBackgroundPreview('');
                      setSettings(prev => ({ ...prev, backgroundUrl: '' }));
                    }}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {isAdmin && (
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Upload Background</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                    className="hidden"
                  />
                </label>

                <input
                  type="text"
                  value={settings.backgroundUrl || ''}
                  onChange={(e) => {
                    setSettings(prev => ({ ...prev, backgroundUrl: e.target.value }));
                    setBackgroundPreview(e.target.value);
                  }}
                  placeholder="Or paste image URL..."
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Member Count Display */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Members
            </label>
            <div className="flex items-center space-x-2 text-gray-400">
              <Users className="w-4 h-4" />
              <span>{conversation.memberCount || 0} members</span>
            </div>
          </div>

          {!isAdmin && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">
                Only room administrators can modify these settings.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {isAdmin && (
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
