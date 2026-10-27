import { useState } from 'react';
import { AuthLayout } from '../../../layouts/AuthLayout.js';
import cuscLogo1xWebp from '../../../assets/logo/CUSC-Logo-1x.webp';
import cuscLogoWebp from '../../../assets/logo/CUSC-Logo.webp';
import cuscLogo1xPng from '../../../assets/logo/CUSC-Logo-1x.png';
import cuscLogoPng from '../../../assets/logo/CUSC-Logo@2x.png';
import { LoginForm } from '../components/LoginForm.js';
import { SignUpForm } from '../components/SignUpForm.js';
import { AUTH_TAB, type AuthTab } from '../constants/auth.constants.js';
import type { LoginResponse } from '../types/auth.types.js';
import { PasswordRecoveryFlow } from '../components/PasswordRecoveryFlow.js';

export type AuthPageProps = {
  onLoginSuccess?: (session: LoginResponse) => void;
  defaultTab?: AuthTab;
};

export { AUTH_TAB, type AuthTab };

export function AuthPage({
  onLoginSuccess,
  defaultTab = AUTH_TAB.LOGIN,
}: AuthPageProps = {}) {
  const [activeTab, setActiveTab] = useState<AuthTab>(defaultTab);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleTabChange = (tab: AuthTab) => {
    if (tab !== activeTab) {
      setHasInteracted(true);
      setActiveTab(tab);
    }
  };

  const isLoginActive = activeTab === AUTH_TAB.LOGIN;
  const isSignUpActive = activeTab === AUTH_TAB.SIGN_UP;

  return (
    <AuthLayout>
      <picture>
        <source
          type="image/webp"
          srcSet={`${cuscLogo1xWebp} 1x, ${cuscLogoWebp} 2x`}
        />
        <img
          className="mx-auto mb-6 h-[76px] w-auto object-contain"
          src={cuscLogo1xPng}
          srcSet={`${cuscLogo1xPng} 1x, ${cuscLogoPng} 2x`}
          alt="CUSC Logo"
          width={154}
          height={76}
          fetchPriority="high"
          decoding="async"
        />
      </picture>

      {isRecoveryOpen ? (
        <PasswordRecoveryFlow
          onBackToLogin={() => {
            setIsRecoveryOpen(false);
            handleTabChange(AUTH_TAB.LOGIN);
          }}
        />
      ) : (
        <>
          {/* Tab switcher với Sliding Tab Indicator */}
          <div className="relative mb-6 flex border-b border-border-default" role="tablist" aria-label="Authentication tabs">
            <button id="auth-tab-login" type="button" role="tab" aria-selected={isLoginActive} aria-controls="auth-panel-login" tabIndex={isLoginActive ? 0 : -1} onClick={() => handleTabChange(AUTH_TAB.LOGIN)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  handleTabChange(AUTH_TAB.SIGN_UP);
                  document.getElementById('auth-tab-signup')?.focus();
                }
              }}
              className={`relative z-10 flex-1 pb-3 text-center font-sans text-body font-medium transition-colors duration-200 cursor-pointer rounded-t-md hover:bg-slate-50/60 ${isLoginActive ? 'text-brand-primary font-semibold' : 'text-text-secondary hover:text-text-primary'}`}>
              Đăng nhập
            </button>

            <button id="auth-tab-signup" type="button" role="tab" aria-selected={isSignUpActive} aria-controls="auth-panel-signup" tabIndex={isSignUpActive ? 0 : -1}
              onClick={() => handleTabChange(AUTH_TAB.SIGN_UP)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  handleTabChange(AUTH_TAB.LOGIN);
                  document.getElementById('auth-tab-login')?.focus();
                }
              }}
              className={`relative z-10 flex-1 pb-3 text-center font-sans text-body font-medium transition-colors duration-200 cursor-pointer rounded-t-md hover:bg-slate-50/60 ${isSignUpActive ? 'text-brand-primary font-semibold' : 'text-text-secondary hover:text-text-primary'}`}>
              Đăng ký
            </button>

            {/* Sliding Tab Indicator */}
            <span
              className="absolute -bottom-px left-0 h-[2.5px] w-1/2 rounded-full bg-brand-primary shadow-[0_1px_4px_rgba(41,80,151,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
              style={{
                transform: isLoginActive ? 'translateX(0%)' : 'translateX(100%)',
              }}
              aria-hidden="true"
            />
          </div>

          {/* LoginForm & SignUpForm */}
          {isLoginActive ? (
            <div key="auth-panel-login" id="auth-panel-login" role="tabpanel" aria-labelledby="auth-tab-login" className={hasInteracted ? 'animate-auth-slide-left' : ''}>
              <LoginForm
                onSuccess={(res) => onLoginSuccess?.(res)}
                onForgotPassword={() => setIsRecoveryOpen(true)}
                onSwitchToSignUp={() => handleTabChange(AUTH_TAB.SIGN_UP)}
              />
            </div>
          ) : (
            <div key="auth-panel-signup" id="auth-panel-signup" role="tabpanel" aria-labelledby="auth-tab-signup" className={hasInteracted ? 'animate-auth-slide-right' : ''}>
              <SignUpForm
                onSuccess={(res) =>
                  onLoginSuccess?.({
                    ...res,
                    staff: {
                      ...res.staff,
                      mustChangePassword: false,
                    },
                  })
                }
                onSwitchToLogin={() => handleTabChange(AUTH_TAB.LOGIN)}
              />
            </div>
          )}
        </>
      )}
    </AuthLayout>
  );
}
