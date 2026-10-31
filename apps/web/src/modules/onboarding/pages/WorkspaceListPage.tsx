import React, { useState } from 'react';
import {
  Search,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Building2,
} from 'lucide-react';
import type { WorkspaceItem } from '../../workspace/WorkspaceConfigContext.js';

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
      ws.name.toLowerCase().includes(query) ||
      (ws.domain && ws.domain.toLowerCase().includes(query))
    );
  });

  return (
    <div className="workspace-flat-view w-full max-w-[1200px] mx-auto py-2 pb-10">
      {/* 1. Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold m-0 mb-1.5 text-slate-900 tracking-tight">
            Không gian làm việc
          </h1>
          <p className="text-[13.5px] text-slate-500 m-0">
            Quản lý các tổ chức và không gian làm việc của bạn.
          </p>
        </div>

        {/* Tạo không gian làm việc */}
        <button
          type="button"
          onClick={onCreateNewWorkspace}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none rounded-none cursor-pointer transition-colors shadow-none"
        >
          <Plus size={15} />
          <span>Thêm không gian làm việc</span>
        </button>
      </div>

      {/* Ô tìm kiếm  */}
      <div className="relative mb-4">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm không gian làm việc..."
          className="w-full py-2.5 pl-9 pr-3 text-[13.5px] rounded-none border border-slate-300 bg-white text-slate-900 outline-none focus:border-blue-600 transition-colors shadow-none box-border"
        />
      </div>

      {/* Thanh phụ: Tất cả không gian làm việc & Số lượng */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <span className="text-[12.5px] font-bold text-slate-800 uppercase tracking-wider">
          Tất cả không gian làm việc
        </span>
        <span className="text-xs text-slate-500">
          {filteredWorkspaces.length} không gian làm việc
        </span>
      </div>

      {/* Trạng thái Loading */}
      {isLoading && (
        <div className="flex justify-center items-center py-10 text-slate-500 text-xs gap-2">
          <Loader2 className="animate-spin text-blue-600" size={22} />
          <span>Đang tải danh sách không gian làm việc...</span>
        </div>
      )}

      {/* Trạng thái rỗng  */}
      {!isLoading && filteredWorkspaces.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-none py-12 px-5 text-center flex flex-col items-center gap-3">
          <Building2 size={32} className="text-slate-400" />
          <div>
            <h3 className="text-sm font-semibold m-0 mb-1 text-slate-900">
              {searchQuery ? 'Không tìm thấy không gian làm việc phù hợp' : 'Chưa có không gian làm việc nào'}
            </h3>
            <p className="text-xs text-slate-500 m-0 max-w-md">
              {searchQuery
                ? `Không có kết quả nào khớp với "${searchQuery}". Vui lòng thử từ khóa khác.`
                : 'Hãy tạo không gian làm việc đầu tiên để bắt đầu kết nối kênh và quản lý đội ngũ tư vấn.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={onCreateNewWorkspace}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white border-none rounded-none cursor-pointer"
            >
              <Plus size={15} />
              <span>Tạo không gian làm việc</span>
            </button>
          )}
        </div>
      )}

      {!isLoading && filteredWorkspaces.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-none divide-y divide-slate-200">
          {filteredWorkspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;

            return (
              <div
                key={ws.id}
                className={`flex items-center justify-between p-3.5 gap-4 flex-wrap transition-colors hover:bg-slate-50 ${
                  isActive ? 'border-l-[3px] border-l-blue-600 bg-slate-50/50' : 'border-l-[3px] border-l-transparent'
                }`}
              >
                {/* Tên & Lĩnh vực & Badges  */}
                <div className="flex flex-col gap-1 min-w-[220px]">
                  <span className="text-[14.5px] font-semibold text-slate-900">
                    {ws.name}
                  </span>

                  {/* Lĩnh vực / Mô tả tổ chức */}
                  <span className="text-xs text-slate-500">
                    {ws.domain || 'Dịch vụ & Doanh nghiệp'}
                  </span>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-0.5">
                    {ws.isOwner && (
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-none border bg-blue-50 text-blue-700 border-blue-200">
                        Chủ sở hữu
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-none bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 size={11} />
                        <span>Đang làm việc</span>
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {ws.isOwner ? 'Toàn quyền quản trị' : 'Thành viên'}
                    </span>
                  </div>
                </div>

                {/*  Mở không gian làm việc  */}
                <div className="flex items-center gap-3">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSelectWorkspace(ws.id)}
                      className="bg-white border border-slate-300 hover:border-blue-600 hover:text-blue-600 text-slate-700 rounded-none px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors shadow-none"
                      title="Kích hoạt làm việc trên không gian này"
                    >
                      Chọn
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onViewDetail(ws)}
                    className="bg-transparent border-none text-blue-600 text-xs font-medium cursor-pointer p-0 inline-flex items-center gap-1 hover:underline shadow-none"
                  >
                    <span>Mở không gian làm việc</span>
                    <ArrowUpRight size={14} />
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
