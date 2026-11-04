import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../../../../../../components/ui/index.js';
import type { WorkspaceItem } from '../../../../../workspace/WorkspaceConfigContext.js';
import { DOMAIN_OPTIONS, getDomainLabel } from '../../../../../workspace/workspaceConfig.types.js';
import { notify } from '../../../../../../components/feedback/toastEmitter.js';

export interface EditWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceItem | null;
  onSave: (workspaceId: string, data: { name: string; domain: string }) => Promise<void>;
}

export const EditWorkspaceModal: React.FC<EditWorkspaceModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [selectedDomainKey, setSelectedDomainKey] = useState('EDUCATION');
  const [customDomainText, setCustomDomainText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      const wsDomain = workspace.domain || 'EDUCATION';
      const isPreset = DOMAIN_OPTIONS.some((opt) => opt.value === wsDomain && opt.value !== 'CUSTOM');
      if (isPreset) {
        setSelectedDomainKey(wsDomain);
        setCustomDomainText('');
      } else {
        setSelectedDomainKey('CUSTOM');
        setCustomDomainText(wsDomain === 'CUSTOM' ? '' : wsDomain);
      }
    }
  }, [workspace, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    if (!name.trim()) {
      notify.warning('Vui lòng nhập tên Không gian làm việc.');
      return;
    }

    const finalDomain = selectedDomainKey === 'CUSTOM'
      ? (customDomainText.trim() || 'CUSTOM')
      : selectedDomainKey;

    setIsSubmitting(true);
    try {
      await onSave(workspace.id, {
        name: name.trim(),
        domain: finalDomain,
      });
      notify.success(`Đã cập nhật mô hình: ${getDomainLabel(finalDomain)}`);
      onClose();
    } catch {
      // Error handled in context/apiClient
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workspace) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="flat"
      size="sm"
      showCloseButton
      title="Chỉnh sửa thông tin Không gian làm việc"
      description="Cập nhật tên gọi và lĩnh vực hoạt động chính của doanh nghiệp."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tên không gian làm việc <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Chi nhánh Hà Nội, Văn phòng TP.HCM, Trụ sở chính..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border bg-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Lĩnh vực / Mô hình kinh doanh
          </label>
          <select
            value={selectedDomainKey}
            onChange={(e) => setSelectedDomainKey(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700 outline-none focus:border-blue-600 shadow-xs cursor-pointer box-border transition-all"
          >
            {DOMAIN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {selectedDomainKey === 'CUSTOM' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên loại mô hình mới <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={customDomainText}
              onChange={(e) => setCustomDomainText(e.target.value)}
              placeholder="VD: F&B / Nhà hàng, Logistics, Du lịch & Khách sạn..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border bg-white transition-all"
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
