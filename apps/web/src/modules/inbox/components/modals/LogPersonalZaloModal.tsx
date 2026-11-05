import React, { useState } from 'react';
import { X, Smartphone, AlertTriangle, Save } from 'lucide-react';
import { notify } from '../../../../components/feedback/toastEmitter.js';
import { Button } from '../../../../components/ui/Button.js';
import type { CustomerProfile } from '../../types.js';

export interface LogPersonalZaloModalProps {
  isOpen: boolean;
  customer: CustomerProfile;
  onClose: () => void;
  onSaveNote: (note: string) => void;
}

export const LogPersonalZaloModal: React.FC<LogPersonalZaloModalProps> = ({
  isOpen,
  customer,
  onClose,
  onSaveNote,
}) => {
  const [zaloName, setZaloName] = useState(customer.fullName);
  const [zaloPhone, setZaloPhone] = useState(customer.phone);
  const [content, setContent] = useState('');
  const [summaryTag, setSummaryTag] = useState('Tư vấn Zalo Cá nhân');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      notify.warning('Vui lòng nhập tóm tắt nội dung trao đổi qua Zalo cá nhân.');
      return;
    }

    const fullNote = `[ZALO CÁ NHÂN - ${zaloName} (${zaloPhone || 'Chưa SĐT'}) - Tag: ${summaryTag}]:\n${content.trim()}`;
    onSaveNote(fullNote);
    notify.success('Đã lưu nhật ký tư vấn Zalo cá nhân vào hồ sơ CRM thành công!');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-orange-100 bg-orange-50/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <Smartphone size={18} />
            </div>
            <div>
              <h3 className="m-0 text-[15px] font-bold text-slate-900">
                Ghi Nhận Tư Vấn Zalo Cá Nhân
              </h3>
              <p className="m-0 text-xs text-slate-500">
                Lưu vết trao đổi và cam kết vào CRM
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            onClick={onClose}
            title="Đóng (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Cảnh báo rủi ro thất thoát dữ liệu */}
          <div className="flex gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-amber-950">Lưu ý bắt buộc cho Nhân viên:</strong>
              <p className="m-0 mt-0.5 text-amber-800">
                Zalo cá nhân không có API đồng bộ tự động. Toàn bộ thông tin trao đổi, cam kết và SĐT khách hàng cần được lưu vào CRM để đảm bảo quyền lợi KPI và chăm sóc liên tục.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Tên nick Zalo khách hàng *
              </label>
              <input
                type="text"
                className="w-full h-8 px-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500 transition-colors"
                value={zaloName}
                onChange={(e) => setZaloName(e.target.value)}
                placeholder="VD: Nguyễn An (Zalo)"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Số điện thoại Zalo
              </label>
              <input
                type="tel"
                className="w-full h-8 px-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500 transition-colors"
                value={zaloPhone}
                onChange={(e) => setZaloPhone(e.target.value)}
                placeholder="VD: 0939.882.115"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Phân loại tương tác
            </label>
            <select
              className="w-full h-8 px-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500 transition-colors"
              value={summaryTag}
              onChange={(e) => setSummaryTag(e.target.value)}
            >
              <option value="Tư vấn Zalo Cá nhân">Tư vấn Zalo Cá nhân (Lần đầu)</option>
              <option value="Hẹn nộp hồ sơ qua Zalo">Hẹn nộp hồ sơ / Đóng phí qua Zalo</option>
              <option value="Gửi biểu phí & Học bổng Zalo">Đã gửi biểu phí & Học bổng</option>
              <option value="Phụ huynh liên hệ Zalo">Phụ huynh trao đổi Zalo</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Tóm tắt nội dung trao đổi & Cam kết *
            </label>
            <textarea
              className="w-full min-h-[90px] p-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500 transition-colors resize-none leading-relaxed"
              rows={4}
              placeholder="VD: Khách đã trao đổi qua Zalo cá nhân, đồng ý giải pháp đã đề xuất. Đã hẹn 9h sáng thứ 7 đến văn phòng hoàn tất thủ tục..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              className="h-8 px-4 rounded-lg text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<Save size={14} />}
              className="h-8 px-4 rounded-lg text-xs bg-orange-600 hover:bg-orange-700 text-white"
            >
              Lưu vào Hồ sơ CRM
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

