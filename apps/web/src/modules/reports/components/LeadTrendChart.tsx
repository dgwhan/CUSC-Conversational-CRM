import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { TrendDataPoint } from '../reports.types.js';
import '../chartSetup.js';

interface LeadTrendChartProps {
  trends: TrendDataPoint[];
  entityName?: string;
  wonLabel?: string;
}

export const LeadTrendChart: React.FC<LeadTrendChartProps> = ({
  trends,
  entityName,
  wonLabel,
}) => {
  const [viewMode, setViewMode] = useState<'volume' | 'revenue'>('volume');

  const displayEntity = entityName || 'Hồ sơ';
  const displayWon = wonLabel || 'Chốt thành công';

  const labels = trends.map((t) => t.date);
  const leadsData = trends.map((t) => t.newLeads);
  const enrolledData = trends.map((t) => t.won ?? t.enrolled);
  const revenueData = trends.map((t) => t.revenue);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const volumeChartData: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: `${displayEntity} mới tiếp nhận`,
        data: leadsData,
        borderColor: '#0284c7',
        backgroundColor: 'rgba(2, 132, 199, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointBackgroundColor: '#0284c7',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: displayWon,
        data: enrolledData,
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointBackgroundColor: '#16a34a',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const revenueChartData: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Doanh thu ghi nhận',
        data: revenueData,
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointBackgroundColor: '#d97706',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 12,
          usePointStyle: true,
          font: { size: 12, weight: 500 },
          color: '#475569',
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const val = context.raw as number;
            if (viewMode === 'revenue') {
              return ` ${context.dataset.label}: ${formatCurrency(val)}`;
            }
            return ` ${context.dataset.label}: ${val} ${displayEntity.toLowerCase()}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: '#f8fafc',
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
        },
      },
      y: {
        grid: {
          color: '#f1f5f9',
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
          callback: (value) => {
            if (viewMode === 'revenue') {
              const num = Number(value);
              if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)} Tỷ`;
              if (num >= 1000000) return `${(num / 1000000).toFixed(0)} Tr`;
              return num.toLocaleString('vi-VN');
            }
            return value;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            Biểu Đồ Xu Hướng Tăng Trưởng
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Biến động lưu lượng {displayEntity.toLowerCase()} và dòng doanh thu theo thời gian
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('volume')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'volume'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Số Lượng {displayEntity}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('revenue')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'revenue'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Doanh Thu (VNĐ)
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[280px]">
        {trends.length > 0 ? (
          <Line
            data={viewMode === 'volume' ? volumeChartData : revenueChartData}
            options={options}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Chưa có dữ liệu xu hướng
          </div>
        )}
      </div>
    </div>
  );
};
