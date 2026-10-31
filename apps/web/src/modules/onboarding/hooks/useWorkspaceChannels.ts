import { useState, useEffect } from 'react';
import type {
  ChannelKey,
  FanpageItem,
  DiscoveredPageDto,
  OnboardingState,
} from '../types.js';
import { apiClient } from '../../../lib/api-client.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

export interface UseWorkspaceChannelsOptions {
  workspaceId: string;
  ownerId: string;
  isEnabled: boolean;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
}

/**
 * Hook chuyên biệt quản lý trạng thái kết nối các kênh MXH (Facebook, Zalo, TikTok, Instagram)
 * và đồng bộ các Fanpage/OA thuộc Workspace vào CRM
 */
export const useWorkspaceChannels = ({
  workspaceId,
  ownerId,
  isEnabled,
  setState,
}: UseWorkspaceChannelsOptions) => {
  const [isCheckingChannels, setIsCheckingChannels] = useState(false);

  // Tải danh sách kênh kết nối của Workspace khi vào Wizard
  useEffect(() => {
    if (!isEnabled || !workspaceId) return;

    let isMounted = true;
    setIsCheckingChannels(true);

    const loadWorkspaceChannels = async () => {
      try {
        const channels = await apiClient.getChannels(workspaceId, ownerId);
        if (isMounted && Array.isArray(channels)) {
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
      } finally {
        if (isMounted) {
          setIsCheckingChannels(false);
        }
      }
    };

    loadWorkspaceChannels();
    return () => {
      isMounted = false;
    };
  }, [workspaceId, ownerId, isEnabled, setState]);

  /**
   * Kích hoạt & lưu kênh mạng xã hội vào CSDL
   */
  const handleConnectChannel = async (channel: ChannelKey, discoveredPages?: DiscoveredPageDto[]) => {
    if (!discoveredPages || discoveredPages.length === 0) return;

    const pagesToActivate = discoveredPages.map((dp) => ({
      channel: dp.channel || channel,
      externalAccountId: dp.externalAccountId || dp.id,
      displayName: dp.name,
      avatarUrl: dp.avatarUrl || '',
      category: dp.category || `Kênh ${channel}`,
      accessToken: dp.accessToken,
      metadata: (dp as any).metadata || {},
    }));

    try {
      await apiClient.activateChannels(pagesToActivate, workspaceId, ownerId);
      notify.success(
        `Đã lưu và kích hoạt tài khoản ${pagesToActivate.map((p) => p.displayName).join(', ')} vào Workspace!`,
        'Kết nối Kênh Thành công',
      );
    } catch (err) {
      notify.warning(`Đã thêm vào danh sách (${(err as Error).message}).`);
    }

    try {
      const freshChannels = await apiClient.getChannels(workspaceId, ownerId);
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
      }
    } catch {
      // Fallback
    }
  };

  /**
   * Bật/Tắt đồng bộ tin nhắn của kênh
   */
  const handleTogglePage = async (pageId: string, currentPages: FanpageItem[]) => {
    const target = currentPages.find((p) => p.id === pageId);
    if (!target) return;
    const nextSelected = !target.selected;

    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === pageId ? { ...p, selected: nextSelected } : p)),
    }));

    try {
      await apiClient.toggleChannel(pageId, nextSelected, workspaceId);
      notify.info(
        `${nextSelected ? 'Đã bật' : 'Đã tạm dừng'} đồng bộ tin nhắn cho ${target.name}.`,
        'Trạng thái kênh',
      );
    } catch {
      // Đã cập nhật local state
    }
  };

  /**
   * Ngắt kết nối kênh và xóa khỏi Workspace
   */
  const handleDisconnectPage = async (pageId: string, currentPages: FanpageItem[]) => {
    const target = currentPages.find((p) => p.id === pageId);
    if (!target) return;

    try {
      await apiClient.disconnectChannel(pageId, workspaceId);
      notify.success(`Đã ngắt kết nối ${target.name} khỏi Workspace.`);
    } catch (err) {
      notify.warning(`Đã xóa khỏi danh sách (${(err as Error).message}).`);
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

  return {
    isCheckingChannels,
    handleConnectChannel,
    handleTogglePage,
    handleDisconnectPage,
  };
};
