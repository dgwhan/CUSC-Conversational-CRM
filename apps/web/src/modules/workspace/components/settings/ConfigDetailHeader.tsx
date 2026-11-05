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

  return (
    <div className="w-full space-y-2.5 pb-2 border-b border-slate-200/80">
      {/* 1. Breadcrumb navigation */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors font-medium cursor-pointer border-none bg-transparent p-0"
        >
          <ArrowLeft size={13} />
          <span>Quản lý cấu hình</span>
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700 font-semibold truncate max-w-xs">{profile.name}</span>
      </div>

      {/* 2. Main Title Row: Left is Title & Badges, Right is Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Title + Badges */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isEditingInline ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tên thiết lập cấu hình..."
                className="text-lg sm:text-xl font-bold text-slate-900 border border-blue-500 px-3 py-1 rounded-lg outline-none bg-white font-inherit min-w-[220px] max-w-sm sm:max-w-md w-full shadow-2xs focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={handleSaveName}
                title="Lưu tên (Enter)"
                className="w-7 h-7 flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer border-none shrink-0 transition-colors shadow-2xs"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                title="Hủy (Esc)"
                className="w-7 h-7 flex items-center justify-center text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer shrink-0 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1
                onClick={isOwner ? handleStartEdit : undefined}
                className={`text-lg sm:text-xl font-bold text-slate-900 tracking-tight m-0 ${
                  isOwner ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''
                }`}
                title={isOwner ? 'Nhấn để sửa nhanh tên thiết lập' : undefined}
              >
                {profile.name}
              </h1>
              {isOwner && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  title="Sửa nhanh tên thiết lập"
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center border-none bg-transparent"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
          )}

          {/* Badges */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              {getDomainLabel(profile.domain)}
            </span>
            {isActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Đang áp dụng</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                <span>Chưa áp dụng</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Action Buttons Group */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {!isActive && isOwner && (
            <button
              type="button"
              onClick={onSelectApply}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Check size={13} />
              <span>Chọn áp dụng</span>
            </button>
          )}

          {isOwner && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="h-8 px-2.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 size={13} className="text-slate-500" />
                <span>Sửa thông tin</span>
              </button>

              <button
                type="button"
                onClick={onResetDefault}
                className="h-8 px-2.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                title="Khôi phục các giai đoạn và danh mục theo mẫu ngành ban đầu"
              >
                <RotateCcw size={13} className="text-slate-500" />
                <span>Khôi phục mặc định</span>
              </button>

              <button
                type="button"
                onClick={onDelete}
                className="h-8 px-2.5 text-xs font-medium rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xóa thiết lập</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3. Structured Metadata Card (Terminology Pill) */}
      <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap text-xs text-slate-600 bg-slate-50/70 border border-slate-200/70 rounded-lg px-3 py-1.5">
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-medium">Thực thể:</span>
          <span className="font-semibold text-slate-800">{terminology.entityName}</span>
        </div>
        <span className="text-slate-300 hidden sm:inline">•</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-medium">Phễu:</span>
          <span className="font-semibold text-slate-800">{terminology.pipelineName}</span>
        </div>
        <span className="text-slate-300 hidden sm:inline">•</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-medium">Danh mục:</span>
          <span className="font-semibold text-slate-800">{terminology.productLabel}</span>
        </div>
        <span className="text-slate-300 hidden sm:inline">•</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-medium">Doanh số:</span>
          <span className="font-semibold text-slate-800">{terminology.valueLabel}</span>
        </div>
      </div>
    </div>
  );
};
