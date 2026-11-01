import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, RotateCcw, Zap } from 'lucide-react';
import type { QuickReplyItem } from '../../types.js';
import { MOCK_QUICK_REPLIES } from '../../mockData.js';
import { notify } from '../../../../components/feedback/toastEmitter.js';
import { Button } from '../../../../components/ui/Button.js';

export interface QuickReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickReplies: QuickReplyItem[];
  onSaveReplies: (replies: QuickReplyItem[]) => void;
}

export const QuickReplyModal: React.FC<QuickReplyModalProps> = ({
  isOpen,
  onClose,
  quickReplies,
  onSaveReplies,
}) => {
  const [replies, setReplies] = useState<QuickReplyItem[]>(quickReplies);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form thêm mới
  const [newLabel, setNewLabel] = useState('');
  const [newShortcut, setNewShortcut] = useState('');
  const [newContent, setNewContent] = useState('');

  // Form chỉnh sửa
  const [editLabel, setEditLabel] = useState('');
  const [editShortcut, setEditShortcut] = useState('');
  const [editContent, setEditContent] = useState('');

  if (!isOpen) return null;

  const handleStartEdit = (item: QuickReplyItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditShortcut(item.shortcut || '');
    setEditContent(item.content);
  };

  const handleSaveEdit = (id: string) => {
    if (!editLabel.trim() || !editContent.trim()) {
      notify.warning('Tiêu đề và nội dung tin nhắn nhanh không được để trống.');
      return;
    }

    const updated = replies.map((r) =>
      r.id === id
        ? {
            ...r,
            label: editLabel.trim(),
            shortcut: editShortcut.trim()
              ? editShortcut.startsWith('/')
                ? editShortcut.trim()
                : `/${editShortcut.trim()}`
              : undefined,
            content: editContent.trim(),
          }
        : r
    );

    setReplies(updated);
    onSaveReplies(updated);
    setEditingId(null);
    notify.success('Đã cập nhật tin nhắn nhanh.');
  };

  const handleDelete = (id: string) => {
    const updated = replies.filter((r) => r.id !== id);
    setReplies(updated);
    onSaveReplies(updated);
    notify.info('Đã xóa mẫu tin nhắn nhanh.');
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newContent.trim()) {
      notify.warning('Vui lòng điền đủ tiêu đề và nội dung tin nhắn.');
      return;
    }

    const newItem: QuickReplyItem = {
      id: `qr-${Date.now()}`,
      label: newLabel.trim(),
      shortcut: newShortcut.trim()
        ? newShortcut.startsWith('/')
          ? newShortcut.trim()
          : `/${newShortcut.trim()}`
        : undefined,
      content: newContent.trim(),
    };

    const updated = [...replies, newItem];
    setReplies(updated);
    onSaveReplies(updated);

    // Reset form
    setNewLabel('');
    setNewShortcut('');
    setNewContent('');
    notify.success('Đã thêm tin nhắn nhanh mới thành công!');
  };

  const handleResetDefaults = () => {
    if (window.confirm('Khôi phục danh sách tin nhắn nhanh về mẫu mặc định?')) {
      setReplies(MOCK_QUICK_REPLIES);
      onSaveReplies(MOCK_QUICK_REPLIES);
      notify.success('Đã khôi phục các mẫu tin nhắn nhanh mặc định.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="m-0 text-[15px] font-bold text-slate-900">
                Tùy Chỉnh Danh Sách Tin Nhắn Nhanh
              </h3>
              <p className="m-0 text-xs text-slate-500">
                Quản lý các mẫu câu trả lời tư vấn thường dùng
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
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Form thêm mới */}
          <form
            onSubmit={handleAddNew}
            className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 space-y-3"
          >
            <h4 className="m-0 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={14} className="text-blue-600" />
              Thêm mẫu tin nhắn nhanh mới
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tiêu đề gợi nhớ *
                </label>
                <input
                  type="text"
                  className="w-full h-8 px-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                  placeholder="VD: Lời chào khai giảng"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Phím tắt (tùy chọn)
                </label>
                <input
                  type="text"
                  className="w-full h-8 px-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                  placeholder="VD: /chao"
                  value={newShortcut}
                  onChange={(e) => setNewShortcut(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nội dung tin nhắn *
              </label>
              <textarea
                rows={2}
                className="w-full min-h-[50px] p-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors resize-none leading-relaxed"
                placeholder="Nhập nội dung mẫu câu trả lời tư vấn..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                className="h-8 px-3.5 rounded-lg"
              >
                Thêm mẫu tin
              </Button>
            </div>
          </form>

          {/* Tiêu đề danh sách hiện tại & nút khôi phục */}
          <div className="flex items-center justify-between pt-1">
            <h4 className="m-0 text-[13px] font-bold text-slate-800">
              Danh sách đang sử dụng ({replies.length})
            </h4>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={12} />}
              onClick={handleResetDefaults}
              className="h-7 px-2.5 text-[11px] text-slate-600 border-slate-200 hover:bg-slate-100 rounded-lg"
              title="Khôi phục lại các mẫu mặc định"
            >
              Khôi phục mặc định
            </Button>
          </div>

          {/* Danh sách các card mẫu */}
          <div className="flex flex-col gap-2.5">
            {replies.map((item) => (
              <div
                key={item.id}
                className={`border rounded-xl p-3.5 transition-colors ${
                  editingId === item.id
                    ? 'bg-blue-50/50 border-blue-200'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {editingId === item.id ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        className="sm:col-span-2 h-8 px-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Tiêu đề"
                      />
                      <input
                        type="text"
                        className="h-8 px-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        value={editShortcut}
                        onChange={(e) => setEditShortcut(e.target.value)}
                        placeholder="Phím tắt (/...)"
                      />
                    </div>
                    <textarea
                      rows={2}
                      className="w-full min-h-[50px] p-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none leading-relaxed"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        className="h-7 px-3 text-xs rounded-lg"
                      >
                        Hủy
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={<Check size={12} />}
                        onClick={() => handleSaveEdit(item.id)}
                        className="h-7 px-3 text-xs rounded-lg"
                      >
                        Lưu
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <strong className="text-[13px] font-bold text-slate-800 truncate">
                          {item.label}
                        </strong>
                        {item.shortcut && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                            {item.shortcut}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          onClick={() => handleStartEdit(item)}
                          title="Sửa mẫu này"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          onClick={() => handleDelete(item.id)}
                          title="Xóa mẫu này"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="m-0 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex justify-end shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            className="h-8 px-5 rounded-lg text-xs"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};

