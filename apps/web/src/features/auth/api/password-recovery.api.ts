const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

type EmailInput = { email: string };
type VerifyOtpInput = EmailInput & { otp: string };
type ResetPasswordInput = {
  resetToken: string;
  newPassword: string;
};

export class PasswordRecoveryApiError extends Error {
  readonly status: number;
  readonly serverMessage?: string;

  constructor(status: number, serverMessage?: string) {
    super(serverMessage || 'Password recovery request failed');
    this.name = 'PasswordRecoveryApiError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let serverMessage: string | undefined;
    try {
      const data = await response.json();
      if (Array.isArray(data?.message)) {
        serverMessage = data.message.join('. ');
      } else if (typeof data?.message === 'string') {
        serverMessage = data.message;
      }
    } catch {
      // Ignore JSON parse failure on non-JSON error pages
    }
    throw new PasswordRecoveryApiError(response.status, serverMessage);
  }

  // Response has no content or status 204
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// Gửi HTTP POST tới auth/password-recovery với payload JSON
async function postPasswordRecovery<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/auth/password-recovery/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export function requestPasswordRecoveryOtp(input: EmailInput): Promise<{ message: string }> {
  return postPasswordRecovery<{ message: string }>('request', input);
}

export function verifyPasswordRecoveryOtp(
  input: VerifyOtpInput,
): Promise<{ verified: true; resetToken: string }> {
  return postPasswordRecovery<{ verified: true; resetToken: string }>('verify', input);
}

export function resetPassword(
  input: ResetPasswordInput,
): Promise<{ success: true; message: string }> {
  return postPasswordRecovery<{ success: true; message: string }>('reset', input);
}
