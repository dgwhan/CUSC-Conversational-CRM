export interface StandardizePhoneOptions {
  throwOnError?: boolean;
}

export class InvalidPhoneNumberError extends Error {
  constructor(message: string = 'Số điện thoại không hợp lệ hoặc sai độ dài') {
    super(message);
    this.name = 'InvalidPhoneNumberError';
  }
}

export const VIETNAMESE_PHONE_STANDARD_REGEX = /^0[0-9]{9}$/;

export function standardizeVietnamesePhoneNumber(
  input: string | null | undefined,
  options?: { throwOnError?: false },
): string | null;
export function standardizeVietnamesePhoneNumber(
  input: string | null | undefined,
  options: { throwOnError: true },
): string;
export function standardizeVietnamesePhoneNumber(
  input: string | null | undefined,
  options?: StandardizePhoneOptions,
): string | null;
export function standardizeVietnamesePhoneNumber(
  input: string | null | undefined,
  options?: StandardizePhoneOptions,
): string | null {
  const reject = (reason: string): null => {
    if (options?.throwOnError) {
      throw new InvalidPhoneNumberError(reason);
    }
    return null;
  };

  if (typeof input !== 'string') {
    return reject('Số điện thoại phải là chuỗi ký tự hợp lệ');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return reject('Số điện thoại không được để trống');
  }

  const allowedCharsPattern = /^[0-9+\s.\-–—()]+$/;
  if (!allowedCharsPattern.test(trimmed)) {
    return reject('Số điện thoại chứa ký tự không hợp lệ (chỉ chấp nhận số và dấu phân cách).');
  }

  const plusOccurrences = (trimmed.match(/\+/g) || []).length;
  if (plusOccurrences > 1) {
    return reject('Số điện thoại không được chứa nhiều hơn một dấu cộng (+).');
  }
  if (plusOccurrences === 1) {
    const firstNonWrapperChar = trimmed.replace(/^[\s(]+/, '')[0];
    if (firstNonWrapperChar !== '+') {
      return reject('Dấu cộng (+) chỉ được phép đặt ở đầu mã quốc gia.');
    }
  }

  const clean = trimmed.replace(/[\s.\-–—()]/g, '');

  let nationalDigits = '';

  if (clean.startsWith('+84')) {
    let remainder = clean.slice(3);
    if (remainder.startsWith('0')) {
      remainder = remainder.slice(1);
    }
    nationalDigits = '0' + remainder;
  } else if (clean.startsWith('0084')) {
    let remainder = clean.slice(4);
    if (remainder.startsWith('0')) {
      remainder = remainder.slice(1);
    }
    nationalDigits = '0' + remainder;
  } else if (clean.startsWith('84')) {
    let remainder = clean.slice(2);
    if (remainder.startsWith('0')) {
      remainder = remainder.slice(1);
    }
    nationalDigits = '0' + remainder;
  } else if (clean.startsWith('0')) {
    nationalDigits = clean;
  } else {
    return reject('Số điện thoại phải bắt đầu bằng 0, 84 hoặc +84.');
  }

  if (nationalDigits.length !== 10) {
    return reject(`Số điện thoại phải gồm 10 chữ số (hiện tại có ${nationalDigits.length} số).`);
  }

  if (!VIETNAMESE_PHONE_STANDARD_REGEX.test(nationalDigits)) {
    return reject('Số điện thoại không hợp lệ sau khi chuẩn hóa.');
  }

  return nationalDigits;
}

export const normalizeVietnamesePhoneNumber = standardizeVietnamesePhoneNumber;
export const standardizePhoneNumber = standardizeVietnamesePhoneNumber;
export const normalizePhoneNumber = standardizeVietnamesePhoneNumber;

export function isValidVietnamesePhoneNumber(input: string | null | undefined): boolean {
  return standardizeVietnamesePhoneNumber(input) !== null;
}

export interface PhoneValidationResult {
  isValid: boolean;
  phoneNumber: string | null;
  error?: string;
  originalInput: string | null | undefined;
}

export function validateVietnamesePhoneNumber(
  input: string | null | undefined,
): PhoneValidationResult {
  try {
    const standardized = standardizeVietnamesePhoneNumber(input, { throwOnError: true });
    return {
      isValid: true,
      phoneNumber: standardized,
      originalInput: input,
    };
  } catch (err) {
    return {
      isValid: false,
      phoneNumber: null,
      error: (err as Error).message,
      originalInput: input,
    };
  }
}

export type PhoneFormatStyle = 'compact' | 'dot' | 'space' | 'dash' | 'international';

export function formatVietnamesePhoneNumber(
  input: string | null | undefined,
  style: PhoneFormatStyle = 'compact',
): string | null {
  const standardized = standardizeVietnamesePhoneNumber(input);
  if (!standardized) return null;

  const part1 = standardized.slice(0, 4);
  const part2 = standardized.slice(4, 7);
  const part3 = standardized.slice(7, 10);

  switch (style) {
    case 'dot':
      return `${part1}.${part2}.${part3}`;
    case 'space':
      return `${part1} ${part2} ${part3}`;
    case 'dash':
      return `${part1}-${part2}-${part3}`;
    case 'international':
      return `+84 ${part1.slice(1)} ${part2} ${part3}`;
    case 'compact':
    default:
      return standardized;
  }
}

