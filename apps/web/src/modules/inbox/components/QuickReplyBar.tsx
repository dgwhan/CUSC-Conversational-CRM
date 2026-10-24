import React from 'react';
import { Zap } from 'lucide-react';
import type { QuickReplyItem } from '../types.js';

export interface QuickReplyBarProps {
  replies: QuickReplyItem[];
  onSelect: (content: string) => void;
}

export const QuickReplyBar: React.FC<QuickReplyBarProps> = ({ replies, onSelect }) => {
  return (
    <div className="quick-reply-bar">
      <div className="quick-reply-label">
        <Zap size={14} className="zap-icon" />
        <span>Trả lời nhanh:</span>
      </div>
      <div className="quick-reply-scroll">
        {replies.map((item) => (
          <button
            key={item.id}
            type="button"
            className="quick-reply-chip"
            onClick={() => onSelect(item.content)}
            title={item.content}
          >
            <span className="chip-text">{item.label}</span>
            {item.shortcut && <span className="chip-shortcut">{item.shortcut}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};
