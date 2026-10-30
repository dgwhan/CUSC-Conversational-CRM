import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface ContactTagsSectionProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

/**
 * Section: Nhãn Phân Loại
 * Thiết kế phẳng bằng Tailwind CSS
 */
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

  return (
    <section className="p-4 border-b border-slate-200">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[13px] font-semibold text-slate-800 m-0">
          Nhãn Phân Loại ({displayTags.length})
        </h3>
        {!isAddingTag && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-blue-600 hover:text-blue-800 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            onClick={() => setIsAddingTag(true)}
          >
            <Plus size={12} />
            <span>Thêm nhãn</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {displayTags.length === 0 && !isAddingTag && (
          <span className="text-[12px] text-slate-400 italic">
            Chưa có nhãn phân loại
          </span>
        )}

        {displayTags.map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-[12px] rounded border border-slate-200"
          >
            <span>{tag}</span>
            <button
              type="button"
              className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 leading-none text-[14px]"
              onClick={() => onRemoveTag(tag)}
              title="Xóa nhãn"
            >
              &times;
            </button>
          </span>
        ))}

        {isAddingTag && (
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5 mt-1">
            <input
              type="text"
              className="px-2 py-0.5 text-[12px] border border-blue-500 rounded bg-white text-slate-800 outline-none w-32"
              placeholder="Nhập tên nhãn..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="px-2 py-0.5 text-[11px] font-medium bg-blue-600 text-white rounded hover:bg-blue-700 border-0 cursor-pointer transition-colors"
            >
              Lưu
            </button>
            <button
              type="button"
              className="px-1.5 py-0.5 text-[11px] text-slate-500 hover:text-slate-800 bg-transparent border-0 cursor-pointer"
              onClick={() => setIsAddingTag(false)}
            >
              Hủy
            </button>
          </form>
        )}
      </div>
    </section>
  );
};
