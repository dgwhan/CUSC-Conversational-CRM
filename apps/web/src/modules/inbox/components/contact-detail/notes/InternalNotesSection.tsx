import React, { useState } from 'react';
import { Trash2, MessageSquarePlus } from 'lucide-react';
import type { InternalNote } from '../../../types.js';
import { Button } from '../../../../../components/ui/Button.js';

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
    <div className="p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-xs font-bold text-slate-800 uppercase tracking-wider">
          Ghi Chú Nội Bộ ({notes.length})
        </h4>
      </div>

      {/* Form nhập ghi chú */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          rows={2}
          placeholder="Thêm ghi chú nội bộ cho tư vấn viên..."
          value={newNoteInput}
          onChange={(e) => setNewNoteInput(e.target.value)}
          className="w-full min-h-[50px] p-2.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none transition-all leading-relaxed"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={<MessageSquarePlus size={13} />}
            disabled={!newNoteInput.trim()}
            className="h-7 px-3 text-xs"
          >
            Lưu ghi chú
          </Button>
        </div>
      </form>

      {/* Danh sách ghi chú */}
      {notes.length > 0 && (
        <div className="space-y-2 pt-1">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-700">{note.author}</span>
                <div className="flex items-center gap-2">
                  <span>{note.createdAt}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveNote(note.id)}
                    className="p-0.5 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
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
    </div>
  );
};
