import React, { useState } from 'react';
import { X, BookOpen, AlertCircle } from 'lucide-react';
import { Modal } from '../../../../../components/ui/Modal.js';

interface CatalogItem {
  id: string;
  name: string;
  category?: string;
  defaultPrice: number;
}

interface InterestedCoursesSectionProps {
  productLabel?: string;
  courses?: string[];
  estimatedValue?: number;
  catalog: CatalogItem[];
  onOpenAssignModal: () => void;
  onRemoveCourse: (course: string) => void;
}

export const InterestedCoursesSection: React.FC<InterestedCoursesSectionProps> = ({
  productLabel = 'Sản phẩm / Dịch vụ',
  courses,
  estimatedValue,
  catalog,
  onOpenAssignModal,
  onRemoveCourse,
}) => {
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const effectiveCourses = courses && courses.length > 0 ? courses : [];
  const effectiveTuition = estimatedValue && estimatedValue > 0 ? estimatedValue : 0;

  return (
    <div className="p-4 bg-white space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 shrink-0">
          <h4 className="m-0 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {productLabel} ({effectiveCourses.length})
          </h4>
          <button
            type="button"
            onClick={() => setIsExplainModalOpen(true)}
            className="inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded"
            title={`Xem giải thích ${productLabel.toLowerCase()}`}
            aria-label={`Giải thích ${productLabel}`}
          >
            <AlertCircle size={13} />
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenAssignModal}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer bg-transparent border-0 p-0 transition-colors"
          title={`Gán hoặc đổi ${productLabel.toLowerCase()}`}
        >
          {effectiveCourses.length > 0 ? 'Sửa' : '+ Gán'}
        </button>
      </div>

      <div className="space-y-1.5">
        {effectiveCourses.length === 0 ? (
          <div className="py-1 text-xs text-slate-400 italic">
            Chưa có {productLabel.toLowerCase()} nào được gán
          </div>
        ) : (
          effectiveCourses.map((courseName, idx) => {
            const matched = catalog.find((c) => c.name === courseName || c.id === courseName);
            const price = matched?.defaultPrice;

            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-md border border-slate-200/80 bg-slate-50 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen size={13} className="text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="m-0 font-medium text-slate-800 truncate" title={courseName}>
                      {courseName}
                    </p>
                    {price ? (
                      <p className="m-0 text-[11px] text-slate-500">
                        {price.toLocaleString('vi-VN')} đ
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveCourse(courseName)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                  title="Gỡ khóa học"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        )}

        {/* Tổng giá trị dự kiến */}
        {effectiveTuition > 0 && (
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
            <span className="text-slate-500">Tổng giá trị:</span>
            <span className="font-semibold text-slate-900 font-mono">
              {effectiveTuition.toLocaleString('vi-VN')} đ
            </span>
          </div>
        )}
      </div>

      {/* Modal Giải thích Sản phẩm / Dịch vụ / Khóa học */}
      <Modal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        title={`${productLabel} & Doanh Thu Dự Kiến`}
        size="md"
        showCloseButton={true}
        primaryAction={{
          label: 'Đã hiểu',
          onClick: () => setIsExplainModalOpen(false),
          variant: 'primary',
        }}
      >
        <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              1. Gán danh mục quan tâm
            </h5>
            <p className="m-0 text-slate-600">
              Ghi nhận các gói sản phẩm, dịch vụ hoặc khóa học mà khách hàng đang tìm hiểu để chuẩn bị phương án tư vấn hoặc gửi báo giá chính xác.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              2. Doanh thu & Chi phí dự kiến
            </h5>
            <p className="m-0 text-slate-600">
              Tổng giá trị dự kiến được tự động tính toán từ bảng giá niêm yết trong cấu hình Workspace, phục vụ báo cáo doanh số tiềm năng của phễu.
            </p>
          </div>

          <div className="space-y-1">
            <h5 className="m-0 font-semibold text-slate-900 text-xs">
              3. Tự động tương thích lĩnh vực
            </h5>
            <p className="m-0 text-slate-600">
              Tên đề mục ({productLabel.toLowerCase()}) và danh mục lựa chọn sẽ tự động điều chỉnh linh hoạt theo ngành nghề kinh doanh được thiết lập trong cấu hình Không gian làm việc.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
