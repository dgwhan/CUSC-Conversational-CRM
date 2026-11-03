import React from 'react';
import {
  Clock,
  UserCheck,
  AlertTriangle,
  ArrowLeft,
  User,
} from 'lucide-react';
import type { ConversationItem, AssignedStaff } from '../../../types.js';
import { Avatar } from '../../../../../components/common/Avatar.js';
import { Button } from '../../../../../components/ui/Button.js';
import { resolveChannelInfo } from '../../../../../lib/channel-meta.js';
import { useTranslation } from '../../../../../i18n/index.js';
import { useUserRole } from '../../../../auth/UserRoleContext.js';
import { getUnresponsiveStatus } from '../../../utils/index.js';

export interface ChatHeaderProps {
  conversation: ConversationItem;
  staffList: AssignedStaff[];
  isWithin24Hours: boolean;
  hoursRemaining: number;
  alertThresholdMinutes?: number;
  onAssignStaff: (staffId: string) => void;
  onBackToList?: () => void;
  onToggleProfile?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  staffList,
  isWithin24Hours,
  hoursRemaining,
  alertThresholdMinutes = 15,
  onAssignStaff,
  onBackToList,
  onToggleProfile,
}) => {
  const { t } = useTranslation();
  const { isOwner, staffId } = useUserRole();
  const channelMeta = resolveChannelInfo(conversation.channel);
  const { isOverdue, waitingMinutes } = getUnresponsiveStatus(conversation, alertThresholdMinutes);

  return (
    <div className="h-[60px] px-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
      {/* Thông tin khách hàng & kênh */}
      <div className="flex items-center gap-3 min-w-0">
        {onBackToList && (
          <button
            type="button"
            className="md:hidden inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors cursor-pointer"
            onClick={onBackToList}
            title="Quay lại danh sách hội thoại"
          >
            <ArrowLeft size={14} />
            <span>Danh sách</span>
          </button>
        )}

        <Avatar
          src={conversation.customer.avatarUrl}
          name={conversation.customer.fullName}
          size={38}
          className="border border-slate-200 shadow-sm shrink-0"
        />

        <div className="min-w-0">
          <h3
            className="text-[14px] font-bold text-slate-900 truncate leading-snug m-0"
            title={conversation.customer.fullName}
          >
            {conversation.customer.fullName}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
            {channelMeta.iconUrl && (
              <img
                src={channelMeta.iconUrl}
                alt={channelMeta.label}
                className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
              />
            )}
            <span className="font-medium text-slate-600">{channelMeta.label}</span>
            {conversation.channelAccountName &&
              !conversation.channelAccountName.startsWith('Kênh ') &&
              conversation.channelAccountName.toLowerCase() !== channelMeta.label.toLowerCase() && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500 truncate">{conversation.channelAccountName}</span>
                </>
              )}
          </div>
        </div>
      </div>

      {/* Hành động Header: Cảnh báo SLA phản hồi, 24h Meta Badge, Phân công nhân viên, Nút Mobile Profile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Cảnh báo tin nhắn chưa phản hồi quá n phút */}
        {isOverdue && (
          <div
            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full animate-pulse shadow-xs"
            title={`Khách hàng đã chờ ${waitingMinutes} phút chưa có phản hồi từ nhân viên`}
          >
            <Clock size={12} className="text-rose-600" />
            <span>Chưa phản hồi {waitingMinutes >= 60 ? `${Math.floor(waitingMinutes / 60)}h${waitingMinutes % 60}p` : `${waitingMinutes}p`}</span>
          </div>
        )}

        {/* Badge 24h Meta (Facebook Messenger) */}
        {conversation.channel === 'FACEBOOK' && (
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
              isWithin24Hours
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={
              isWithin24Hours
                ? `Còn ${hoursRemaining} giờ để phản hồi miễn phí theo chính sách Meta`
                : 'Đã quá 24 giờ kể từ tin nhắn cuối của khách. Cần dùng Message Tag.'
            }
          >
            {isWithin24Hours ? (
              <>
                <Clock size={12} className="text-emerald-600" />
                <span>{t('inbox.chatHeader.meta24hValid')} ~{hoursRemaining}h</span>
              </>
            ) : (
              <>
                <AlertTriangle size={12} className="text-amber-600" />
                <span>Hết hạn 24h</span>
              </>
            )}
          </div>
        )}

        {/* Phân công nhân viên: Chủ cơ sở chọn bất kỳ ai, Tư vấn viên chỉ thấy nút Claim */}
        {isOwner ? (
          <div className="relative inline-flex items-center">
            <UserCheck size={13} className="absolute left-2 text-slate-400 pointer-events-none" />
            <select
              className="h-8 pl-7 pr-3 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:bg-white transition-colors cursor-pointer"
              value={conversation.assignedStaff?.id || ''}
              onChange={(e) => onAssignStaff(e.target.value)}
              title="Chủ doanh nghiệp: Phân công cho bất kỳ tư vấn viên nào"
            >
              <option value="">{t('inbox.chatHeader.unassigned')}</option>
              {conversation.assignedStaff?.id && !staffList.some((st) => st.id === conversation.assignedStaff?.id) && (
                <option value={conversation.assignedStaff.id}>
                  {conversation.assignedStaff.name}
                </option>
              )}
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            {conversation.assignedStaff?.id === staffId ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                <UserCheck size={12} className="text-emerald-600" />
                <span>Bạn đang phụ trách</span>
              </span>
            ) : !conversation.assignedStaff ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={<UserCheck size={13} />}
                onClick={() => onAssignStaff(staffId)}
                title="Nhận cuộc hội thoại này để bắt đầu tư vấn"
              >
                Nhận việc (Claim)
              </Button>
            ) : (
              <span className="text-[11px] font-medium text-slate-500 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md">
                Phụ trách: {conversation.assignedStaff.name}
              </span>
            )}
          </div>
        )}

        {/* Nút Xem Hồ Sơ trên Mobile */}
        {onToggleProfile && (
          <button
            type="button"
            className="md:hidden inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors cursor-pointer"
            onClick={onToggleProfile}
            title="Xem thông tin chi tiết hồ sơ khách hàng"
          >
            <User size={13} />
            <span>Hồ sơ</span>
          </button>
        )}
      </div>
    </div>
  );
};

