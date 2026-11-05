import React from 'react';
import {
  CheckCheck,
  Tag,
  UserCheck,
  UserX,
  Clock,
  Moon,
} from 'lucide-react';
import type { ConversationItem, ChannelType } from '../../../types.js';
import { formatConversationTime, getUnresponsiveStatus } from '../../../utils/index.js';
import { Avatar } from '../../../../../components/common/Avatar.js';
import { resolveChannelInfo } from '../../../../../lib/channel-meta.js';

export interface ConversationCardProps {
  item: ConversationItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  alertThresholdMinutes?: number;
}

export const ConversationCard: React.FC<ConversationCardProps> = ({
  item,
  isSelected,
  onSelect,
  alertThresholdMinutes = 15,
}) => {
  const hasUnread = item.unreadCount > 0;
  const { isOverdue, waitingMinutes } = getUnresponsiveStatus(item, alertThresholdMinutes);
  const isOutOfOffice = Boolean(
    item.tags?.some((t) => {
      const lower = String(t || '').toLowerCase();
      return (
        lower.includes('ngoài giờ') ||
        lower.includes('ngoai_gio') ||
        lower.includes('hẹn tư vấn') ||
        lower.includes('sáng mai') ||
        lower.includes('hôm sau')
      );
    }),
  );

  // Helper render channel badge overlay on avatar
  const renderChannelBadge = (channel: ChannelType) => {
    const meta = resolveChannelInfo(channel);
    return (
      <span
        className="absolute -bottom-0.5 -right-0.5 w-[20px] h-[20px] rounded-full text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-sm overflow-hidden"
        style={{ backgroundColor: meta.badgeBg }}
        title={meta.label}
      >
        {meta.iconUrl ? (
          <img
            src={meta.iconUrl}
            alt={meta.label}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          meta.badgeText
        )}
      </span>
    );
  };

  return (
    <div
      className={`relative flex items-start gap-3 p-3 transition-colors cursor-pointer border-l-[3px] ${
        isSelected
          ? 'bg-blue-50/70 border-l-blue-600'
          : isOutOfOffice
          ? 'bg-amber-50/20 border-l-amber-500 hover:bg-amber-50/50'
          : isOverdue
          ? 'bg-rose-50/30 border-l-rose-500 hover:bg-rose-50/60'
          : hasUnread
          ? 'bg-slate-50/60 border-l-transparent hover:bg-slate-100/70'
          : 'bg-white border-l-transparent hover:bg-slate-50/80'
      }`}
      onClick={() => onSelect(item.id)}
    >
      {/* Avatar kèm Badge kênh liên hệ */}
      <div className="relative shrink-0">
        <Avatar
          src={item.customer.avatarUrl}
          name={item.customer.fullName}
          size={42}
          className="border border-slate-200 shadow-sm"
          badge={renderChannelBadge(item.channel)}
        />
      </div>

      {/* Thông tin hội thoại */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={`text-[13px] truncate ${
              hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
            }`}
          >
            {item.customer.fullName}
          </span>
          <div className="flex items-center gap-1.5 ml-1.5 shrink-0">
            {isOverdue && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded leading-none shadow-xs"
                title={`Chưa phản hồi ${waitingMinutes} phút (vượt mốc cảnh báo ${alertThresholdMinutes} phút)`}
              >
                <Clock size={10} className="text-rose-600 animate-pulse" />
                <span>{waitingMinutes >= 60 ? `${Math.floor(waitingMinutes / 60)}h${waitingMinutes % 60}p` : `${waitingMinutes}p`}</span>
              </span>
            )}
            {isOutOfOffice && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded leading-none shadow-xs"
                title="Tin nhắn đến ngoài giờ làm việc - Cần tư vấn trao đổi trong ngày hôm sau"
              >
                <Moon size={9} className="text-amber-700" />
                <span>Hẹn sáng mai</span>
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
              {formatConversationTime(item.lastMessageAt)}
            </span>
          </div>
        </div>

        <p
          className={`text-xs truncate leading-snug mb-1.5 ${
            hasUnread ? 'font-semibold text-slate-800' : 'text-slate-500 font-normal'
          }`}
        >
          {item.snippet || 'Hội thoại mới'}
        </p>

        <div className="flex items-center justify-between gap-1">
          {/* Nhãn tags */}
          <div className="flex items-center gap-1 overflow-hidden">
            {item.tags.slice(0, 2).map((tag: string, idx: number) => (
              <span
                key={idx}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded leading-none shrink-0"
              >
                <Tag size={9} />
                {tag}
              </span>
            ))}
            {item.tags.length > 2 && (
              <span className="text-[11px] text-slate-400 font-medium shrink-0">
                +{item.tags.length - 2}
              </span>
            )}
          </div>

          {/* Chỉ báo trạng thái đọc & Nhân viên phụ trách */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {hasUnread ? (
              <span className="text-[11px] font-bold bg-red-500 text-white px-1.5 py-0.5 min-w-[18px] text-center rounded-full leading-none shadow-sm shadow-red-500/20">
                {item.unreadCount}
              </span>
            ) : (
              <CheckCheck size={14} className="text-blue-500" />
            )}

            {item.assignedStaff ? (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded leading-none"
                title={`Phụ trách: ${item.assignedStaff.name}`}
              >
                <UserCheck size={11} className="text-slate-500" />
                <span>{item.assignedStaff.avatar || item.assignedStaff.name}</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded leading-none"
                title="Hội thoại chưa gán - Bạn có thể bấm Nhận việc"
              >
                <UserX size={10} className="text-amber-600" />
                <span>Chờ nhận</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
