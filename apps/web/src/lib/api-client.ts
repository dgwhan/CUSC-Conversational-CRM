/**
 * API Client tập trung cho ứng dụng CUSC Conversational CRM.
 * Hỗ trợ tự động định tuyến qua Vite Proxy hoặc cấu hình Base URL tuỳ chỉnh.
 * Tích hợp ErrorHandler chi tiết và thông báo Toast vị trí lỗi.
 */

import { notify } from '../components/feedback/toastEmitter.js';

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipToast?: boolean;
  _retry?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly method: string;
  readonly data?: unknown;
  readonly timestamp: Date;

  constructor(
    message: string,
    status: number,
    endpoint: string,
    method: string = 'GET',
    data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.method = method;
    this.data = data;
    this.timestamp = new Date();
  }
}

class ApiClient {
  private baseUrl: string = '/api';
  private activeWorkspaceId: string = '';
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private isLoggingOut: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.activeWorkspaceId = localStorage.getItem('polarisx_crm_active_workspace_id') || '';
      try {
        const saved =
          localStorage.getItem('polarisx_crm_auth_session') ||
          localStorage.getItem('cusc_crm_auth_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.accessToken === 'string') {
            this.accessToken = parsed.accessToken;
          }
        }
      } catch {}
    }
  }

  setAccessToken(token: string | null) {
    if (token) {
      this.isLoggingOut = false;
    }
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    if (this.isLoggingOut) return null;
    if (!this.accessToken && typeof window !== 'undefined') {
      try {
        const saved =
          localStorage.getItem('polarisx_crm_auth_session') ||
          localStorage.getItem('cusc_crm_auth_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.accessToken === 'string') {
            this.accessToken = parsed.accessToken;
          }
        }
      } catch {}
    }
    return this.accessToken;
  }

  /**
   * Xóa sạch toàn bộ thông tin xác thực, token và session khỏi bộ nhớ & LocalStorage
   * Đồng thời chặn cơ chế Silent Refresh không được tự động cấp lại token mới.
   */
  clearAuth() {
    this.isLoggingOut = true;
    this.accessToken = null;
    this.activeWorkspaceId = '';
    this.refreshPromise = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('polarisx_crm_auth_session');
        localStorage.removeItem('cusc_crm_auth_session');
        localStorage.removeItem('polarisx_crm_user_role');
        localStorage.removeItem('cusc_crm_user_role');
        localStorage.removeItem('polarisx_crm_active_workspace_id');
      } catch {}
    }
  }

  setActiveWorkspaceId(id: string) {
    this.activeWorkspaceId = id;
  }

  getActiveWorkspaceId(): string {
    return this.activeWorkspaceId;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Cơ chế tự động làm mới Access Token khi token bị hỏng hoặc hết hạn (Transparent Silent Refresh).
   * Sử dụng Mutex / Promise Queue để gom tất cả các request song song bị 401 lại vào 1 lần gọi duy nhất.
   */
  private async refreshAccessToken(): Promise<string | null> {
    if (this.isLoggingOut) {
      return null;
    }
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (this.isLoggingOut) return null;
        const refreshUrl = `${this.baseUrl}/auth/refresh`;
        const res = await fetch(refreshUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error(`Token refresh rejected with HTTP ${res.status}`);
        }

        const data = await res.json().catch(() => null);
        if (!data || typeof data !== 'object' || typeof data.accessToken !== 'string') {
          throw new Error('Invalid refresh response payload');
        }

        const newAccessToken = data.accessToken as string;
        this.accessToken = newAccessToken;

        // Cập nhật session storage đồng bộ
        try {
          const saved =
            localStorage.getItem('polarisx_crm_auth_session') ||
            localStorage.getItem('cusc_crm_auth_session');
          const prev = saved ? JSON.parse(saved) : {};
          const updated = {
            ...prev,
            accessToken: newAccessToken,
            staff: data.staff ?? prev.staff,
          };
          localStorage.setItem('polarisx_crm_auth_session', JSON.stringify(updated));
        } catch {}

        // Phát sự kiện thông báo cho UI và các module cập nhật
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('crm:token-refreshed', {
              detail: { accessToken: newAccessToken, staff: data.staff },
            }),
          );
        }

        return newAccessToken;
      } catch {
        this.accessToken = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('crm:session-expired'));
        }
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, headers, skipToast, method = 'GET', _retry, ...restOptions } = options;

    let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined) searchParams.append(key, String(val));
      });
      const query = searchParams.toString();
      if (query) url += `?${query}`;
    }

    // Tự động đính kèm Bearer token nếu đã có
    const token = this.getAccessToken();
    const defaultHeaders: Record<string, string> = {
      ...(this.activeWorkspaceId ? { 'x-workspace-id': this.activeWorkspaceId } : {}),
      ...(restOptions.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          ...defaultHeaders,
          ...headers,
        },
        ...restOptions,
      });
    } catch (networkError: unknown) {
      const err = new ApiError(
        `Không thể kết nối đến máy chủ API (${this.baseUrl}). Vui lòng kiểm tra server Backend.`,
        0,
        `${method} ${endpoint}`,
        method,
        networkError,
      );

      if (!skipToast) {
        notify.error(err.message, 'Lỗi kết nối mạng (Network Error)', {
          location: `${method} ${endpoint}`,
          details: networkError,
        });
      }

      throw err;
    }

    // CƠ CHẾ CHỐNG BROKEN ACCESS TOKEN MINH BẠCH:
    // Nếu token bị hết hạn, sai lệch hoặc bị từ chối 401 trên các endpoint bảo vệ,
    // tự động kích hoạt refresh token và thử lại request mà không làm gián đoạn người dùng.
    const isAuthEndpoint =
      endpoint.includes('/auth/login') ||
      endpoint.includes('/auth/register') ||
      endpoint.includes('/auth/refresh') ||
      endpoint.includes('/auth/logout');

    if (response.status === 401 && !_retry && !isAuthEndpoint) {
      const refreshedToken = await this.refreshAccessToken();
      if (refreshedToken) {
        return this.request<T>(endpoint, {
          ...options,
          _retry: true,
          headers: {
            ...headers,
            Authorization: `Bearer ${refreshedToken}`,
          },
        });
      }
    }

    // Xử lý các loại Content-Type trả về
    const contentType = response.headers.get('content-type') || '';
    const responseData: unknown = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      let errorMessage = `Yêu cầu thất bại với mã HTTP ${response.status}: ${response.statusText}`;

      if (responseData && typeof responseData === 'object') {
        const body = responseData as Record<string, unknown>;
        if (body.message) {
          errorMessage = Array.isArray(body.message) ? body.message.join(', ') : String(body.message);
        }
      } else if (typeof responseData === 'string' && responseData.length > 0 && responseData.length < 300) {
        errorMessage = responseData;
      }

      const apiError = new ApiError(
        errorMessage,
        response.status,
        `${method} ${endpoint}`,
        method,
        responseData,
      );

      if (!skipToast) {
        const errorTitle = `Lỗi HTTP ${response.status} (${response.statusText || 'Error'})`;
        notify.error(errorMessage, errorTitle, {
          location: `${method} ${endpoint}`,
          details: responseData,
        });
      }

      throw apiError;
    }

    return responseData as T;
  }

  get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Channel Connection & OAuth API Endpoints
  getAuthorizeUrl(channel: string, redirectUri?: string) {
    return this.get<{ authorizeUrl: string; state: string; channel: string }>(
      `/oauth/${channel.toLowerCase()}/authorize-url`,
      { params: { redirectUri } },
    );
  }

  exchangeOAuthToken(
    channel: string,
    codeOrPayload:
      | string
      | {
          code?: string;
          state?: string;
          redirectUri?: string;
          pageId?: string;
          pageName?: string;
          accessToken?: string;
        },
    state?: string,
    redirectUri?: string,
  ) {
    const body =
      typeof codeOrPayload === 'string'
        ? { code: codeOrPayload, state: state || `st_${Date.now()}`, redirectUri }
        : codeOrPayload;

    return this.post<{
      channel: string;
      userName?: string;
      userId?: string;
      pages: Array<{
        id: string;
        externalAccountId: string;
        name: string;
        category: string;
        avatarUrl?: string;
        followerCount?: number;
        channel: string;
        accessToken: string;
      }>;
    }>(`/oauth/${channel.toLowerCase()}/exchange-token`, body);
  }

  activateChannels(pages: Record<string, unknown>[], workspaceId?: string, ownerId?: string) {
    return this.post<{ activatedCount: number; workspaceId: string; channels: Record<string, unknown>[] }>(
      '/channels/activate',
      { pages, workspaceId },
      {
        headers: {
          ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
          ...(ownerId ? { 'x-owner-id': ownerId } : {}),
        },
      },
    );
  }

  getChannels(workspaceId?: string, ownerId?: string) {
    return this.get<Record<string, unknown>[]>('/channels', {
      params: { workspaceId },
      headers: {
        ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
        ...(ownerId ? { 'x-owner-id': ownerId } : {}),
      },
    });
  }

  toggleChannel(id: string, isActive?: boolean, workspaceId?: string) {
    return this.patch<Record<string, unknown>>(
      `/channels/${id}/toggle`,
      { isActive },
      {
        headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
      },
    );
  }

  disconnectChannel(id: string, workspaceId?: string) {
    return this.delete<{ success: boolean; id: string }>(`/channels/${id}`, {
      headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
    });
  }

  syncChannel(id: string, workspaceId?: string) {
    return this.post<{ syncedCount: number; conversationsCount: number; pageName: string }>(
      `/channels/${id}/sync`,
      {},
      {
        headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
      },
    );
  }

  sendMessage(data: {
    channel: string;
    recipientId: string;
    content: string;
    channelAccountId?: string;
    conversationId?: string;
    workspaceId?: string;
  }) {
    return this.post<{
      success: boolean;
      messageId: string;
      sentAt: string;
      content: string;
      recipientId: string;
      channel: string;
    }>('/channels/send-message', data, {
      headers: data.workspaceId ? { 'x-workspace-id': data.workspaceId } : {},
    });
  }

  initZaloPersonalQr() {
    return this.post<{
      sessionId: string;
      qrCodeUrl: string;
      status: 'PENDING' | 'SCANNED' | 'SUCCESS' | 'EXPIRED';
      createdAt: number;
      expiresAt: number;
    }>('/channels/zalo-personal/qr-init', {});
  }

  getZaloPersonalQrStatus(sessionId: string) {
    return this.get<{
      sessionId: string;
      status: 'PENDING' | 'SCANNED' | 'SUCCESS' | 'EXPIRED';
      expiresAt: number;
      account?: {
        id: string;
        externalAccountId: string;
        displayName: string;
        avatarUrl: string;
        phone?: string;
        accessToken: string;
      };
    }>('/channels/zalo-personal/qr-status', {
      params: { sessionId },
    });
  }

  confirmZaloPersonalQr(data: {
    sessionId: string;
    displayName?: string;
    phone?: string;
    avatarUrl?: string;
    externalAccountId?: string;
  }) {
    return this.post<{
      sessionId: string;
      status: 'SUCCESS' | 'EXPIRED';
      account?: {
        id: string;
        externalAccountId: string;
        displayName: string;
        avatarUrl: string;
        phone?: string;
        accessToken: string;
      };
    }>('/channels/zalo-personal/qr-confirm', data);
  }

  getZaloSafetyConfig() {
    return this.get<{
      enabled: boolean;
      minIntervalMs: number;
      maxIntervalMs: number;
      maxMessagesPerMinute: number;
      maxStrangerPerDay: number;
      autoCooldownMinutes: number;
    }>('/channels/zalo-personal/safety-config');
  }

  updateZaloSafetyConfig(config: Record<string, unknown>) {
    return this.patch<{
      enabled: boolean;
      minIntervalMs: number;
      maxIntervalMs: number;
      maxMessagesPerMinute: number;
      maxStrangerPerDay: number;
      autoCooldownMinutes: number;
    }>('/channels/zalo-personal/safety-config', config);
  }

  getMessages(params?: {
    page?: number;
    limit?: number;
    channel?: string;
    search?: string;
    workspaceId?: string;
  }) {
    return this.get<{
      items: Array<{
        id: string;
        channel: string;
        externalMessageId: string;
        senderExternalId: string;
        content: string | null;
        direction: 'INBOUND' | 'OUTBOUND';
        sentAt: string;
        channelAccountId?: string;
        channelAccount?: { displayName: string; externalAccountId: string };
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/messages', {
      params,
      headers: params?.workspaceId ? { 'x-workspace-id': params.workspaceId } : {},
    });
  }
  getCustomers(params?: { workspaceId?: string; search?: string }) {
    return this.get<{
      items: Array<{
        id: string;
        workspaceId?: string | null;
        fullName: string;
        phone?: string | null;
        email?: string | null;
        avatarUrl?: string | null;
        leadStatus?: string;
        channelIdentities?: any;
        interestCourses?: string[];
        estimatedValue?: number;
        leadStage?: string;
        tags?: string[];
        conversations?: Array<{
          id: string;
          snippet?: string | null;
          lastMessageAt?: string | null;
          channelAccount?: { displayName: string; channel: string; avatarUrl?: string };
        }>;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
    }>('/customers', {
      params,
      headers: params?.workspaceId ? { 'x-workspace-id': params.workspaceId } : {},
    });
  }

  updateCustomer(id: string, data: Record<string, unknown>, workspaceId?: string) {
    return this.patch<Record<string, unknown>>(`/customers/${id}`, data, {
      headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
    });
  }

  deleteCustomerTag(id: string, tag: string, conversationId?: string, workspaceId?: string) {
    return this.delete<Record<string, unknown>>(`/customers/${id}/tags/${encodeURIComponent(tag)}`, {
      params: conversationId ? { conversationId } : undefined,
      headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
    });
  }

  getMyWorkspaces(staffId?: string, ownerId?: string) {
    return this.get<Array<{
      id: string;
      name: string;
      slug: string;
      role: 'OWNER' | 'STAFF';
      isOwner: boolean;
      domain: string;
      ownerId?: string;
      ownerName?: string;
      createdAt?: string;
    }>>('/workspaces/my-workspaces', {
      headers: {
        ...(staffId ? { 'x-staff-id': staffId } : {}),
        ...(ownerId ? { 'x-owner-id': ownerId } : {}),
      },
    });
  }

  createWorkspace(
    data: { name: string; domain?: string },
    staffId?: string,
    ownerId?: string,
  ) {
    return this.post<{
      id: string;
      name: string;
      slug: string;
      role: 'OWNER' | 'STAFF';
      isOwner: boolean;
      domain: string;
      ownerId?: string;
      ownerName?: string;
      createdAt?: string;
    }>('/workspaces', data, {
      headers: {
        ...(staffId ? { 'x-staff-id': staffId } : {}),
        ...(ownerId ? { 'x-owner-id': ownerId } : {}),
        'x-user-role': 'OWNER',
      },
    });
  }

  updateWorkspace(
    workspaceId: string,
    data: { name?: string; domain?: string },
    staffId?: string,
    ownerId?: string,
  ) {
    return this.patch<{
      id: string;
      name: string;
      slug: string;
      role: 'OWNER' | 'STAFF';
      isOwner: boolean;
      domain: string;
      ownerId?: string;
      ownerName?: string;
      createdAt?: string;
    }>(`/workspaces/${workspaceId}`, data, {
      headers: {
        ...(staffId ? { 'x-staff-id': staffId } : {}),
        ...(ownerId ? { 'x-owner-id': ownerId } : {}),
        'x-user-role': 'OWNER',
      },
    });
  }

  deleteWorkspace(workspaceId: string, staffId?: string, ownerId?: string) {
    return this.delete<{ success: boolean; message: string }>(`/workspaces/${workspaceId}`, {
      headers: {
        ...(staffId ? { 'x-staff-id': staffId } : {}),
        ...(ownerId ? { 'x-owner-id': ownerId } : {}),
        'x-user-role': 'OWNER',
      },
    });
  }

  getWorkspaceHotlines(workspaceId: string) {
    return this.get<Array<{
      id: string;
      workspaceId: string;
      phoneNumber: string;
      label: string;
      department: string;
      assignedStaffId?: string;
      assignedStaffName?: string;
      status: 'ACTIVE' | 'INACTIVE';
      workingHours?: string;
      isDefault?: boolean;
      notes?: string;
      createdAt: string;
      updatedAt: string;
    }>>(`/workspaces/${workspaceId}/hotlines`);
  }

  createWorkspaceHotline(
    workspaceId: string,
    data: {
      phoneNumber: string;
      label: string;
      department?: string;
      assignedStaffId?: string;
      assignedStaffName?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      workingHours?: string;
      isDefault?: boolean;
      notes?: string;
    },
    staffId?: string,
    ownerId?: string,
  ) {
    return this.post<{
      id: string;
      workspaceId: string;
      phoneNumber: string;
      label: string;
      department: string;
      assignedStaffId?: string;
      assignedStaffName?: string;
      status: 'ACTIVE' | 'INACTIVE';
      workingHours?: string;
      isDefault?: boolean;
      notes?: string;
      createdAt: string;
      updatedAt: string;
    }>(`/workspaces/${workspaceId}/hotlines`, data, {
      headers: {
        ...(staffId ? { 'x-staff-id': staffId } : {}),
        ...(ownerId ? { 'x-owner-id': ownerId } : {}),
        'x-user-role': 'OWNER',
      },
    });
  }

  updateWorkspaceHotline(
    workspaceId: string,
    hotlineId: string,
    data: Record<string, unknown>,
    staffId?: string,
    ownerId?: string,
  ) {
    return this.patch<{
      id: string;
      workspaceId: string;
      phoneNumber: string;
      label: string;
      department: string;
      assignedStaffId?: string;
      assignedStaffName?: string;
      status: 'ACTIVE' | 'INACTIVE';
      workingHours?: string;
      isDefault?: boolean;
      notes?: string;
      createdAt: string;
      updatedAt: string;
    }>(`/workspaces/${workspaceId}/hotlines/${hotlineId}`, data, {
      headers: {
        ...(staffId ? { 'x-staff-id': staffId } : {}),
        ...(ownerId ? { 'x-owner-id': ownerId } : {}),
        'x-user-role': 'OWNER',
      },
    });
  }

  deleteWorkspaceHotline(workspaceId: string, hotlineId: string, staffId?: string, ownerId?: string) {
    return this.delete<{ success: boolean; message: string }>(`/workspaces/${workspaceId}/hotlines/${hotlineId}`, {
      headers: {
        ...(staffId ? { 'x-staff-id': staffId } : {}),
        ...(ownerId ? { 'x-owner-id': ownerId } : {}),
        'x-user-role': 'OWNER',
      },
    });
  }
}

export const apiClient = new ApiClient();
