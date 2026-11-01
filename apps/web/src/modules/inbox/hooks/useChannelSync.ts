import { useState } from 'react';
import { apiClient } from '../../../lib/api-client.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

interface UseChannelSyncProps {
  activeWorkspaceId?: string | null;
  onSyncCompleted: () => Promise<void>;
}

export const useChannelSync = ({ activeWorkspaceId, onSyncCompleted }: UseChannelSyncProps) => {
  const [isSyncingFb, setIsSyncingFb] = useState(false);
  const [isSyncingZalo, setIsSyncingZalo] = useState(false);

  // Kéo các cuộc trò chuyện và tin nhắn từ Fanpage Facebook
  const handleSyncFacebook = async () => {
    setIsSyncingFb(true);
    notify.info('Đang kết nối Meta Graph API để kéo tin nhắn từ các Fanpage Facebook...', 'Đồng bộ Facebook');
    try {
      const channels = await apiClient.getChannels(activeWorkspaceId || undefined);
      const activeChannels = (channels || []).filter(
        (c: any) => c.channel === 'FACEBOOK' && c.isActive,
      );

      if (activeChannels.length === 0) {
        notify.warning('Chưa có Fanpage Facebook nào được kích hoạt trong Workspace.');
        return;
      }

      let totalSynced = 0;
      for (const ch of activeChannels) {
        try {
          const res = await apiClient.syncChannel(ch.id as string, activeWorkspaceId || undefined);
          totalSynced += res.syncedCount;
        } catch (err) {
          notify.warning(`Không thể kéo tin từ ${(ch as any).displayName}: ${(err as Error).message}`);
        }
      }

      if (totalSynced > 0) {
        await onSyncCompleted();
        notify.success(`Đã kéo thành công ${totalSynced} tin nhắn từ Facebook vào Hộp thư!`, 'Đồng bộ Facebook');
      } else {
        notify.info('Đã quét Fanpage: Hiện chưa có tin nhắn khách hàng mới nào.');
      }
    } catch (err) {
      notify.error(`Lỗi khi đồng bộ Facebook: ${(err as Error).message}`);
    } finally {
      setIsSyncingFb(false);
    }
  };

  // Kéo các cuộc trò chuyện và tin nhắn từ Zalo (Zalo OA & Zalo Cá nhân zca-js)
  const handleSyncZalo = async () => {
    setIsSyncingZalo(true);
    notify.info('Đang kết nối Zalo để đồng bộ tin nhắn...', 'Đồng bộ Zalo');
    try {
      const channels = await apiClient.getChannels(activeWorkspaceId || undefined);
      const activeChannels = (channels || []).filter(
        (c: any) => (c.channel === 'ZALO' || c.channel === 'ZALO_PERSONAL') && c.isActive,
      );

      if (activeChannels.length === 0) {
        notify.warning('Chưa có tài khoản Zalo nào được kích hoạt trong Workspace.');
        return;
      }

      let totalSynced = 0;
      for (const ch of activeChannels) {
        try {
          const res = await apiClient.syncChannel(ch.id as string, activeWorkspaceId || undefined);
          totalSynced += res.syncedCount;
        } catch (err) {
          notify.warning(`Không thể kéo tin từ ${(ch as any).displayName}: ${(err as Error).message}`);
        }
      }

      if (totalSynced > 0) {
        await onSyncCompleted();
        notify.success(`Đã kéo thành công ${totalSynced} tin nhắn từ Zalo vào Hộp thư!`, 'Đồng bộ Zalo');
      } else {
        notify.info('Đã quét Zalo: Hiện chưa có tin nhắn khách hàng mới nào.');
      }
    } catch (err) {
      notify.error(`Lỗi khi đồng bộ Zalo: ${(err as Error).message}`);
    } finally {
      setIsSyncingZalo(false);
    }
  };

  return {
    isSyncingFb,
    isSyncingZalo,
    handleSyncFacebook,
    handleSyncZalo,
  };
};

