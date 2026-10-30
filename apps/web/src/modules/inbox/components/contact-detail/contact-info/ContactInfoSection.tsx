import React, { useState, useEffect } from 'react';
import { Copy, Check, PenLine } from 'lucide-react';
import { notify } from '../../../../../components/feedback/toastEmitter.js';

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

/**
 * Section: Thông Tin Liên Hệ
 * Giao diện phẳng chuẩn Tailwind CSS, hỗ trợ inline edit SĐT & Email
 */
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
    <section className="p-4 border-b border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-slate-800 m-0">
          Thông Tin Liên Hệ
        </h3>
      </div>

      <div className="flex flex-col gap-2 text-[12.5px]">
        {/* SỐ ĐIỆN THOẠI */}
        <div className="flex items-center justify-between py-1 min-h-[30px]">
          <span className="text-slate-500 text-[12px] w-24 shrink-0">
            Số điện thoại:
          </span>
          {isEditingPhone ? (
            <div className="flex items-center gap-1.5 flex-1 justify-end">
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
                className="px-2 py-0.5 text-[12px] border border-blue-500 rounded bg-white text-slate-800 outline-none w-32"
              />
              <button
                type="button"
                onClick={handleSavePhone}
                className="px-2 py-0.5 text-[11px] font-medium bg-blue-600 text-white rounded hover:bg-blue-700 border-0 cursor-pointer transition-colors"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPhone(false)}
                className="px-1.5 py-0.5 text-[11px] text-slate-500 hover:text-slate-800 bg-transparent border-0 cursor-pointer"
              >
                Hủy
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-end flex-1 min-w-0">
              <span className={`font-medium truncate ${!hasPhone ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                {hasPhone ? phone : 'Chưa có SĐT'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {hasPhone && (
                  <button
                    type="button"
                    onClick={() => onCopy(phone!, 'Số điện thoại')}
                    className="p-1 text-slate-400 hover:text-blue-600 bg-transparent border-0 cursor-pointer transition-colors"
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
                  className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:text-blue-800 bg-transparent border-0 cursor-pointer font-medium"
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
        <div className="flex items-center justify-between py-1 min-h-[30px]">
          <span className="text-slate-500 text-[12px] w-24 shrink-0">
            Email:
          </span>
          {isEditingEmail ? (
            <div className="flex items-center gap-1.5 flex-1 justify-end">
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
                className="px-2 py-0.5 text-[12px] border border-blue-500 rounded bg-white text-slate-800 outline-none w-36"
              />
              <button
                type="button"
                onClick={handleSaveEmail}
                className="px-2 py-0.5 text-[11px] font-medium bg-blue-600 text-white rounded hover:bg-blue-700 border-0 cursor-pointer transition-colors"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => setIsEditingEmail(false)}
                className="px-1.5 py-0.5 text-[11px] text-slate-500 hover:text-slate-800 bg-transparent border-0 cursor-pointer"
              >
                Hủy
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-end flex-1 min-w-0">
              <span className={`font-medium truncate ${!hasEmail ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                {hasEmail ? email : 'Chưa có Email'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {hasEmail && (
                  <button
                    type="button"
                    onClick={() => onCopy(email!, 'Email')}
                    className="p-1 text-slate-400 hover:text-blue-600 bg-transparent border-0 cursor-pointer transition-colors"
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
                  className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:text-blue-800 bg-transparent border-0 cursor-pointer font-medium"
                  title="Chỉnh sửa email"
                >
                  <PenLine size={11} />
                  <span>{hasEmail ? 'Sửa' : '+ Thêm'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MÃ CONTACT NẾU CÓ */}
        {contactId && (
          <div className="flex items-center justify-between py-1 min-h-[30px]">
            <span className="text-slate-500 text-[12px] w-24 shrink-0">
              Mã Contact:
            </span>
            <div className="flex items-center gap-2 justify-end flex-1 min-w-0">
              <span className="font-mono text-[12px] text-slate-700 truncate">
                {contactId.slice(0, 10)}...
              </span>
              <button
                type="button"
                onClick={() => onCopy(contactId, 'Mã Contact')}
                className="p-1 text-slate-400 hover:text-blue-600 bg-transparent border-0 cursor-pointer transition-colors"
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
    </section>
  );
};
