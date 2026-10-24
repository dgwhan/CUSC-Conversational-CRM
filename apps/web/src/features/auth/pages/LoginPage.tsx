import { useState } from 'react';
import { Button } from '../../../components/ui/Button.js';
import { PageHeading } from '../../../components/ui/PageHeading.js';
import { AuthLayout } from '../../../layouts/AuthLayout.js';
import cuscLogo from '../../../assets/logo/CUSC-Logo.png';
import { AdminPage } from '../../admin/pages/AdminPage.js';
import { LoginForm } from '../components/LoginForm.js';
import type { LoginResponse } from '../types/auth.types.js';
import { StaffPage } from '../../staff/pages/StaffPage.js';
import { PasswordRecoveryFlow } from '../components/PasswordRecoveryFlow.js';

export function LoginPage() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

  if (session?.staff.role === 'ADMIN') {
    return <AdminPage onLogout={() => setSession(null)} />;
  }
  if (session?.staff.role === 'STAFF') {
    return <StaffPage onLogout={() => setSession(null)} />;
  }

  return (
    <AuthLayout>
      <img className="mx-auto mb-6 h-[76px] w-auto object-contain" src={cuscLogo} alt="CUSC"/>

      {session ? (
        <section aria-live="polite">
          <PageHeading title="Chưa có trang cho vai trò này" />
          <Button className="mt-6" fullWidth onClick={() => setSession(null)}>
            Đăng xuất
          </Button>
        </section>
      ) : isRecoveryOpen ? (
        // Luồng này kết thúc sau khi API xác nhận OTP thành công.
        <PasswordRecoveryFlow
          onBackToLogin={() => setIsRecoveryOpen(false)}
        />
      ) : (
        <>
          <PageHeading title="Chào mừng trở lại"
            description="Đăng nhập để tiếp tục sử dụng hệ thống Conversational CRM của CUSC."
          />
          <LoginForm
            onSuccess={setSession}
            onForgotPassword={() => setIsRecoveryOpen(true)}
          />
        </>
      )}
    </AuthLayout>
  );
}
