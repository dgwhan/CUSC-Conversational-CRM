import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, Button } from '../../../../../../components/ui/index.js';
import type { WorkspaceItem } from '../../../../../workspace/WorkspaceConfigContext.js';

export interface DeleteWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceItem | null;
  onConfirm: (workspaceId: string) => Promise<void>;
}

export const DeleteWorkspaceModal: React.FC<DeleteWorkspaceModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onConfirm,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!workspace) return null;

  const isConfirmed = confirmText.trim().toLowerCase() === workspace.name.trim().toLowerCase();

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    try {
      await onConfirm(workspace.id);
      setConfirmText('');
      onClose();
    } catch {
      // Error handled in context
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="flat"
      size="sm"
      showCloseButton
      title="Xóa Không gian làm việc"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs leading-relaxed">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong>Cảnh báo quan trọng:</strong> Hành động này sẽ xóa vĩnh viễn Không gian làm việc <strong>"{workspace.name}"</strong> cùng toàn bộ dữ liệu cấu hình phễu, phân quyền nhân viên và kênh kết nối trực thuộc. Dữ liệu sau khi xóa sẽ không thể khôi phục.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Nhập chính xác tên không gian làm việc để xác nhận: <strong className="text-slate-900 font-mono">{workspace.name}</strong>
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Nhập "${workspace.name}"...`}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-none outline-none focus:border-red-600 box-border bg-white"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setConfirmText('');
              onClose();
            }}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={!isConfirmed || isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
