import React, { useState } from 'react';
import { Plus } from 'lucide-react';

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

  const displayTags = tags && tags.length > 0 ? tags : ['Facebook Lead'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    if (!tag) return;
    onAddTag(tag);
    setNewTagInput('');
    setIsAddingTag(false);
  };

  return (
    <section className="flat-section">
      <div className="flat-section-header">
        <h3 className="flat-section-title">
          Nhãn Phân Loại ({displayTags.length})
        </h3>
        {!isAddingTag && (
          <button
            type="button"
            className="flat-link-action"
            onClick={() => setIsAddingTag(true)}
          >
            <Plus size={12} />
            <span>Thêm nhãn</span>
          </button>
        )}
      </div>

      <div className="flat-tags-container">
        {displayTags.map((tag, idx) => (
          <span key={idx} className="flat-tag-item">
            <span>{tag}</span>
            <button
              type="button"
              className="flat-tag-delete-btn"
              onClick={() => onRemoveTag(tag)}
              title="Xóa nhãn"
            >
              &times;
            </button>
          </span>
        ))}

        {isAddingTag && (
          <form onSubmit={handleSubmit} className="flat-inline-edit-box">
            <input
              type="text"
              className="flat-input-field"
              placeholder="Nhập tên nhãn..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="flat-btn-save-sm">
              Lưu
            </button>
            <button
              type="button"
              className="flat-btn-cancel-sm"
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
