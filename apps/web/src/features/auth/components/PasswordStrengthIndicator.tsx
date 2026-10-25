import { Check } from 'lucide-react';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_SPECIAL_CHAR_LABEL,
  type PasswordStrength,
} from '../validation/auth.validation.js';

export type PasswordStrengthIndicatorProps = {
  strength: PasswordStrength;
  className?: string;
};

/**
 * PasswordStrengthIndicator - Component hiển thị checklist tiêu chuẩn mật khẩu
 */
export function PasswordStrengthIndicator({
  strength,
  className = '',
}: PasswordStrengthIndicatorProps) {
  const criteria = [
    {
      id: 'min-length',
      label: `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`,
      passed: strength.hasMinLength,
    },
    {
      id: 'uppercase',
      label: 'Ít nhất 1 chữ hoa',
      passed: strength.hasUppercase,
    },
    {
      id: 'lowercase',
      label: 'Ít nhất 1 chữ thường',
      passed: strength.hasLowercase,
    },
    {
      id: 'number',
      label: 'Ít nhất 1 số',
      passed: strength.hasNumber,
    },
    {
      id: 'special',
      label: `Ít nhất 1 ký tự đặc biệt (${PASSWORD_SPECIAL_CHAR_LABEL})`,
      passed: strength.hasSpecial,
    },
  ];

  return (
    <div
      className={`space-y-3 pt-1 animate-in fade-in duration-200 ${className}`}
    >
      {/* Tiêu đề quy tắc */}
      <p className="font-sans text-caption font-medium text-text-secondary">
        Mật khẩu phải bao gồm:
      </p>

      {/* Danh sách 5 tiêu chuẩn xếp dọc */}
      <div className="flex flex-col gap-2.5 font-sans text-caption">
        {criteria.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-2.5 transition-colors duration-200 ${item.passed ? 'font-medium text-slate-700' : 'text-text-muted'
              }`}
          >
            <div
              className={`flex size-4.5 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${item.passed
                  ? 'bg-state-success text-white shadow-xs'
                  : 'border border-slate-300 bg-white text-transparent'
                }`}
            >
              <Check className="size-3 stroke-[3]" />
            </div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
