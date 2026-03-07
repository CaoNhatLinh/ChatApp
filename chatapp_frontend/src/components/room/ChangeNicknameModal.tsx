// src/components/room/ChangeNicknameModal.tsx

import { useState } from 'react';
import { X, User } from 'lucide-react';
import type { Conversation } from '@/types/conversation';

interface ChangeNicknameModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentNickname?: string;
  onSave: (nickname: string) => Promise<void>;
}

export const ChangeNicknameModal: React.FC<ChangeNicknameModalProps> = ({
  isOpen,
  onClose,
  conversation,
  currentNickname = '',
  onSave
}) => {
  const [nickname, setNickname] = useState(currentNickname);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim()) {
      setError('Biệt danh không được để trống');
      return;
    }

    if (nickname.length > 50) {
      setError('Biệt danh không được quá 50 ký tự');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave(nickname.trim());
      onClose();
    } catch (err) {
      setError('Có lỗi xảy ra khi đổi biệt danh');
      console.error('Error changing nickname:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNickname(currentNickname);
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Đổi biệt danh</h2>
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Biệt danh trong phòng "{conversation.name || conversation.conversationId}"
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nhập biệt danh mới..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                maxLength={50}
                disabled={loading}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-500">
                {nickname.length}/50 ký tự
              </span>
              {currentNickname && (
                <span className="text-xs text-gray-500">
                  Hiện tại: {currentNickname}
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-600 bg-opacity-20 border border-red-600 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="mb-4 p-3 bg-blue-600 bg-opacity-20 border border-blue-600 rounded-lg">
            <p className="text-blue-400 text-sm">
              💡 Biệt danh chỉ hiển thị trong phòng này và không ảnh hưởng đến tên của bạn ở nơi khác.
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3">
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
              disabled={loading || !nickname.trim() || nickname === currentNickname}
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
