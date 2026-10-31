import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  MessageSquare,
  LogOut,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { PageHeader, Button } from '../../../../components/ui/index.js';
import type { WorkspaceItem } from '../../../workspace/WorkspaceConfigContext.js';
import { notify } from '../../../../components/feedback/toastEmitter.js';

export interface WorkspaceDetailHeaderProps {
  workspace: WorkspaceItem;
  isActive: boolean;
  domainLabel: string;
  canOwnerLeave: boolean;
  onBack: () => void;
  onSelectWorkspace: (workspaceId: string) => Promise<void> | void;
  onGoToInbox: (workspaceId: string) => void;
  onLeaveWorkspace: () => Promise<void>;
  onEditWorkspace?: () => void;
  onSaveWorkspaceName?: (newName: string) => Promise<void>;
  onDeleteWorkspace?: () => void;
}

export const WorkspaceDetailHeader: React.FC<WorkspaceDetailHeaderProps> = ({
  workspace,
  isActive,
  domainLabel,
  canOwnerLeave,
  onBack,
  onSelectWorkspace,
  onGoToInbox,
  onLeaveWorkspace,
  onEditWorkspace,
  onSaveWorkspaceName,
  onDeleteWorkspace,
}) => {
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [nameValue, setNameValue] = useState(workspace.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameValue(workspace.name);
  }, [workspace.name]);

  useEffect(() => {
    if (isEditingInline) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingInline]);

  const handleStartEdit = () => {
    setNameValue(workspace.name);
    setIsEditingInline(true);
  };

  const handleCancelEdit = () => {
    setNameValue(workspace.name);
    setIsEditingInline(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      notify.warning('Tên không gian làm việc không được để trống.');
      return;
    }
    if (trimmed === workspace.name) {
      setIsEditingInline(false);
      return;
    }

    if (onSaveWorkspaceName) {
      setIsSavingName(true);
      try {
        await onSaveWorkspaceName(trimmed);
        setIsEditingInline(false);
      } catch {
        // error handled in caller
      } finally {
        setIsSavingName(false);
      }
    } else if (onEditWorkspace) {
      onEditWorkspace();
      setIsEditingInline(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <PageHeader
      title={
        isEditingInline ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSavingName}
              placeholder="Nhập tên không gian làm việc..."
              className="text-base sm:text-xl font-bold text-slate-900 border border-blue-600 px-2.5 py-1 rounded-none outline-none bg-white font-inherit min-w-[220px] max-w-sm sm:max-w-md w-full shadow-none box-border"
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={isSavingName}
              title="Lưu tên (Nhấn Enter)"
              className="w-8 h-8 flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 rounded-none cursor-pointer border-none shrink-0"
            >
              {isSavingName ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSavingName}
              title="Hủy (Nhấn Esc)"
              className="w-8 h-8 flex items-center justify-center text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-none cursor-pointer shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <span
              onClick={workspace.isOwner ? handleStartEdit : undefined}
              className={workspace.isOwner ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}
              title={workspace.isOwner ? 'Nhấn để sửa tên trực tiếp trên dòng này' : undefined}
            >
              {workspace.name}
            </span>
            {workspace.isOwner && (
              <button
                type="button"
                onClick={handleStartEdit}
                title="Chỉnh sửa tên trực tiếp trên dòng này"
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-none transition-colors cursor-pointer inline-flex items-center justify-center border-none bg-transparent"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
        )
      }
      description={domainLabel}
      onBack={onBack}
      hasDivider={false}
      breadcrumbs={[
        { label: 'Không gian làm việc', onClick: onBack },
        { label: workspace.name, isCurrent: true },
      ]}
      badges={
        <>
          {isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-none">
              <CheckCircle2 size={12} />
              <span>Đang làm việc</span>
            </span>
          )}
        </>
      }
      actions={
        <>
          {!isActive && (
            <Button
              variant="secondary"
              size="md"
              icon={<CheckCircle2 size={14} className="text-blue-600" />}
              onClick={() => onSelectWorkspace(workspace.id)}
            >
              Chọn làm việc
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            icon={<MessageSquare size={14} />}
            onClick={() => onGoToInbox(workspace.id)}
          >
            Vào Hộp thư
          </Button>

          {workspace.isOwner && onEditWorkspace && (
            <Button
              variant="secondary"
              size="md"
              icon={<Edit2 size={14} />}
              onClick={onEditWorkspace}
              title="Chỉnh sửa tên và thông tin Không gian làm việc"
            >
              Sửa thông tin
            </Button>
          )}

          <Button
            variant="secondary"
            size="md"
            icon={<LogOut size={14} className={workspace.isOwner && !canOwnerLeave ? 'text-slate-400' : 'text-red-600'} />}
            onClick={onLeaveWorkspace}
            disabled={workspace.isOwner && !canOwnerLeave}
            title={
              workspace.isOwner && !canOwnerLeave
                ? 'Không gian làm việc phải có ít nhất 1 Chủ sở hữu (Cần tối thiểu 2 Chủ sở hữu để rời)'
                : 'Rời khỏi Không gian làm việc này'
            }
            className={
              workspace.isOwner && !canOwnerLeave
                ? 'text-slate-400 border-slate-200'
                : 'text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'
            }
          >
            Rời workspace
          </Button>

          {workspace.isOwner && onDeleteWorkspace && (
            <Button
              variant="secondary"
              size="md"
              icon={<Trash2 size={14} className="text-red-600" />}
              onClick={onDeleteWorkspace}
              title="Xóa Không gian làm việc này"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              Xóa
            </Button>
          )}
        </>
      }
    />
  );
};
