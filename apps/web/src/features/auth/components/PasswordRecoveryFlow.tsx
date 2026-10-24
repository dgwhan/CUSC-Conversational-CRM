import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { MailIcon } from '../../../components/icons/AuthIcons.js';
import { Button } from '../../../components/ui/Button.js';
import { PageHeading } from '../../../components/ui/PageHeading.js';
import { TextField } from '../../../components/ui/TextField.js';
import {
  PasswordRecoveryApiError,
  requestPasswordRecoveryOtp,
  verifyPasswordRecoveryOtp,
} from '../api/password-recovery.api.js';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PasswordRecoveryFlowProps = {
  onBackToLogin: () => void;
};

type RecoveryStep = 'request' | 'verify' | 'verified';

function getRequestError(error: unknown): string {
  if (error instanceof PasswordRecoveryApiError && error.status === 429) {
    return 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau.';
  }
  return 'Chưa thể gửi mã xác minh lúc này. Vui lòng thử lại.';
}

function getVerificationError(error: unknown): string {
  if (error instanceof PasswordRecoveryApiError && error.status === 400) {
    return 'Mã xác minh không đúng hoặc đã hết hạn.';
  }
  if (error instanceof PasswordRecoveryApiError && error.status === 429) {
    return 'Bạn đã nhập mã quá nhiều lần. Vui lòng thử lại sau.';
  }
  return 'Không thể xác minh mã lúc này. Vui lòng thử lại.';
}

export function PasswordRecoveryFlow({
  onBackToLogin,
}: PasswordRecoveryFlowProps) {
  // Giữ email xuyên suốt các bước; OTP chỉ tồn tại trong state phía trình duyệt.
  const [step, setStep] = useState<RecoveryStep>('request');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const otp = digits.join('');

  useEffect(() => {
    if (resendSeconds === 0) return;

    const timer = window.setTimeout(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function validateEmail(value: string): string {
    if (!value.trim()) return 'Vui lòng nhập email.';
    if (!EMAIL_FORMAT_PATTERN.test(value.trim())) {
      return 'Vui lòng nhập địa chỉ email hợp lệ.';
    }
    return '';
  }

  async function sendOtp(value: string) {
    setIsSubmitting(true);
    setError('');

    try {
      await requestPasswordRecoveryOtp({ email: value.trim().toLowerCase() });
      setEmail(value.trim().toLowerCase());
      setDigits(Array(OTP_LENGTH).fill(''));
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      setStep('verify');
      window.setTimeout(() => otpInputs.current[0]?.focus(), 0);
    } catch (cause) {
      setError(getRequestError(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateEmail(email);
    setEmailError(validationError);
    if (validationError) return;

    await sendOtp(email);
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) {
      setError('Nhập đủ 6 chữ số của mã xác minh.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyPasswordRecoveryOtp({ email, otp });
      setStep('verified');
    } catch (cause) {
      setError(getVerificationError(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    setError('');
    if (digit && index < OTP_LENGTH - 1) {
      otpInputs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      otpInputs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      otpInputs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    // Cho phép dán cả mã vào một ô rồi tự phân bổ vào sáu ô nhập.
    const pastedDigits = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH);
    if (!pastedDigits) return;

    event.preventDefault();
    setDigits(Array.from({ length: OTP_LENGTH }, (_, index) => pastedDigits[index] ?? ''));
    setError('');
    otpInputs.current[Math.min(pastedDigits.length, OTP_LENGTH) - 1]?.focus();
  }

  function returnToRequest() {
    setStep('request');
    setDigits(Array(OTP_LENGTH).fill(''));
    setError('');
  }

  if (step === 'verified') {
    return (
      <section aria-live="polite" className="flex flex-col gap-6">
        <PageHeading
          title="Xác minh email thành công"
          description="Địa chỉ email của bạn đã được xác minh."
        />
        <p className="font-sans text-body text-text-secondary">
          Bạn có thể quay lại đăng nhập.
        </p>
        <Button fullWidth onClick={onBackToLogin}>Quay lại đăng nhập</Button>
      </section>
    );
  }

  if (step === 'request') {
    return (
      <section>
        <PageHeading
          title="Quên mật khẩu?"
          description="Nhập địa chỉ email đã đăng ký. Nếu tài khoản đủ điều kiện, chúng tôi sẽ gửi mã xác minh."
        />
        <form className="mt-6 flex flex-col gap-6" noValidate onSubmit={handleRequest}>
          <TextField
            autoComplete="email"
            disabled={isSubmitting}
            errorMessage={emailError}
            label="Email"
            leadingIcon={<MailIcon />}
            name="email"
            onBlur={() => setEmailError(validateEmail(email))}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError(validateEmail(event.target.value));
              setError('');
            }}
            placeholder="Nhập Gmail đã đăng ký"
            required
            type="email"
            value={email}
          />
          {error && <p className="-mt-3 font-sans text-body text-state-error" role="alert">{error}</p>}
          <Button disabled={isSubmitting} fullWidth type="submit">
            {isSubmitting ? 'Đang gửi mã…' : 'Gửi mã xác minh'}
          </Button>
          <button className="font-sans text-body text-brand-primary hover:underline" onClick={onBackToLogin} type="button">
            Quay lại đăng nhập
          </button>
        </form>
      </section>
    );
  }

  const formattedCountdown = `00:${String(resendSeconds).padStart(2, '0')}`;

  return (
    <section>
      <PageHeading
        title="Xác minh email"
        description={`Mã xác minh đã được gửi đến ${email}. Nhập mã gồm 6 chữ số để xác minh email.`}
      />
      <form className="mt-6 flex flex-col gap-6" noValidate onSubmit={handleVerify}>
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="mb-2 font-sans text-label font-medium text-text-primary">Mã xác minh</legend>
          <div className="grid grid-cols-6 gap-2 sm:gap-3" role="group" aria-label="Mã xác minh gồm 6 chữ số">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => { otpInputs.current[index] = element; }}
                aria-label={`Chữ số ${index + 1} của mã xác minh`}
                aria-invalid={error ? true : undefined}
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                className="h-12 min-w-0 rounded-control border border-border-default bg-bg-surface text-center font-sans text-display font-medium text-text-primary outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgb(41_80_151_/_18%)]"
                inputMode="numeric"
                maxLength={1}
                onChange={(event) => updateDigit(index, event.target.value)}
                onKeyDown={(event) => handleOtpKeyDown(index, event)}
                onPaste={handleOtpPaste}
                pattern="[0-9]*"
                required
                type="text"
                value={digit}
              />
            ))}
          </div>
        </fieldset>
        {error && <p className="-mt-3 font-sans text-body text-state-error" role="alert">{error}</p>}
        <Button disabled={isSubmitting} fullWidth type="submit">
          {isSubmitting ? 'Đang xác minh…' : 'Xác minh mã'}
        </Button>
        <div className="flex flex-col items-center gap-2 text-center">
          <button
            className="font-sans text-body text-text-muted disabled:cursor-not-allowed disabled:text-text-muted enabled:text-brand-primary enabled:hover:underline"
            disabled={resendSeconds > 0 || isSubmitting}
            onClick={() => void sendOtp(email)}
            type="button"
          >
            Gửi lại mã
          </button>
          <p className="font-sans text-caption text-text-secondary" aria-live="polite">
            {resendSeconds > 0 ? `Có thể gửi lại sau ${formattedCountdown}` : 'Bạn có thể yêu cầu gửi lại mã.'}
          </p>
          <button className="mt-2 font-sans text-body text-brand-primary hover:underline" onClick={returnToRequest} type="button">
            Quay lại bước trước
          </button>
        </div>
      </form>
    </section>
  );
}
