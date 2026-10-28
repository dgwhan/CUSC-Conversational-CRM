import React from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { CourseReport, ProductReport } from '../reports.types.js';
import '../chartSetup.js';

interface CoursePopularityChartProps {
  courses?: CourseReport[];
  products?: ProductReport[];
  productLabel?: string;
  entityName?: string;
}

export const CoursePopularityChart: React.FC<CoursePopularityChartProps> = ({
  courses,
  products,
  productLabel,
  entityName,
}) => {
  const displayLabel = productLabel || 'Sản Phẩm / Dịch Vụ';
  const displayEntity = entityName || 'khách hàng';
  const itemList = products || courses || [];
  const topItems = itemList.slice(0, 6);
  const labels = topItems.map((c) => c.productName || c.courseName || '');
  const counts = topItems.map((c) => c.count);

  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#10b981', // emerald
    '#f59e0b', // amber
    '#06b6d4', // cyan
    '#ec4899', // pink
  ];

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: `Số lượng ${displayEntity} quan tâm`,
        data: counts,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 6,
        maxBarThickness: 36,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
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
            return ` ${displayEntity} quan tâm: ${count}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { size: 11 },
          color: '#475569',
          maxRotation: 25,
          minRotation: 0,
        },
      },
      y: {
        grid: {
          color: '#f1f5f9',
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
          precision: 0,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            {displayLabel} Thu Hút Nhất
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Xếp hạng mức độ quan tâm của {displayEntity} theo từng danh mục
          </p>
        </div>
      </div>
      <div className="relative flex-1 min-h-[280px]">
        {topItems.length > 0 && topItems.some((c) => c.count > 0) ? (
          <Bar data={data} options={options} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm py-12">
            <p className="font-medium text-slate-500">Chưa có dữ liệu {displayLabel.toLowerCase()} trong kỳ</p>
          </div>
        )}
      </div>
    </div>
  );
};
