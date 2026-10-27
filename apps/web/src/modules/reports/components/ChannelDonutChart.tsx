import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { ChannelReport } from '../reports.types.js';
import '../chartSetup.js';

interface ChannelDonutChartProps {
  channels: ChannelReport[];
}

export const ChannelDonutChart: React.FC<ChannelDonutChartProps> = ({ channels }) => {
  const totalLeads = channels.reduce((sum, ch) => sum + ch.count, 0);

  const labels = channels.map((c) => c.label);
  const counts = channels.map((c) => c.count);
  const colors = channels.map((c) => c.color);

  const data: ChartData<'doughnut'> = {
    labels,
    datasets: [
      {
        data: counts,
        backgroundColor: colors,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: { size: 12 },
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
            const count = context.raw as number;
            const pct = totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0';
            return ` ${context.label}: ${count} hồ sơ (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            Nguồn Kênh Tiếp Nhận
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tỷ trọng hồ sơ từ Facebook, Zalo, TikTok & Hotline
          </p>
        </div>
      </div>
      <div className="relative flex-1 min-h-[280px] flex items-center justify-center">
        <Doughnut data={data} options={options} />
        {/* Center label inside Doughnut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12">
          <span className="text-2xl font-bold text-slate-900">{totalLeads}</span>
          <span className="text-xs text-slate-500 font-medium">Tổng hồ sơ</span>
        </div>
      </div>
    </div>
  );
};
