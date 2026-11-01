import React from 'react';
import { MessageSquare } from 'lucide-react';

export const EmptyInboxView: React.FC = () => {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/60 min-w-[380px] h-full select-none">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 shadow-xs flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-inner">
          <MessageSquare size={28} />
        </div>
        <h3 className="m-0 mb-2 text-base font-bold text-slate-900">
          Hộp thoại đang trống
        </h3>
        <p className="m-0 text-xs leading-relaxed text-slate-500 max-w-sm">
          Chưa có cuộc hội thoại nào. Khi khách hàng nhắn tin từ Facebook Messenger hoặc Zalo,
          tin nhắn sẽ được đẩy tự động qua kết nối WebSocket Realtime và xuất hiện tại đây ngay lập tức.
        </p>
      </div>
    </main>
  );
};

