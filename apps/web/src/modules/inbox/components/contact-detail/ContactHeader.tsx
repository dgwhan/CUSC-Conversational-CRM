import React from 'react';
import { Phone, Mail, MoreHorizontal, Copy, Check, ExternalLink } from 'lucide-react';
import type { CustomerProfile } from '../../types.js';
import { Avatar } from '../../../../components/common/Avatar.js';

interface ContactHeaderProps {
  customer: CustomerProfile;
  copiedField: string | null;
  onCopy: (text: string, fieldName: string) => void;
  onStartEditPhone: () => void;
  onStartEditEmail: () => void;
  onOpenMenu: () => void;
}

export const ContactHeader: React.FC<ContactHeaderProps> = ({
  customer,
  copiedField,
  onCopy,
  onStartEditPhone,
  onStartEditEmail,
  onOpenMenu,
}) => {
  const channelType = (customer.channel || 'facebook').toLowerCase();

  // Lấy chính xác ID của KHÁCH HÀNG (không lấy ID của Fanpage)
  const customerId =
    customer.socialId ||
    customer.channelIdentities?.[0]?.externalUserId ||
    customer.id ||
    '';

  return (
    <header className="flat-contact-header">
      <div className="flat-header-top-row">
        <div className="flat-avatar-wrapper">
          <Avatar
            src={customer.avatarUrl}
            name={customer.fullName || 'Dương Ngọc Hân'}
            size={54}
            className="flat-avatar"
          />
          <span
            className={`flat-channel-badge ${channelType}`}
            title={customer.channel || 'Facebook Messenger'}
          >
            f
          </span>
        </div>

        <div className="flat-header-identity">
          <div className="flat-name-row">
            <h2 className="flat-customer-name">
              {customer.fullName || 'Dương Ngọc Hân'}
            </h2>
            <span className="flat-verified-icon" title="Kênh xác thực Facebook">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </span>
          </div>

          {/* Dòng 1: ID của khách */}
          <div className="flat-external-id-row">
            <span>ID:</span>
            <span className="flat-id-mono" title={customerId}>
              {customerId}
            </span>
            <button
              type="button"
              className="flat-copy-btn"
              onClick={() => onCopy(customerId, 'ID khách hàng')}
              title="Sao chép ID khách hàng"
            >
              {copiedField === 'ID khách hàng' ? <Check size={12} color="#16803C" /> : <Copy size={12} />}
            </button>
          </div>

          {/* Dòng 2: Link mở hội thoại trên Meta Business Suite hoặc Profile thật nếu có */}
          <div className="flat-link-fb-row">
            {customer.profileUrl ? (
              <a
                href={customer.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flat-link-fb"
                title={`Mở trang cá nhân Facebook: ${customer.profileUrl}`}
              >
                <ExternalLink size={11} />
                <span>Trang cá nhân Facebook</span>
              </a>
            ) : (
              <a
                href={`https://business.facebook.com/latest/inbox/messenger?selected_item_id=${customerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flat-link-fb"
                title="Mở hội thoại khách hàng trên Meta Business Suite của Fanpage"
              >
                <ExternalLink size={11} />
                <span>Mở trên Meta Business Suite</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Nút thao tác nhanh: Gọi ngay, Gửi Mail, Menu */}
      <div className="flat-header-actions">
        {customer.phone && customer.phone !== 'Chưa có SĐT' ? (
          <a
            href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
            className="flat-btn flat-btn-primary"
            title="Gọi ngay"
          >
            <Phone size={13} />
            <span>Gọi ngay</span>
          </a>
        ) : (
          <button
            type="button"
            className="flat-btn flat-btn-primary"
            onClick={onStartEditPhone}
            title="Khách chưa có SĐT. Bấm để thêm nhanh"
          >
            <Phone size={13} />
            <span>Gọi ngay</span>
          </button>
        )}

        {customer.email && customer.email !== 'Chưa có Email' ? (
          <a
            href={`mailto:${customer.email}`}
            className="flat-btn flat-btn-secondary"
            title="Gửi Mail"
          >
            <Mail size={13} />
            <span>Gửi Mail</span>
          </a>
        ) : (
          <button
            type="button"
            className="flat-btn flat-btn-secondary"
            onClick={onStartEditEmail}
            title="Khách chưa có Email. Bấm để thêm nhanh"
          >
            <Mail size={13} />
            <span>Gửi Mail</span>
          </button>
        )}

        <button
          type="button"
          className="flat-btn flat-btn-menu"
          onClick={onOpenMenu}
          title="Ghi nhận nhật ký tư vấn Zalo / Thao tác khác"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </header>
  );
};
