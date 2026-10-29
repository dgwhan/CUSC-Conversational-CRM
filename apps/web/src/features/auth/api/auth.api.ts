import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '../types/auth.types.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class AuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      throw new AuthApiError(
        'Email/số điện thoại hoặc mật khẩu không chính xác.',
        401,
      );
    }

    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Không thể đăng nhập. Vui lòng thử lại.';
    throw new AuthApiError(message, response.status);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    typeof body.accessToken !== 'string' ||
    !('staff' in body) ||
    typeof body.staff !== 'object' ||
    body.staff === null
  ) {
    throw new AuthApiError('Phản hồi đăng nhập không hợp lệ.', response.status);
  }

  return body as LoginResponse;
}

export async function register(
  input: RegisterRequest,
): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let message = 'Không thể đăng ký tài khoản. Vui lòng thử lại.';
    if (typeof body === 'object' && body !== null && 'message' in body) {
      if (typeof body.message === 'string') {
        message = body.message;
      } else if (Array.isArray(body.message) && body.message.length > 0) {
        message = body.message.join(', ');
      }
    }
    throw new AuthApiError(message, response.status);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    typeof body.accessToken !== 'string' ||
    !('staff' in body) ||
    typeof body.staff !== 'object' ||
    body.staff === null
  ) {
    throw new AuthApiError('Phản hồi đăng ký không hợp lệ.', response.status);
  }

  return body as RegisterResponse;
}

export async function refreshAccessToken(refreshToken?: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: refreshToken ? JSON.stringify({ refreshToken }) : JSON.stringify({}),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AuthApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', response.status);
  }

  return body as LoginResponse;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  }).catch(() => {});
}

export async function getMe(accessToken?: string): Promise<LoginResponse['staff']> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new AuthApiError('Không thể lấy thông tin người dùng hiện tại.', response.status);
  }

  return response.json() as Promise<LoginResponse['staff']>;
}

