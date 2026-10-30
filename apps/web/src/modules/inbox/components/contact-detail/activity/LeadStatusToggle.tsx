import React from 'react';
import { Star } from 'lucide-react';

export interface LeadStatusToggleProps {
  isLead: boolean;
  onMarkAsLead: () => void;
  onUnmarkLead: () => void;
}

/**
 * Sub-component: Đánh dấu / Bỏ đánh dấu khách hàng tiềm năng
 * Tách biệt logic và giao diện, sử dụng Tailwind CSS chuẩn hệ thống
 */
export const LeadStatusToggle: React.FC<LeadStatusToggleProps> = ({
  isLead,
  onMarkAsLead,
  onUnmarkLead,
}) => {
  return (
    <div className="mb-3">
      {!isLead ? (
        <button
          type="button"
          onClick={onMarkAsLead}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0 transition-colors"
          title="Kích hoạt trạng thái khách hàng tiềm năng"
        >
          <Star size={13} className="fill-blue-600 text-blue-600" />
          <span>Đánh dấu là khách hàng tiềm năng</span>
        </button>
      ) : (
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-blue-600">
            <Star size={13} className="fill-blue-600 text-blue-600" />
            Đã đánh dấu là khách hàng tiềm năng
          </span>
          <button
            type="button"
            onClick={onUnmarkLead}
            className="text-[11.5px] text-slate-500 hover:text-slate-800 underline bg-transparent border-0 cursor-pointer px-1 py-0.5 transition-colors"
            title="Bỏ đánh dấu khách hàng tiềm năng"
          >
            Hủy
          </button>
        </div>
      )}
    </div>
  );
};
