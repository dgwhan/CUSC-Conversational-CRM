import React from 'react';
import { X, BookOpen } from 'lucide-react';

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
  productLabel = 'Khóa học / Ngành đào tạo',
  courses,
  estimatedValue,
  catalog,
  onOpenAssignModal,
  onRemoveCourse,
}) => {
  const effectiveCourses = courses && courses.length > 0 ? courses : [];
  const effectiveTuition = estimatedValue && estimatedValue > 0 ? estimatedValue : 0;

  return (
    <div className="p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-xs font-bold text-slate-800 uppercase tracking-wider">
          {productLabel} ({effectiveCourses.length})
        </h4>
        <button
          type="button"
          onClick={onOpenAssignModal}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer bg-transparent border-0 p-0 transition-colors"
          title="Gán hoặc đổi khóa học"
        >
          {effectiveCourses.length > 0 ? 'Chỉnh sửa' : '+ Gán khóa'}
        </button>
      </div>

      <div className="space-y-2">
        {effectiveCourses.length === 0 ? (
          <div className="py-2 text-xs text-slate-400 italic">
            Chưa có {productLabel.toLowerCase()} nào được gán
          </div>
        ) : (
          effectiveCourses.map((course, idx) => {
            const prod = catalog.find((p) => p.name === course || p.id === course);
            const courseType = prod?.category || 'Tiêu chuẩn';
            const coursePrice = prod?.defaultPrice || 0;

            return (
              <div
                key={idx}
                className="p-3 bg-slate-50/80 border border-slate-200/90 rounded-xl space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen size={14} className="text-blue-600 shrink-0 mt-0.5" />
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {course}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveCourse(course)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer shrink-0"
                    title="Gỡ bỏ"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pl-5">
                  <span>{courseType}</span>
                  <span className="font-semibold text-slate-700 font-mono">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(coursePrice)}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Tổng học phí dự kiến */}
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">Học phí dự kiến:</span>
          <span className="font-bold text-blue-700 font-mono text-sm">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(effectiveTuition)}
          </span>
        </div>
      </div>
    </div>
  );
};
