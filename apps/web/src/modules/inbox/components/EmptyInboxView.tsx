import React from 'react';
import { MessageSquare } from 'lucide-react';

export const EmptyInboxView: React.FC = () => {
  return (
    <main
      className="pancake-chat-window empty-placeholder-view"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        color: '#94a3b8',
        flexDirection: 'column',
        padding: '32px',
        textAlign: 'center',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          maxWidth: '420px',
          background: '#ffffff',
          borderRadius: '12px',
          padding: '36px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <MessageSquare size={30} />
        </div>
        <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '18px', fontWeight: 600 }}>
          Hộp thoại đang trống
        </h3>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
          Chưa có cuộc hội thoại nào. Khi khách hàng nhắn tin từ Facebook Messenger hoặc Zalo,
          tin nhắn sẽ được đẩy tự động qua kết nối WebSocket Realtime và xuất hiện tại đây ngay lập tức.
        </p>
      </div>
    </main>
  );
};

