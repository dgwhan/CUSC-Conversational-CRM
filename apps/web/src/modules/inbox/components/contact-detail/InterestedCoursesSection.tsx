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
    <section className="flat-section">
      <div className="flat-section-header">
        <h3 className="flat-section-title">
          {productLabel} ({effectiveCourses.length})
        </h3>
        <button
          type="button"
          className="flat-link-action"
          onClick={onOpenAssignModal}
          title="Gán hoặc đổi khóa học"
        >
          <span>Gán</span>
        </button>
      </div>

      <div className="flat-course-container">
        {effectiveCourses.map((course, idx) => {
          const prod = catalog.find((p) => p.name === course || p.id === course);
          const courseType = prod?.category || 'Dài hạn';
          const coursePrice = prod?.defaultPrice || 32000000;

          return (
            <div key={idx} className="flat-course-item">
              <div className="flat-course-header-row">
                <span className="flat-course-name">{course}</span>
                <button
                  type="button"
                  className="flat-tag-delete-btn"
                  onClick={() => onRemoveCourse(course)}
                  title="Gỡ bỏ"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="flat-course-meta-row">
                <span className="flat-course-type">Loại: {courseType}</span>
                <span className="flat-course-price">
                  Học phí: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(coursePrice)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Dòng tổng học phí dự kiến */}
        <div className="flat-tuition-total-row">
          <span className="flat-tuition-total-label">Học phí dự kiến (VNĐ):</span>
          <span className="flat-tuition-total-val">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(effectiveTuition)}
          </span>
        </div>
      </div>
    </section>
  );
};
