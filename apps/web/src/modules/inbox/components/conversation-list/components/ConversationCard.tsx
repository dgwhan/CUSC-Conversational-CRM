import React from 'react';
import {
  CheckCheck,
  Tag,
  Clock,
  Moon,
} from 'lucide-react';
import type { ConversationItem, ChannelType } from '../../../types.js';
import { formatConversationTime, getUnresponsiveStatus } from '../../../utils/index.js';
import { Avatar } from '../../../../../components/common/Avatar.js';
import { resolveChannelInfo } from '../../../../../lib/channel-meta.js';
import { evaluateConversationScore } from '../../../utils/leadScoringUtils.js';

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

  const scoringData = React.useMemo(() => {
    if (item.customer.classification) return item.customer.classification;
    return evaluateConversationScore(item.messages || [], item.customer.phone);
  }, [item.customer.classification, item.messages, item.customer.phone]);

  // Render icon kênh nhỏ gọn, tinh tế
  const renderChannelIndicator = (channel: ChannelType) => {
    const meta = resolveChannelInfo(channel);
    return (
      <span
        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center border border-white shadow-xs overflow-hidden"
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
          meta.badgeText.slice(0, 1)
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
      className={`group relative flex items-start gap-3 p-3 transition-colors cursor-pointer border-l-2 select-none ${isSelected
          ? 'bg-white border-l-blue-600 shadow-xs'
          : isOverdue
            ? 'bg-rose-50/40 border-l-rose-500 hover:bg-rose-50/70'
            : hasUnread
              ? 'bg-slate-50 border-l-transparent hover:bg-slate-100/70'
              : 'bg-white border-l-transparent hover:bg-slate-50'
        }`}
    >
      {/* 1. Avatar người gửi */}
      <div className="relative shrink-0 mt-0.5">
        <Avatar
          src={item.customer.avatarUrl}
          name={item.customer.fullName}
          size={38}
          className="border border-slate-200/80 rounded-full"
          badge={renderChannelIndicator(item.channel)}
        />
      </div>

      {/* 2. Nội dung hội thoại */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={`text-sm truncate ${hasUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'
              }`}
          >
            {item.customer.fullName}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {isOverdue && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200/80 px-1.5 py-0.2 rounded"
                title={`Chưa phản hồi ${waitingMinutes}p`}
              >
                <Clock size={9} className="text-rose-500" />
                <span>{waitingMinutes >= 60 ? `${Math.floor(waitingMinutes / 60)}h` : `${waitingMinutes}p`}</span>
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

        {/* Đoạn trích tin nhắn cuối */}
        <p
          className={`text-xs truncate leading-relaxed mb-1.5 ${hasUnread ? 'font-medium text-slate-800' : 'text-slate-500 font-normal'
            }`}
        >
          {item.snippet || 'Hội thoại mới'}
        </p>

        {/* Thẻ tag & trạng thái footer */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 overflow-hidden">
            {/* Trạng thái tiềm năng: Chỉ 2 tone màu (Xanh lục cho Ưu tiên, Xám cho còn lại) */}
            {scoringData && scoringData.score > 0 && scoringData.tier !== 'IRRELEVANT' && (
              <span
                className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.2 rounded border shrink-0 ${
                  scoringData.tier === 'HOT'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200/80'
                    : 'text-slate-600 bg-slate-100 border-slate-200/80'
                }`}
                title={`Mức độ tiềm năng: ${scoringData.tier === 'HOT' ? 'Ưu tiên cao' : scoringData.tier === 'WARM' ? 'Đang quan tâm' : 'Mới tiếp cận'}`}
              >
                <span>
                  {scoringData.tier === 'HOT'
                    ? 'Ưu tiên'
                    : scoringData.tier === 'WARM'
                      ? 'Đang quan tâm'
                      : 'Mới tiếp cận'}
                </span>
              </span>
            )}

            {/* Tags thường dạng Muted tag */}
            {item.tags.slice(0, 1).map((tag: string, idx: number) => (
              <span
                key={idx}
                className="inline-flex items-center gap-0.5 text-[10px] font-normal text-slate-600 bg-slate-100 border border-slate-200/60 px-1.5 py-0.2 rounded truncate max-w-[80px]"
              >
                <Tag size={8} className="text-slate-400" />
                <span className="truncate">{tag}</span>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {hasUnread ? (
              <span className="text-[10px] font-semibold bg-blue-600 text-white px-1.5 py-0.2 min-w-[16px] text-center rounded-full leading-tight">
                {item.unreadCount}
              </span>
            ) : (
              <CheckCheck size={13} className="text-blue-500" />
            )}

            {item.assignedStaff ? (
              <span
                className="text-[10px] font-normal text-slate-500 truncate max-w-[70px]"
                title={`Phụ trách: ${item.assignedStaff.name}`}
              >
                {item.assignedStaff.name.split(' ')[0]}
              </span>
            ) : (
              <span
                className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/60 px-1 rounded"
                title="Chưa gán tư vấn viên"
              >
                Chờ nhận
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
