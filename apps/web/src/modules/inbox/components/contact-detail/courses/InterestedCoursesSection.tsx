import React from 'react';
import { X } from 'lucide-react';

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

/**
 * Section: Khóa học / Chương trình đào tạo quan tâm
 * Thiết kế phẳng bằng Tailwind CSS
 */
export const InterestedCoursesSection: React.FC<InterestedCoursesSectionProps> = ({
  productLabel = 'Khóa học / Chương trình đào tạo',
  courses,
  estimatedValue,
  catalog,
  onOpenAssignModal,
  onRemoveCourse,
}) => {
  const effectiveCourses = courses && courses.length > 0 ? courses : ['Lập trình viên Quốc tế Aptech ADSE'];
  const effectiveTuition = estimatedValue && estimatedValue > 0 ? estimatedValue : 32000000;

  return (
    <section className="p-4 border-b border-slate-200">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[13px] font-semibold text-slate-800 m-0">
          {productLabel} ({effectiveCourses.length})
        </h3>
        <button
          type="button"
          onClick={onOpenAssignModal}
          className="text-[11.5px] font-medium text-blue-600 hover:text-blue-800 bg-transparent border-0 cursor-pointer p-0 transition-colors"
          title="Gán hoặc đổi khóa học"
        >
          <span>Gán</span>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {effectiveCourses.map((course, idx) => {
          const prod = catalog.find((p) => p.name === course || p.id === course);
          const courseType = prod?.category || 'Dài hạn';
          const coursePrice = prod?.defaultPrice || 32000000;

          return (
            <div
              key={idx}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-md"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[12.5px] font-semibold text-slate-800 leading-snug">
                  {course}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveCourse(course)}
                  className="text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 shrink-0"
                  title="Gỡ bỏ"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="flex items-center justify-between text-[11.5px] text-slate-500">
                <span>Loại: {courseType}</span>
                <span className="font-semibold text-slate-700">
                  Học phí: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(coursePrice)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Dòng tổng học phí dự kiến */}
        <div className="flex items-center justify-between pt-1 text-[12px]">
          <span className="text-slate-500 font-medium">Học phí dự kiến (VNĐ):</span>
          <span className="font-bold text-blue-700 font-mono">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(effectiveTuition)}
          </span>
        </div>
      </div>
    </section>
  );
};
