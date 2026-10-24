import React, { useState } from 'react';
import { Building2, Phone, Briefcase, Users2, ArrowRight } from 'lucide-react';
import type { BusinessSetupData } from '../types.js';
import { useTranslation } from '../../../i18n/index.js';

export interface Step1BusinessSetupProps {
  initialData: BusinessSetupData;
  onNext: (data: BusinessSetupData) => void;
}

export const Step1BusinessSetup: React.FC<Step1BusinessSetupProps> = ({
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
    if (!formData.phone.trim()) {
      setErrorMsg(t('onboarding.step1.errors.phoneRequired'));
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
          <h2 className="onboarding-card-title">{t('onboarding.step1.title')}</h2>
          <p className="onboarding-card-desc">
            {t('onboarding.step1.desc')}
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
            {t('onboarding.step1.companyName')} <span className="required-star">*</span>
          </label>
          <div className="onboarding-input-wrapper">
            <Building2 size={18} className="field-icon" />
            <input
              id="companyName"
              type="text"
              className="onboarding-input"
              placeholder={t('onboarding.step1.companyPlaceholder')}
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
          </div>
          <span className="field-hint">{t('onboarding.step1.companyHint')}</span>
        </div>

        <div className="onboarding-field-group">
          <label className="onboarding-label" htmlFor="brandName">
            {t('onboarding.step1.brandName')}
          </label>
          <input
            id="brandName"
            type="text"
            className="onboarding-input no-icon"
            placeholder={t('onboarding.step1.brandPlaceholder')}
            value={formData.brandName}
            onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
          />
        </div>

        <div className="onboarding-field-group">
          <label className="onboarding-label" htmlFor="phone">
            {t('onboarding.step1.phone')} <span className="required-star">*</span>
          </label>
          <div className="onboarding-input-wrapper">
            <Phone size={18} className="field-icon" />
            <input
              id="phone"
              type="tel"
              className="onboarding-input"
              placeholder={t('onboarding.step1.phonePlaceholder')}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="onboarding-field-group">
          <label className="onboarding-label" htmlFor="industry">
            {t('onboarding.step1.industry')}
          </label>
          <div className="onboarding-input-wrapper">
            <Briefcase size={18} className="field-icon" />
            <select
              id="industry"
              className="onboarding-select"
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

        <div className="onboarding-field-group">
          <label className="onboarding-label" htmlFor="businessScale">
            {t('onboarding.step1.scale')}
          </label>
          <div className="onboarding-input-wrapper">
            <Users2 size={18} className="field-icon" />
            <select
              id="businessScale"
              className="onboarding-select"
              value={formData.businessScale}
              onChange={(e) => setFormData({ ...formData, businessScale: e.target.value })}
            >
              <option value="1-10">{t('onboarding.step1.scales.small')}</option>
              <option value="11-50">{t('onboarding.step1.scales.medium')}</option>
              <option value="51-200">{t('onboarding.step1.scales.large')}</option>
              <option value="200+">{t('onboarding.step1.scales.enterprise')}</option>
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
          <span>{t('onboarding.step1.continueBtn')}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
};
