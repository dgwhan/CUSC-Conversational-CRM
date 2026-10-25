import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type SubmitEvent,
} from 'react';
import { Button } from '../../../../components/ui/Button.js';
import { PageHeading } from '../../../../components/ui/PageHeading.js';
import {
  requestPasswordRecoveryOtp,
  verifyPasswordRecoveryOtp,
} from '../../api/password-recovery.api.js';
import {
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  getRequestErrorMessage,
  getVerificationErrorMessage,
} from './recovery.constants.js';

type PasswordRecoveryVerifyStepProps = {
  email: string;
  onSuccess: (resetToken: string) => void;
  onBackToRequest: () => void;
};

export function PasswordRecoveryVerifyStep({
  email,
  onSuccess,
  onBackToRequest,
}: PasswordRecoveryVerifyStepProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const otp = digits.join('');

  useEffect(() => {
    // Focus ô đầu tiên khi component mount
    otpInputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendSeconds === 0) return;

    const timer = window.setTimeout(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function handleResend() {
    setIsSubmitting(true);
    setError('');

    try {
      await requestPasswordRecoveryOtp({ email });
      setDigits(Array(OTP_LENGTH).fill(''));
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      otpInputs.current[0]?.focus();
    } catch (cause) {
      setError(getRequestErrorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function executeVerification(codeToVerify: string) {
    if (!/^\d{6}$/.test(codeToVerify)) {
      setError('Nhập đủ 6 chữ số của mã xác minh.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await verifyPasswordRecoveryOtp({ email, otp: codeToVerify });
      onSuccess(result.resetToken);
    } catch (cause) {
      setError(getVerificationErrorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeVerification(otp);
  }

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    setDigits(nextDigits);
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
    const pastedDigits = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH);
    if (!pastedDigits) return;

    event.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, index) => pastedDigits[index] ?? '');
    setDigits(next);
    setError('');
    otpInputs.current[Math.min(pastedDigits.length, OTP_LENGTH) - 1]?.focus();
  }

  const formattedCountdown = `00:${String(resendSeconds).padStart(2, '0')}`;

  return (
    <section className="animate-in fade-in duration-300">
      <PageHeading
        title="Xác minh email"
        description={`Mã xác minh đã được gửi đến ${email}. Nhập mã gồm 6 chữ số để xác minh email.`}
      />
      <form
        className="mt-6 flex flex-col gap-6"
        noValidate
        onSubmit={handleVerify}>
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="mb-2 font-sans text-label font-medium text-text-primary">
            Mã xác minh
          </legend>
          <div
            className="grid grid-cols-6 gap-2 sm:gap-3"
            role="group"
            aria-label="Mã xác minh gồm 6 chữ số">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  otpInputs.current[index] = element;
                }}
                aria-label={`Chữ số ${index + 1} của mã xác minh`}
                aria-invalid={error ? true : undefined}
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                className="h-12 min-w-0 rounded-control border border-border-default bg-bg-surface text-center font-sans text-display font-medium text-text-primary outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgb(41_80_151_/_18%)] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-75 transition-colors"
                disabled={isSubmitting}
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


        {/* Thông báo lỗi khi xác minh thất bại */}
        {!isSubmitting && error && (
          <p className="-mt-2 font-sans text-body text-state-error" role="alert">
            {error}
          </p>
        )}

        <Button
          disabled={isSubmitting}
          fullWidth
          loading={isSubmitting}
          type="submit">
          {isSubmitting ? 'Đang xác minh mã…' : 'Xác minh mã'}
        </Button>

        <div className="flex flex-col items-center gap-2 text-center">
          <button
            className="font-sans text-body text-text-muted disabled:cursor-not-allowed disabled:text-text-muted enabled:text-brand-primary enabled:hover:underline"
            disabled={resendSeconds > 0 || isSubmitting}
            onClick={() => void handleResend()}
            type="button">
            Gửi lại mã
          </button>
          <p
            className="font-sans text-caption text-text-secondary"
            aria-live="polite"
          >
            {resendSeconds > 0
              ? `Có thể gửi lại sau ${formattedCountdown}`
              : 'Bạn có thể yêu cầu gửi lại mã.'}
          </p>
          <button
            className="mt-2 font-sans text-body text-brand-primary hover:underline"
            disabled={isSubmitting}
            onClick={onBackToRequest}
            type="button">
            Quay lại bước trước
          </button>
        </div>
      </form>
    </section>
  );
}
