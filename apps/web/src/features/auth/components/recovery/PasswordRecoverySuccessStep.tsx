import { useState } from 'react';
import { Modal } from '../../../../components/ui/Modal.js';
import { ModalIcon } from '../../../../components/ui/ModalIcon.js';

type PasswordRecoverySuccessStepProps = {
  onBackToLogin: () => void;
};

/**
 * PasswordRecoverySuccessStep - Hiển thị popup thông báo thành công
 * Tái sử dụng component Modal và ModalIcon chung của hệ thống 
 */
export function PasswordRecoverySuccessStep({
  onBackToLogin,
}: PasswordRecoverySuccessStepProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative min-h-[280px] flex items-center justify-center">
      <div className="text-center space-y-2 opacity-30 select-none pointer-events-none">
        <h2 className="font-sans text-display font-semibold text-text-primary">
          Đang hoàn tất…
        </h2>
        <p className="font-sans text-body text-text-secondary">
          Vui lòng đợi giây lát.
        </p>
      </div>

      <Modal
        closeOnEsc
        closeOnOverlayClick
        description="Mật khẩu của bạn đã được cập nhật. Vui lòng đăng nhập lại"
        icon={<ModalIcon size="md" variant="success" />}
        isOpen={isOpen}
        onClose={handleClose}
        onExited={onBackToLogin}
        primaryAction={{
          label: 'Đăng nhập ngay',
          onClick: handleClose,
          variant: 'primary',
        }}
        showCloseButton={false}
        size="sm"
        title="Đặt lại mật khẩu thành công"
      />
    </div>
  );
}
