import type { LoginRequest, LoginResponse } from '../types/auth.types.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class AuthApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
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
      throw new AuthApiError('Email hoặc mật khẩu không chính xác.', 401);
    }

    const message =
      typeof body === 'object' && body !== null && 'message' in body &&
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
