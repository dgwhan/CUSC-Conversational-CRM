import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '../../../../../components/ui/Button.js';
import { Modal } from '../../../../../components/ui/Modal.js';

interface ContactTagsSectionProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export const ContactTagsSection: React.FC<ContactTagsSectionProps> = ({
  tags,
  onAddTag,
  onRemoveTag,
}) => {
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);

  const displayTags =
    Array.isArray(tags)
      ? Array.from(
          new Set(
            tags
              .map((t) => (t.trim().toLowerCase() === 'facebook lead' ? 'Lead' : t.trim()))
              .filter(Boolean)
          )
        )
      : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    if (!tag) return;
    onAddTag(tag);
    setNewTagInput('');
    setIsAddingTag(false);
  };

  return (
    <div className="p-4 bg-white space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 shrink-0">
          <h4 className="m-0 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Nhãn Phân Loại ({displayTags.length})
          </h4>
          <button
            type="button"
            onClick={() => setIsExplainModalOpen(true)}
            className="inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded"
            title="Xem giải thích nhãn phân loại"
            aria-label="Giải thích nhãn phân loại"
          >
            <AlertCircle size={13} />
          </button>
        </div>
        {!isAddingTag && (
          <button
            type="button"
            className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer bg-transparent border-0 p-0 transition-colors"
            onClick={() => setIsAddingTag(true)}
          >
            + Thêm nhãn
          </button>
        )}
      </div>

      {/* Form nhập nhãn mới */}
      {isAddingTag && (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5 pt-0.5">
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            placeholder="Tên nhãn..."
            autoFocus
            className="h-7 px-2 text-xs border border-blue-500 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="h-7 px-2 text-xs"
          >
            Thêm
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingTag(false)}
            className="h-7 px-2 text-xs"
          >
            Hủy
          </Button>
        </form>
      )}

      {/* Danh sách nhãn muted tag */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {displayTags.length === 0 && !isAddingTag && (
          <span className="text-xs text-slate-400 italic">
            Chưa có nhãn phân loại nào
          </span>
        )}

        {displayTags.map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80 transition-colors"
          >
            <span>{tag}</span>
            <button
              type="button"
              className="p-0.5 hover:bg-black/10 rounded transition-colors cursor-pointer leading-none text-slate-400 hover:text-slate-700"
              onClick={() => onRemoveTag(tag)}
              title={`Xóa nhãn ${tag}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      {/* Modal Giải thích Nhãn Phân Loại */}
      <Modal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        title="Nhãn Phân Loại Khách Hàng (Tags)"
        size="md"
        showCloseButton={true}
        primaryAction={{
          label: 'Đã hiểu',
          onClick: () => setIsExplainModalOpen(false),
          variant: 'primary',
        }}
      >
        <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              1. Mục đích của nhãn phân loại
            </h5>
            <p className="m-0 text-slate-600">
              Nhãn giúp phân nhóm nhanh khách hàng theo nguồn gốc chiến dịch (Facebook Ads, Web Form, Sự kiện), phân loại ưu tiên hoặc đặc điểm kinh doanh riêng.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              2. Gắn nhãn tự động & Thủ công
            </h5>
            <p className="m-0 text-slate-600">
              Hệ thống tự động gắn các nhãn chiến dịch khi đồng bộ từ Meta hoặc Zalo. Tư vấn viên cũng có thể bấm "+ Thêm nhãn" để tạo bất kỳ nhãn ghi nhớ nào.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              3. Tối giản giao diện & Xóa nhãn
            </h5>
            <p className="m-0 text-slate-600">
              Toàn bộ nhãn được thiết kế tối giản trung tính, tránh gây rối mắt. Bạn có thể bấm biểu tượng [x] trên từng nhãn để xóa bất kỳ lúc nào.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
