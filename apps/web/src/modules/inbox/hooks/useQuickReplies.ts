import { useState } from 'react';
import type { QuickReplyItem } from '../types.js';
import { MOCK_QUICK_REPLIES } from '../mockData.js';

const STORAGE_KEY_QUICK_REPLIES = 'polarisx_crm_quick_replies_v1';

export const useQuickReplies = () => {
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_QUICK_REPLIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return MOCK_QUICK_REPLIES;
  });

  const [isQuickReplyModalOpen, setIsQuickReplyModalOpen] = useState(false);

  const handleSaveQuickReplies = (replies: QuickReplyItem[]) => {
    setQuickReplies(replies);
    try {
      localStorage.setItem(STORAGE_KEY_QUICK_REPLIES, JSON.stringify(replies));
    } catch { }
  };

  return {
    quickReplies,
    isQuickReplyModalOpen,
    setIsQuickReplyModalOpen,
    handleSaveQuickReplies,
  };
};

