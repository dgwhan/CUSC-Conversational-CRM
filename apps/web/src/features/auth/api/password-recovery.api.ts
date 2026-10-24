const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

type EmailInput = { email: string };
type VerifyOtpInput = EmailInput & { otp: string };

export class PasswordRecoveryApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super('Password recovery request failed');
    this.name = 'PasswordRecoveryApiError';
    this.status = status;
  }
}

// Đóng gói API request và verify, chỉ dùng mã HTTP để hiển thị lỗi an toàn.
async function postPasswordRecovery(path: string, body: object): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/password-recovery/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new PasswordRecoveryApiError(response.status);
  }
}

export function requestPasswordRecoveryOtp(input: EmailInput): Promise<void> {
  return postPasswordRecovery('request', input);
}

export async function verifyPasswordRecoveryOtp(
  input: VerifyOtpInput,
): Promise<void> {
  await postPasswordRecovery('verify', input);
}
