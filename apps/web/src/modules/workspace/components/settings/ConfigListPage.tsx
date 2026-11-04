import React, { useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Sliders,
  Edit2,
  Trash2,
  Layers,
  ShoppingBag,
  SlidersHorizontal,
} from 'lucide-react';
import { SearchInput } from '../../../../components/ui/SearchInput.js';
import { matchesUnaccent } from '../../../../lib/unaccent.js';
import { getDomainLabel } from '../../workspaceConfig.types.js';
import type { ConfigProfileItem } from './types.js';

export interface ConfigListPageProps {
  profiles: ConfigProfileItem[];
  activeProfileId: string;
  isOwner: boolean;
  onSelectApply: (profile: ConfigProfileItem) => void;
  onViewDetail: (profile: ConfigProfileItem) => void;
  onCreateNew: () => void;
  onEdit: (profile: ConfigProfileItem) => void;
  onDelete: (profile: ConfigProfileItem) => void;
}

export const ConfigListPage: React.FC<ConfigListPageProps> = ({
  profiles,
  activeProfileId,
  isOwner,
  onSelectApply,
  onViewDetail,
  onCreateNew,
  onEdit,
  onDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      matchesUnaccent(p.name, searchQuery) ||
      matchesUnaccent(getDomainLabel(p.domain), searchQuery) ||
      (p.config.terminology.entityName && matchesUnaccent(p.config.terminology.entityName, searchQuery)) ||
      (p.config.terminology.pipelineName && matchesUnaccent(p.config.terminology.pipelineName, searchQuery)) ||
      (p.config.terminology.productLabel && matchesUnaccent(p.config.terminology.productLabel, searchQuery))
    );
  });

  return (
    <div className="w-full max-w-[1600px] mx-auto p-3 sm:p-4 min-h-full space-y-3.5 sm:space-y-4">
      {/* 1. Header Đồng Bộ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 m-0">
            Quản lý cấu hình
          </h1>
          <p className="text-xs text-slate-500 m-0 mt-0.5 leading-relaxed">
            Danh sách các bộ thiết lập quy trình phễu, thuật ngữ và danh mục sản phẩm cho doanh nghiệp.
          </p>
        </div>

        {/* Nút Thêm thiết lập mới */}
        {isOwner && (
          <button
            type="button"
            onClick={onCreateNew}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors shrink-0"
          >
            <Plus size={14} />
            <span>Thêm thiết lập</span>
          </button>
        )}
      </div>

      {/* 2. Ô tìm kiếm */}
      <div className="w-full">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Tìm kiếm thiết lập theo tên, mô hình kinh doanh hoặc thuật ngữ..."
          size="sm"
          className="w-full"
        />
      </div>

      {/* 3. Thanh tiêu đề phụ: Số lượng thiết lập */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Tất cả thiết lập
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          {filteredProfiles.length} thiết lập
        </span>
      </div>

      {/* 4. Trạng thái rỗng */}
      {filteredProfiles.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl py-12 px-6 text-center flex flex-col items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <Sliders size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold m-0 mb-1 text-slate-900">
              {searchQuery ? 'Không tìm thấy thiết lập phù hợp' : 'Chưa có bộ thiết lập cấu hình nào'}
            </h3>
            <p className="text-[11px] text-slate-500 m-0 max-w-md">
              {searchQuery
                ? `Không có kết quả nào khớp với "${searchQuery}". Vui lòng thử từ khóa khác.`
                : 'Tạo bộ thiết lập quy trình đầu tiên để chuẩn hóa phễu và thuật ngữ phù hợp cho doanh nghiệp.'}
            </p>
          </div>
          {!searchQuery && isOwner && (
            <button
              type="button"
              onClick={onCreateNew}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Thêm thiết lập</span>
            </button>
          )}
        </div>
      )}

      {/* 5. Danh sách thẻ Thiết Lập Cấu Hình */}
      {filteredProfiles.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {filteredProfiles.map((item) => {
            const isActive = item.id === activeProfileId;
            const domainLabel = getDomainLabel(item.domain);
            const { terminology, pipelineStages, productCatalog, criteria } = item.config;

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3.5 sm:p-4 px-4 sm:px-5 gap-4 flex-wrap transition-colors hover:bg-slate-50/80 ${
                  isActive ? 'border-l-[4px] border-l-blue-600 bg-blue-50/30' : 'border-l-[4px] border-l-transparent'
                }`}
              >
                {/* Thông tin thiết lập & Thuật ngữ & Thống kê */}
                <div className="flex flex-col gap-1.5 min-w-[240px] flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">
                      {item.name}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
                      {domainLabel}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                        <CheckCircle2 size={11} />
                        <span>Đang áp dụng</span>
                      </span>
                    )}
                  </div>

                  {/* Thuật ngữ thiết lập */}
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      <strong className="text-slate-700">Thực thể:</strong> {terminology.entityName}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      <strong className="text-slate-700">Phễu:</strong> {terminology.pipelineName}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      <strong className="text-slate-700">Danh mục:</strong> {terminology.productLabel}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      <strong className="text-slate-700">Doanh số:</strong> {terminology.valueLabel}
                    </span>
                  </div>

                  {/* Thống kê số lượng phễu / sản phẩm / tiêu chí */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Layers size={12} className="text-slate-400" />
                      <span>{pipelineStages.length} giai đoạn phễu</span>
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <ShoppingBag size={12} className="text-slate-400" />
                      <span>{productCatalog.length} {terminology.productLabel.toLowerCase()}</span>
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <SlidersHorizontal size={12} className="text-slate-400" />
                      <span>{criteria.length} tiêu chí</span>
                    </span>
                  </div>
                </div>

                {/* Các nút thao tác */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isActive && isOwner && (
                    <button
                      type="button"
                      onClick={() => onSelectApply(item)}
                      className="h-7 px-3 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer transition-colors"
                      title="Áp dụng bộ thiết lập này cho Workspace"
                    >
                      Chọn áp dụng
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onViewDetail(item)}
                    className="h-7 px-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                    title="Xem và chỉnh sửa chi tiết các giai đoạn, sản phẩm, thuật ngữ"
                  >
                    <span>Chi tiết thiết lập</span>
                    <ArrowUpRight size={13} />
                  </button>

                  {isOwner && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        title="Đổi tên hoặc mô hình"
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        title="Xóa thiết lập này"
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

