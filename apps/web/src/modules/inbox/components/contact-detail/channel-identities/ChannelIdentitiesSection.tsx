import React, { useState } from 'react';
import { Copy, Check, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';
import type { ChannelIdentityItem } from '../../../types.js';
import { notify } from '../../../../../components/feedback/toastEmitter.js';
import { resolveChannelInfo } from '../../../../../lib/channel-meta.js';
import { apiClient } from '../../../../../lib/api-client/index.js';
import { Modal } from '../../../../../components/ui/Modal.js';

export interface ChannelIdentitiesSectionProps {
  identities: ChannelIdentityItem[];
  copiedField?: string | null;
  onCopy?: (text: string, fieldName: string) => void;
  contactId?: string;
  customerId?: string;
  phone?: string;
  onUnmergeSuccess?: () => void;
  linkedConversations?: { id: string; channel: any; channelAccountName?: string }[];
  onSelectConversation?: (conversationId: string) => void;
}

/**
 * Section: Định danh kênh hội thoại (Facebook Messenger, Zalo OA, Zalo Cá nhân...)
 * Hỗ trợ xem đa kênh và thao tác Tách lại hồ sơ nếu gộp nhầm (CUS-04)
 */
export const ChannelIdentitiesSection: React.FC<ChannelIdentitiesSectionProps> = ({
  identities,
  copiedField,
  onCopy,
  contactId,
  customerId,
  phone,
  onUnmergeSuccess,
  linkedConversations,
  onSelectConversation,
}) => {
  const [internalCopied, setInternalCopied] = useState<string | null>(null);
  const [isUnmerging, setIsUnmerging] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [mergeLogs, setMergeLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleCopy = (idValue: string, label: string) => {
    if (onCopy) {
      onCopy(idValue, label);
    } else {
      navigator.clipboard.writeText(idValue);
      setInternalCopied(idValue);
      notify.success(`Đã sao chép định danh: ${idValue}`);
      setTimeout(() => setInternalCopied(null), 2000);
    }
  };

  const handleOpenUnmergeModal = async () => {
    const rawPhone = phone && phone !== 'Chưa có SĐT' ? phone : undefined;
    const identifier = contactId || customerId || rawPhone || identities[0]?.externalUserId;

    if (!identifier) {
      notify.warning('Không tìm thấy thông tin định danh để tra cứu lịch sử gộp');
      return;
    }

    setLoadingHistory(true);
    setShowConfirmModal(true);
    try {
      const res = await apiClient.getContactMergeHistory(identifier);
      const activeLogs = (res?.items || []).filter((log: any) => !log.isReverted);
      setMergeLogs(activeLogs);
      if (activeLogs.length === 0) {
        notify.info('Hồ sơ này chưa có lượt gộp nào trong CSDL hoặc đã được hoàn tác.');
      }
    } catch {
      setMergeLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleConfirmUnmerge = async (logId: string) => {
    setIsUnmerging(true);
    try {
      const res = await apiClient.unmergeContact(logId, {
        reason: 'Tư vấn viên tách lại hồ sơ do gộp nhầm SĐT',
      });
      if (res?.success) {
        notify.success('Đã hoàn tác gộp thành công! Hai hồ sơ đã được tách biệt.');
        setShowConfirmModal(false);
        if (onUnmergeSuccess) {
          onUnmergeSuccess();
        } else {
          setTimeout(() => window.location.reload(), 1000);
        }
      } else {
        notify.error(res?.message || 'Không thể tách lại hồ sơ');
      }
    } catch (err: any) {
      notify.error(err?.message || 'Lỗi khi tách lại hồ sơ');
    } finally {
      setIsUnmerging(false);
    }
  };

  return (
    <section className="p-4 bg-white space-y-2.5">
      {/* Header đề mục */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider m-0">
            Định Danh Kênh
          </h3>
          <button
            type="button"
            onClick={() => setIsExplainModalOpen(true)}
            className="inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded"
            title="Xem giải thích định danh đa kênh"
            aria-label="Giải thích định danh đa kênh"
          >
            <AlertCircle size={13} />
          </button>
          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
            Đa kênh
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-normal">
          {identities.length} kênh
        </span>
      </div>

      {/* Danh sách định danh từng kênh */}
      <div className="flex flex-col gap-2">
        {identities.map((item, idx) => {
          const meta = resolveChannelInfo(item.channel, item.externalUserId);
          const isCopied =
            internalCopied === item.externalUserId ||
            copiedField === `Kênh ${item.channel}` ||
            copiedField === item.externalUserId;

          return (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-md"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Badge icon đại diện kênh chính thức */}
                <span
                  className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-white shadow-sm"
                  style={{ backgroundColor: meta.badgeBg }}
                  title={meta.label}
                >
                  {meta.iconUrl ? (
                    <img
                      src={meta.iconUrl}
                      alt={meta.label}
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-white text-[11px] font-bold">{meta.badgeText}</span>
                  )}
                </span>

                {/* Thông tin kênh & ID */}
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] text-slate-500 font-medium leading-tight">
                    {meta.label}
                  </span>
                  <span
                    className="text-[12px] font-mono font-medium text-slate-800 truncate select-all leading-tight"
                    title={item.externalUserId}
                  >
                    ID: {item.externalUserId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Nút Mở chat nếu kênh này có cuộc hội thoại riêng (CUS-04) */}
                {(() => {
                  const matchedLinked = linkedConversations?.find((lc) => {
                    if (lc.channel === item.channel) return true;
                    if ((lc.channel === 'ZALO' || lc.channel === 'ZALO_PERSONAL') && (item.channel === 'ZALO' || item.channel === 'ZALO_PERSONAL')) return true;
                    return false;
                  });
                  if (!matchedLinked || !onSelectConversation) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => onSelectConversation(matchedLinked.id)}
                      className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium rounded text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer"
                      title="Chuyển đến cuộc hội thoại trên kênh này"
                    >
                      <MessageSquare size={11} />
                      <span>Mở chat</span>
                    </button>
                  );
                })()}

                {/* Nút sao chép ID */}
                <button
                  type="button"
                  onClick={() => handleCopy(item.externalUserId, `Kênh ${item.channel}`)}
                  className={`inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium rounded transition-colors bg-transparent border-0 cursor-pointer ${isCopied
                    ? 'text-emerald-600 font-semibold'
                    : 'text-blue-600 hover:text-blue-800'
                    }`}
                  title="Sao chép định danh kênh"
                >
                  {isCopied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nút Tách lại hồ sơ nếu gộp nhầm (CUS-04) */}
      {identities.length > 1 && (
        <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Hồ sơ có nhiều kênh cùng SĐT?
          </span>
          <button
            type="button"
            onClick={handleOpenUnmergeModal}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition-colors border border-amber-200 cursor-pointer"
            title="Tách lại nếu hai người khác nhau dùng chung SĐT hoặc gộp nhầm"
          >
            <span>Tách lại hồ sơ</span>
          </button>
        </div>
      )}

      {/* Modal xác nhận Tách lại hồ sơ (Unmerge) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-slate-200">
            <div className="flex items-center gap-2.5 text-amber-600 mb-3">
              <AlertCircle size={20} />
              <h4 className="text-[14px] font-semibold text-slate-800 m-0">
                Tách lại hồ sơ khách hàng
              </h4>
            </div>

            <p className="text-[12.5px] text-slate-600 mb-4 leading-relaxed">
              Thao tác này sẽ hoàn tác việc sáp nhập, tách các kênh liên kết và tin nhắn trở lại thành 2 hồ sơ độc lập ban đầu.
            </p>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-[12px]">
                <RefreshCw size={14} className="animate-spin" />
                <span>Đang tải lịch sử gộp...</span>
              </div>
            ) : mergeLogs.length > 0 ? (
              <div className="flex flex-col gap-2.5 mb-4">
                <span className="text-[11.5px] font-medium text-slate-700">
                  Chọn lần gộp muốn hoàn tác:
                </span>
                {mergeLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="text-[12px] font-semibold text-slate-800">
                        SĐT gộp: {log.phoneNormalized || 'Chung SĐT'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Thời gian: {new Date(log.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isUnmerging}
                      onClick={() => handleConfirmUnmerge(log.id)}
                      className="px-2.5 py-1 text-[11.5px] font-medium bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 cursor-pointer border-0"
                    >
                      {isUnmerging ? 'Đang tách...' : 'Tách lần này'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-[12px] text-slate-600 mb-4">
                Hồ sơ này được nhận diện trùng kênh tự động. Bạn có thể xóa số điện thoại bị gán nhầm trong mục <strong>Thông Tin Liên Hệ</strong> bên dưới để tách rời.
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-1.5 text-[12px] text-slate-600 hover:text-slate-800 bg-slate-100 rounded border-0 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Giải thích Định Danh Đa Kênh */}
      <Modal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        title="Định Danh Kênh & Hợp Nhất Đa Kênh"
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
              1. Hợp nhất đa kênh (Omni-channel)
            </h5>
            <p className="m-0 text-slate-600">
              Khi khách hàng nhắn tin từ Facebook Messenger và Zalo (OA hoặc Cá nhân), nếu phát hiện trùng số điện thoại, hệ thống sẽ tự động liên kết thành một hồ sơ duy nhất.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              2. Mã định danh nền tảng (External ID)
            </h5>
            <p className="m-0 text-slate-600">
              Mỗi tài khoản mạng xã hội có một mã định danh kỹ thuật riêng biệt. Bạn có thể sao chép mã này để đối soát sự kiện webhook hoặc tra cứu nhật ký hệ thống.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              3. Hoàn tác gộp (Tách hồ sơ)
            </h5>
            <p className="m-0 text-slate-600">
              Trong trường hợp hai người dùng khác nhau chia sẻ chung một số điện thoại, quản lý có thể nhấn "Tách lại hồ sơ" để hoàn nguyên thành 2 khách hàng độc lập.
            </p>
          </div>
        </div>
      </Modal>
    </section>
  );
};
