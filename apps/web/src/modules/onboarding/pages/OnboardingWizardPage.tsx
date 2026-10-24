import React, { useState } from 'react';
import {
  Building2,
  Share2,
  Users2,
  Check,
} from 'lucide-react';
import type { OnboardingState, BusinessSetupData, ChannelKey, FanpageItem, DiscoveredPageDto } from '../types.js';
import { Step1BusinessSetup } from '../components/Step1BusinessSetup.js';
import { Step2ChannelConnect } from '../components/Step2ChannelConnect.js';
import { Step3TeamInvite } from '../components/Step3TeamInvite.js';
import { notify } from '../../../components/feedback/toastEmitter.js';
import { apiClient } from '../../../lib/api-client.js';
import { useTranslation } from '../../../i18n/index.js';

export interface OnboardingWizardPageProps {
  onComplete: (data: OnboardingState) => void;
  onSkipToInbox?: () => void;
}

export const OnboardingWizardPage: React.FC<OnboardingWizardPageProps> = ({
  onComplete,
  onSkipToInbox,
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<OnboardingState>({
    step: 1,
    business: {
      companyName: 'Trung tâm Công nghệ Phần mềm Đại học Cần Thơ (CUSC)',
      brandName: 'CUSC Can Tho',
      businessScale: '11-50',
      phone: '0292.3835.581',
      industry: 'Giáo dục & Tuyển sinh',
    },
    connectedChannels: ['FACEBOOK', 'ZALO'],
    pages: [
      {
        id: 'page-fb-1',
        name: 'CUSC - Trung Tâm Công Nghệ Phần Mềm ĐH Cần Thơ',
        avatarUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&auto=format&fit=crop&q=60',
        category: 'Trường Đại học & Đào tạo IT',
        followerCount: 48500,
        channel: 'FACEBOOK',
        selected: true,
      },
      {
        id: 'page-fb-2',
        name: 'Tuyển sinh Aptech Cần Thơ - CUSC',
        avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=60',
        category: 'Chương trình Quốc tế Aptech & Arena',
        followerCount: 21300,
        channel: 'FACEBOOK',
        selected: true,
      },
      {
        id: 'page-zalo-1',
        name: 'CUSC Official Account (Tick Vàng)',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60',
        category: 'Zalo Doanh Nghiệp Xác Thực',
        followerCount: 15200,
        channel: 'ZALO',
        selected: true,
      },
      {
        id: 'page-tiktok-1',
        name: 'CUSC Tech Life (@cusc.tech)',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60',
        category: 'Kênh TikTok Học Lập Trình',
        followerCount: 84000,
        channel: 'TIKTOK',
        selected: false,
      },
    ],
    invites: [
      { id: 'inv-1', email: 'tuyensinh.cusc@ctu.edu.vn', role: 'ADMIN' },
      { id: 'inv-2', email: 'tuvanvien.minh@cusc.vn', role: 'AGENT' },
      { id: 'inv-3', email: 'tuvanvien.lan@cusc.vn', role: 'AGENT' },
    ],
  });

  const stepsMeta = [
    { number: 1, title: t('onboarding.steps.step1'), icon: <Building2 size={16} /> },
    { number: 2, title: t('onboarding.steps.step2'), icon: <Share2 size={16} /> },
    { number: 3, title: t('onboarding.steps.step3'), icon: <Users2 size={16} /> },
  ];

  const handleStep1Next = (businessData: BusinessSetupData) => {
    setState((prev) => ({ ...prev, business: businessData, step: 2 }));
    notify.info('Đã lưu thông tin doanh nghiệp. Vui lòng kết nối các kênh mạng xã hội.');
  };

  const handleConnectChannel = (channel: ChannelKey, discoveredPages?: DiscoveredPageDto[]) => {
    setState((prev) => {
      const already = prev.connectedChannels.includes(channel);
      const nextChannels = already ? prev.connectedChannels : [...prev.connectedChannels, channel];

      let mergedPages = [...prev.pages];
      if (discoveredPages && discoveredPages.length > 0) {
        discoveredPages.forEach((dp) => {
          const pageId = dp.id || dp.externalAccountId;
          const idx = mergedPages.findIndex((p) => p.id === pageId);
          const newItem: FanpageItem = {
            id: pageId,
            name: dp.name,
            avatarUrl:
              dp.avatarUrl ||
              'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&auto=format&fit=crop&q=60',
            category: dp.category || 'Trang mạng xã hội',
            followerCount: dp.followerCount || 12000,
            channel,
            selected: true,
          };
          if (idx >= 0) {
            mergedPages[idx] = newItem;
          } else {
            mergedPages.push(newItem);
          }
        });
      } else {
        mergedPages = mergedPages.map((p) =>
          p.channel === channel ? { ...p, selected: true } : p
        );
      }

      return {
        ...prev,
        connectedChannels: nextChannels,
        pages: mergedPages,
      };
    });

    notify.success(
      `Ủy quyền OAuth thành công cho kênh ${channel}! Đã tự động tải danh sách Fanpage.`,
      'Kết nối Kênh Thành công'
    );
  };

  const handleTogglePage = (pageId: string) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId ? { ...p, selected: !p.selected } : p
      ),
    }));
  };

  const handleAddInvite = (email: string, role: 'ADMIN' | 'AGENT') => {
    const newInvite = { id: `inv-${Date.now()}`, email, role };
    setState((prev) => ({
      ...prev,
      invites: [...prev.invites, newInvite],
    }));
    notify.success(`Đã thêm ${email} (${role}) vào danh sách mời.`);
  };

  const handleRemoveInvite = (id: string) => {
    setState((prev) => ({
      ...prev,
      invites: prev.invites.filter((inv) => inv.id !== id),
    }));
  };

  const handleComplete = async () => {
    try {
      const activePages = state.pages
        .filter((p) => p.selected)
        .map((p) => ({
          channel: p.channel,
          externalAccountId: p.id,
          displayName: p.name,
          avatarUrl: p.avatarUrl,
          category: p.category,
          accessToken: `EAA_mock_${p.id}_token_secret`,
        }));

      if (activePages.length > 0) {
        await apiClient.activateChannels(activePages);
      }
    } catch {
      // Tiếp tục chuyển hướng kể cả khi máy chủ backend offline
    }

    notify.success(
      `Khởi tạo Workspace "${state.business.companyName}" hoàn tất! Đang chuyển hướng vào Hộp thư Trực tuyến...`,
      'Onboarding Thành công'
    );
    onComplete(state);
  };

  return (
    <div className="onboarding-page-container">
      {/* Top Banner & Stepper */}
      <div className="onboarding-wizard-header">
        <div className="wizard-title-group">
          <div className="wizard-badge">{t('onboarding.badge')}</div>
          <h1 className="wizard-headline">{t('onboarding.welcomeTitle')}</h1>
          <p className="wizard-subheadline">
            {t('onboarding.welcomeDesc')}
          </p>
        </div>

        {onSkipToInbox && (
          <button
            type="button"
            className="crm-btn crm-btn-secondary crm-btn-sm skip-btn"
            onClick={onSkipToInbox}
          >
            {t('onboarding.skipToInbox')}
          </button>
        )}
      </div>

      {/* Stepper Bar */}
      <div className="onboarding-stepper-container">
        <div className="onboarding-stepper-bar">
          {stepsMeta.map((s) => {
            const isCompleted = state.step > s.number;
            const isCurrent = state.step === s.number;

            return (
              <div
                key={s.number}
                className={`step-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                onClick={() => {
                  if (s.number < state.step) {
                    setState((prev) => ({ ...prev, step: s.number as 1 | 2 | 3 }));
                  }
                }}
              >
                <div className="step-circle">
                  {isCompleted ? <Check size={14} /> : s.number}
                </div>
                <div className="step-label-group">
                  <span className="step-number-tag">{t('onboarding.steps.stepTag')} {s.number}</span>
                  <span className="step-title-text">{s.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card Content Tương Ứng Với Từng Bước */}
      <div className="onboarding-content-card">
        {state.step === 1 && (
          <Step1BusinessSetup
            initialData={state.business}
            onNext={handleStep1Next}
          />
        )}

        {state.step === 2 && (
          <Step2ChannelConnect
            connectedChannels={state.connectedChannels}
            pages={state.pages}
            onConnectChannel={handleConnectChannel}
            onTogglePage={handleTogglePage}
            onNext={() => setState((prev) => ({ ...prev, step: 3 }))}
            onBack={() => setState((prev) => ({ ...prev, step: 1 }))}
          />
        )}

        {state.step === 3 && (
          <Step3TeamInvite
            business={state.business}
            pages={state.pages}
            invites={state.invites}
            onAddInvite={handleAddInvite}
            onRemoveInvite={handleRemoveInvite}
            onFinish={handleComplete}
            onBack={() => setState((prev) => ({ ...prev, step: 2 }))}
          />
        )}
      </div>
    </div>
  );
};
