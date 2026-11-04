import React, { useState } from 'react';
import { Modal, Button } from '../../../../../components/ui/index.js';
import { DOMAIN_OPTIONS, type BusinessDomain } from '../../../workspaceConfig.types.js';
import { CLIENT_INDUSTRY_PRESETS } from '../../../workspacePresets.js';
import { notify } from '../../../../../components/feedback/toastEmitter.js';
import type { ConfigProfileItem } from '../types.js';
import type { WorkspaceConfig } from '../../../workspaceConfig.types.js';

export interface CreateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentActiveConfig: WorkspaceConfig;
  onCreate: (newProfile: ConfigProfileItem) => void;
}

export const CreateConfigModal: React.FC<CreateConfigModalProps> = ({
  isOpen,
  onClose,
  currentActiveConfig,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [selectedDomainKey, setSelectedDomainKey] = useState<string>('CUSTOM');
  const [customDomainText, setCustomDomainText] = useState('');
  const [templateSource, setTemplateSource] = useState<'current' | 'preset'>('current');
  const [selectedPresetDomain, setSelectedPresetDomain] = useState<BusinessDomain>('EDUCATION');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      notify.warning('Vui lòng nhập tên thiết lập.');
      return;
    }

    const finalDomain = selectedDomainKey === 'CUSTOM'
      ? (customDomainText.trim() || 'CUSTOM')
      : selectedDomainKey;

    let baseConfig: WorkspaceConfig;
    if (templateSource === 'preset') {
      const preset = CLIENT_INDUSTRY_PRESETS[selectedPresetDomain] || CLIENT_INDUSTRY_PRESETS.CUSTOM;
      baseConfig = {
        workspaceId: 'cfg-' + Date.now(),
        workspaceName: name.trim(),
        domain: (finalDomain in CLIENT_INDUSTRY_PRESETS ? finalDomain : selectedPresetDomain) as BusinessDomain,
        terminology: { ...preset.terminology },
        pipelineStages: preset.pipelineStages.map((s) => ({ ...s })),
        productCatalog: preset.productCatalog.map((p) => ({ ...p })),
        criteria: preset.criteria.map((c) => ({ ...c })),
        unresponsiveAlertMinutes: 15,
      };
    } else {
      baseConfig = {
        ...currentActiveConfig,
        workspaceId: 'cfg-' + Date.now(),
        workspaceName: name.trim(),
        domain: (finalDomain in CLIENT_INDUSTRY_PRESETS ? finalDomain : 'CUSTOM') as BusinessDomain,
        terminology: { ...currentActiveConfig.terminology },
        pipelineStages: currentActiveConfig.pipelineStages.map((s) => ({ ...s })),
        productCatalog: currentActiveConfig.productCatalog.map((p) => ({ ...p })),
        criteria: currentActiveConfig.criteria.map((c) => ({ ...c })),
        unresponsiveAlertMinutes: currentActiveConfig.unresponsiveAlertMinutes ?? 15,
      };
    }

    const newProfile: ConfigProfileItem = {
      id: 'cfg-' + Date.now(),
      name: name.trim(),
      domain: finalDomain,
      config: baseConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreate(newProfile);
    notify.success(`Đã tạo bộ thiết lập mới: ${newProfile.name}`);
    setName('');
    setSelectedDomainKey('CUSTOM');
    setCustomDomainText('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="flat"
      size="sm"
      showCloseButton
      title="Thêm bộ thiết lập cấu hình mới"
      description="Tạo quy trình phễu, thuật ngữ và danh mục sản phẩm mới cho doanh nghiệp."
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
            onChange={(e) => {
              setSelectedDomainKey(e.target.value);
              if (e.target.value in CLIENT_INDUSTRY_PRESETS) {
                setSelectedPresetDomain(e.target.value as BusinessDomain);
              }
            }}
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

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Dữ liệu khởi tạo ban đầu
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="radio"
                name="templateSource"
                checked={templateSource === 'current'}
                onChange={() => setTemplateSource('current')}
                className="text-blue-600"
              />
              <span className="font-medium text-slate-800">Sao chép cấu hình hiện tại</span>
            </label>

            <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="radio"
                name="templateSource"
                checked={templateSource === 'preset'}
                onChange={() => setTemplateSource('preset')}
                className="text-blue-600"
              />
              <span className="font-medium text-slate-800">Nạp mẫu ngành chuẩn</span>
            </label>
          </div>
        </div>

        {templateSource === 'preset' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chọn mẫu ngành chuẩn
            </label>
            <select
              value={selectedPresetDomain}
              onChange={(e) => setSelectedPresetDomain(e.target.value as BusinessDomain)}
              className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
            >
              <option value="EDUCATION">Giáo dục & Tuyển sinh</option>
              <option value="REAL_ESTATE">Bất động sản & Dự án</option>
              <option value="BEAUTY_SPA">Thẩm mỹ viện & Spa</option>
              <option value="B2B_SAAS">B2B SaaS & Phần mềm</option>
              <option value="RETAIL">Bán lẻ & Thương mại</option>
              <option value="CUSTOM">Doanh nghiệp & Dịch vụ</option>
            </select>
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
            Tạo thiết lập
          </Button>
        </div>
      </form>
    </Modal>
  );
};

