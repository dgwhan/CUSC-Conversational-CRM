import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { InternalNote } from '../../types.js';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const note = newNoteInput.trim();
    if (!note) return;
    onAddNote(note);
    setNewNoteInput('');
  };

  return (
    <section className="flat-section">
      <div className="flat-section-header">
        <h3 className="flat-section-title">
          Ghi Chú Nội Bộ ({notes.length})
        </h3>
      </div>

      {/* Form nhập ghi chú phẳng */}
      <form onSubmit={handleSubmit} className="flat-note-input-container">
        <textarea
          className="flat-note-textarea"
          rows={2}
          placeholder="Thêm ghi chú nội bộ..."
          value={newNoteInput}
          onChange={(e) => setNewNoteInput(e.target.value)}
        />
        <button
          type="submit"
          className="flat-note-save-btn"
          disabled={!newNoteInput.trim()}
        >
          Lưu ghi chú
        </button>
      </form>

      {/* Danh sách ghi chú */}
      {notes.length > 0 && (
        <div className="flat-notes-list">
          {notes.map((note) => (
            <div key={note.id} className="flat-note-item">
              <div className="flat-note-header">
                <span className="flat-note-author">{note.author}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="flat-note-time">{note.createdAt}</span>
                  <button
                    type="button"
                    className="flat-tag-delete-btn"
                    onClick={() => onRemoveNote(note.id)}
                    title="Xóa ghi chú"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <p className="flat-note-content">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
