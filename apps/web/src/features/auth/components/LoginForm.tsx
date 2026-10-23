import { useState, type FormEvent } from 'react';
import { MailIcon } from '../../../components/icons/AuthIcons.js';
import { Button } from '../../../components/ui/Button.js';
import { Checkbox } from '../../../components/ui/Checkbox.js';
import { PasswordField } from '../../../components/ui/PasswordField.js';
import { TextField } from '../../../components/ui/TextField.js';
import { AuthApiError, login } from '../api/auth.api.js';
import type { LoginResponse } from '../types/auth.types.js';

const REMEMBERED_EMAIL_KEY = 'cusc.rememberedEmail';
const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginFormProps = {
  onSuccess: (result: LoginResponse) => void;
};

function readRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState(readRememberedEmail);
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(readRememberedEmail()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  function validateEmail(value: string): string {
    const normalizedEmail = value.trim();

    if (!normalizedEmail) 
      return 'Vui lòng nhập email.';

    if (!EMAIL_FORMAT_PATTERN.test(normalizedEmail)) {
      return 'Vui lòng nhập email hợp lệ.';
    }

    return '';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    const nextEmailError = validateEmail(email);
    const nextPasswordError = password.length === 0 ? 'Vui lòng nhập mật khẩu.' : '';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;

    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim();
      const result = await login({ email: normalizedEmail, password });
      try {
        if (rememberEmail) localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      } catch {
        //email remembrance is optional if browser storage is unavailable.
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
    <form className="mt-6 flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
      <TextField label="Email" name="email" type="email" autoComplete="username" placeholder="Nhập email công việc" value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (emailError) setEmailError(validateEmail(event.target.value));
          if (error) setError('');
        }}
        onBlur={() => setEmailError(validateEmail(email))}
        leadingIcon={<MailIcon />}
        errorMessage={emailError}
        required
        disabled={isSubmitting}/>

      <PasswordField value={password} onChange={(value) => {
          setPassword(value);
          if (passwordError) setPasswordError(value ? '' : 'Vui lòng nhập mật khẩu.');
          if (error) setError('');
        }}
        errorMessage={passwordError}
        disabled={isSubmitting}/>

      <div className="-mt-2 flex flex-wrap items-center justify-between gap-3">
        <Checkbox checked={rememberEmail} disabled={isSubmitting}
          onChange={(event) => setRememberEmail(event.target.checked)}>
          Ghi nhớ đăng nhập
        </Checkbox>

        <button className="font-sans text-body text-brand-primary hover:underline"
          type="button" aria-expanded={Boolean(notice)} aria-controls="forgot-password-notice"
          onClick={() =>
            setNotice('Tính năng quên mật khẩu chưa được triển khai. Vui lòng liên hệ quản trị viên để được hỗ trợ.')
          }>
          Quên mật khẩu?
        </button>
      </div>

      {notice && (
        <p className="-mt-3 rounded-control border border-border-subtle bg-bg-page px-3 py-2 font-sans text-body text-text-secondary"
          id="forgot-password-notice"
          role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="-mt-3 rounded-control border border-state-error bg-state-error-bg px-3 py-2 font-sans text-body text-state-error" role="alert">
          {error}
        </p>
      )}
      <Button fullWidth type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
    </form>
  );
}
