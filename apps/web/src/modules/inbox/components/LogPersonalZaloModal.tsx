import React, { useState } from 'react';
import { X, Smartphone, AlertTriangle, Save } from 'lucide-react';
import { notify } from '../../../components/feedback/toastEmitter.js';
import type { CustomerProfile } from '../types.js';

interface LogPersonalZaloModalProps {
  isOpen: boolean;
  customer: CustomerProfile;
  onClose: () => void;
  onSaveNote: (note: string) => void;
}

export const LogPersonalZaloModal: React.FC<LogPersonalZaloModalProps> = ({
  isOpen,
  customer,
  onClose,
  onSaveNote,
}) => {
  const [zaloName, setZaloName] = useState(customer.fullName);
  const [zaloPhone, setZaloPhone] = useState(customer.phone);
  const [content, setContent] = useState('');
  const [summaryTag, setSummaryTag] = useState('Tư vấn Zalo Cá nhân');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      notify.warning('Vui lòng nhập tóm tắt nội dung trao đổi qua Zalo cá nhân.');
      return;
    }

    const fullNote = `[ZALO CÁ NHÂN - ${zaloName} (${zaloPhone || 'Chưa SĐT'}) - Tag: ${summaryTag}]:\n${content.trim()}`;
    onSaveNote(fullNote);
    notify.success('Đã lưu nhật ký tư vấn Zalo cá nhân vào hồ sơ CRM thành công!');
    onClose();
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="crm-modal-header" style={{ borderBottomColor: '#fed7aa' }}>
          <div className="modal-title-row">
            <Smartphone size={18} style={{ color: '#ea580c' }} />
            <h3 className="modal-title">Ghi nhận Tư vấn từ Zalo Cá nhân</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="crm-modal-body">
          {/* Cảnh báo rủi ro thất thoát dữ liệu */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              padding: '10px 12px',
              background: '#fff7ed',
              border: '1px solid #fdba74',
              borderRadius: '8px',
              color: '#9a3412',
              fontSize: '12px',
              lineHeight: '1.5',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#ea580c' }} />
            <div>
              <strong>Lưu ý bắt buộc cho Tư vấn viên:</strong>
              <p style={{ margin: '2px 0 0' }}>
                Zalo cá nhân không có API đồng bộ tự động. Toàn bộ thông tin thỏa thuận học phí, học bổng và SĐT học viên cần được lưu vào CRM để đảm bảo quyền lợi tính KPI hoa hồng và chăm sóc liên tục.
              </p>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Tên nick Zalo thí sinh / phụ huynh</label>
              <input
                type="text"
                className="crm-form-input"
                value={zaloName}
                onChange={(e) => setZaloName(e.target.value)}
                placeholder="VD: Nguyễn An (Zalo)"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Số điện thoại Zalo</label>
              <input
                type="tel"
                className="crm-form-input"
                value={zaloPhone}
                onChange={(e) => setZaloPhone(e.target.value)}
                placeholder="VD: 0939.882.115"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Phân loại tương tác</label>
            <select
              className="crm-form-select"
              value={summaryTag}
              onChange={(e) => setSummaryTag(e.target.value)}
            >
              <option value="Tư vấn Zalo Cá nhân">Tư vấn Zalo Cá nhân (Lần đầu)</option>
              <option value="Hẹn nộp hồ sơ qua Zalo">Hẹn nộp hồ sơ / Đóng phí qua Zalo</option>
              <option value="Gửi biểu phí & Học bổng Zalo">Đã gửi biểu phí & Học bổng</option>
              <option value="Phụ huynh liên hệ Zalo">Phụ huynh trao đổi Zalo</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tóm tắt nội dung trao đổi & Cam kết tuyển sinh *</label>
            <textarea
              className="crm-form-textarea"
              rows={4}
              placeholder="VD: Em An đã chat Zalo với mình, phụ huynh đồng ý đăng ký khóa Fullstack Web. Đã hẹn 9h sáng thứ 7 đến trung tâm CUSC hoàn tất thủ tục học bổng 20%..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="crm-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" style={{ background: '#ea580c', borderColor: '#ea580c' }}>
              <Save size={15} />
              <span>Lưu vào Hồ sơ CRM</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
