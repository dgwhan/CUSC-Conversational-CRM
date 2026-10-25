/**
 * API Client tập trung cho ứng dụng CUSC Recruitment CRM.
 * Hỗ trợ tự động định tuyến qua Vite Proxy hoặc cấu hình Base URL tuỳ chỉnh.
 * Tích hợp ErrorHandler chi tiết và thông báo Toast vị trí lỗi.
 */

import { notify } from '../components/feedback/toastEmitter.js';

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipToast?: boolean;
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

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, headers, skipToast, method = 'GET', ...restOptions } = options;

    let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined) searchParams.append(key, String(val));
      });
      const query = searchParams.toString();
      if (query) url += `?${query}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
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
}

export const apiClient = new ApiClient();
