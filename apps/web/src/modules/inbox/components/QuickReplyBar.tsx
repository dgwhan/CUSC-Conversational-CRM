import React from 'react';
import { Zap, Settings } from 'lucide-react';
import type { QuickReplyItem } from '../types.js';

export interface QuickReplyBarProps {
  replies: QuickReplyItem[];
  onSelect: (content: string) => void;
  onOpenSettings?: () => void;
}

export const QuickReplyBar: React.FC<QuickReplyBarProps> = ({ replies, onSelect, onOpenSettings }) => {
  return (
    <div className="quick-reply-bar">
      <div className="quick-reply-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Zap size={14} className="zap-icon" />
        <span>Trả lời nhanh:</span>
        {onOpenSettings && (
          <button
            type="button"
            className="crm-btn-ghost"
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              color: '#0284c7',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              cursor: 'pointer',
              borderRadius: '4px',
              border: '1px solid #e0f2fe',
              background: '#f0f9ff',
              marginLeft: '4px',
            }}
            onClick={onOpenSettings}
            title="Quản lý và tùy chỉnh tin nhắn nhanh"
          >
            <Settings size={11} />
            <span>Tùy chỉnh</span>
          </button>
        )}
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
