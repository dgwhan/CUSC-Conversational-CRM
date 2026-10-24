import { useState } from 'react';
import { PageHeading } from '../../../components/ui/PageHeading.js';
import { AuthLayout } from '../../../layouts/AuthLayout.js';
import cuscLogo from '../../../assets/logo/CUSC-Logo.png';
import { LoginForm } from '../components/LoginForm.js';
import type { LoginResponse } from '../types/auth.types.js';
import { PasswordRecoveryFlow } from '../components/PasswordRecoveryFlow.js';

type LoginPageProps = {
  onLoginSuccess?: (session: LoginResponse) => void;
};

export function LoginPage({ onLoginSuccess }: LoginPageProps = {}) {
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

  return (
    <AuthLayout>
      <img className="mx-auto mb-6 h-[76px] w-auto object-contain" src={cuscLogo} alt="CUSC" />

      {isRecoveryOpen ? (
        // Luồng này kết thúc sau khi API xác nhận OTP thành công.
        <PasswordRecoveryFlow
          onBackToLogin={() => setIsRecoveryOpen(false)}
        />
      ) : (
        <>
          <PageHeading
            title="Chào mừng trở lại"
            description="Đăng nhập để tiếp tục sử dụng hệ thống Conversational CRM của CUSC."
          />
          <LoginForm
            onSuccess={(res) => onLoginSuccess?.(res)}
            onForgotPassword={() => setIsRecoveryOpen(true)}
          />
        </>
      )}
    </AuthLayout>
  );
}
