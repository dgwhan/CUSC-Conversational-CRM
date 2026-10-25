import { useState, type SubmitEvent } from 'react';
import { MailIcon } from '../../../../components/icons/AuthIcons.js';
import { Button } from '../../../../components/ui/Button.js';
import { PageHeading } from '../../../../components/ui/PageHeading.js';
import { TextField } from '../../../../components/ui/TextField.js';
import { requestPasswordRecoveryOtp } from '../../api/password-recovery.api.js';
import { getRequestErrorMessage, validateEmail } from './recovery.constants.js';

type PasswordRecoveryRequestStepProps = {
  initialEmail?: string;
  onSuccess: (email: string) => void;
  onBackToLogin: () => void;
};

export function PasswordRecoveryRequestStep({
  initialEmail = '',
  onSuccess,
  onBackToLogin,
}: PasswordRecoveryRequestStepProps) {
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequest(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateEmail(email);
    setEmailError(validationError);
    if (validationError) return;

    setIsSubmitting(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      await requestPasswordRecoveryOtp({ email: normalizedEmail });
      onSuccess(normalizedEmail);
    } catch (cause) {
      setError(getRequestErrorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="animate-in fade-in duration-300">
      <PageHeading
        title="Quên mật khẩu?"
        description="Nhập địa chỉ email của bạn. Hệ thống sẽ gửi mã xác minh."
      />
      <form
        className="mt-6 flex flex-col gap-6"
        noValidate
        onSubmit={handleRequest}
      >
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
          placeholder="Nhập địa chỉ email của bạn"
          required
          type="email"
          value={email}
        />

        {error && (
          <p className="-mt-3 font-sans text-body text-state-error" role="alert">
            {error}
          </p>
        )}

        <Button disabled={isSubmitting} fullWidth type="submit">
          {isSubmitting ? 'Đang gửi mã…' : 'Gửi mã xác minh'}
        </Button>

        <button
          className="font-sans text-body text-brand-primary hover:underline text-center"
          onClick={onBackToLogin}
          type="button"
        >
          Quay lại đăng nhập
        </button>
      </form>
    </section>
  );
}
