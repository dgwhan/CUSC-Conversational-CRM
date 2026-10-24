import React from 'react';
import { Layers, CheckCircle2, XCircle } from 'lucide-react';
import { StatCard } from '../../../components/ui/StatCard.js';
import type { ImportMessagesResponse } from '../types/messaging.types.js';

interface ImportResultsSummaryProps {
  result: ImportMessagesResponse;
}

export const ImportResultsSummary: React.FC<ImportResultsSummaryProps> = ({ result }) => {
  return (
    <div className="crm-results-summary">
      <StatCard
        variant="neutral"
        label="Tổng số dòng xử lý"
        value={result.total}
        icon={<Layers size={22} />}
        description="Tổng số dòng được đưa vào kiểm thực Zod"
      />
      <StatCard
        variant="success"
        label="Hợp lệ & Đã import"
        value={result.successCount}
        icon={<CheckCircle2 size={22} />}
        description="Đã lưu vào Database & enqueue vào BullMQ"
      />
      <StatCard
        variant="danger"
        label="Dòng lỗi vi phạm"
        value={result.errorCount}
        icon={<XCircle size={22} />}
        description="Bị bác bỏ do không thỏa mãn Zod Schema"
      />
    </div>
  );
};
