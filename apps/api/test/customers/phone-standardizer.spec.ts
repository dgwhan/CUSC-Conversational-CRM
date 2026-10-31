import { describe, expect, it } from 'vitest';
import {
  standardizeVietnamesePhoneNumber,
  normalizeVietnamesePhoneNumber,
  isValidVietnamesePhoneNumber,
  validateVietnamesePhoneNumber,
  formatVietnamesePhoneNumber,
  InvalidPhoneNumberError,
} from '../../src/modules/customers/domain/phone-standardizer.js';

describe('CUS-03: Standardizing Vietnamese Phone Numbers', () => {
  describe('1. Yêu cầu nghiệp vụ cốt lõi (Core Acceptance Criteria)', () => {
    it('chuẩn hóa số có dấu chấm: 0912.345.678 -> 0912345678', () => {
      expect(standardizeVietnamesePhoneNumber('0912.345.678')).toBe('0912345678');
    });

    it('chuẩn hóa số có tiền tố +84 và khoảng trắng: +84 912 345 678 -> 0912345678', () => {
      expect(standardizeVietnamesePhoneNumber('+84 912 345 678')).toBe('0912345678');
    });

    it('chuẩn hóa số có tiền tố 84 viết liền: 84912345678 -> 0912345678', () => {
      expect(standardizeVietnamesePhoneNumber('84912345678')).toBe('0912345678');
    });

    it('hàm normalizeVietnamesePhoneNumber là bí danh hoạt động tương đương', () => {
      expect(normalizeVietnamesePhoneNumber('0912.345.678')).toBe('0912345678');
      expect(normalizeVietnamesePhoneNumber('+84 912 345 678')).toBe('0912345678');
      expect(normalizeVietnamesePhoneNumber('84912345678')).toBe('0912345678');
    });
  });

  describe('2. Xử lý các dạng định dạng có Dấu Chấm (Dots)', () => {
    it('chuẩn hóa định dạng phân đoạn 4.3.3: 0912.345.678', () => {
      expect(standardizeVietnamesePhoneNumber('0912.345.678')).toBe('0912345678');
    });

    it('chuẩn hóa định dạng phân đoạn 3.3.4: 091.234.5678', () => {
      expect(standardizeVietnamesePhoneNumber('091.234.5678')).toBe('0912345678');
    });

    it('chuẩn hóa định dạng phân đoạn 2.2.2.2.2: 09.12.34.56.78', () => {
      expect(standardizeVietnamesePhoneNumber('09.12.34.56.78')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố +84 kết hợp dấu chấm: +84.912.345.678', () => {
      expect(standardizeVietnamesePhoneNumber('+84.912.345.678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố 84 kết hợp dấu chấm: 84.912.345.678', () => {
      expect(standardizeVietnamesePhoneNumber('84.912.345.678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố +84 phân đoạn 2 chấm: +84.91.234.5678', () => {
      expect(standardizeVietnamesePhoneNumber('+84.91.234.5678')).toBe('0912345678');
    });
  });

  describe('3. Xử lý các dạng định dạng có Khoảng Trắng (Spaces)', () => {
    it('chuẩn hóa khoảng trắng phân tách tiêu chuẩn: 0912 345 678', () => {
      expect(standardizeVietnamesePhoneNumber('0912 345 678')).toBe('0912345678');
    });

    it('chuẩn hóa khoảng trắng phân tách 3 3 4: 091 234 5678', () => {
      expect(standardizeVietnamesePhoneNumber('091 234 5678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố 84 kèm khoảng trắng: 84 912 345 678', () => {
      expect(standardizeVietnamesePhoneNumber('84 912 345 678')).toBe('0912345678');
    });

    it('loại bỏ khoảng trắng ở đầu và cuối chuỗi (trimmed): "   0912345678   "', () => {
      expect(standardizeVietnamesePhoneNumber('   0912345678   ')).toBe('0912345678');
    });

    it('xử lý nhiều khoảng trắng liên tiếp giữa các số: "0912   345   678"', () => {
      expect(standardizeVietnamesePhoneNumber('0912   345   678')).toBe('0912345678');
    });

    it('xử lý nhiều khoảng trắng sau tiền tố +84: "+84   912   345   678"', () => {
      expect(standardizeVietnamesePhoneNumber('+84   912   345   678')).toBe('0912345678');
    });

    it('chuẩn hóa số có khoảng trắng giữa từng chữ số: "0 9 1 2 3 4 5 6 7 8"', () => {
      expect(standardizeVietnamesePhoneNumber('0 9 1 2 3 4 5 6 7 8')).toBe('0912345678');
    });

    it('xử lý ký tự tab (\\t) và xuống dòng (\\n) lẫn trong chuỗi', () => {
      expect(standardizeVietnamesePhoneNumber('\t0912 345 678\n')).toBe('0912345678');
    });
  });

  describe('4. Xử lý các dạng Tiền Tố Quốc Tế (+84, 84, 0084)', () => {
    it('chuẩn hóa tiền tố +84 viết liền: +84912345678', () => {
      expect(standardizeVietnamesePhoneNumber('+84912345678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố +84 kèm dấu gạch ngang: +84-912-345-678', () => {
      expect(standardizeVietnamesePhoneNumber('+84-912-345-678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố trong ngoặc đơn (+84): (+84) 912 345 678', () => {
      expect(standardizeVietnamesePhoneNumber('(+84) 912 345 678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố trong ngoặc đơn kết hợp dấu chấm: (+84) 912.345.678', () => {
      expect(standardizeVietnamesePhoneNumber('(+84) 912.345.678')).toBe('0912345678');
    });

    it('chuẩn hóa định dạng business card có số 0 trong ngoặc: +84 (0) 912 345 678', () => {
      expect(standardizeVietnamesePhoneNumber('+84 (0) 912 345 678')).toBe('0912345678');
    });

    it('chuẩn hóa định dạng (+84) (0) kết hợp: (+84) (0) 912.345.678', () => {
      expect(standardizeVietnamesePhoneNumber('(+84) (0) 912.345.678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố +84 viết liền cả số 0: +840912345678', () => {
      expect(standardizeVietnamesePhoneNumber('+840912345678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố 84 kèm dấu gạch ngang: 84-912-345-678', () => {
      expect(standardizeVietnamesePhoneNumber('84-912-345-678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố (84) trong ngoặc đơn: (84) 912 345 678', () => {
      expect(standardizeVietnamesePhoneNumber('(84) 912 345 678')).toBe('0912345678');
    });

    it('chuẩn hóa tiền tố quay số quốc tế 0084: 0084 912 345 678', () => {
      expect(standardizeVietnamesePhoneNumber('0084 912 345 678')).toBe('0912345678');
    });
  });

  describe('5. Hỗ trợ các đầu số nhà mạng lớn tại Việt Nam', () => {
    it('chuẩn hóa đầu số Viettel (03x, 086, 09x): +84 38 123 4567 -> 0381234567', () => {
      expect(standardizeVietnamesePhoneNumber('+84 38 123 4567')).toBe('0381234567');
      expect(standardizeVietnamesePhoneNumber('086.123.4567')).toBe('0861234567');
      expect(standardizeVietnamesePhoneNumber('84981234567')).toBe('0981234567');
    });

    it('chuẩn hóa đầu số Mobifone (07x, 089, 090/093): +84 77 123 4567 -> 0771234567', () => {
      expect(standardizeVietnamesePhoneNumber('+84 77 123 4567')).toBe('0771234567');
      expect(standardizeVietnamesePhoneNumber('070.345.6789')).toBe('0703456789');
      expect(standardizeVietnamesePhoneNumber('84901234567')).toBe('0901234567');
    });

    it('chuẩn hóa đầu số Vinaphone (081-085, 088, 091/094): 84881234567 -> 0881234567', () => {
      expect(standardizeVietnamesePhoneNumber('84881234567')).toBe('0881234567');
      expect(standardizeVietnamesePhoneNumber('083.456.7890')).toBe('0834567890');
      expect(standardizeVietnamesePhoneNumber('+84 94 123 4567')).toBe('0941234567');
    });

    it('chuẩn hóa đầu số Vietnamobile / Wintel (05x): +84 56 123 4567 -> 0561234567', () => {
      expect(standardizeVietnamesePhoneNumber('+84 56 123 4567')).toBe('0561234567');
      expect(standardizeVietnamesePhoneNumber('055.999.8888')).toBe('0559998888');
    });
  });

  describe('6. Từ chối các số sai độ dài (Length Rejection)', () => {
    it('từ chối số quá ngắn (9 chữ số nội địa): 091234567', () => {
      expect(standardizeVietnamesePhoneNumber('091234567')).toBeNull();
    });

    it('từ chối số quá dài (11 chữ số nội địa): 09123456789', () => {
      expect(standardizeVietnamesePhoneNumber('09123456789')).toBeNull();
    });

    it('từ chối số quá ngắn có dấu chấm: 0912.345.67', () => {
      expect(standardizeVietnamesePhoneNumber('0912.345.67')).toBeNull();
    });

    it('từ chối số quá dài có dấu chấm: 0912.345.6789', () => {
      expect(standardizeVietnamesePhoneNumber('0912.345.6789')).toBeNull();
    });

    it('từ chối số quá ngắn kèm tiền tố +84: +84 912 345 67', () => {
      expect(standardizeVietnamesePhoneNumber('+84 912 345 67')).toBeNull();
    });

    it('từ chối số quá dài kèm tiền tố +84: +84 912 345 6789', () => {
      expect(standardizeVietnamesePhoneNumber('+84 912 345 6789')).toBeNull();
    });

    it('từ chối số quá ngắn kèm tiền tố 84: 8491234567', () => {
      expect(standardizeVietnamesePhoneNumber('8491234567')).toBeNull();
    });

    it('từ chối số quá dài kèm tiền tố 84: 849123456789', () => {
      expect(standardizeVietnamesePhoneNumber('849123456789')).toBeNull();
    });

    it('từ chối số chỉ có 4 chữ số: 0912', () => {
      expect(standardizeVietnamesePhoneNumber('0912')).toBeNull();
    });

    it('từ chối khi chỉ truyền mã quốc gia +84', () => {
      expect(standardizeVietnamesePhoneNumber('+84')).toBeNull();
    });

    it('từ chối khi chỉ truyền mã quốc gia 84', () => {
      expect(standardizeVietnamesePhoneNumber('84')).toBeNull();
    });

    it('từ chối khi chỉ truyền chữ số 0', () => {
      expect(standardizeVietnamesePhoneNumber('0')).toBeNull();
    });

    it('từ chối chuỗi rỗng và chuỗi toàn khoảng trắng', () => {
      expect(standardizeVietnamesePhoneNumber('')).toBeNull();
      expect(standardizeVietnamesePhoneNumber('   ')).toBeNull();
    });

    it('từ chối khi đầu vào là null hoặc undefined', () => {
      expect(standardizeVietnamesePhoneNumber(null)).toBeNull();
      expect(standardizeVietnamesePhoneNumber(undefined)).toBeNull();
    });

    it('ném InvalidPhoneNumberError khi số sai độ dài nếu bật throwOnError: true', () => {
      expect(() => standardizeVietnamesePhoneNumber('091234567', { throwOnError: true })).toThrow(
        InvalidPhoneNumberError,
      );
      expect(() => standardizeVietnamesePhoneNumber('09123456789', { throwOnError: true })).toThrow(
        /Số điện thoại sai độ dài/,
      );
    });
  });

  describe('7. Từ chối ký tự và định dạng không hợp lệ khác', () => {
    it('từ chối số chứa ký tự chữ cái (letters): 0912.abc.678', () => {
      expect(standardizeVietnamesePhoneNumber('0912.abc.678')).toBeNull();
    });

    it('từ chối số chứa ký tự đặc biệt không được phép: 0912#345$678', () => {
      expect(standardizeVietnamesePhoneNumber('0912#345$678')).toBeNull();
    });

    it('từ chối số chứa nhiều hơn 1 dấu cộng (+)', () => {
      expect(standardizeVietnamesePhoneNumber('++84 912 345 678')).toBeNull();
      expect(standardizeVietnamesePhoneNumber('+84 +912 345 678')).toBeNull();
    });

    it('từ chối số có dấu cộng nằm ở giữa: 0912+345678', () => {
      expect(standardizeVietnamesePhoneNumber('0912+345678')).toBeNull();
    });

    it('từ chối số bắt đầu bằng mã quốc gia khác ngoài Việt Nam: +1 912 345 678', () => {
      expect(standardizeVietnamesePhoneNumber('+1 912 345 678')).toBeNull();
    });

    it('từ chối số không bắt đầu bằng 0 hoặc mã quốc gia Việt Nam: 1234567890', () => {
      expect(standardizeVietnamesePhoneNumber('1234567890')).toBeNull();
    });
  });

  describe('8. Các hàm tiện ích bổ trợ (Utility Helpers)', () => {
    it('isValidVietnamesePhoneNumber trả về true cho số hợp lệ và false cho số sai', () => {
      expect(isValidVietnamesePhoneNumber('0912.345.678')).toBe(true);
      expect(isValidVietnamesePhoneNumber('+84 912 345 678')).toBe(true);
      expect(isValidVietnamesePhoneNumber('84912345678')).toBe(true);
      expect(isValidVietnamesePhoneNumber('091234567')).toBe(false); // sai độ dài
      expect(isValidVietnamesePhoneNumber('09123456789')).toBe(false); // sai độ dài
      expect(isValidVietnamesePhoneNumber('0912.abc.678')).toBe(false);
    });

    it('validateVietnamesePhoneNumber trả về object kết quả chi tiết', () => {
      const validRes = validateVietnamesePhoneNumber('+84 912 345 678');
      expect(validRes.isValid).toBe(true);
      expect(validRes.phoneNumber).toBe('0912345678');
      expect(validRes.error).toBeUndefined();

      const invalidRes = validateVietnamesePhoneNumber('0912.345');
      expect(invalidRes.isValid).toBe(false);
      expect(invalidRes.phoneNumber).toBeNull();
      expect(invalidRes.error).toBeDefined();
    });

    it('formatVietnamesePhoneNumber định dạng hiển thị linh hoạt các kiểu', () => {
      const phone = '+84 912 345 678';
      expect(formatVietnamesePhoneNumber(phone, 'compact')).toBe('0912345678');
      expect(formatVietnamesePhoneNumber(phone, 'dot')).toBe('0912.345.678');
      expect(formatVietnamesePhoneNumber(phone, 'space')).toBe('0912 345 678');
      expect(formatVietnamesePhoneNumber(phone, 'dash')).toBe('0912-345-678');
      expect(formatVietnamesePhoneNumber(phone, 'international')).toBe('+84 912 345 678');
      expect(formatVietnamesePhoneNumber('invalid-number')).toBeNull();
    });
  });
});

