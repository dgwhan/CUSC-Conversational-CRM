import { useState, type FormEvent } from 'react';
import {
  MailIcon,
  PhoneIcon,
  UserIcon,
} from '../../../components/icons/AuthIcons.js';
import { Button } from '../../../components/ui/Button.js';
import { PageHeading } from '../../../components/ui/PageHeading.js';
import { PasswordField } from '../../../components/ui/PasswordField.js';
import { TextField } from '../../../components/ui/TextField.js';
import { AuthApiError, register } from '../api/auth.api.js';
import type { RegisterResponse } from '../types/auth.types.js';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator.js';
import {
  calculatePasswordStrength,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
} from '../validation/auth.validation.js';

export type SignUpFormProps = {
  onSuccess: (result: RegisterResponse) => void;
  onSwitchToLogin: () => void;
  hideHeading?: boolean;
};

export function SignUpForm({
  onSuccess,
  onSwitchToLogin,
  hideHeading = false,
}: SignUpFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [hasBlurredPassword, setHasBlurredPassword] = useState(false);
  const [hasBlurredConfirm, setHasBlurredConfirm] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [fullNameError, setFullNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const strength = calculatePasswordStrength(password);
  const rawPasswordError = validatePassword(password);
  const rawConfirmError = validateConfirmPassword(confirmPassword, password);

  const displayedPasswordError =
    (hasBlurredPassword || hasSubmitted) && rawPasswordError
      ? rawPasswordError : '';
  const displayedConfirmError =
    (hasBlurredConfirm || hasSubmitted) && rawConfirmError
      ? rawConfirmError : '';
  const isMatching =
    confirmPassword.length > 0 &&
    password.length > 0 &&
    password === confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setError('');

    const nextFullNameError = validateFullName(fullName);
    const nextEmailError = validateEmail(email);
    const nextPhoneError = validatePhone(phoneNumber);
    const nextPasswordError = validatePassword(password);
    const nextConfirmError = validateConfirmPassword(confirmPassword, password);

    setFullNameError(nextFullNameError);
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);

    if (
      nextFullNameError ||
      nextEmailError ||
      nextPhoneError ||
      nextPasswordError ||
      nextConfirmError
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
      });

      onSuccess(response);
    } catch (submitError) {
      if (submitError instanceof AuthApiError) {
        setError(submitError.message);
      } else {
        setError('Có lỗi xảy ra trong quá trình đăng ký. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!hideHeading && (
        <PageHeading
          title="Tạo tài khoản mới"
          description="Đăng ký tài khoản nhân viên để tham gia hệ thống Conversational CRM của CUSC."
        />
      )}

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <TextField label="Họ và tên" name="fullName" autoComplete="name" placeholder="Nhập họ và tên của bạn" leadingIcon={<UserIcon />}
          value={fullName}
          onChange={(event) => {
            const val = event.target.value;
            setFullName(val);
            if (fullNameError) setFullNameError(validateFullName(val));
            if (error) setError('');
          }}
          onBlur={() => {
            if (fullName) setFullNameError(validateFullName(fullName));
          }}
          errorMessage={fullNameError}
          disabled={isSubmitting}
        />

        <TextField label="Email của bạn" name="email" type="email" autoComplete="email" placeholder="Nhập email của bạn" leadingIcon={<MailIcon />}
          value={email}
          onChange={(event) => {
            const val = event.target.value;
            setEmail(val);
            if (emailError) setEmailError(validateEmail(val));
            if (error) setError('');
          }}
          onBlur={() => {
            if (email) setEmailError(validateEmail(email));
          }}
          errorMessage={emailError}
          disabled={isSubmitting}
        />

        <TextField label="Số điện thoại" name="phoneNumber" type="tel" autoComplete="tel" placeholder="Nhập số điện thoại của bạn" leadingIcon={<PhoneIcon />}
          value={phoneNumber}
          onChange={(event) => {
            const val = event.target.value;
            setPhoneNumber(val);
            if (phoneError) setPhoneError(validatePhone(val));
            if (error) setError('');
          }}
          onBlur={() => {
            if (phoneNumber) setPhoneError(validatePhone(phoneNumber));
          }}
          errorMessage={phoneError}
          disabled={isSubmitting}
        />

        <div className="flex flex-col gap-2">
          <PasswordField label="Mật khẩu" name="password" autoComplete="new-password" value={password} onChange={(value) => {
            setPassword(value);
            if (error) setError('');
          }}
            onBlur={() => setHasBlurredPassword(true)}
            errorMessage={displayedPasswordError}
            disabled={isSubmitting}
          />

          {password.length > 0 && (
            <PasswordStrengthIndicator strength={strength} />
          )}
        </div>

        <PasswordField label="Xác nhận mật khẩu" name="confirmPassword" autoComplete="new-password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            if (error) setError('');
          }}
          onBlur={() => setHasBlurredConfirm(true)}
          errorMessage={displayedConfirmError}
          successMessage={isMatching ? 'Mật khẩu trùng khớp' : undefined}
          disabled={isSubmitting}
        />

        {error && (
          <p className="rounded-control border border-state-error bg-state-error-bg px-3 py-2 font-sans text-body text-state-error" role="alert">
            {error}
          </p>
        )}

        <Button fullWidth type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang tạo tài khoản…' : 'Đăng ký tài khoản'}
        </Button>

        <div className="text-center font-sans text-body text-text-secondary">
          <span>Đã có tài khoản?</span>{' '}
          <button type="button" onClick={onSwitchToLogin} className="font-medium text-brand-primary hover:underline cursor-pointer">
            Đăng nhập ngay
          </button>
        </div>
      </form>
    </div>
  );
}
