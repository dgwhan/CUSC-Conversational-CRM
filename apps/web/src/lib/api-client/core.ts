import { notify } from '../../components/feedback/toastEmitter.js';
import { ApiError, type ApiRequestOptions } from './types.js';

export const DEFAULT_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string)?.replace(/\/+$/, '') || '/api';

export class BaseApiClient {
  protected baseUrl: string = DEFAULT_API_BASE_URL;
  protected activeWorkspaceId: string = '';
  protected accessToken: string | null = null;
  protected refreshPromise: Promise<string | null> | null = null;
  protected isLoggingOut: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.activeWorkspaceId = localStorage.getItem('polarisx_crm_active_workspace_id') || '';
      try {
        const saved = localStorage.getItem('polarisx_crm_auth_session');
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
        const saved = localStorage.getItem('polarisx_crm_auth_session');
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
        localStorage.clear();
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
  protected async refreshAccessToken(): Promise<string | null> {
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
          const saved = localStorage.getItem('polarisx_crm_auth_session');
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
    let userRole = '';
    let currentStaffId = '';
    if (typeof window !== 'undefined') {
      try {
        userRole = localStorage.getItem('polarisx_crm_user_role') || '';
        const savedSession = localStorage.getItem('polarisx_crm_auth_session');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          currentStaffId = parsed?.user?.id || parsed?.staff?.id || '';
        }
      } catch {}
    }

    const defaultHeaders: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
      ...(this.activeWorkspaceId ? { 'x-workspace-id': this.activeWorkspaceId } : {}),
      ...(userRole ? { 'x-user-role': userRole } : {}),
      ...(currentStaffId ? { 'x-staff-id': currentStaffId } : {}),
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

    // Cơ chế xử lý 401 Silent Refresh
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
}

