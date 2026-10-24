import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from './useTranslation.js';

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="crm-lang-switcher" title="Chuyển đổi ngôn ngữ / Switch Language">
      <Globe size={14} className="lang-globe-icon" />
      <button
        type="button"
        className={`lang-btn ${locale === 'vi' ? 'active' : ''}`}
        onClick={() => setLocale('vi')}
      >
        VI
      </button>
      <span className="lang-divider">/</span>
      <button
        type="button"
        className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
        onClick={() => setLocale('en')}
      >
        EN
      </button>
    </div>
  );
};
