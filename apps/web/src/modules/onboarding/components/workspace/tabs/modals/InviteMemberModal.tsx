import React, { useState } from 'react';
import { Modal, Button } from '../../../../../../components/ui/index.js';
import { notify } from '../../../../../../components/feedback/toastEmitter.js';
import { StaffRole } from '../../../../../../features/auth/constants/auth.constants.js';

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteMember: (email: string, fullName: string, role: StaffRole, phoneNumber?: string) => Promise<void>;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onInviteMember,
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<StaffRole>(StaffRole.STAFF);
  const [isInviting, setIsInviting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      notify.warning('Vui lòng nhập email thành viên.');
      return;
    }
    setIsInviting(true);
    try {
      await onInviteMember(inviteEmail.trim(), inviteFullName.trim(), inviteRole, invitePhone.trim() || undefined);
      setInviteEmail('');
      setInviteFullName('');
      setInvitePhone('');
      onClose();
    } catch {
      // Error handled in parent/context
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="flat"
      size="sm"
      showCloseButton
      title="Mời thành viên mới vào Không gian làm việc"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Email thành viên <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Họ và tên
          </label>
          <input
            type="text"
            value={inviteFullName}
            onChange={(e) => setInviteFullName(e.target.value)}
            placeholder="Nhập họ và tên..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Số điện thoại
          </label>
          <input
            type="text"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            placeholder="VD: 0901.234.567"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs box-border font-mono transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Vai trò
          </label>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as StaffRole)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700 outline-none focus:border-blue-600 shadow-xs cursor-pointer box-border transition-all"
          >
            <option value={StaffRole.STAFF}>Nhân viên tư vấn</option>
            <option value={StaffRole.OWNER}>Chủ sở hữu</option>
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
            disabled={isInviting}
          >
            {isInviting ? 'Đang gửi...' : 'Mời thành viên'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
