import React from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { FunnelStageReport } from '../reports.types.js';
import '../chartSetup.js';

interface FunnelChartProps {
  stages: FunnelStageReport[];
  pipelineName?: string;
  entityName?: string;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({
  stages,
  pipelineName,
  entityName,
}) => {
  const displayEntity = entityName || 'khách hàng';
  const labels = stages.map((s) => s.label);
  const dataCounts = stages.map((s) => s.count);
  const backgroundColors = stages.map((s) => s.color || '#0284c7');

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: `Số lượng ${displayEntity}`,
        data: dataCounts,
        backgroundColor: backgroundColors,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 45,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y', // Biểu đồ dạng phễu nằm ngang trực quan
    plugins: {
      legend: {
        display: false,
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
            const total = dataCounts.reduce((acc, curr) => acc + curr, 0);
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
            return ` ${displayEntity}: ${count} (${pct}% tổng phễu)`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: '#f1f5f9',
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
          precision: 0,
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          font: { size: 12, weight: 500 },
          color: '#334155',
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            {pipelineName || 'Phễu Chuyển Đổi'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân bổ số lượng {displayEntity} qua từng giai đoạn trong quy trình
          </p>
        </div>
      </div>
      <div className="relative flex-1 min-h-[300px]">
        {stages.length > 0 ? (
          <Bar data={data} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Chưa có dữ liệu giai đoạn phễu
          </div>
        )}
      </div>
    </div>
  );
};
