import { standardizeVietnamesePhoneNumber } from './phone.js';

/**
 * Tiện ích chuẩn hóa và bỏ dấu tiếng Việt 
 * Hỗ trợ tìm kiếm thông minh không phân biệt dấu và chữ hoa/thường 
 * An toàn tuyệt đối với mọi kiểu dữ liệu (string, number, array, object, null, undefined).
 */
export function removeVietnameseTones(str?: unknown): string {
  if (str === null || str === undefined) return '';

  let text: string;
  if (typeof str === 'string') {
    text = str;
  } else if (typeof str === 'number') {
    text = String(str);
  } else if (Array.isArray(str)) {
    text = str
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'content' in item) {
          return String((item as any).content || '');
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
  } else if (typeof str === 'object') {
    if ('content' in (str as any)) {
      text = String((str as any).content || '');
    } else if ('name' in (str as any)) {
      text = String((str as any).name || '');
    } else {
      return '';
    }
  } else {
    return '';
  }

  if (!text || typeof text.normalize !== 'function') {
    return '';
  }

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();
}

/**
 * Kiểm tra xem chuỗi văn bản (target) có chứa từ khóa (keyword) sau khi đã bỏ dấu hay không
 */
export function matchesUnaccent(target?: unknown, keyword?: unknown): boolean {
  if (!target || !keyword) return false;
  const normTarget = removeVietnameseTones(target);
  const normKeyword = removeVietnameseTones(keyword);
  if (!normTarget || !normKeyword) return false;
  return normTarget.includes(normKeyword);
}

/**
 * Bộ kiểm tra tìm kiếm đa năng:
 * - Tìm theo họ tên không dấu (ví dụ: "nguyen van a" -> "Nguyễn Văn A")
 * - Tìm theo số điện thoại (bỏ qua dấu chấm, gạch ngang, khoảng trắng, đầu số quốc tế +84)
 * - Tìm theo email, ghi chú (notes dạng chuỗi hoặc mảng InternalNote[]), nội dung tin nhắn, danh sách tags
 */
export function matchesSmartSearch(
  item: {
    fullName?: string;
    phone?: string;
    email?: string;
    notes?: any;
    snippet?: string;
    tags?: string[];
    interestCourses?: string[];
  },
  keyword?: string | null
): boolean {
  if (!keyword || !keyword.trim()) return true;
  const rawQ = keyword.trim();
  const lowerQ = rawQ.toLowerCase();

  // 1. Kiểm tra so khớp không dấu trên tên
  if (item.fullName && matchesUnaccent(item.fullName, rawQ)) {
    return true;
  }

  // 2. Kiểm tra so khớp trên số điện thoại
  const rawDigits = rawQ.replace(/\D/g, '');
  if (rawDigits.length >= 3 && item.phone) {
    const itemDigits = String(item.phone).replace(/\D/g, '');
    if (itemDigits.includes(rawDigits)) return true;

    // Chuẩn hóa SĐT nếu đủ độ dài
    if (rawDigits.length >= 7) {
      const stdQ = standardizeVietnamesePhoneNumber(rawDigits);
      const stdItem = standardizeVietnamesePhoneNumber(itemDigits);
      if (stdQ && stdItem && stdQ === stdItem) return true;
    }
  }

  // 3. Kiểm tra email
  if (item.email && String(item.email).toLowerCase().includes(lowerQ)) {
    return true;
  }

  // 4. Kiểm tra ghi chú (notes) - hỗ trợ cả chuỗi String hoặc mảng InternalNote[]
  if (item.notes) {
    if (typeof item.notes === 'string') {
      if (matchesUnaccent(item.notes, rawQ)) return true;
    } else if (Array.isArray(item.notes)) {
      const noteMatched = item.notes.some((n: any) => {
        const content = typeof n === 'string' ? n : n?.content;
        return content && matchesUnaccent(content, rawQ);
      });
      if (noteMatched) return true;
    }
  }

  // 5. Kiểm tra snippet (nội dung tin nhắn gần nhất) không dấu
  if (item.snippet && matchesUnaccent(item.snippet, rawQ)) {
    return true;
  }

  // 6. Kiểm tra danh sách tags
  if (Array.isArray(item.tags) && item.tags.some((t) => matchesUnaccent(t, rawQ))) {
    return true;
  }

  // 7. Kiểm tra danh sách khóa học quan tâm
  if (Array.isArray(item.interestCourses) && item.interestCourses.some((c) => matchesUnaccent(c, rawQ))) {
    return true;
  }

  return false;
}
