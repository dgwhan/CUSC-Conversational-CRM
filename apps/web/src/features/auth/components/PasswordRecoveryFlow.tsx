import { useState } from 'react';
import { PasswordRecoveryRequestStep } from './recovery/PasswordRecoveryRequestStep.js';
import { PasswordRecoveryVerifyStep } from './recovery/PasswordRecoveryVerifyStep.js';
import { PasswordRecoveryResetStep } from './recovery/PasswordRecoveryResetStep.js';
import { PasswordRecoverySuccessStep } from './recovery/PasswordRecoverySuccessStep.js';

type PasswordRecoveryFlowProps = {
  onBackToLogin: () => void;
};

type RecoveryStep = 'request' | 'verify' | 'reset' | 'success';

/**
 * PasswordRecoveryFlow - Bộ điều phối luồng khôi phục và đặt lại mật khẩu
 */
export function PasswordRecoveryFlow({ onBackToLogin }: PasswordRecoveryFlowProps) {
  const [step, setStep] = useState<RecoveryStep>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  //Yêu cầu mã OTP qua Email
  if (step === 'request') {
    return (
      <PasswordRecoveryRequestStep
        initialEmail={email}
        onBackToLogin={onBackToLogin}
        onSuccess={(submittedEmail) => {
          setEmail(submittedEmail);
          setStep('verify');
        }}
      />
    );
  }

  //Nhập và xác minh 6 số OTP
  if (step === 'verify') {
    return (
      <PasswordRecoveryVerifyStep
        email={email}
        onBackToRequest={() => setStep('request')}
        onSuccess={(token) => {
          setResetToken(token);
          setStep('reset');
        }}
      />
    );
  }

  //Tạo và xác nhận mật khẩu mới
  if (step === 'reset') {
    return (
      <PasswordRecoveryResetStep
        email={email}
        onBackToRequest={() => {
          setResetToken('');
          setStep('request');
        }}
        onSuccess={() => setStep('success')}
        resetToken={resetToken}
      />
    );
  }

  //Thông báo hoàn tất thành công
  return <PasswordRecoverySuccessStep onBackToLogin={onBackToLogin} />;
}
