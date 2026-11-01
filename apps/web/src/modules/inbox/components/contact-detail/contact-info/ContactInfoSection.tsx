import React, { useState, useEffect } from 'react';
import { Copy, Check, PenLine, Phone, Mail, Hash } from 'lucide-react';
import { notify } from '../../../../../components/feedback/toastEmitter.js';
import { Button } from '../../../../../components/ui/Button.js';
import {
  standardizeVietnamesePhoneNumber,
  formatVietnamesePhoneNumber,
} from '../../../../../lib/phone.js';

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
    if (!trimmed) {
      if (onUpdateContactInfo) {
        onUpdateContactInfo({ phone: '' });
      }
      notify.success('Đã xóa số điện thoại');
      setIsEditingPhone(false);
      return;
    }

    const standardized = standardizeVietnamesePhoneNumber(trimmed);
    if (!standardized) {
      notify.error('Số điện thoại sai độ dài hoặc không hợp lệ (yêu cầu đúng 10 chữ số)!');
      return;
    }

    if (onUpdateContactInfo) {
      onUpdateContactInfo({ phone: standardized });
    }
    notify.success(`Đã chuẩn hóa và lưu: ${standardized}`);
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

  const hasPhone = Boolean(phone && phone !== 'Chưa có SĐT');
  const hasEmail = Boolean(email && email !== 'Chưa có Email');

  return (
    <div className="p-4 bg-white space-y-3">
      <h4 className="m-0 text-xs font-bold text-slate-800 uppercase tracking-wider">
        Thông Tin Liên Hệ
      </h4>

      <div className="space-y-2.5">
        {/* SỐ ĐIỆN THOẠI */}
        <div className="flex items-center justify-between text-xs py-1">
          <div className="flex items-center gap-2 text-slate-500 shrink-0">
            <Phone size={14} className="text-slate-400" />
            <span>SĐT:</span>
          </div>

          {isEditingPhone ? (
            <div className="flex items-center gap-1.5 flex-1 justify-end ml-2">
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePhone();
                  if (e.key === 'Escape') setIsEditingPhone(false);
                }}
                placeholder="0939..."
                autoFocus
                className="h-7 px-2 text-xs border border-blue-500 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSavePhone}
                className="h-7 px-2 text-[11px]"
              >
                Lưu
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditingPhone(false)}
                className="h-7 px-1.5 text-[11px]"
              >
                Hủy
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 justify-end flex-1 min-w-0 ml-2">
              <span
                className={`truncate font-medium ${
                  hasPhone ? 'text-slate-800' : 'text-slate-400 italic'
                }`}
              >
                {hasPhone ? formatVietnamesePhoneNumber(phone, 'space') || phone : 'Chưa có SĐT'}
              </span>

              {hasPhone && (
                <button
                  type="button"
                  onClick={() => onCopy(phone!, 'Số điện thoại')}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                  title="Sao chép SĐT"
                >
                  {copiedField === 'Số điện thoại' ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setPhoneInput(hasPhone ? phone! : '');
                  setIsEditingPhone(true);
                }}
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer ml-0.5"
                title="Chỉnh sửa số điện thoại"
              >
                <PenLine size={11} />
                <span>{hasPhone ? 'Sửa' : '+ Thêm'}</span>
              </button>
            </div>
          )}
        </div>

        {/* EMAIL */}
        <div className="flex items-center justify-between text-xs py-1">
          <div className="flex items-center gap-2 text-slate-500 shrink-0">
            <Mail size={14} className="text-slate-400" />
            <span>Email:</span>
          </div>

          {isEditingEmail ? (
            <div className="flex items-center gap-1.5 flex-1 justify-end ml-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEmail();
                  if (e.key === 'Escape') setIsEditingEmail(false);
                }}
                placeholder="example@..."
                autoFocus
                className="h-7 px-2 text-xs border border-blue-500 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveEmail}
                className="h-7 px-2 text-[11px]"
              >
                Lưu
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditingEmail(false)}
                className="h-7 px-1.5 text-[11px]"
              >
                Hủy
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 justify-end flex-1 min-w-0 ml-2">
              <span
                className={`truncate font-medium ${
                  hasEmail ? 'text-slate-800' : 'text-slate-400 italic'
                }`}
                title={email}
              >
                {hasEmail ? email : 'Chưa có Email'}
              </span>

              {hasEmail && (
                <button
                  type="button"
                  onClick={() => onCopy(email!, 'Email')}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                  title="Sao chép Email"
                >
                  {copiedField === 'Email' ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setEmailInput(hasEmail ? email! : '');
                  setIsEditingEmail(true);
                }}
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer ml-0.5"
                title="Chỉnh sửa Email"
              >
                <PenLine size={11} />
                <span>{hasEmail ? 'Sửa' : '+ Thêm'}</span>
              </button>
            </div>
          )}
        </div>

        {/* MÃ CONTACT CRM NẾU CÓ */}
        {contactId && (
          <div className="flex items-center justify-between text-xs py-1">
            <div className="flex items-center gap-2 text-slate-500 shrink-0">
              <Hash size={14} className="text-slate-400" />
              <span>Contact ID:</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end flex-1 min-w-0 ml-2">
              <span className="font-mono text-slate-700 truncate" title={contactId}>
                {contactId.slice(0, 10)}...
              </span>
              <button
                type="button"
                onClick={() => onCopy(contactId, 'Mã Contact')}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                title="Sao chép Mã Contact"
              >
                {copiedField === 'Mã Contact' ? (
                  <Check size={12} className="text-emerald-600" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
