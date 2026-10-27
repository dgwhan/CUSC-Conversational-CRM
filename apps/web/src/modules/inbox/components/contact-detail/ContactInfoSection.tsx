import React, { useState, useEffect } from 'react';
import { Copy, Check, PenLine } from 'lucide-react';
import { notify } from '../../../../components/feedback/toastEmitter.js';

interface ContactInfoSectionProps {
  phone?: string;
  email?: string;
  channelAccountName?: string;
  contactId?: string;
  copiedField: string | null;
  onCopy: (text: string, fieldName: string) => void;
  onUpdateContactInfo?: (info: { phone?: string; email?: string; fullName?: string }) => void;
  isEditingPhoneExternal?: boolean;
  onResetEditingPhoneExternal?: () => void;
  isEditingEmailExternal?: boolean;
  onResetEditingEmailExternal?: () => void;
}

export const ContactInfoSection: React.FC<ContactInfoSectionProps> = ({
  phone,
  email,
  channelAccountName,
  contactId,
  copiedField,
  onCopy,
  onUpdateContactInfo,
  isEditingPhoneExternal = false,
  onResetEditingPhoneExternal,
  isEditingEmailExternal = false,
  onResetEditingEmailExternal,
}) => {
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  // Đồng bộ giá trị khởi tạo
  useEffect(() => {
    setPhoneInput(phone && phone !== 'Chưa có SĐT' ? phone : '');
    setEmailInput(email && email !== 'Chưa có Email' ? email : '');
    setIsEditingPhone(false);
    setIsEditingEmail(false);
  }, [phone, email]);

  // Phản hồi trigger sửa từ nút header ("Gọi ngay" / "Gửi Mail")
  useEffect(() => {
    if (isEditingPhoneExternal) {
      setIsEditingPhone(true);
      if (onResetEditingPhoneExternal) onResetEditingPhoneExternal();
    }
  }, [isEditingPhoneExternal, onResetEditingPhoneExternal]);

  useEffect(() => {
    if (isEditingEmailExternal) {
      setIsEditingEmail(true);
      if (onResetEditingEmailExternal) onResetEditingEmailExternal();
    }
  }, [isEditingEmailExternal, onResetEditingEmailExternal]);

  const handleSavePhone = () => {
    const trimmed = phoneInput.trim();
    if (onUpdateContactInfo) {
      onUpdateContactInfo({ phone: trimmed });
    }
    notify.success(trimmed ? 'Đã lưu số điện thoại!' : 'Đã xóa số điện thoại');
    setIsEditingPhone(false);
  };

  const handleSaveEmail = () => {
    const trimmed = emailInput.trim();
    if (onUpdateContactInfo) {
      onUpdateContactInfo({ email: trimmed });
    }
    notify.success(trimmed ? 'Đã lưu email!' : 'Đã xóa email');
    setIsEditingEmail(false);
  };

  const hasPhone = phone && phone !== 'Chưa có SĐT';
  const hasEmail = email && email !== 'Chưa có Email';

  return (
    <section className="flat-section">
      <div className="flat-section-header">
        <h3 className="flat-section-title">Thông Tin Liên Hệ</h3>
      </div>

      <div className="flat-kv-table">
        {/* SỐ ĐIỆN THOẠI */}
        <div className="flat-kv-row">
          <span className="flat-kv-label">Số điện thoại:</span>
          {isEditingPhone ? (
            <div className="flat-inline-edit-box">
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePhone();
                  if (e.key === 'Escape') setIsEditingPhone(false);
                }}
                placeholder="Nhập SĐT..."
                autoFocus
                className="flat-input-field"
              />
              <button type="button" onClick={handleSavePhone} className="flat-btn-save-sm">
                Lưu
              </button>
              <button type="button" onClick={() => setIsEditingPhone(false)} className="flat-btn-cancel-sm">
                Hủy
              </button>
            </div>
          ) : (
            <div className="flat-kv-value-container">
              <span className={`flat-kv-value ${!hasPhone ? 'empty' : ''}`}>
                {hasPhone ? phone : 'Chưa có SĐT'}
              </span>
              <div className="flat-kv-actions">
                {hasPhone && (
                  <button
                    type="button"
                    className="flat-copy-btn"
                    onClick={() => onCopy(phone!, 'Số điện thoại')}
                    title="Sao chép SĐT"
                  >
                    {copiedField === 'Số điện thoại' ? <Check size={12} color="#16803C" /> : <Copy size={12} />}
                  </button>
                )}
                <button
                  type="button"
                  className="flat-inline-edit-btn"
                  onClick={() => {
                    setPhoneInput(hasPhone ? phone! : '');
                    setIsEditingPhone(true);
                  }}
                  title="Chỉnh sửa số điện thoại"
                >
                  <PenLine size={11} />
                  <span>{hasPhone ? 'Sửa' : '+ Thêm'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* EMAIL */}
        <div className="flat-kv-row">
          <span className="flat-kv-label">Email:</span>
          {isEditingEmail ? (
            <div className="flat-inline-edit-box">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEmail();
                  if (e.key === 'Escape') setIsEditingEmail(false);
                }}
                placeholder="Nhập Email..."
                autoFocus
                className="flat-input-field"
              />
              <button type="button" onClick={handleSaveEmail} className="flat-btn-save-sm">
                Lưu
              </button>
              <button type="button" onClick={() => setIsEditingEmail(false)} className="flat-btn-cancel-sm">
                Hủy
              </button>
            </div>
          ) : (
            <div className="flat-kv-value-container">
              <span className={`flat-kv-value ${!hasEmail ? 'empty' : ''}`}>
                {hasEmail ? email : 'Chưa có Email'}
              </span>
              <div className="flat-kv-actions">
                {hasEmail && (
                  <button
                    type="button"
                    className="flat-copy-btn"
                    onClick={() => onCopy(email!, 'Email')}
                    title="Sao chép Email"
                  >
                    {copiedField === 'Email' ? <Check size={12} color="#16803C" /> : <Copy size={12} />}
                  </button>
                )}
                <button
                  type="button"
                  className="flat-inline-edit-btn"
                  onClick={() => {
                    setEmailInput(hasEmail ? email! : '');
                    setIsEditingEmail(true);
                  }}
                  title="Chỉnh sửa email"
                >
                  <PenLine size={11} />
                  <span>{hasEmail ? 'Sửa' : '+ Thêm'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* KÊNH KẾT NỐI */}
        <div className="flat-kv-row">
          <span className="flat-kv-label">Kênh kết nối:</span>
          <div className="flat-kv-value-container">
            <span className="flat-kv-value" style={{ fontWeight: 600 }}>
              {channelAccountName || 'PolarisX Studio'}
            </span>
          </div>
        </div>

        {/* MÃ CONTACT NẾU CÓ */}
        {contactId && (
          <div className="flat-kv-row">
            <span className="flat-kv-label">Mã Contact:</span>
            <div className="flat-kv-value-container">
              <span className="flat-kv-value flat-id-mono">
                {contactId.slice(0, 10)}...
              </span>
              <div className="flat-kv-actions">
                <button
                  type="button"
                  className="flat-copy-btn"
                  onClick={() => onCopy(contactId, 'Mã Contact')}
                  title="Sao chép Mã Contact"
                >
                  {copiedField === 'Mã Contact' ? <Check size={12} color="#16803C" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
