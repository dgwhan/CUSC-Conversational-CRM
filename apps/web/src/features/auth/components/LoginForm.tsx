import { useState, type FormEvent } from 'react';
import { MailIcon } from '../../../components/icons/AuthIcons.js';
import { Button } from '../../../components/ui/Button.js';
import { Checkbox } from '../../../components/ui/Checkbox.js';
import { PageHeading } from '../../../components/ui/PageHeading.js';
import { PasswordField } from '../../../components/ui/PasswordField.js';
import { TextField } from '../../../components/ui/TextField.js';
import { AuthApiError, login } from '../api/auth.api.js';
import type { LoginResponse } from '../types/auth.types.js';
import { AUTH_MESSAGES } from '../validation/auth.validation.js';

const REMEMBERED_IDENTIFIER_KEY = 'cusc.rememberedIdentifier';

export type LoginFormProps = {
  onSuccess: (result: LoginResponse) => void;
  onForgotPassword: () => void;
  onSwitchToSignUp?: () => void;
  hideHeading?: boolean;
};

function readRememberedIdentifier(): string {
  try {
    localStorage.removeItem('cusc.rememberedEmail');
    const saved = localStorage.getItem(REMEMBERED_IDENTIFIER_KEY) ?? '';
    if (saved === 'staff@cusc.com' || saved === 'owner@cusc.com') {
      localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
      return '';
    }
    return saved;
  } catch {
    return '';
  }
}

export function LoginForm({
  onSuccess,
  onForgotPassword,
  onSwitchToSignUp,
  hideHeading = false,
}: LoginFormProps) {
  const [identifier, setIdentifier] = useState(readRememberedIdentifier);
  const [password, setPassword] = useState('');
  const [rememberIdentifier, setRememberIdentifier] = useState(() =>
    Boolean(readRememberedIdentifier()),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const nextIdentifierError = identifier.trim()
      ? ''
      : AUTH_MESSAGES.IDENTIFIER_REQUIRED;
    const nextPasswordError = password ? '' : AUTH_MESSAGES.PASSWORD_REQUIRED;
    setIdentifierError(nextIdentifierError);
    setPasswordError(nextPasswordError);

    if (nextIdentifierError || nextPasswordError) return;

    setIsSubmitting(true);

    try {
      const normalizedIdentifier = identifier.trim();
      const result = await login({
        identifier: normalizedIdentifier,
        password,
      });

      try {
        if (rememberIdentifier) {
          localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, normalizedIdentifier);
        } else {
          localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
        }
      } catch {
        // Remembrance is optional if browser storage is unavailable.
      }

      setPassword('');
      onSuccess(result);
    } catch (cause) {
      setError(
        cause instanceof AuthApiError
          ? cause.message
          : 'Không kết nối được máy chủ. Vui lòng kiểm tra kết nối mạng.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!hideHeading && (
        <PageHeading
          title="Chào mừng trở lại"
          description="Đăng nhập để tiếp tục sử dụng hệ thống Conversational CRM của CUSC."
        />
      )}

      <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
        <TextField
          label="Email hoặc Số điện thoại"
          name="identifier"
          type="text"
          autoComplete="username"
          placeholder="Nhập email hoặc số điện thoại"
          value={identifier}
          onChange={(event) => {
            setIdentifier(event.target.value);
            if (identifierError) {
              setIdentifierError(
                event.target.value.trim() ? '' : AUTH_MESSAGES.IDENTIFIER_REQUIRED,
              );
            }
            if (error) setError('');
          }}
          onBlur={() => {
            if (identifierError) {
              setIdentifierError(
                identifier.trim() ? '' : AUTH_MESSAGES.IDENTIFIER_REQUIRED,
              );
            }
          }}
          leadingIcon={<MailIcon />}
          errorMessage={identifierError}
          required
          disabled={isSubmitting}
        />

        <PasswordField
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (passwordError) {
              setPasswordError(value ? '' : AUTH_MESSAGES.PASSWORD_REQUIRED);
            }
            if (error) setError('');
          }}
          errorMessage={passwordError}
          disabled={isSubmitting}
        />

        <div className="-mt-2 flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            checked={rememberIdentifier}
            disabled={isSubmitting}
            onChange={(event) => setRememberIdentifier(event.target.checked)}
          >
            Ghi nhớ đăng nhập
          </Checkbox>

          <button
            className="font-sans text-body text-brand-primary hover:underline cursor-pointer"
            type="button"
            onClick={onForgotPassword}
          >
            Quên mật khẩu?
          </button>
        </div>

        {error && (
          <p
            className="-mt-3 rounded-control border border-state-error bg-state-error-bg px-3 py-2 font-sans text-body text-state-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <Button fullWidth type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>

        {onSwitchToSignUp && (
          <div className="text-center font-sans text-body text-text-secondary">
            <span>Chưa có tài khoản?</span>{' '}
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="font-medium text-brand-primary hover:underline cursor-pointer"
            >
              Đăng ký ngay
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
