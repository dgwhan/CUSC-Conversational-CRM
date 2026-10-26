import React, { useState, useEffect } from 'react';
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
import { useWorkspaceConfig } from '../../workspace/WorkspaceConfigContext.js';
import { useUserRole } from '../../auth/index.js';

export interface OnboardingWizardPageProps {
  onComplete: (data: OnboardingState) => void;
  onSkipToInbox?: () => void;
}

export const OnboardingWizardPage: React.FC<OnboardingWizardPageProps> = ({
  onComplete,
  onSkipToInbox,
}) => {
  const { t } = useTranslation();
  const { config: workspaceConfig } = useWorkspaceConfig();
  const { staffId, ownerId, isOwner } = useUserRole();
  const effectiveOwnerId = ownerId || (isOwner ? staffId : '');
  const effectiveWorkspaceId = workspaceConfig.workspaceId;

  // Khởi tạo trạng thái ban đầu SẠCH SẼ, không gán cứng dữ liệu mẫu
  const [state, setState] = useState<OnboardingState>(() => ({
    step: 1,
    business: {
      companyName: workspaceConfig.workspaceName || '',
      brandName: '',
      businessScale: '',
      phone: '',
      industry: workspaceConfig.domain || '',
    },
    connectedChannels: [],
    pages: [],
    invites: [],
  }));

  // Tự động tải danh sách các kênh đã liên kết thực tế từ Database theo Workspace
  useEffect(() => {
    let isMounted = true;
    const loadWorkspaceChannels = async () => {
      try {
        const channels = await apiClient.getChannels(effectiveWorkspaceId, effectiveOwnerId);
        if (isMounted && Array.isArray(channels) && channels.length > 0) {
          const mappedPages: FanpageItem[] = channels.map((c: any) => ({
            id: c.id,
            name: c.displayName,
            avatarUrl: c.avatarUrl || '',
            category: c.metadata?.category || `Kênh ${c.channel}`,
            followerCount: c.metadata?.followerCount || 0,
            channel: c.channel as ChannelKey,
            selected: c.isActive !== false,
          }));

          const activeChannels = Array.from(new Set(mappedPages.map((p) => p.channel)));
          setState((prev) => ({
            ...prev,
            connectedChannels: activeChannels,
            pages: mappedPages,
          }));
        }
      } catch {
        // Chưa có kênh hoặc backend đang khởi động
      }
    };

    loadWorkspaceChannels();
    return () => {
      isMounted = false;
    };
  }, [effectiveWorkspaceId, effectiveOwnerId]);

  const stepsMeta = [
    { number: 1, title: t('onboarding.steps.step1'), icon: <Building2 size={16} /> },
    { number: 2, title: t('onboarding.steps.step2'), icon: <Share2 size={16} /> },
    { number: 3, title: t('onboarding.steps.step3'), icon: <Users2 size={16} /> },
  ];

  const handleStep1Next = (businessData: BusinessSetupData) => {
    setState((prev) => ({ ...prev, business: businessData, step: 2 }));
    notify.info('Đã lưu thông tin doanh nghiệp. Vui lòng kết nối các kênh mạng xã hội.');
  };

  /**
   * Kết nối kênh mạng xã hội và lưu trực tiếp vào Cơ sở dữ liệu theo Workspace
   */
  const handleConnectChannel = async (channel: ChannelKey, discoveredPages?: DiscoveredPageDto[]) => {
    if (!discoveredPages || discoveredPages.length === 0) return;

    // Chuẩn bị payload kích hoạt vào cơ sở dữ liệu
    const pagesToActivate = discoveredPages.map((dp) => ({
      channel: dp.channel || channel,
      externalAccountId: dp.externalAccountId || dp.id,
      displayName: dp.name,
      avatarUrl: dp.avatarUrl || '',
      category: dp.category || `Kênh ${channel}`,
      accessToken: dp.accessToken,
    }));

    try {
      await apiClient.activateChannels(pagesToActivate, effectiveWorkspaceId, effectiveOwnerId);
      notify.success(
        `Đã lưu và kích hoạt tài khoản ${pagesToActivate.map((p) => p.displayName).join(', ')} vào Workspace!`,
        'Kết nối Kênh Thành công',
      );
    } catch (err) {
      notify.warn(`Đã thêm vào danh sách (${(err as Error).message}).`);
    }

    // Tải lại danh sách kênh mới nhất từ Database
    try {
      const freshChannels = await apiClient.getChannels(effectiveWorkspaceId, effectiveOwnerId);
      if (Array.isArray(freshChannels) && freshChannels.length > 0) {
        const mappedPages: FanpageItem[] = freshChannels.map((c: any) => ({
          id: c.id,
          name: c.displayName,
          avatarUrl: c.avatarUrl || '',
          category: c.metadata?.category || `Kênh ${c.channel}`,
          followerCount: c.metadata?.followerCount || 0,
          channel: c.channel as ChannelKey,
          selected: c.isActive !== false,
        }));

        setState((prev) => ({
          ...prev,
          connectedChannels: Array.from(new Set(mappedPages.map((p) => p.channel))),
          pages: mappedPages,
        }));
        return;
      }
    } catch {}

    // Fallback cập nhật state cục bộ
    setState((prev) => {
      const already = prev.connectedChannels.includes(channel);
      const nextChannels = already ? prev.connectedChannels : [...prev.connectedChannels, channel];
      const mergedPages = [...prev.pages];

      discoveredPages.forEach((dp) => {
        const pageId = dp.id || dp.externalAccountId;
        const idx = mergedPages.findIndex((p) => p.id === pageId);
        const newItem: FanpageItem = {
          id: pageId,
          name: dp.name,
          avatarUrl: dp.avatarUrl || '',
          category: dp.category || `Kênh ${channel}`,
          followerCount: dp.followerCount || 0,
          channel,
          selected: true,
        };
        if (idx >= 0) {
          mergedPages[idx] = newItem;
        } else {
          mergedPages.push(newItem);
        }
      });

      return {
        ...prev,
        connectedChannels: nextChannels,
        pages: mergedPages,
      };
    });
  };

  /**
   * Bật/Tắt hoạt động của kênh và đồng bộ vào DB
   */
  const handleTogglePage = async (pageId: string) => {
    const target = state.pages.find((p) => p.id === pageId);
    if (!target) return;
    const nextSelected = !target.selected;

    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === pageId ? { ...p, selected: nextSelected } : p)),
    }));

    try {
      await apiClient.toggleChannel(pageId, nextSelected, effectiveWorkspaceId);
      notify.info(
        `${nextSelected ? 'Đã bật' : 'Đã tạm dừng'} đồng bộ tin nhắn cho ${target.name}.`,
        'Trạng thái kênh',
      );
    } catch {
      // Đã lưu state
    }
  };

  /**
   * Ngắt kết nối kênh và xóa khỏi Database
   */
  const handleDisconnectPage = async (pageId: string) => {
    const target = state.pages.find((p) => p.id === pageId);
    if (!target) return;

    try {
      await apiClient.disconnectChannel(pageId, effectiveWorkspaceId);
      notify.success(`Đã ngắt kết nối ${target.name} khỏi Workspace.`);
    } catch (err) {
      notify.warn(`Đã xóa khỏi danh sách (${(err as Error).message}).`);
    }

    setState((prev) => {
      const remainingPages = prev.pages.filter((p) => p.id !== pageId);
      return {
        ...prev,
        pages: remainingPages,
        connectedChannels: Array.from(new Set(remainingPages.map((p) => p.channel))),
      };
    });
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
    notify.success(
      `Khởi tạo Workspace "${state.business.companyName || 'CUSC CRM'}" hoàn tất! Đang chuyển hướng vào Hộp thư Trực tuyến...`,
      'Onboarding Thành công',
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
                  {isCompleted ? <Check size={16} /> : s.icon}
                </div>
                <div className="step-text">
                  <span className="step-num">BƯỚC {s.number}</span>
                  <span className="step-label">{s.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Contents */}
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
            onDisconnectPage={handleDisconnectPage}
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
