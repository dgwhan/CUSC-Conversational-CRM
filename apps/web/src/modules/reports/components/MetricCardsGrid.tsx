import React from 'react';
import {
  Users,
  GraduationCap,
  TrendingUp,
  DollarSign,
  Clock,
  UserX,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { OverviewMetrics } from '../reports.types.js';

interface MetricCardsGridProps {
  metrics: OverviewMetrics;
}

export const MetricCardsGrid: React.FC<MetricCardsGridProps> = ({ metrics }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const cards = [
    {
      title: 'Tổng Hồ Sơ Tuyển Sinh',
      value: metrics.totalLeads.toLocaleString('vi-VN'),
      subtext: `${metrics.newLeadsGrowth >= 0 ? '+' : ''}${metrics.newLeadsGrowth}% so với kỳ trước`,
      isPositive: metrics.newLeadsGrowth >= 0,
      icon: <Users size={22} className="text-blue-600" />,
      bgIcon: 'bg-blue-50 border-blue-200',
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      title: 'Nhập Học Thành Công',
      value: metrics.enrolledCount.toLocaleString('vi-VN'),
      subtext: `Tỷ lệ chuyển đổi: ${metrics.conversionRate}%`,
      isPositive: true,
      icon: <GraduationCap size={22} className="text-emerald-600" />,
      bgIcon: 'bg-emerald-50 border-emerald-200',
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      title: 'Doanh Thu Thực Thu',
      value: formatCurrency(metrics.totalCollectedTuition),
      subtext: 'Đã hoàn tất 100% học phí',
      isPositive: true,
      icon: <DollarSign size={22} className="text-amber-600" />,
      bgIcon: 'bg-amber-50 border-amber-200',
      badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      title: 'Giá Trị Phễu Dự Kiến',
      value: formatCurrency(metrics.totalEstimatedTuition),
      subtext: 'Học phí tiềm năng đang chăm sóc',
      isPositive: true,
      icon: <TrendingUp size={22} className="text-purple-600" />,
      bgIcon: 'bg-purple-50 border-purple-200',
      badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
    },
    {
      title: 'Tốc Độ Phản Hồi Tin Nhắn',
      value: `${metrics.avgResponseTimeMinutes} phút`,
      subtext: 'Thời gian phản hồi khách đầu tiên',
      isPositive: true,
      icon: <Clock size={22} className="text-teal-600" />,
      bgIcon: 'bg-teal-50 border-teal-200',
      badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
    },
    {
      title: 'Tỷ Lệ Rơi Rụng / Thất Bại',
      value: `${metrics.dropOffRate}%`,
      subtext: 'Không phù hợp / Không phản hồi',
      isPositive: metrics.dropOffRate < 20,
      icon: <UserX size={22} className="text-rose-600" />,
      bgIcon: 'bg-rose-50 border-rose-200',
      badgeColor: metrics.dropOffRate < 20
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : 'text-rose-700 bg-rose-50 border-rose-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider line-clamp-1">
              {card.title}
            </span>
            <div className={`p-2 rounded-lg border ${card.bgIcon}`}>
              {card.icon}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight mb-1 truncate">
              {card.value}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {card.isPositive ? (
                <ArrowUpRight size={14} className="text-emerald-600 shrink-0" />
              ) : (
                <ArrowDownRight size={14} className="text-rose-600 shrink-0" />
              )}
              <span className="truncate">{card.subtext}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
