import React, { useState } from 'react';
import { Trash2, MessageSquarePlus, AlertCircle } from 'lucide-react';
import type { InternalNote } from '../../../types.js';
import { Button } from '../../../../../components/ui/Button.js';
import { Modal } from '../../../../../components/ui/Modal.js';

interface InternalNotesSectionProps {
  notes?: InternalNote[];
  onAddNote: (content: string) => void;
  onRemoveNote: (noteId: string) => void;
}

export const InternalNotesSection: React.FC<InternalNotesSectionProps> = ({
  notes = [],
  onAddNote,
  onRemoveNote,
}) => {
  const [newNoteInput, setNewNoteInput] = useState('');
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const note = newNoteInput.trim();
    if (!note) return;
    onAddNote(note);
    setNewNoteInput('');
  };

  return (
    <div className="p-4 bg-white space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 shrink-0">
          <h4 className="m-0 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Ghi Chú Nội Bộ ({notes.length})
          </h4>
          <button
            type="button"
            onClick={() => setIsExplainModalOpen(true)}
            className="inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded"
            title="Xem giải thích ghi chú nội bộ"
            aria-label="Giải thích ghi chú nội bộ"
          >
            <AlertCircle size={13} />
          </button>
        </div>
      </div>

      {/* Form nhập ghi chú */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          rows={2}
          placeholder="Thêm ghi chú nội bộ..."
          value={newNoteInput}
          onChange={(e) => setNewNoteInput(e.target.value)}
          className="w-full min-h-[48px] p-2 text-xs border border-slate-200/80 rounded-md bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all leading-relaxed"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={<MessageSquarePlus size={12} />}
            disabled={!newNoteInput.trim()}
            className="h-7 px-2.5 text-xs font-medium"
          >
            Lưu ghi chú
          </Button>
        </div>
      </form>

      {/* Danh sách ghi chú */}
      {notes.length > 0 && (
        <div className="space-y-1.5 pt-0.5">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-md text-xs space-y-1"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-medium text-slate-700">{note.author}</span>
                <div className="flex items-center gap-1.5">
                  <span>{note.createdAt}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveNote(note.id)}
                    className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                    title="Xóa ghi chú"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <p className="m-0 text-slate-700 whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal Giải thích Ghi Chú Nội Bộ */}
      <Modal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        title="Ghi Chú Nội Bộ"
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
              1. Bảo mật nội bộ tuyệt đối
            </h5>
            <p className="m-0 text-slate-600">
              Ghi chú chỉ hiển thị riêng cho các thành viên trong đội ngũ nội bộ workspace. Khách hàng hoàn toàn không thể xem được các nội dung này.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              2. Lưu trữ ngữ cảnh & Dặn dò chăm sóc
            </h5>
            <p className="m-0 text-slate-600">
              Dùng để ghi lại các chi tiết quan trọng như lịch hẹn gọi lại, lưu ý đặc biệt về ngân sách, sở thích hoặc thói quen của khách hàng.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              3. Bàn giao ca trực dễ dàng
            </h5>
            <p className="m-0 text-slate-600">
              Mỗi ghi chú đều lưu trữ thời điểm tạo, giúp các tư vấn viên khác tiếp quản cuộc trò chuyện nhanh chóng mà không cần hỏi lại khách hàng.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
