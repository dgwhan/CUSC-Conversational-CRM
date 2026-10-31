import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, Check, X, Loader2 } from 'lucide-react';
import type { WorkspaceItem } from '../../../../workspace/WorkspaceConfigContext.js';
import { PageSection, Button } from '../../../../../components/ui/index.js';

export interface WorkspaceOverviewTabProps {
  workspace: WorkspaceItem;
  domainLabel: string;
  membersCount: number;
  channelsCount: number;
  contactsCount: number | null;
  isLoadingContacts: boolean;
  adminName: string;
  onEditWorkspace?: () => void;
  onSaveWorkspaceName?: (newName: string) => Promise<void>;
  onDeleteWorkspace?: () => void;
}

export const WorkspaceOverviewTab: React.FC<WorkspaceOverviewTabProps> = ({
  workspace,
  domainLabel,
  membersCount,
  channelsCount,
  contactsCount,
  isLoadingContacts,
  adminName,
  onEditWorkspace,
  onSaveWorkspaceName,
  onDeleteWorkspace,
}) => {
  const [isEditingNameInline, setIsEditingNameInline] = useState(false);
  const [nameInputValue, setNameInputValue] = useState(workspace.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameInputValue(workspace.name);
  }, [workspace.name]);

  useEffect(() => {
    if (isEditingNameInline) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingNameInline]);

  const handleSaveInlineName = async () => {
    const trimmed = nameInputValue.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed === workspace.name) {
      setIsEditingNameInline(false);
      return;
    }
    if (onSaveWorkspaceName) {
      setIsSavingName(true);
      try {
        await onSaveWorkspaceName(trimmed);
        setIsEditingNameInline(false);
      } finally {
        setIsSavingName(false);
      }
    } else if (onEditWorkspace) {
      onEditWorkspace();
      setIsEditingNameInline(false);
    }
  };
  return (
    <div className="pt-6 flex flex-col gap-8">
      {/* 1. THỐNG KÊ TỔNG QUAN (Áp dụng PageSection chuẩn hệ thống) */}
      <PageSection
        title="Tổng quan không gian làm việc"
        hasDivider
        className="pb-6"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Thành viên</div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{membersCount}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Kênh kết nối</div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{channelsCount}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Khách hàng liên hệ</div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {isLoadingContacts ? (
                <span className="text-slate-400 font-normal text-lg">...</span>
              ) : (
                (contactsCount ?? 0).toLocaleString()
              )}
            </div>
          </div>
        </div>
      </PageSection>

      {/* 2. THÔNG TIN CHUNG (Áp dụng PageSection chuẩn hệ thống) */}
      <PageSection
        title="Thông tin chung"
        className="pb-6"
        actions={
          workspace.isOwner && onEditWorkspace ? (
            <Button
              variant="outline"
              size="sm"
              icon={<Edit2 size={13} />}
              onClick={onEditWorkspace}
            >
              Sửa thông tin
            </Button>
          ) : undefined
        }
      >
        <div className="divide-y divide-slate-100 text-sm">
          <div className="py-3 flex items-center justify-between gap-4">
            <span className="text-slate-500 shrink-0">Tên không gian làm việc</span>
            {isEditingNameInline ? (
              <div className="flex items-center gap-1.5 max-w-sm w-full justify-end">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInputValue}
                  onChange={(e) => setNameInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveInlineName();
                    if (e.key === 'Escape') setIsEditingNameInline(false);
                  }}
                  disabled={isSavingName}
                  className="px-2 py-1 text-xs border border-blue-600 outline-none rounded-none w-full bg-white font-semibold text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleSaveInlineName}
                  disabled={isSavingName}
                  className="w-7 h-7 flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 rounded-none cursor-pointer border-none shrink-0"
                  title="Lưu (Enter)"
                >
                  {isSavingName ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingNameInline(false)}
                  disabled={isSavingName}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-none cursor-pointer shrink-0"
                  title="Hủy (Esc)"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  onClick={workspace.isOwner ? () => setIsEditingNameInline(true) : undefined}
                  className={`font-semibold text-slate-900 ${workspace.isOwner ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
                  title={workspace.isOwner ? 'Nhấn để sửa tên trực tiếp trên dòng này' : undefined}
                >
                  {workspace.name}
                </span>
                {workspace.isOwner && (
                  <button
                    type="button"
                    onClick={() => setIsEditingNameInline(true)}
                    title="Chỉnh sửa tên trực tiếp trên dòng này"
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-none transition-colors cursor-pointer border-none bg-transparent"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="py-3 flex items-center justify-between">
            <span className="text-slate-500">Lĩnh vực / Ngành nghề</span>
            <span className="font-semibold text-slate-900">{domainLabel}</span>
          </div>
          <div className="py-3 flex items-center justify-between">
            <span className="text-slate-500">Người quản trị</span>
            <span className="font-semibold text-slate-900">
              {(adminName && adminName !== 'Chính bạn' ? adminName : '') ||
               (workspace.ownerName && workspace.ownerName !== 'Chính bạn' ? workspace.ownerName : '') ||
               'Chủ sở hữu'}
            </span>
          </div>
          <div className="py-3 flex items-center justify-between">
            <span className="text-slate-500">Quyền hạn tài khoản</span>
            <span className="font-semibold text-slate-900">
              {workspace.isOwner ? 'Chủ sở hữu' : 'Nhân viên tư vấn'}
            </span>
          </div>
          <div className="py-3 flex items-center justify-between">
            <span className="text-slate-500">Mã ID hệ thống</span>
            <span className="font-mono text-xs text-slate-500">{workspace.id}</span>
          </div>
        </div>
      </PageSection>

      {/* 3. KHU VỰC NGUY HIỂM: XÓA WORKSPACE */}
      {workspace.isOwner && onDeleteWorkspace && (
        <PageSection
          title="Khu vực quản trị cấp cao"
          subtitle="Các thao tác nhạy cảm liên quan đến sự tồn tại của Không gian làm việc"
        >
          <div className="p-4 border border-red-200 bg-red-50/20 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs font-bold text-red-900 mb-0.5">Xóa Không gian làm việc này</div>
              <div className="text-[11px] text-red-600">
                Xóa vĩnh viễn cấu hình phễu, phân quyền nhân viên và dữ liệu kênh kết nối trực thuộc.
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={13} />}
              onClick={onDeleteWorkspace}
            >
              Xóa workspace
            </Button>
          </div>
        </PageSection>
      )}
    </div>
  );
};
