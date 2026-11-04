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
  Building2,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react';
import type { OverviewMetrics } from '../reports.types.js';

interface MetricCardsGridProps {
  metrics: OverviewMetrics;
  terminology?: {
    entityName: string;
    pipelineName: string;
    productLabel: string;
    valueLabel: string;
  };
  domain?: string;
}

export const MetricCardsGrid: React.FC<MetricCardsGridProps> = ({
  metrics,
  terminology,
  domain,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatResponseTime = (mins: number) => {
    if (!mins || mins <= 0) return 'Chưa có';
    if (mins >= 60) return `${(mins / 60).toFixed(1)} giờ`;
    return `${Math.round(mins)} phút`;
  };

  const getWonConfig = () => {
    switch (domain) {
      case 'REAL_ESTATE':
        return {
          title: 'Chốt cọc thành công',
          icon: <Building2 size={16} className="text-emerald-600" />,
        };
      case 'BEAUTY_SPA':
        return {
          title: 'Chốt liệu trình',
          icon: <Sparkles size={16} className="text-emerald-600" />,
        };
      case 'RETAIL':
        return {
          title: 'Đơn hàng thành công',
          icon: <ShoppingBag size={16} className="text-emerald-600" />,
        };
      case 'B2B_SAAS':
        return {
          title: 'Hợp đồng ký kết',
          icon: <CheckCircle2 size={16} className="text-emerald-600" />,
        };
      case 'EDUCATION':
      default:
        return {
          title: 'Nhập học thành công',
          icon: <GraduationCap size={16} className="text-emerald-600" />,
        };
    }
  };

  const wonConfig = getWonConfig();
  const wonCount = metrics.wonCount ?? metrics.enrolledCount ?? 0;
  const collectedValue = metrics.totalCollectedValue ?? metrics.totalCollectedTuition ?? 0;
  const estimatedValue = metrics.totalEstimatedValue ?? metrics.totalEstimatedTuition ?? 0;

  const rawEntityLabel = terminology?.entityName || 'Khách hàng';
  const cleanEntityLabel = rawEntityLabel.split('/')[0].trim();
  const rawValueLabel = terminology?.valueLabel || 'Giá trị dự kiến';
  const cleanValueLabel = rawValueLabel.replace(/\s*\(VNĐ\)/gi, '').trim();

  const cards = [
    {
      title: `Tổng ${cleanEntityLabel}`,
      fullTitle: `Tổng ${rawEntityLabel}`,
      value: metrics.totalLeads.toLocaleString('vi-VN'),
      subtext: `${metrics.newLeadsGrowth >= 0 ? '+' : ''}${metrics.newLeadsGrowth}% so với kỳ trước`,
      isPositive: metrics.newLeadsGrowth >= 0,
      icon: <Users size={16} className="text-blue-600" />,
    },
    {
      title: wonConfig.title,
      fullTitle: wonConfig.title,
      value: wonCount.toLocaleString('vi-VN'),
      subtext: `Tỷ lệ chuyển đổi: ${metrics.conversionRate}%`,
      isPositive: true,
      icon: wonConfig.icon,
    },
    {
      title: 'Doanh thu thực thu',
      fullTitle: 'Doanh thu thực thu (Đã thanh toán)',
      value: formatCurrency(collectedValue),
      subtext: 'Đã hoàn tất thanh toán / ghi nhận',
      isPositive: true,
      icon: <DollarSign size={16} className="text-amber-600" />,
    },
    {
      title: `Phễu ${cleanValueLabel}`,
      fullTitle: `Phễu ${rawValueLabel}`,
      value: formatCurrency(estimatedValue),
      subtext: 'Quy mô tiềm năng đang chăm sóc',
      isPositive: true,
      icon: <TrendingUp size={16} className="text-purple-600" />,
    },
    {
      title: 'Tốc độ phản hồi',
      fullTitle: 'Tốc độ phản hồi khách hàng đầu tiên',
      value: formatResponseTime(metrics.avgResponseTimeMinutes),
      subtext: metrics.avgResponseTimeMinutes > 0 ? 'Thời gian phản hồi khách đầu tiên' : 'Chưa ghi nhận tin nhắn phản hồi',
      isPositive: true,
      icon: <Clock size={16} className="text-teal-600" />,
    },
    {
      title: 'Tỷ lệ rơi rụng',
      fullTitle: 'Tỷ lệ rơi rụng / Thất bại',
      value: `${metrics.dropOffRate}%`,
      subtext: 'Không phù hợp / Hủy nhu cầu',
      isPositive: metrics.dropOffRate < 20,
      icon: <UserX size={16} className="text-rose-600" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 mb-3.5">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all duration-150 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <span
              className="text-xs font-medium text-slate-500 truncate"
              title={card.fullTitle || card.title}
            >
              {card.title}
            </span>
            <div className="w-7 h-7 rounded-lg border border-slate-200/80 bg-slate-50/80 flex items-center justify-center shrink-0">
              {card.icon}
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mb-1 truncate" title={card.value}>
              {card.value}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500" title={card.subtext}>
              {card.isPositive ? (
                <ArrowUpRight size={13} className="text-emerald-600 shrink-0" />
              ) : (
                <ArrowDownRight size={13} className="text-rose-600 shrink-0" />
              )}
              <span className="truncate">{card.subtext}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
