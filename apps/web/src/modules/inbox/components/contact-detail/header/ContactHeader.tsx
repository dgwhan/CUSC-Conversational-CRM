import React from 'react';
import { Phone, Mail, MoreHorizontal, Copy, Check, ExternalLink } from 'lucide-react';
import type { CustomerProfile } from '../../../types.js';
import { Avatar } from '../../../../../components/common/Avatar.js';
import { resolveChannelInfo } from '../../../../../lib/channel-meta.js';

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
  // Lấy chính xác ID của KHÁCH HÀNG
  const customerId =
    customer.socialId ||
    customer.channelIdentities?.[0]?.externalUserId ||
    customer.id ||
    '';

  const channelMeta = resolveChannelInfo(customer.channel, customer.socialId, customer.profileUrl);

  const displayName = customer.fullName?.trim() || 'Khách hàng';

  // Chỉ hiển thị tích xác thực nếu có cờ verified thực sự từ kênh
  const isVerified = (customer as any).isVerified === true;

  return (
    <header className="flat-contact-header">
      <div className="flat-header-top-row">
        <div className="flat-avatar-wrapper">
          <Avatar
            src={customer.avatarUrl}
            name={displayName}
            size={54}
            className="flat-avatar"
          />
          <span
            className={`flat-channel-badge ${channelMeta.key.toLowerCase()}`}
            style={{ backgroundColor: channelMeta.badgeBg }}
            title={channelMeta.label}
          >
            {channelMeta.iconUrl ? (
              <img
                src={channelMeta.iconUrl}
                alt={channelMeta.label}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              channelMeta.badgeText
            )}
          </span>
        </div>

        <div className="flat-header-identity">
          <div className="flat-name-row">
            <h2 className="flat-customer-name" title={displayName}>
              {displayName}
            </h2>
            {isVerified && (
              <span className="flat-verified-icon" title={`Kênh xác thực (${channelMeta.label})`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </span>
            )}
          </div>

          {/* Dòng 1: ID của khách */}
          {customerId && (
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
          )}

          {/* Dòng 2: Link mở hội thoại ngoài tùy biến theo từng kênh (Meta Suite, Zalo Web, TikTok, Profile URL) */}
          {channelMeta.externalLink && (
            <div className="flat-link-fb-row">
              <a
                href={channelMeta.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flat-link-fb"
                title={channelMeta.externalLinkLabel || 'Mở liên kết'}
              >
                <ExternalLink size={11} />
                <span>{channelMeta.externalLinkLabel}</span>
              </a>
            </div>
          )}
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
          title="Ghi nhận nhật ký tư vấn / Thao tác khác"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </header>
  );
};
