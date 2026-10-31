import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../../../../../../components/ui/index.js';
import type { WorkspaceItem } from '../../../../../workspace/WorkspaceConfigContext.js';
import { notify } from '../../../../../../components/feedback/toastEmitter.js';

export interface EditWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceItem | null;
  onSave: (workspaceId: string, data: { name: string; domain: string }) => Promise<void>;
}

const DOMAIN_OPTIONS = [
  { value: 'EDUCATION', label: 'Giáo dục & Tuyển sinh' },
  { value: 'REAL_ESTATE', label: 'Bất động sản & Dự án' },
  { value: 'BEAUTY_SPA', label: 'Thẩm mỹ viện & Spa' },
  { value: 'B2B_SAAS', label: 'B2B SaaS & Phần mềm' },
  { value: 'RETAIL', label: 'Bán lẻ & Thương mại' },
];

export const EditWorkspaceModal: React.FC<EditWorkspaceModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('EDUCATION');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setDomain(workspace.domain || 'EDUCATION');
    }
  }, [workspace, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    if (!name.trim()) {
      notify.warning('Vui lòng nhập tên Không gian làm việc.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(workspace.id, {
        name: name.trim(),
        domain,
      });
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
            placeholder="VD: CUSC Cần Thơ..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-blue-600 box-border bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Lĩnh vực / Mô hình kinh doanh
          </label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none bg-white text-slate-700 outline-none focus:border-blue-600 cursor-pointer box-border"
          >
            {DOMAIN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

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
