import React, { useState } from 'react';
import { Building2, Briefcase, ArrowRight } from 'lucide-react';
import type { BusinessSetupData } from '../../types.js';
import { useTranslation } from '../../../../i18n/index.js';

export interface BusinessSetupStepProps {
  initialData: BusinessSetupData;
  onNext: (data: BusinessSetupData) => void;
}

/**
 * Bước 1: Thiết lập Thông tin Doanh nghiệp / Tổ chức
 */
export const BusinessSetupStep: React.FC<BusinessSetupStepProps> = ({
  initialData,
  onNext,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<BusinessSetupData>(initialData);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      setErrorMsg(t('onboarding.step1.errors.nameRequired'));
      return;
    }
    setErrorMsg(null);
    onNext(formData);
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      {/* Header đề mục Bước 1 chuẩn Flat Design */}
      <div className="flex items-center gap-3.5 pb-5 border-b border-slate-200">
        <div className="w-10 h-10 border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 text-blue-600 rounded-none">
          <Building2 size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 m-0">{t('onboarding.step1.title')}</h2>
          <p className="text-xs text-slate-500 mt-1 m-0">
            {t('onboarding.step1.desc')}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-none">
          {errorMsg}
        </div>
      )}

      {/* Grid Fields chuẩn Flat Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-800" htmlFor="companyName">
            {t('onboarding.step1.companyName')} <span className="text-red-600">*</span>
          </label>
          <div className="relative flex items-center">
            <Building2 size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              id="companyName"
              type="text"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 focus:border-blue-600 outline-none rounded-none bg-white text-slate-900 font-medium"
              placeholder={t('onboarding.step1.companyPlaceholder')}
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
          </div>
          <span className="text-[11px] text-slate-500">{t('onboarding.step1.companyHint')}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-800" htmlFor="industry">
            {t('onboarding.step1.industry')}
          </label>
          <div className="relative flex items-center">
            <Briefcase size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
            <select
              id="industry"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 focus:border-blue-600 outline-none rounded-none bg-white text-slate-900 font-medium cursor-pointer"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
            >
              <option value="Giáo dục & Tuyển sinh">{t('onboarding.step1.industries.education')}</option>
              <option value="Bán lẻ & Thương mại điện tử">{t('onboarding.step1.industries.ecommerce')}</option>
              <option value="Dịch vụ & Tư vấn">{t('onboarding.step1.industries.services')}</option>
              <option value="Công nghệ & Phần mềm">{t('onboarding.step1.industries.tech')}</option>
              <option value="Khác">{t('onboarding.step1.industries.other')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Footer Nút Tiếp tục */}
      <div className="pt-6 border-t border-slate-200 flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-none cursor-pointer border-0 transition-colors shadow-none"
        >
          <span>{t('onboarding.step1.continueBtn')}</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
};

// Alias tương thích ngược
export const Step1BusinessSetup = BusinessSetupStep;
export type Step1BusinessSetupProps = BusinessSetupStepProps;
