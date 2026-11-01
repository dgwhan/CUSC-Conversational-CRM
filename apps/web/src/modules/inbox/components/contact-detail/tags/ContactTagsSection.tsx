import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../../../components/ui/Button.js';

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

  // Màu pastel luân phiên theo hashtag hoặc tên
  const getTagColorClass = (tag: string) => {
    const lower = tag.toLowerCase();
    if (lower === 'lead' || lower.includes('tiềm năng')) {
      return 'bg-amber-50 text-amber-700 border-amber-200/80';
    }
    if (lower.includes('vip') || lower.includes('quan trọng') || lower.includes('priority')) {
      return 'bg-purple-50 text-purple-700 border-purple-200/80';
    }
    if (lower.includes('học bổng') || lower.includes('đăng ký')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    }
    return 'bg-sky-50 text-sky-700 border-sky-200/80';
  };

  return (
    <div className="p-4 bg-white space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-xs font-bold text-slate-800 uppercase tracking-wider">
          Nhãn Phân Loại ({displayTags.length})
        </h4>
        {!isAddingTag && (
          <button
            type="button"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer bg-transparent border-0 p-0 transition-colors"
            onClick={() => setIsAddingTag(true)}
          >
            + Thêm nhãn
          </button>
        )}
      </div>

      {/* Form nhập nhãn mới */}
      {isAddingTag && (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5 pt-1">
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            placeholder="Tên nhãn (VD: VIP, Học bổng...)"
            autoFocus
            className="h-7 px-2.5 text-xs border border-blue-500 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="h-7 px-2.5 text-xs"
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

      {/* Danh sách nhãn hình viên thuốc pastel */}
      <div className="flex flex-wrap gap-2 items-center pt-0.5">
        {displayTags.length === 0 && !isAddingTag && (
          <span className="text-xs text-slate-400 italic">
            Chưa có nhãn phân loại nào
          </span>
        )}

        {displayTags.map((tag, idx) => (
          <span
            key={idx}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-xs transition-colors ${getTagColorClass(
              tag
            )}`}
          >
            <span>{tag}</span>
            <button
              type="button"
              className="p-0.5 hover:bg-black/10 rounded-full transition-colors cursor-pointer leading-none"
              onClick={() => onRemoveTag(tag)}
              title={`Xóa nhãn ${tag}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};
