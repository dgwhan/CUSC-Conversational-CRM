import React from 'react';
import { Award, Trophy, Medal, Clock } from 'lucide-react';
import type { StaffPerformanceReport } from '../reports.types.js';

interface StaffLeaderboardProps {
  staffList: StaffPerformanceReport[];
  entityName?: string;
  valueLabel?: string;
  wonLabel?: string;
}

export const StaffLeaderboard: React.FC<StaffLeaderboardProps> = ({
  staffList,
  entityName,
  valueLabel,
  wonLabel,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-bold text-xs" title="Hạng 1 Tuyệt đối">
            <Trophy size={14} />
          </div>
        );
      case 1:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs" title="Hạng 2 Xuất sắc">
            <Medal size={14} />
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs" title="Hạng 3 Triển vọng">
            <Award size={14} />
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-500 font-semibold text-xs">
            #{index + 1}
          </div>
        );
    }
  };

  const displayEntity = entityName || 'Hồ Sơ';
  const displayWon = wonLabel || 'Chốt Thành Công';
  const displayValue = valueLabel || 'Doanh Thu';

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            Bảng Xếp Hạng & Hiệu Suất Tư Vấn Viên / Sales
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Đánh giá năng lực chốt giao dịch, tốc độ phản hồi và giá trị doanh thu đem về
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-3 text-center w-12">Hạng</th>
              <th className="py-3 px-4">Tư Vấn Viên / Sales</th>
              <th className="py-3 px-3 text-center">{displayEntity} Nhận</th>
              <th className="py-3 px-3 text-center">{displayWon}</th>
              <th className="py-3 px-4">Tỷ Lệ Chuyển Đổi</th>
              <th className="py-3 px-4 text-right">{displayValue} Mang Về</th>
              <th className="py-3 px-3 text-center">Tốc Độ Chat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffList.length > 0 ? (
              staffList.map((staff, idx) => {
                const won = staff.wonCount ?? staff.enrolledCount ?? 0;
                return (
                  <tr key={staff.staffId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex justify-center">{getRankBadge(idx)}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs border border-blue-200">
                          {staff.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{staff.name}</div>
                          <div className="text-[11px] text-slate-400">Chuyên viên tư vấn</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-700 font-semibold">
                      {staff.leadsCount}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {won} {displayEntity.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(staff.conversionRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700 min-w-9">
                          {staff.conversionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(staff.revenue)}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <Clock size={12} className="text-teal-600" />
                        {staff.avgResponseTime}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                  Chưa có dữ liệu tư vấn viên
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
