import React, { useState } from 'react';
import { Plus, Trash2, LogOut, Users } from 'lucide-react';
import type { ManagedStaffItem } from '../../../../workspace/WorkspaceConfigContext.js';
import { StaffRole } from '../../../../../features/auth/constants/auth.constants.js';
import {
  PageToolbar,
  SearchInput,
  Select,
  Button,
  EmptyState,
} from '../../../../../components/ui/index.js';
import { InviteMemberModal } from './modals/index.js';

export interface WorkspaceMembersTabProps {
  workspaceId: string;
  workspaceName: string;
  isOwner: boolean;
  currentStaffId: string;
  currentStaffEmail: string;
  staffMembers: ManagedStaffItem[];
  onRemoveMember: (memberId: string, memberName: string, memberRole?: string) => Promise<void>;
  onLeaveWorkspace: () => Promise<void>;
  onInviteMember: (email: string, fullName: string, role: StaffRole, phoneNumber?: string) => Promise<void>;
}

export const WorkspaceMembersTab: React.FC<WorkspaceMembersTabProps> = ({
  isOwner,
  currentStaffId,
  currentStaffEmail,
  staffMembers,
  onRemoveMember,
  onLeaveWorkspace,
  onInviteMember,
}) => {
  // Tìm kiếm và bộ lọc vai trò
  const [memberSearch, setMemberSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [memberPage, setMemberPage] = useState(1);
  const pageSize = 10;

  // Modal mời thành viên mới
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Quy tắc nghiệp vụ: 1 workspace ít nhất 1 owner, nếu có >= 2 owner cho phép rời workspace
  const totalOwners = staffMembers.filter((m) => m.role === StaffRole.OWNER).length;
  const canOwnerLeave = totalOwners >= 2;

  // Lọc theo từ khóa tìm kiếm & vai trò
  const filteredStaff = staffMembers.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    const matchQuery =
      !q ||
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.phoneNumber && m.phoneNumber.toLowerCase().includes(q));
    const matchRole = roleFilter === 'ALL' || m.role === roleFilter;
    return matchQuery && matchRole;
  });

  // Phân trang
  const totalPages = Math.ceil(filteredStaff.length / pageSize) || 1;
  const paginatedStaff = filteredStaff.slice((memberPage - 1) * pageSize, memberPage * pageSize);

  const roleFilterOptions = [
    { value: 'ALL', label: 'Tất cả vai trò' },
    { value: StaffRole.OWNER, label: 'Chủ sở hữu' },
    { value: StaffRole.STAFF, label: 'Nhân viên tư vấn' },
  ];

  return (
    <div className="pt-6">
      {/* 1. Header đề mục */}
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900 m-0">
          Thành viên
        </h2>
        <p className="text-xs text-slate-500 mt-1 m-0">
          Quản lý những người có quyền truy cập vào không gian làm việc này.
        </p>
      </div>

      {/* 2. Global Page Toolbar & Search System */}
      <PageToolbar
        search={
          <SearchInput
            value={memberSearch}
            onChange={(val) => {
              setMemberSearch(val);
              setMemberPage(1);
            }}
            placeholder="Tìm kiếm thành viên theo tên, email hoặc số điện thoại... (Nhấn /)"
            shortcutHint="/"
            size="md"
          />
        }
        filters={
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setMemberPage(1);
            }}
            options={roleFilterOptions}
            size="md"
          />
        }
        actions={
          isOwner && (
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={14} />}
              onClick={() => setIsInviteModalOpen(true)}
            >
              Mời thành viên
            </Button>
          )
        }
      />

      {/* 3. Bảng danh sách thành viên */}
      <div className="border border-slate-200/80 rounded-xl overflow-x-auto bg-white shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
              <th className="py-3 px-5 sm:px-6">Thành viên</th>
              <th className="py-3 px-5 sm:px-6">Email</th>
              <th className="py-3 px-5 sm:px-6">Số điện thoại</th>
              <th className="py-3 px-5 sm:px-6">Vai trò</th>
              <th className="py-3 px-5 sm:px-6 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {paginatedStaff.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    icon={<Users size={28} className="mx-auto text-slate-400" />}
                    title={memberSearch ? 'Không tìm thấy thành viên nào' : 'Chưa có thành viên nào'}
                    description={
                      memberSearch
                        ? `Không có kết quả nào khớp với "${memberSearch}". Thử kiểm tra lại từ khóa.`
                        : 'Mời thành viên mới tham gia không gian làm việc để cùng cộng tác.'
                    }
                    isDashed={false}
                    className="border-none py-8 bg-white"
                  />
                </td>
              </tr>
            ) : (
              paginatedStaff.map((member) => {
                const isOwnerMember = member.role === StaffRole.OWNER;
                const isCurrentUser =
                  (member.id && member.id === currentStaffId) ||
                  (member.email && currentStaffEmail && member.email.toLowerCase() === currentStaffEmail.toLowerCase());

                return (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Tên thành viên */}
                    <td className="py-3.5 px-5 sm:px-6 font-semibold text-slate-900">
                      {member.fullName || member.email.split('@')[0]}
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-5 sm:px-6 text-slate-600 font-mono text-[11.5px]">
                      {member.email}
                    </td>

                    {/* Số điện thoại */}
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11.5px]">
                      {member.phoneNumber || <span className="text-slate-400">—</span>}
                    </td>

                    {/* Nhãn vai trò tiếng Việt */}
                    <td className="py-3.5 px-5 sm:px-6">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${isOwnerMember
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                      >
                        {isOwnerMember ? 'Chủ sở hữu' : 'Nhân viên tư vấn'}
                      </span>
                    </td>

                    {/* Cột thao tác */}
                    <td className="py-3.5 px-5 sm:px-6 text-right">
                      {(() => {
                        // Trường hợp 1: Chính tài khoản đang đăng nhập
                        if (isCurrentUser) {
                          if (isOwnerMember && !canOwnerLeave) {
                            return (
                              <span
                                className="text-slate-400 text-[11px]"
                                title="Không gian làm việc phải có ít nhất 1 Chủ sở hữu. Cần tối thiểu 2 Chủ sở hữu để rời."
                              >
                              </span>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={onLeaveWorkspace}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md bg-transparent border-none cursor-pointer transition-colors"
                              title="Rời khỏi Không gian làm việc này"
                            >
                              <LogOut size={13} />
                              <span>Rời workspace</span>
                            </button>
                          );
                        }

                        // Trường hợp 2: Quản trị viên (Owner) thao tác trên thành viên khác
                        if (isOwner) {
                          if (isOwnerMember && !canOwnerLeave) {
                            return (
                              <span
                                className="text-slate-400 text-xs"
                                title="Không thể xóa khi chỉ còn 1 Chủ sở hữu duy nhất"
                              >
                                —
                              </span>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => onRemoveMember(member.id, member.fullName || member.email, member.role)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 bg-transparent border-none cursor-pointer p-0"
                              title={isOwnerMember ? 'Loại bỏ Chủ sở hữu này khỏi Không gian làm việc' : 'Xóa thành viên khỏi không gian làm việc'}
                            >
                              <Trash2 size={13} />
                              <span>{isOwnerMember ? 'Loại bỏ' : 'Xóa'}</span>
                            </button>
                          );
                        }

                        return <span className="text-slate-400 text-xs">—</span>;
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer phân trang */}
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500 flex-wrap gap-2">
        <span>
          Hiển thị {paginatedStaff.length > 0 ? (memberPage - 1) * pageSize + 1 : 0}–
          {Math.min(memberPage * pageSize, filteredStaff.length)} trên tổng số {filteredStaff.length} thành viên
        </span>

        {/* Nút phân trang */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={memberPage === 1}
              onClick={() => setMemberPage((p) => Math.max(p - 1, 1))}
            >
              Trước
            </Button>
            <span className="px-2 font-medium text-slate-700">
              {memberPage} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={memberPage === totalPages}
              onClick={() => setMemberPage((p) => Math.min(p + 1, totalPages))}
            >
              Sau
            </Button>
          </div>
        )}
      </div>

      {/* Modal Mời thành viên */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInviteMember={onInviteMember}
      />
    </div>
  );
};
