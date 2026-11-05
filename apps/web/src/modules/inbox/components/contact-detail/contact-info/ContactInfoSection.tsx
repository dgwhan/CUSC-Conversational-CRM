import React, { useState, useEffect } from 'react';
import { Copy, Check, PenLine, Phone, Mail, Plus, AlertCircle } from 'lucide-react';
import { notify } from '../../../../../components/feedback/toastEmitter.js';
import { Button } from '../../../../../components/ui/Button.js';
import { Modal } from '../../../../../components/ui/Modal.js';
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
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);

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
      notify.error('Số điện thoại không hợp lệ (yêu cầu đúng 10 chữ số)!');
      return;
    }

    if (onUpdateContactInfo) {
      onUpdateContactInfo({ phone: standardized });
    }
    notify.success(`Đã lưu: ${standardized}`);
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
    <div className="p-4 bg-white space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 shrink-0">
          <h4 className="m-0 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Thông Tin Liên Hệ
          </h4>
          <button
            type="button"
            onClick={() => setIsExplainModalOpen(true)}
            className="inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded"
            title="Xem giải thích thông tin liên hệ"
            aria-label="Giải thích thông tin liên hệ"
          >
            <AlertCircle size={13} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {/* SỐ ĐIỆN THOẠI */}
        <div className="group flex items-center justify-between text-xs py-1 rounded hover:bg-slate-50 px-1 -mx-1 transition-colors">
          <div className="flex items-center gap-2 text-slate-500 shrink-0">
            <Phone size={13} className="text-slate-400" />
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
                className="h-6 px-2 text-xs border border-blue-500 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSavePhone}
                className="h-6 px-1.5 text-[11px]"
              >
                Lưu
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditingPhone(false)}
                className="h-6 px-1.5 text-[11px]"
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
                {hasPhone ? formatVietnamesePhoneNumber(phone, 'space') || phone : 'Chưa có'}
              </span>

              {/* Action icons: Hiển thị khi hover */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {hasPhone && (
                  <button
                    type="button"
                    onClick={() => onCopy(phone!, 'Số điện thoại')}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                    title="Sao chép SĐT"
                  >
                    {copiedField === 'Số điện thoại' ? (
                      <Check size={11} className="text-emerald-600" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPhoneInput(hasPhone ? phone! : '');
                    setIsEditingPhone(true);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                  title={hasPhone ? 'Sửa SĐT' : 'Thêm SĐT'}
                >
                  {hasPhone ? <PenLine size={11} /> : <Plus size={11} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* EMAIL */}
        <div className="group flex items-center justify-between text-xs py-1 rounded hover:bg-slate-50 px-1 -mx-1 transition-colors">
          <div className="flex items-center gap-2 text-slate-500 shrink-0">
            <Mail size={13} className="text-slate-400" />
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
                placeholder="email@example.com"
                autoFocus
                className="h-6 px-2 text-xs border border-blue-500 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveEmail}
                className="h-6 px-1.5 text-[11px]"
              >
                Lưu
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditingEmail(false)}
                className="h-6 px-1.5 text-[11px]"
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
                title={hasEmail ? email : undefined}
              >
                {hasEmail ? email : 'Chưa có'}
              </span>

              {/* Action icons: Hiển thị khi hover */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {hasEmail && (
                  <button
                    type="button"
                    onClick={() => onCopy(email!, 'Email')}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                    title="Sao chép Email"
                  >
                    {copiedField === 'Email' ? (
                      <Check size={11} className="text-emerald-600" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setEmailInput(hasEmail ? email! : '');
                    setIsEditingEmail(true);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                  title={hasEmail ? 'Sửa Email' : 'Thêm Email'}
                >
                  {hasEmail ? <PenLine size={11} /> : <Plus size={11} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Giải thích Thông Tin Liên Hệ */}
      <Modal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        title="Thông Tin Liên Hệ Khách Hàng"
        size="md"
        showCloseButton={true}
        primaryAction={{
          label: 'Đã hiểu',
          onClick: () => setIsExplainModalOpen(false),
          variant: 'primary',
        }}
      >
        <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              1. Số điện thoại (SĐT) & Hợp nhất tự động
            </h5>
            <p className="m-0 text-slate-600">
              Số điện thoại được chuẩn hóa tự động theo định dạng quốc gia (10 số). Khi cùng một SĐT xuất hiện trên các kênh khác nhau (Facebook, Zalo, Web), hệ thống sẽ tự động gộp chung vào hồ sơ này.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              2. Địa chỉ Email
            </h5>
            <p className="m-0 text-slate-600">
              Dùng để gửi thông tin báo giá, hợp đồng điện tử và tài liệu tư vấn chi tiết cho khách hàng.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              3. Chỉnh sửa nhanh & Sao chép tiện lợi
            </h5>
            <p className="m-0 text-slate-600">
              Bạn có thể nhấn vào biểu tượng cây bút để sửa trực tiếp hoặc nhấn nút sao chép để dán nhanh vào ứng dụng gọi điện/CRM ngoài.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
