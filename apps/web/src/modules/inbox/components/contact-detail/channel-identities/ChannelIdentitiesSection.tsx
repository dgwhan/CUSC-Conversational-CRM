import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { ChannelIdentityItem } from '../../../types.js';
import { notify } from '../../../../../components/feedback/toastEmitter.js';

export interface ChannelIdentitiesSectionProps {
  identities: ChannelIdentityItem[];
  copiedField?: string | null;
  onCopy?: (text: string, fieldName: string) => void;
}

/**
 * Section: Định danh kênh hội thoại (Facebook Messenger, Zalo OA...)
 * Tách biệt thành component độc lập, sử dụng Tailwind CSS chuẩn hệ thống
 */
export const ChannelIdentitiesSection: React.FC<ChannelIdentitiesSectionProps> = ({
  identities,
  copiedField,
  onCopy,
}) => {
  const [internalCopied, setInternalCopied] = useState<string | null>(null);

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

  return (
    <section className="p-4 border-b border-slate-200">
      {/* Header đề mục */}
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[13px] font-semibold text-slate-800 m-0">
          Định danh kênh hội thoại
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">
          {identities.length} kênh
        </span>
      </div>

      {/* Danh sách định danh từng kênh */}
      <div className="flex flex-col gap-2">
        {identities.map((item, idx) => {
          const chUpper = (item.channel || 'FACEBOOK').toUpperCase();
          const isFb = chUpper.includes('FACEBOOK') || chUpper.includes('FB');
          const isZalo = chUpper.includes('ZALO');
          const channelLabel = isFb
            ? 'Facebook Messenger'
            : isZalo
              ? 'Zalo OA'
              : item.channel;

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
                {/* Badge icon đại diện kênh */}
                <span
                  className={`w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 ${
                    isFb ? 'bg-[#1877f2]' : isZalo ? 'bg-[#0068ff]' : 'bg-slate-700'
                  }`}
                  title={channelLabel}
                >
                  {isFb ? 'f' : isZalo ? 'Z' : 'C'}
                </span>

                {/* Thông tin kênh & ID */}
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] text-slate-500 font-medium leading-tight">
                    {channelLabel}
                  </span>
                  <span
                    className="text-[12px] font-mono font-medium text-slate-800 truncate select-all leading-tight"
                    title={item.externalUserId}
                  >
                    ID: {item.externalUserId}
                  </span>
                </div>
              </div>

              {/* Nút sao chép ID */}
              <button
                type="button"
                onClick={() => handleCopy(item.externalUserId, `Kênh ${item.channel}`)}
                className={`inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium rounded transition-colors bg-transparent border-0 cursor-pointer shrink-0 ${
                  isCopied
                    ? 'text-emerald-600 font-semibold'
                    : 'text-blue-600 hover:text-blue-800'
                }`}
                title="Sao chép định danh kênh"
              >
                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
