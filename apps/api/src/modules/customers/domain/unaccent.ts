/**
 * Tiện ích loại bỏ dấu tiếng Việt (Unaccent)
 * Phục vụ cho tìm kiếm thông minh không phân biệt dấu và chữ hoa/thường 
 */
export function removeVietnameseTones(str?: unknown): string {
  if (typeof str !== 'string' || !str) return '';

  return str
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
  return normTarget.includes(normKeyword);
}

