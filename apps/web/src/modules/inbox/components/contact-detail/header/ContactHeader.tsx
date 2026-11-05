import React from 'react';
import { Phone, Mail, MoreHorizontal, Copy, Check, ExternalLink } from 'lucide-react';
import type { CustomerProfile } from '../../../types.js';
import { Avatar } from '../../../../../components/common/Avatar.js';
import { Button } from '../../../../../components/ui/Button.js';
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
  const customerId =
    customer.socialId ||
    customer.channelIdentities?.[0]?.externalUserId ||
    customer.id ||
    '';

  const channelMeta = resolveChannelInfo(customer.channel, customer.socialId, customer.profileUrl);
  const displayName = customer.fullName?.trim() || 'Khách hàng';
  const isVerified = (customer as any).isVerified === true;

  const hasPhone = Boolean(customer.phone && customer.phone !== 'Chưa có SĐT');
  const hasEmail = Boolean(customer.email && customer.email !== 'Chưa có Email');

  return (
    <div className="p-4 bg-white flex flex-col gap-3">
      {/* 1. Profile Avatar & Information Header */}
      <div className="flex items-start gap-3">
        {/* Avatar with Channel Badge */}
        <div className="relative shrink-0">
          <Avatar
            src={customer.avatarUrl}
            name={displayName}
            size={44}
            className="rounded-full border border-slate-200/80"
          />
          <span
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white ring-2 ring-white overflow-hidden"
            style={{ backgroundColor: channelMeta.badgeBg }}
            title={channelMeta.label}
          >
            {channelMeta.iconUrl ? (
              <img
                src={channelMeta.iconUrl}
                alt={channelMeta.label}
                className="w-3 h-3 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              channelMeta.badgeText
            )}
          </span>
        </div>

        {/* Identity Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="m-0 text-sm font-semibold text-slate-900 truncate" title={displayName}>
              {displayName}
            </h3>
            {isVerified && (
              <span className="text-blue-500 shrink-0" title={`Kênh xác thực (${channelMeta.label})`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </span>
            )}
          </div>

          <p className="m-0 text-xs text-slate-500 truncate mt-0.5">
            {customer.channel ? `Khách qua ${channelMeta.label}` : 'Khách hàng tiềm năng'}
          </p>

          {/* Customer ID Row */}
          {customerId && (
            <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400">
              <span className="text-slate-400">ID:</span>
              <span className="font-mono text-slate-500 truncate max-w-[120px]" title={customerId}>
                {customerId}
              </span>
              <button
                type="button"
                className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                onClick={() => onCopy(customerId, 'ID khách hàng')}
                title="Sao chép ID"
              >
                {copiedField === 'ID khách hàng' ? (
                  <Check size={11} className="text-emerald-600" />
                ) : (
                  <Copy size={11} />
                )}
              </button>
            </div>
          )}

          {/* External Profile Link */}
          {channelMeta.externalLink && (
            <a
              href={channelMeta.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
              title={channelMeta.externalLinkLabel || 'Mở liên kết ngoài'}
            >
              <ExternalLink size={11} />
              <span className="truncate">{channelMeta.externalLinkLabel}</span>
            </a>
          )}
        </div>
      </div>

      {/* 2. Action Buttons (Gọi ngay, Gửi Mail, Menu) */}
      <div className="grid grid-cols-12 gap-1.5 pt-1">
        {hasPhone ? (
          <a
            href={`tel:${customer.phone?.replace(/[^0-9]/g, '')}`}
            className="col-span-5 inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            title="Gọi điện ngay"
          >
            <Phone size={12} />
            <span>Gọi ngay</span>
          </a>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Phone size={12} />}
            onClick={onStartEditPhone}
            className="col-span-5 h-7 text-xs font-medium"
            title="Khách chưa có SĐT. Bấm để thêm nhanh"
          >
            Gọi ngay
          </Button>
        )}

        {hasEmail ? (
          <a
            href={`mailto:${customer.email}`}
            className="col-span-5 inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 transition-colors"
            title="Gửi email"
          >
            <Mail size={12} />
            <span>Gửi Mail</span>
          </a>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Mail size={12} />}
            onClick={onStartEditEmail}
            className="col-span-5 h-7 text-xs font-medium"
            title="Khách chưa có Email. Bấm để thêm nhanh"
          >
            Gửi Mail
          </Button>
        )}

        <button
          type="button"
          onClick={onOpenMenu}
          className="col-span-2 h-7 flex items-center justify-center rounded-md border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          title="Tùy chọn khác / Ghi nhận Zalo cá nhân"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  );
};
