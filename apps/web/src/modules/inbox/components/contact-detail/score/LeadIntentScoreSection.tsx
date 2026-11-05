import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { ChatMessage, ConversationClassificationData, ConversationTier } from '../../../types.js';
import { evaluateConversationScore } from '../../../utils/leadScoringUtils.js';
import { Modal } from '../../../../../components/ui/Modal.js';

interface LeadIntentScoreSectionProps {
  classification?: ConversationClassificationData;
  messages?: ChatMessage[];
  customerPhone?: string;
}

export const LeadIntentScoreSection: React.FC<LeadIntentScoreSectionProps> = ({
  classification,
  messages = [],
  customerPhone,
}) => {
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  // Đánh giá trực tiếp dựa trên thông tin và tin nhắn trao đổi thực tế
  const data: ConversationClassificationData = useMemo(() => {
    if (classification && classification.reasons && classification.reasons.length > 0) {
      return classification;
    }
    return evaluateConversationScore(messages, customerPhone);
  }, [classification, messages, customerPhone]);

  const getTierMeta = (tier: ConversationTier) => {
    switch (tier) {
      case 'HOT':
        return {
          label: 'Ưu tiên cao',
          badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
          barColor: 'bg-emerald-500',
          recommendation: 'Khách hàng có nhu cầu hợp tác/chốt đơn rõ ràng và đã có SĐT. Ưu tiên liên hệ xử lý trong 15 phút.',
        };
      case 'WARM':
        return {
          label: 'Đang quan tâm',
          badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200/80',
          barColor: 'bg-slate-400',
          recommendation: 'Khách hàng đang tìm hiểu báo giá hoặc chi tiết giải pháp. Gửi tài liệu tư vấn và phương án triển khai.',
        };
      case 'COLD':
        return {
          label: 'Mới tiếp cận',
          badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200/80',
          barColor: 'bg-slate-300',
          recommendation: 'Khách hàng hỏi thông tin chung. Tiếp tục giải đáp và cập nhật hồ sơ chăm sóc định kỳ.',
        };
      default:
        return {
          label: 'Chưa phân loại',
          badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200/80',
          barColor: 'bg-slate-200',
          recommendation: 'Chưa phát hiện từ khóa nhu cầu trong các lượt trao đổi gần nhất.',
        };
    }
  };

  const meta = getTierMeta(data.tier);
  const progressPercent = Math.min(100, Math.max(data.score > 0 ? 8 : 0, (data.score / 15) * 100));

  return (
    <div className="p-4 bg-white space-y-2.5">
      {/* 1. Header Section: Dấu chấm than (!) mở module giải thích */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <h4 className="m-0 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Đánh Giá Tiềm Năng
          </h4>
          <button
            type="button"
            onClick={() => setIsExplanationOpen(true)}
            className="inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded"
            title="Xem nguyên tắc đánh giá tiềm năng"
            aria-label="Nguyên tắc đánh giá tiềm năng"
          >
            <AlertCircle size={13} />
          </button>
        </div>

        <span
          className={`text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
      </div>

      {/* 2. Thang đo tiến độ mảnh, tinh giản */}
      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${meta.barColor}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 3. Tiêu chí đã ghi nhận (Không hiển thị số điểm cộng để tối giản) */}
      {data.reasons.length > 0 && (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Tiêu chí ghi nhận:</span>
            <span className="text-slate-400">Tự động nhận diện</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {data.reasons.map((reason, idx) => {
              const keywordLabel = reason.keyword.replace(/^có\s+/i, '');
              return (
                <span
                  key={idx}
                  className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                >
                  {keywordLabel}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Khuyến nghị tư vấn */}
      <p className="m-0 text-xs text-slate-500 leading-relaxed pt-0.5">
        <span className="font-medium text-slate-700">Tư vấn: </span>
        {meta.recommendation}
      </p>

      {/* 5. Module Giải Thích Nguyên Tắc Đánh Giá Tiềm Năng */}
      <Modal
        isOpen={isExplanationOpen}
        onClose={() => setIsExplanationOpen(false)}
        title="Nguyên Tắc Đánh Giá Tiềm Năng"
        size="xl"
        showCloseButton={true}
        primaryAction={{
          label: 'Đã hiểu',
          onClick: () => setIsExplanationOpen(false),
          variant: 'primary',
        }}
      >
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          {/* Nguyên lý */}
          <div className="space-y-1.5">
            <h5 className="m-0 text-xs font-semibold text-slate-900 uppercase tracking-wider">
              1. Nguyên lý phân tích hội thoại
            </h5>
            <ul className="m-0 pl-4 space-y-1 list-disc text-slate-600">
              <li>
                <span className="font-medium text-slate-800">Tối ưu tín hiệu:</span> Mỗi tiêu chí chỉ ghi nhận tín hiệu tối đa một lần cho toàn bộ hội thoại, tránh việc khách hàng hỏi lặp lại nhiều lần bị đánh giá sai lệch.
              </li>
              <li>
                <span className="font-medium text-slate-800">Loại trừ câu phủ định:</span> Tự động nhận diện và bỏ qua các câu phủ định (ví dụ: <em>"không mua đâu"</em>, <em>"chưa có nhu cầu"</em>).
              </li>
              <li>
                <span className="font-medium text-slate-800">Tiếng Việt linh hoạt:</span> Hỗ trợ cả tiếng Việt có dấu, không dấu và các từ viết tắt phổ biến (<em>"bao gia"</em>, <em>"sdt"</em>, <em>"chi phi"</em>).
              </li>
            </ul>
          </div>

          {/* Bảng tín hiệu */}
          <div className="space-y-1.5">
            <h5 className="m-0 text-xs font-semibold text-slate-900 uppercase tracking-wider">
              2. Các tín hiệu nhận diện chính
            </h5>
            <div className="border-y border-slate-200/80 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="py-2 px-3">Tín hiệu / Tiêu chí</th>
                    <th className="py-2 px-3 w-32 text-right">Mức độ ưu tiên</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  <tr>
                    <td className="py-2 px-3 text-slate-800">
                      <span className="font-medium">Số điện thoại (SĐT)</span>
                      <p className="m-0 text-[10px] text-slate-400">Khách gửi SĐT vào chat hoặc hồ sơ có SĐT liên hệ</p>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-600">Ưu tiên cao</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-800">
                      <span className="font-medium">Ý định hợp tác / Mua hàng / Đăng ký</span>
                      <p className="m-0 text-[10px] text-slate-400">Từ khóa: <em>đăng ký, mua, chốt đơn, đặt hàng, ký hợp đồng</em></p>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-600">Ưu tiên cao</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-800">
                      <span className="font-medium">Hỏi báo giá / Chi phí / Ưu đãi</span>
                      <p className="m-0 text-[10px] text-slate-400">Từ khóa: <em>báo giá, giá, chi phí, bao nhiêu tiền, ưu đãi, chiết khấu</em></p>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-600">Đang quan tâm</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-800">
                      <span className="font-medium">Hỏi quy trình / Lộ trình / Kế hoạch triển khai</span>
                      <p className="m-0 text-[10px] text-slate-400">Từ khóa: <em>quy trình, lộ trình, thời gian, lịch hẹn, kế hoạch</em></p>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-600">Đang quan tâm</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-800">
                      <span className="font-medium">Hỏi thông tin cơ bản</span>
                      <p className="m-0 text-[10px] text-slate-400">Từ khóa: <em>tư vấn, sản phẩm, dịch vụ, thông tin chi tiết</em></p>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-600">Mới tiếp cận</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Phân loại cấp bậc */}
          <div className="space-y-1.5">
            <h5 className="m-0 text-xs font-semibold text-slate-900 uppercase tracking-wider">
              3. Thang phân loại tiềm năng
            </h5>
            <ul className="m-0 pl-4 space-y-1.5 list-disc text-slate-600 text-xs">
              <li>
                <span className="font-medium text-emerald-700">Ưu tiên cao:</span> Khách hàng sẵn sàng chốt nhu cầu, đã để lại SĐT. Ưu tiên liên hệ xử lý ngay.
              </li>
              <li>
                <span className="font-medium text-slate-800">Đang quan tâm:</span> Đang tìm hiểu báo giá và giải pháp. Gửi ngay tài liệu chi tiết.
              </li>
              <li>
                <span className="font-medium text-slate-700">Mới tiếp cận:</span> Mới hỏi thăm thông tin cơ bản. Tiếp tục tư vấn và chăm sóc định kỳ.
              </li>
              <li>
                <span className="font-medium text-slate-600">Chưa phân loại:</span> Chưa phát hiện từ khóa nhu cầu hoặc hội thoại chưa đủ dữ kiện.
              </li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
};
