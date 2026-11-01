import React from 'react';
import { Inbox } from 'lucide-react';
import { useTranslation } from '../../../../../i18n/index.js';

export const EmptyConversationList: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
        <Inbox size={20} />
      </div>
      <p className="text-xs text-slate-400 font-medium">{t('inbox.emptyList')}</p>
    </div>
  );
};
