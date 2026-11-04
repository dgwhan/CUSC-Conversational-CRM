import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react';
import { PageHeader, Button } from '../../../../components/ui/index.js';
import { getDomainLabel } from '../../workspaceConfig.types.js';
import type { ConfigProfileItem } from './types.js';

export interface ConfigDetailHeaderProps {
  profile: ConfigProfileItem;
  isActive: boolean;
  isOwner: boolean;
  onBack: () => void;
  onSelectApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onResetDefault: () => void;
  onSaveNameInline?: (newName: string) => void;
}

export const ConfigDetailHeader: React.FC<ConfigDetailHeaderProps> = ({
  profile,
  isActive,
  isOwner,
  onBack,
  onSelectApply,
  onEdit,
  onDelete,
  onResetDefault,
  onSaveNameInline,
}) => {
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [nameValue, setNameValue] = useState(profile.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameValue(profile.name);
  }, [profile.name]);

  useEffect(() => {
    if (isEditingInline) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingInline]);

  const handleStartEdit = () => {
    setNameValue(profile.name);
    setIsEditingInline(true);
  };

  const handleCancelEdit = () => {
    setNameValue(profile.name);
    setIsEditingInline(false);
  };

  const handleSaveName = () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed !== profile.name && onSaveNameInline) {
      onSaveNameInline(trimmed);
    }
    setIsEditingInline(false);
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

  const { terminology } = profile.config;
  const terminologySummary = `Thực thể: ${terminology.entityName} • Phễu: ${terminology.pipelineName} • Danh mục: ${terminology.productLabel} • Doanh số: ${terminology.valueLabel}`;

  return (
    <PageHeader
      onBack={onBack}
      hasDivider={false}
      breadcrumbs={[
        { label: 'Quản lý cấu hình', onClick: onBack },
        { label: profile.name, isCurrent: true },
      ]}
      title={
        isEditingInline ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tên thiết lập cấu hình..."
              className="text-base sm:text-xl font-bold text-slate-900 border border-blue-500 px-3 py-1.5 rounded-md outline-none bg-white font-inherit min-w-[220px] max-w-sm sm:max-w-md w-full shadow-2xs box-border focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={handleSaveName}
              title="Lưu tên (Enter)"
              className="w-8 h-8 flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer border-none shrink-0 transition-colors shadow-2xs"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              title="Hủy (Esc)"
              className="w-8 h-8 flex items-center justify-center text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer shrink-0 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <span
              onClick={isOwner ? handleStartEdit : undefined}
              className={isOwner ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}
              title={isOwner ? 'Nhấn để sửa tên thiết lập' : undefined}
            >
              {profile.name}
            </span>
            {isOwner && (
              <button
                type="button"
                onClick={handleStartEdit}
                title="Sửa nhanh tên thiết lập"
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center border-none bg-transparent"
              >
                <Edit2 size={15} />
              </button>
            )}
          </div>
        )
      }
      description={terminologySummary}
      badges={
        <>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
            {getDomainLabel(profile.domain)}
          </span>
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
              <CheckCircle2 size={12} />
              <span>Đang áp dụng</span>
            </span>
          )}
        </>
      }
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft size={13} />
            <span>Quay lại danh sách</span>
          </Button>

          {!isActive && isOwner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSelectApply}
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              Chọn áp dụng
            </Button>
          )}

          {isOwner && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex items-center gap-1.5"
              >
                <Edit2 size={13} />
                <span>Sửa thông tin</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Xóa thiết lập</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onResetDefault}
                className="text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
                title="Khôi phục các giai đoạn và danh mục theo mẫu ngành ban đầu"
              >
                <RotateCcw size={13} />
                <span>Khôi phục mặc định</span>
              </Button>
            </>
          )}
        </div>
      }
    />
  );
};

