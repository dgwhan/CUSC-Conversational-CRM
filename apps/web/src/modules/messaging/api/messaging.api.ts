import { apiClient } from '../../../lib/api-client.js';
import type {
  ImportMessagesResponse,
  ManualImportRow,
  SavedMessagesResponse,
} from '../types/messaging.types.js';

export const messagingApi = {
  /**
   * Tải template file mẫu CSV từ API (hoặc tạo file mẫu dự phòng)
   */
  async downloadTemplate(): Promise<Blob> {
    try {
      const response = await fetch(`${apiClient.getBaseUrl()}/messages/import/template`);
      if (response.ok) {
        return await response.blob();
      }
    } catch {
      // API có thể chưa sẵn sàng, tiếp tục với file dự phòng
    }

    const headers = 'kênh,người gửi,nội dung,thời gian\r\n';
    const sample = [
      'ZALO,0912345678,Tư vấn giúp em khóa học Lập trình Web,2026-10-24T08:30:00Z',
      'FACEBOOK,fb_user_102,Học phí ngành CNTT tại PolarisX là bao nhiêu ạ?,2026-10-24T09:15:00Z',
      'TIKTOK,tiktok_user_55,Trường có xét học bạ THPT không ad?,2026-10-24T10:00:00Z',
      'MANUAL_IMPORT,thi_sinh_01,Thí sinh đến trực tiếp văn phòng tư vấn tuyển sinh,2026-10-24T10:45:00Z',
    ].join('\r\n');

    return new Blob(['\uFEFF' + headers + sample], { type: 'text/csv;charset=utf-8;' });
  },

  /**
   * Import dữ liệu tin nhắn từ nội dung CSV
   */
  async importCsv(csvContent: string): Promise<ImportMessagesResponse> {
    return apiClient.post<ImportMessagesResponse>('/messages/import/csv', {
      csvContent,
    });
  },

  /**
   * Nhập tay danh sách tin nhắn
   */
  async importManual(items: ManualImportRow[]): Promise<ImportMessagesResponse> {
    const formatted = items.map((item) => ({
      kênh: item.channel,
      'người gửi': item.sender,
      'nội dung': item.content,
      'thời gian': item.sentAt,
    }));

    return apiClient.post<ImportMessagesResponse>('/messages/import/manual', {
      items: formatted,
    });
  },

  /**
   * Import dữ liệu trực tiếp từ đường link chia sẻ của Google Sheet
   */
  async importGoogleSheet(sheetUrl: string): Promise<ImportMessagesResponse> {
    return apiClient.post<ImportMessagesResponse>('/messages/import/google-sheet', {
      sheetUrl,
    });
  },

  /**
   * Lấy danh sách tin nhắn đã lưu vào cơ sở dữ liệu
   */
  async getSavedMessages(params?: {
    page?: number;
    limit?: number;
    channel?: string;
    search?: string;
  }): Promise<SavedMessagesResponse> {
    return apiClient.get<SavedMessagesResponse>('/messages', {
      params,
    });
  },
};
