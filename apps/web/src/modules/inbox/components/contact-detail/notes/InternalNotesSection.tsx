import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { InternalNote } from '../../../types.js';

interface InternalNotesSectionProps {
  notes?: InternalNote[];
  onAddNote: (content: string) => void;
  onRemoveNote: (noteId: string) => void;
}

/**
 * Section: Ghi Chú Nội Bộ
 * Thiết kế phẳng bằng Tailwind CSS
 */
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
    <section className="p-4 border-b border-slate-200">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[13px] font-semibold text-slate-800 m-0">
          Ghi Chú Nội Bộ ({notes.length})
        </h3>
      </div>

      {/* Form nhập ghi chú */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-3">
        <textarea
          rows={2}
          placeholder="Thêm ghi chú nội bộ..."
          value={newNoteInput}
          onChange={(e) => setNewNoteInput(e.target.value)}
          className="w-full p-2 text-[12px] border border-slate-300 rounded bg-white text-slate-800 outline-none focus:border-blue-500 resize-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!newNoteInput.trim()}
            className="px-2.5 py-1 text-[11.5px] font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed border-0 cursor-pointer transition-colors"
          >
            Lưu ghi chú
          </button>
        </div>
      </form>

      {/* Danh sách ghi chú */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[12px]"
            >
              <div className="flex items-center justify-between mb-1 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">{note.author}</span>
                <div className="flex items-center gap-2">
                  <span>{note.createdAt}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveNote(note.id)}
                    className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0"
                    title="Xóa ghi chú"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <p className="text-slate-800 m-0 leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
