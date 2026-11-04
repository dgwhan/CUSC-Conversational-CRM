import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../../../../../components/ui/index.js';
import { DOMAIN_OPTIONS, getDomainLabel } from '../../../workspaceConfig.types.js';
import { notify } from '../../../../../components/feedback/toastEmitter.js';
import type { ConfigProfileItem } from '../types.js';

export interface EditConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ConfigProfileItem | null;
  onSave: (profileId: string, data: { name: string; domain: string }) => void;
}

export const EditConfigModal: React.FC<EditConfigModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [selectedDomainKey, setSelectedDomainKey] = useState('EDUCATION');
  const [customDomainText, setCustomDomainText] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      const d = profile.domain || 'EDUCATION';
      const isPreset = DOMAIN_OPTIONS.some((opt) => opt.value === d && opt.value !== 'CUSTOM');
      if (isPreset) {
        setSelectedDomainKey(d);
        setCustomDomainText('');
      } else {
        setSelectedDomainKey('CUSTOM');
        setCustomDomainText(d === 'CUSTOM' ? '' : d);
      }
    }
  }, [profile, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!name.trim()) {
      notify.warning('Vui lòng nhập tên thiết lập.');
      return;
    }

    const finalDomain = selectedDomainKey === 'CUSTOM'
      ? (customDomainText.trim() || 'CUSTOM')
      : selectedDomainKey;

    onSave(profile.id, {
      name: name.trim(),
      domain: finalDomain,
    });
    notify.success(`Đã cập nhật thiết lập: ${name.trim()} (${getDomainLabel(finalDomain)})`);
    onClose();
  };

  if (!profile) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="flat"
      size="sm"
      showCloseButton
      title="Chỉnh sửa thông tin thiết lập"
      description="Cập nhật tên gọi và lĩnh vực mô hình kinh doanh của thiết lập."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tên thiết lập <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Phễu Bán Hàng Dự Án Mới, Quy Trình Dịch Vụ..."
            className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white transition-all shadow-2xs"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Lĩnh vực / Mô hình kinh doanh
          </label>
          <select
            value={selectedDomainKey}
            onChange={(e) => setSelectedDomainKey(e.target.value)}
            className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
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
              placeholder="VD: F&B / Nhà hàng, Logistics, Du lịch..."
              className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white shadow-2xs"
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
          >
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Modal>
  );
};

