import React from 'react';
import {
  Calendar,
  Filter,
  Download,
  Printer,
  RotateCw,
} from 'lucide-react';
import type { TimeRangeFilter } from '../reports.types.js';

interface ReportsFilterBarProps {
  selectedRange: TimeRangeFilter;
  onRangeChange: (range: TimeRangeFilter) => void;
  selectedChannel: string;
  onChannelChange: (channel: string) => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  isLoading?: boolean;
}

export const ReportsFilterBar: React.FC<ReportsFilterBarProps> = ({
  selectedRange,
  onRangeChange,
  selectedChannel,
  onChannelChange,
  onRefresh,
  onExportCsv,
  isLoading = false,
}) => {
  const timeRanges: { id: TimeRangeFilter; label: string }[] = [
    { id: '7days', label: '7 Ngày qua' },
    { id: '30days', label: '30 Ngày qua' },
    { id: 'thisMonth', label: 'Tháng này' },
    { id: 'quarter', label: 'Quý này' },
    { id: 'year', label: 'Năm nay' },
    { id: 'all', label: 'Toàn bộ' },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Time range buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-500 mr-1.5 flex items-center gap-1">
          <Calendar size={14} className="text-slate-400" /> Chu kỳ:
        </span>
        {timeRanges.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedRange === r.id
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
            onClick={() => onRangeChange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Filter by Channel + Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-slate-400" />
          <select
            className="text-xs border border-slate-200 rounded-lg py-1.5 px-2.5 bg-slate-50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            value={selectedChannel}
            onChange={(e) => onChannelChange(e.target.value)}
          >
            <option value="ALL">Tất cả kênh tiếp nhận</option>
            <option value="FACEBOOK">Facebook Messenger</option>
            <option value="ZALO">Zalo OA / Cá nhân</option>
            <option value="TIKTOK">TikTok Lead Gen</option>
            <option value="MANUAL">Nhập tay / Hotline</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          title="Tải lại dữ liệu mới nhất"
        >
          <RotateCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Làm mới
        </button>

        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
          title="Xuất bảng số liệu ra file Excel / CSV"
        >
          <Download size={13} />
          Xuất Báo Cáo CSV
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          title="In hoặc lưu file PDF"
        >
          <Printer size={13} />
          In báo cáo
        </button>
      </div>
    </div>
  );
};
