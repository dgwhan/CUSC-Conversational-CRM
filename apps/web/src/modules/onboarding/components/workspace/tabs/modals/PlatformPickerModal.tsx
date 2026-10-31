import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Modal } from '../../../../../../components/ui/index.js';
import type { ChannelKey } from '../../../../types.js';
import { CHANNEL_PLATFORMS_CONFIG } from '../../workspace.config.js';

export interface PlatformPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlatform: (platformKey: ChannelKey) => void;
}

export const PlatformPickerModal: React.FC<PlatformPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectPlatform,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="flat"
      size="md"
      showCloseButton
      title="Kết nối kênh mới"
      description="Chọn nền tảng để kết nối vào Không gian làm việc này."
      secondaryAction={{
        label: 'Hủy',
        onClick: onClose,
      }}
    >
      <div className="flex flex-col gap-3">
        {CHANNEL_PLATFORMS_CONFIG.map((platform) => (
          <button
            key={platform.key}
            type="button"
            onClick={() => {
              onClose();
              onSelectPlatform(platform.key);
            }}
            className="w-full p-4 border border-slate-200/80 hover:border-blue-500 hover:bg-blue-50/25 text-left rounded-xl bg-white cursor-pointer transition-all flex items-center justify-between gap-4 shadow-2xs"
          >
            <div>
              <div className="text-sm font-bold text-slate-900 mb-1">
                {platform.name}
              </div>
              <div className="text-xs text-slate-500">
                {platform.modalDescription}
              </div>
            </div>
            <ExternalLink size={16} className="text-slate-400 shrink-0" />
          </button>
        ))}
      </div>
    </Modal>
  );
};
