import { SearchInput } from '../../../components/ui/SearchInput.js';
import { matchesUnaccent } from '../../../lib/unaccent.js';
import React, { useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Building2,
} from 'lucide-react';
import type { WorkspaceItem } from '../../workspace/WorkspaceConfigContext.js';
import { getDomainLabel } from '../../workspace/workspaceConfig.types.js';

export interface WorkspaceListPageProps {
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string;
  isLoading?: boolean;
  onSelectWorkspace: (workspaceId: string) => void;
  onViewDetail: (workspace: WorkspaceItem) => void;
  onCreateNewWorkspace: () => void;
  onConfigureWorkspace?: (workspace: WorkspaceItem) => void;
}

/**
 * Trang danh sách Không gian làm việc (Workspace List Page)
 */
export const WorkspaceListPage: React.FC<WorkspaceListPageProps> = ({
  workspaces,
  activeWorkspaceId,
  isLoading = false,
  onSelectWorkspace,
  onViewDetail,
  onCreateNewWorkspace,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Lọc không gian làm việc theo từ khóa tìm kiếm 
  const filteredWorkspaces = workspaces.filter((ws) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      matchesUnaccent(ws.name, searchQuery) ||
      (ws.domain && matchesUnaccent(getDomainLabel(ws.domain), searchQuery)) ||
      (ws.domain && ws.domain.toLowerCase().includes(query))
    );
  });

  return (
    <div className="workspace-flat-view w-full max-w-[1600px] mx-auto p-3 sm:p-4 min-h-full space-y-3.5 sm:space-y-4">
      {/* 1. Header Đồng Bộ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 m-0">
            Không gian làm việc
          </h1>
          <p className="text-xs text-slate-500 m-0 mt-0.5 leading-relaxed">
            Quản lý các tổ chức, phân quyền nhân sự và kênh kết nối của bạn.
          </p>
        </div>

        {/* Nút Tạo không gian làm việc */}
        <button
          type="button"
          onClick={onCreateNewWorkspace}
          className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors shrink-0"
        >
          <Plus size={14} />
          <span>Thêm không gian làm việc</span>
        </button>
      </div>

      {/* Ô tìm kiếm đồng bộ chuẩn */}
      <div className="w-full">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Tìm kiếm không gian làm việc theo tên hoặc lĩnh vực..."
          size="sm"
          className="w-full"
        />
      </div>

      {/* Thanh phụ: Tất cả không gian làm việc & Số lượng */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Tất cả không gian làm việc
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          {filteredWorkspaces.length} không gian làm việc
        </span>
      </div>

      {/* Trạng thái Loading */}
      {isLoading && (
        <div className="flex justify-center items-center py-10 text-slate-500 text-xs gap-2">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          <span>Đang tải danh sách không gian làm việc...</span>
        </div>
      )}

      {/* Trạng thái rỗng  */}
      {!isLoading && filteredWorkspaces.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl py-12 px-6 text-center flex flex-col items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <Building2 size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold m-0 mb-1 text-slate-900">
              {searchQuery ? 'Không tìm thấy không gian làm việc phù hợp' : 'Chưa có không gian làm việc nào'}
            </h3>
            <p className="text-[11px] text-slate-500 m-0 max-w-md">
              {searchQuery
                ? `Không có kết quả nào khớp với "${searchQuery}". Vui lòng thử từ khóa khác.`
                : 'Hãy tạo không gian làm việc đầu tiên để bắt đầu kết nối kênh và quản lý đội ngũ tư vấn.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={onCreateNewWorkspace}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Tạo không gian làm việc</span>
            </button>
          )}
        </div>
      )}

      {/* Danh sách thẻ Workspace */}
      {!isLoading && filteredWorkspaces.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {filteredWorkspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;

            return (
              <div
                key={ws.id}
                className={`flex items-center justify-between p-3.5 sm:p-4 px-4 sm:px-5 gap-4 flex-wrap transition-colors hover:bg-slate-50/80 ${
                  isActive ? 'border-l-[4px] border-l-blue-600 bg-blue-50/30' : 'border-l-[4px] border-l-transparent'
                }`}
              >
                {/* Tên & Lĩnh vực & Badges  */}
                <div className="flex flex-col gap-1 min-w-[220px]">
                  <span className="text-sm font-bold text-slate-900">
                    {ws.name}
                  </span>

                  {/* Lĩnh vực / Mô tả tổ chức */}
                  <span className="text-xs text-slate-500 font-medium">
                    {getDomainLabel(ws.domain)}
                  </span>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-0.5">
                    {ws.isOwner && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200/80">
                        Chủ sở hữu
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                        <CheckCircle2 size={11} />
                        <span>Đang làm việc</span>
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {ws.isOwner ? 'Toàn quyền quản trị' : 'Thành viên'}
                    </span>
                  </div>
                </div>

                {/*  Nút thao tác */}
                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSelectWorkspace(ws.id)}
                      className="h-7 px-3 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer transition-colors"
                      title="Kích hoạt làm việc trên không gian này"
                    >
                      Chọn
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onViewDetail(ws)}
                    className="h-7 px-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                  >
                    <span>Mở không gian làm việc</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Alias for backwards compatibility
export const WorkspaceListView = WorkspaceListPage;
export type { WorkspaceListPageProps as WorkspaceListViewProps };
