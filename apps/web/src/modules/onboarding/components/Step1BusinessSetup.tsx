import React, { useState } from 'react';
import { Building2, Phone, Briefcase, Users2, ArrowRight } from 'lucide-react';
import type { BusinessSetupData } from '../types.js';

export interface Step1BusinessSetupProps {
  initialData: BusinessSetupData;
  onNext: (data: BusinessSetupData) => void;
}

export const Step1BusinessSetup: React.FC<Step1BusinessSetupProps> = ({
  initialData,
  onNext,
}) => {
  const [formData, setFormData] = useState<BusinessSetupData>(initialData);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      setErrorMsg('Vui lòng nhập tên doanh nghiệp hoặc trường học / chi nhánh.');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMsg('Vui lòng nhập số điện thoại liên hệ chính.');
      return;
    }
    setErrorMsg(null);
    onNext(formData);
  };

  return (
    <form className="onboarding-step-form" onSubmit={handleSubmit}>
      <div className="onboarding-card-header">
        <div className="header-icon-wrapper">
          <Building2 size={24} />
        </div>
        <div>
          <h2 className="onboarding-card-title">Bước 1: Thiết lập Thông tin Doanh nghiệp</h2>
          <p className="onboarding-card-desc">
            Khởi tạo không gian làm việc (Workspace) để gom các kênh mạng xã hội và phân công nhân viên tư vấn.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="onboarding-error-alert">
          {errorMsg}
        </div>
      )}

      <div className="onboarding-fields-grid">
        <div className="onboarding-field-group full-width">
          <label className="onboarding-label" htmlFor="companyName">
            Tên Doanh nghiệp / Tổ chức / Trường học <span className="required-star">*</span>
          </label>
          <div className="onboarding-input-wrapper">
            <Building2 size={18} className="field-icon" />
            <input
              id="companyName"
              type="text"
              className="onboarding-input"
              placeholder="VD: Trung tâm Công nghệ Phần mềm Đại học Cần Thơ (CUSC)"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
          </div>
          <span className="field-hint">Tên này sẽ hiển thị trên đầu thanh điều hướng và trong email thông báo.</span>
        </div>

        <div className="onboarding-field-group">
          <label className="onboarding-label" htmlFor="brandName">
            Tên thương hiệu / Viết tắt
          </label>
          <input
            id="brandName"
            type="text"
            className="onboarding-input no-icon"
            placeholder="VD: CUSC Cần Thơ"
            value={formData.brandName}
            onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
          />
        </div>

        <div className="onboarding-field-group">
          <label className="onboarding-label" htmlFor="phone">
            Số điện thoại Hotline / Zalo chính <span className="required-star">*</span>
          </label>
          <div className="onboarding-input-wrapper">
            <Phone size={18} className="field-icon" />
            <input
              id="phone"
              type="tel"
              className="onboarding-input"
              placeholder="VD: 0292.3835.581 hoặc 0901.234.567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="onboarding-field-group">
          <label className="onboarding-label" htmlFor="industry">
            Lĩnh vực hoạt động
          </label>
          <div className="onboarding-input-wrapper">
            <Briefcase size={18} className="field-icon" />
            <select
              id="industry"
              className="onboarding-select"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
            >
              <option value="Giáo dục & Tuyển sinh">Giáo dục & Tuyển sinh (Đại học, Cao đẳng, Trung tâm đào tạo)</option>
              <option value="Bán lẻ & Thương mại điện tử">Bán lẻ & Thương mại điện tử (E-Commerce)</option>
              <option value="Dịch vụ & Tư vấn">Dịch vụ, Du học & Tư vấn việc làm</option>
              <option value="Công nghệ & Phần mềm">Công nghệ & Phần mềm</option>
              <option value="Khác">Lĩnh vực khác</option>
            </select>
          </div>
        </div>

        <div className="onboarding-field-group">
          <label className="onboarding-label" htmlFor="businessScale">
            Quy mô nhân sự tư vấn
          </label>
          <div className="onboarding-input-wrapper">
            <Users2 size={18} className="field-icon" />
            <select
              id="businessScale"
              className="onboarding-select"
              value={formData.businessScale}
              onChange={(e) => setFormData({ ...formData, businessScale: e.target.value })}
            >
              <option value="1-10">1 - 10 nhân sự tư vấn</option>
              <option value="11-50">11 - 50 nhân sự tư vấn</option>
              <option value="51-200">51 - 200 nhân sự tư vấn</option>
              <option value="200+">Hơn 200 nhân sự (Doanh nghiệp lớn)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="onboarding-card-footer">
        <button
          type="submit"
          className="crm-btn crm-btn-primary crm-btn-gradient-primary"
          style={{ minWidth: '220px', marginLeft: 'auto' }}
        >
          <span>Tiếp tục: Kết nối Kênh</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
};
