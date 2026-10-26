import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, RotateCcw, Zap } from 'lucide-react';
import type { QuickReplyItem } from '../types.js';
import { MOCK_QUICK_REPLIES } from '../mockData.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

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
            shortcut: editShortcut.trim() ? (editShortcut.startsWith('/') ? editShortcut.trim() : `/${editShortcut.trim()}`) : undefined,
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
      shortcut: newShortcut.trim() ? (newShortcut.startsWith('/') ? newShortcut.trim() : `/${newShortcut.trim()}`) : undefined,
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
    <div className="crm-modal-overlay" onClick={onClose}>
      <div
        className="crm-modal-container"
        style={{ maxWidth: '640px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="crm-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={20} color="#0284c7" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Tùy Chỉnh Danh Sách Tin Nhắn Nhanh</h3>
          </div>
          <button
            type="button"
            className="crm-btn-ghost"
            style={{ padding: '4px', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Form thêm mới */}
          <form onSubmit={handleAddNew} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} /> Thêm mẫu tin nhắn nhanh mới
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tiêu đề gợi nhớ *</label>
                <input
                  type="text"
                  className="crm-form-input"
                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                  placeholder="VD: Lời chào khai giảng"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Phím tắt (tùy chọn)</label>
                <input
                  type="text"
                  className="crm-form-input"
                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                  placeholder="VD: /chao"
                  value={newShortcut}
                  onChange={(e) => setNewShortcut(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nội dung tin nhắn *</label>
              <textarea
                className="crm-form-textarea"
                rows={2}
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                placeholder="Nhập nội dung mẫu câu trả lời tư vấn..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="crm-btn crm-btn-primary"
                style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Thêm mẫu tin
              </button>
            </div>
          </form>

          {/* Danh sách tin nhắn nhanh hiện tại */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
              Danh sách đang sử dụng ({replies.length})
            </h4>
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn-sm"
              style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={handleResetDefaults}
              title="Khôi phục lại các mẫu mặc định"
            >
              <RotateCcw size={12} /> Khôi phục mẫu mặc định
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {replies.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  background: editingId === item.id ? '#eff6ff' : '#ffffff',
                }}
              >
                {editingId === item.id ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        className="crm-form-input"
                        style={{ padding: '6px 8px', fontSize: '13px' }}
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Tiêu đề"
                      />
                      <input
                        type="text"
                        className="crm-form-input"
                        style={{ padding: '6px 8px', fontSize: '13px' }}
                        value={editShortcut}
                        onChange={(e) => setEditShortcut(e.target.value)}
                        placeholder="Phím tắt (/...)"
                      />
                    </div>
                    <textarea
                      className="crm-form-textarea"
                      rows={2}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '13px', marginBottom: '8px' }}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary crm-btn-sm"
                        onClick={() => setEditingId(null)}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        className="crm-btn crm-btn-primary crm-btn-sm"
                        onClick={() => handleSaveEdit(item.id)}
                      >
                        <Check size={12} /> Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.label}</strong>
                        {item.shortcut && (
                          <span
                            style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {item.shortcut}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="crm-btn-ghost"
                          style={{ padding: '4px', cursor: 'pointer', color: '#64748b' }}
                          onClick={() => handleStartEdit(item)}
                          title="Sửa mẫu này"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="crm-btn-ghost"
                          style={{ padding: '4px', cursor: 'pointer', color: '#ef4444' }}
                          onClick={() => handleDelete(item.id)}
                          title="Xóa mẫu này"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                      {item.content}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={onClose}
            style={{ padding: '6px 18px', fontSize: '13px' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
