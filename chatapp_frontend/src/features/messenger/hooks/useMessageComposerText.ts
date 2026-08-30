import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_MESSAGE_CONTENT_LENGTH } from '@/features/messenger/constants/messageLimits';
import { readMessageDraft, writeMessageDraft } from '@/features/messenger/model/messageDraftStorage';

interface MessageComposerTextOptions {
  userId?: string;
  conversationId?: string;
  editingContent?: string;
}

interface MessageComposerTextState {
  text: string;
  draftText: string;
  updateText: (nextText: string) => boolean;
  clearDraft: () => void;
  clearEditingText: () => void;
}

export const useMessageComposerText = ({
  userId,
  conversationId,
  editingContent,
}: MessageComposerTextOptions): MessageComposerTextState => {
  const [draftText, setDraftText] = useState(() => readMessageDraft(userId, conversationId));
  const [editingText, setEditingText] = useState(() => editingContent ?? '');
  const latestDraftTextRef = useRef(draftText);
  latestDraftTextRef.current = draftText;

  useEffect(() => {
    if (editingContent !== undefined) setEditingText(editingContent);
  }, [editingContent]);

  useEffect(() => {
    if (!userId || !conversationId) return;
    const persistDraftTimeout = setTimeout(() => {
      writeMessageDraft(userId, conversationId, draftText);
    }, 300);
    return () => clearTimeout(persistDraftTimeout);
  }, [conversationId, draftText, userId]);

  useEffect(() => {
    return () => {
      if (userId && conversationId) {
        writeMessageDraft(userId, conversationId, latestDraftTextRef.current);
      }
    };
  }, [conversationId, userId]);

  const updateText = useCallback((nextText: string): boolean => {
    if (nextText.length > MAX_MESSAGE_CONTENT_LENGTH) return false;
    if (editingContent !== undefined) {
      setEditingText(nextText);
    } else {
      latestDraftTextRef.current = nextText;
      setDraftText(nextText);
    }
    return true;
  }, [editingContent]);

  const clearDraft = useCallback(() => {
    latestDraftTextRef.current = '';
    if (userId && conversationId) writeMessageDraft(userId, conversationId, '');
    setDraftText('');
  }, [conversationId, userId]);

  const clearEditingText = useCallback(() => setEditingText(''), []);

  return {
    text: editingContent === undefined ? draftText : editingText,
    draftText,
    updateText,
    clearDraft,
    clearEditingText,
  };
};
