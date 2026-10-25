import { useState, type SubmitEvent } from 'react';
import {
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../../../../components/ui/Button.js';
import { PageHeading } from '../../../../components/ui/PageHeading.js';
import { PasswordField } from '../../../../components/ui/PasswordField.js';
import { resetPassword } from '../../api/password-recovery.api.js';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator.js';
import {
  calculatePasswordStrength,
  getResetErrorMessage,
  validateConfirmPassword,
  validatePassword,
} from './recovery.constants.js';

type PasswordRecoveryResetStepProps = {
  email: string;
  resetToken: string;
  onSuccess: () => void;
  onBackToRequest: () => void;
};

export function PasswordRecoveryResetStep({
  resetToken,
  onSuccess,
  onBackToRequest,
}: PasswordRecoveryResetStepProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasBlurredNewPassword, setHasBlurredNewPassword] = useState(false);
  const [hasBlurredConfirmPassword, setHasBlurredConfirmPassword] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = calculatePasswordStrength(newPassword);

  const rawPasswordError = validatePassword(newPassword);
  const rawConfirmError = validateConfirmPassword(confirmPassword, newPassword);

  const displayedPasswordError = (hasBlurredNewPassword || hasSubmitted) && rawPasswordError ? rawPasswordError : '';

  const displayedConfirmError = (hasBlurredConfirmPassword || hasSubmitted) && rawConfirmError ? rawConfirmError : '';

  const isMatching = confirmPassword.length > 0 && confirmPassword === newPassword && !rawPasswordError;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setError('');

    if (rawPasswordError || rawConfirmError) return;

    setIsSubmitting(true);
    try {
      await resetPassword({ resetToken, newPassword });
      onSuccess();
    } catch (cause) {
      setError(getResetErrorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="animate-in fade-in duration-300">
      <PageHeading
        title="Tạo mật khẩu mới"
        description="Tạo mật khẩu mới an toàn để tiếp tục sử dụng hệ thống."
      />

      <form className="mt-6 flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
        {/*Trường Mật khẩu mới */}
        <div>
          <PasswordField
            autoComplete="new-password"
            disabled={isSubmitting}
            errorMessage={displayedPasswordError}
            label="Mật khẩu mới"
            name="newPassword"
            onBlur={() => setHasBlurredNewPassword(true)}
            onChange={(value) => {
              setNewPassword(value);
              setError('');
            }}
            placeholder="Nhập mật khẩu mới"
            value={newPassword}
          />
        </div>

        {/*Trường Xác nhận mật khẩu mới */}
        <div>
          <PasswordField
            autoComplete="new-password"
            disabled={isSubmitting}
            errorMessage={displayedConfirmError}
            successMessage={isMatching ? 'Mật khẩu trùng khớp' : undefined}
            label="Xác nhận mật khẩu mới"
            name="confirmPassword"
            onBlur={() => setHasBlurredConfirmPassword(true)}
            onChange={(value) => {
              setConfirmPassword(value);
              setError('');
            }}
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
          />
        </div>

        {/*Checklist tiêu chuẩn*/}
        {newPassword.length > 0 && (
          <PasswordStrengthIndicator strength={strength} />
        )}

        {/*Thông báo lỗi từ server nếu có */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-control border border-red-200 bg-red-50 p-3 text-left">
            <ShieldAlert className="size-5 text-state-error shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-sans text-caption text-state-error" role="alert">
                {error}
              </p>
              {error.includes('hết hạn') && (
                <button
                  className="font-sans text-caption font-medium text-brand-primary underline hover:opacity-80"
                  onClick={onBackToRequest}
                  type="button"
                >
                  Gửi lại mã xác minh mới
                </button>
              )}
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button
            disabled={isSubmitting}
            fullWidth
            loading={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Đang cập nhật…' : 'Đặt lại mật khẩu'}
          </Button>
        </div>

        <div className="flex justify-center">
          <button
            className="font-sans text-body text-brand-primary hover:underline transition-colors py-1 text-center"
            disabled={isSubmitting}
            onClick={onBackToRequest}
            type="button"
          >
            Quay lại bước trước
          </button>
        </div>
      </form>
    </section>
  );
}
