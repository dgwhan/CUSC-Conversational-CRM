import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, Button } from '../../../../../components/ui/index.js';
import type { ConfigProfileItem } from '../types.js';

export interface DeleteConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ConfigProfileItem | null;
  isActive: boolean;
  canDelete: boolean;
  onConfirm: (profileId: string) => void;
}

export const DeleteConfigModal: React.FC<DeleteConfigModalProps> = ({
  isOpen,
  onClose,
  profile,
  isActive,
  canDelete,
  onConfirm,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!profile) return null;

  const isConfirmed = confirmText.trim().toLowerCase() === profile.name.trim().toLowerCase();

  const handleDelete = () => {
    if (!canDelete || !isConfirmed) return;
    setIsDeleting(true);
    try {
      onConfirm(profile.id);
      setConfirmText('');
      onClose();
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
      title="Xóa Thiết Lập Cấu Hình"
    >
      <div className="flex flex-col gap-4">
        {!canDelete ? (
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed rounded-lg">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Không thể xóa thiết lập này:</strong> Hệ thống yêu cầu duy trì ít nhất một bộ cấu hình quy trình. Bạn cần tạo hoặc chọn một thiết lập khác trước khi xóa.
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs leading-relaxed rounded-lg">
            <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong>Cảnh báo quan trọng:</strong> Hành động này sẽ xóa vĩnh viễn bộ thiết lập <strong>"{profile.name}"</strong> bao gồm các quy định về giai đoạn phễu, danh mục sản phẩm, thuật ngữ và tiêu chí phân loại liên quan.
              {isActive && (
                <div className="mt-1 font-semibold text-red-900">
                  Lưu ý: Thiết lập này hiện đang được áp dụng cho Workspace. Khi xóa, hệ thống sẽ tự động chuyển sang thiết lập khả dụng kế tiếp.
                </div>
              )}
            </div>
          </div>
        )}

        {canDelete && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nhập chính xác tên thiết lập để xác nhận: <strong className="text-slate-900 font-mono">{profile.name}</strong>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`Nhập "${profile.name}"...`}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 shadow-2xs box-border bg-white transition-all"
            />
          </div>
        )}

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
            {canDelete ? 'Hủy bỏ' : 'Đóng'}
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={!isConfirmed || isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

