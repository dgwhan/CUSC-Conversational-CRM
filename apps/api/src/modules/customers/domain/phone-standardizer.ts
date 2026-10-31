
export interface StandardizePhoneOptions {
  /**
   * Nếu true, ném InvalidPhoneNumberError khi số điện thoại không hợp lệ hoặc sai độ dài.
   * Mặc định là false (trả về null khi bị từ chối).
   */
  throwOnError?: boolean;
}

export class InvalidPhoneNumberError extends Error {
  constructor(message: string = 'Số điện thoại không hợp lệ hoặc sai độ dài') {
    super(message);
    this.name = 'InvalidPhoneNumberError';
  }
}

/**
 * Biểu thức chính quy kiểm tra định dạng 10 chữ số chuẩn của Việt Nam bắt đầu bằng số 0
 */
export const VIETNAMESE_PHONE_STANDARD_REGEX = /^0[0-9]{9}$/;

/**
 * Biểu thức chính quy kiểm tra dải đầu số viễn thông hợp lệ tại Việt Nam:
 * - Di động: 03x (Viettel), 05x (Vietnamobile, Wintel), 07x (Mobifone), 08x (Vinaphone, Viettel...), 09x (Tất cả nhà mạng)
 * - Cố định: 02x
 */
export const VIETNAMESE_TELECOM_PREFIX_REGEX = /^0(2[0-9]|3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;

export interface PhoneValidationResult {
  isValid: boolean;
  phoneNumber: string | null;
  error?: string;
  originalInput: string | null | undefined;
}

/**
 * Chuẩn hóa số điện thoại Việt Nam về định dạng chuẩn 10 chữ số nội địa (0xxxxxxxxx).
 *
 * @example
 * standardizeVietnamesePhoneNumber('0912.345.678') // => '0912345678'
 * standardizeVietnamesePhoneNumber('+84 912 345 678') // => '0912345678'
 * standardizeVietnamesePhoneNumber('84912345678') // => '0912345678'
 * standardizeVietnamesePhoneNumber('091234567') // => null (sai độ dài bị từ chối)
 * standardizeVietnamesePhoneNumber('091234567', { throwOnError: true }) // => throws InvalidPhoneNumberError
 */
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

  // Chỉ cho phép: số (0-9), dấu +, dấu chấm, khoảng trắng, gạch nối, dấu ngoặc đơn
  const allowedCharsPattern = /^[0-9+\s.\-–—()]+$/;
  if (!allowedCharsPattern.test(trimmed)) {
    return reject('Số điện thoại chứa ký tự đặc biệt hoặc chữ cái không hợp lệ');
  }

  // Dấu cộng (+) chỉ được xuất hiện tối đa 1 lần và bắt buộc ở vị trí đầu
  const plusOccurrences = (trimmed.match(/\+/g) || []).length;
  if (plusOccurrences > 1) {
    return reject('Số điện thoại không được chứa nhiều hơn một dấu cộng (+)');
  }
  if (plusOccurrences === 1) {
    const firstNonWrapperChar = trimmed.replace(/^[\s(]+/, '')[0];
    if (firstNonWrapperChar !== '+') {
      return reject('Dấu cộng (+) chỉ được phép đặt ở đầu mã quốc gia');
    }
  }

  // Loại bỏ các ký tự định dạng thị giác (khoảng trắng, dấu chấm, dấu gạch nối, dấu ngoặc)
  const clean = trimmed.replace(/[\s.\-–—()]/g, '');

  let nationalDigits = '';

  if (clean.startsWith('+84')) {
    // Trường hợp tiền tố quốc tế +84
    let remainder = clean.slice(3);
    if (remainder.startsWith('0')) {
      remainder = remainder.slice(1);
    }
    nationalDigits = '0' + remainder;
  } else if (clean.startsWith('0084')) {
    // Trường hợp tiền tố quay số quốc tế 0084
    let remainder = clean.slice(4);
    if (remainder.startsWith('0')) {
      remainder = remainder.slice(1);
    }
    nationalDigits = '0' + remainder;
  } else if (clean.startsWith('84')) {
    // Trường hợp tiền tố 84 không có dấu +
    let remainder = clean.slice(2);
    if (remainder.startsWith('0')) {
      remainder = remainder.slice(1);
    }
    nationalDigits = '0' + remainder;
  } else if (clean.startsWith('0')) {
    // Trường hợp số nội địa bắt đầu bằng 0
    nationalDigits = clean;
  } else {
    return reject('Số điện thoại không thuộc định dạng Việt Nam hợp lệ (phải bắt đầu bằng 0, 84 hoặc +84)');
  }

  // Kiểm tra độ dài: Số điện thoại chuẩn Việt Nam bắt buộc gồm đúng 10 chữ số
  if (nationalDigits.length !== 10) {
    return reject(`Số điện thoại sai độ dài (yêu cầu đúng 10 chữ số, nhận được ${nationalDigits.length})`);
  }

  // Phải bắt đầu bằng chữ số 0 và tiếp theo là 9 chữ số
  if (!VIETNAMESE_PHONE_STANDARD_REGEX.test(nationalDigits)) {
    return reject('Số điện thoại không hợp lệ sau khi chuẩn hóa');
  }

  return nationalDigits;
}

/**
 * Bí danh (alias) tương đương với standardizeVietnamesePhoneNumber
 */
export const normalizeVietnamesePhoneNumber = standardizeVietnamesePhoneNumber;
export const standardizePhoneNumber = standardizeVietnamesePhoneNumber;
export const normalizePhoneNumber = standardizeVietnamesePhoneNumber;

/**
 * Kiểm tra xem chuỗi có phải là số điện thoại Việt Nam hợp lệ (đúng độ dài và cấu trúc) hay không.
 */
export function isValidVietnamesePhoneNumber(input: string | null | undefined): boolean {
  return standardizeVietnamesePhoneNumber(input) !== null;
}

/**
 * Xác thực chi tiết số điện thoại Việt Nam, trả về object chứa trạng thái và lý do lỗi nếu có.
 */
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

/**
 * Định dạng số điện thoại đã chuẩn hóa theo các kiểu trình bày phổ biến
 *
 * @example
 * formatVietnamesePhoneNumber('0912345678', 'dot') // => '0912.345.678'
 * formatVietnamesePhoneNumber('0912345678', 'space') // => '0912 345 678'
 * formatVietnamesePhoneNumber('0912345678', 'international') // => '+84 912 345 678'
 * formatVietnamesePhoneNumber('0912345678', 'dash') // => '0912-345-678'
 */
export function formatVietnamesePhoneNumber(
  input: string | null | undefined,
  style: PhoneFormatStyle = 'compact',
): string | null {
  const standardized = standardizeVietnamesePhoneNumber(input);
  if (!standardized) return null;

  // 10 số: 4 số đầu + 3 số giữa + 3 số cuối (0912 345 678)
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

