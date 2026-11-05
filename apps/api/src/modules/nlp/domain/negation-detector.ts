/**
 * Bộ phát hiện ngữ cảnh phủ định trong tiếng Việt tự nhiên (Negation Context Engine)
 * Xử lý các mẫu câu từ chối, hủy, không có nhu cầu như:
 * - "không đăng ký đâu", "chưa muốn học", "đừng gọi nữa", "ko cần tư vấn"
 */

import { stripVietnameseAccents } from '../text-normalizer.js';

// Danh sách từ/cụm từ chỉ sự phủ định trong tiếng Việt (đã bỏ dấu và chữ thường)
export const NEGATION_MARKERS = [
  'khong',
  'chua',
  'ko',
  'k0',
  'k',
  'hong',
  'hong co',
  'chang',
  'dung',
  'dung co',
  'huy',
  'ngung',
  'thoi',
  'khoi',
  'chua tung',
  'khong he',
  'chua muon',
  'khong muon',
  'ko muon',
  'khong can',
  'ko can',
];

// Trợ từ/hậu từ phủ định hoặc nhấn mạnh phủ định đứng sau
export const NEGATION_POST_MARKERS = [
  'dau',
  'nua',
  'gi dau',
  'chi nua',
  'dau a',
  'dau nhe',
];

/**
 * Kiểm tra xem một từ khóa mục tiêu (ví dụ "dang ky", "hoc", "tu van")
 * có bị phủ định trong câu văn hay không.
 *
 * @param normalizedText Văn bản đã qua hàm normalize() (chữ thường, không dấu)
 * @param normalizedKeyword Từ khóa quy tắc (chữ thường, không dấu)
 * @param maxWindowDistance Khoảng cách số từ tối đa về phía trước để phát hiện từ phủ định (mặc định 4 từ)
 */
export function isKeywordNegated(
  normalizedText: string,
  normalizedKeyword: string,
  maxWindowDistance: number = 4
): boolean {
  if (!normalizedText || !normalizedKeyword) return false;

  const cleanText = stripVietnameseAccents(normalizedText.toLowerCase()).trim();
  const cleanKeyword = stripVietnameseAccents(normalizedKeyword.toLowerCase()).trim();

  // Tách câu thành các mệnh đề/cụm từ theo dấu chấm câu hoặc liên từ ngắt
  const clauses = cleanText.split(/[,.;!?\n]+/).map((c) => c.trim()).filter(Boolean);

  for (const clause of clauses) {
    if (!clause.includes(cleanKeyword)) continue;

    const words = clause.split(/\s+/);
    const keywordTokens = cleanKeyword.split(/\s+/);
    const kwLength = keywordTokens.length;

    // Tìm tất cả vị trí xuất hiện của keyword trong mệnh đề
    for (let i = 0; i <= words.length - kwLength; i++) {
      const windowTokens = words.slice(i, i + kwLength);
      if (windowTokens.join(' ') === cleanKeyword) {
        // 1. Kiểm tra tiền từ (Prefix Window): 1 đến maxWindowDistance từ đứng ngay trước
        const startIndex = Math.max(0, i - maxWindowDistance);
        const prefixTokens = words.slice(startIndex, i);
        const prefixStr = prefixTokens.join(' ');

        for (const marker of NEGATION_MARKERS) {
          // Khớp ranh giới từ của từ phủ định trong chuỗi tiền tố
          const markerRegex = new RegExp(`\\b${marker}\\b`, 'i');
          if (markerRegex.test(prefixStr)) {
            return true;
          }
        }

        // 2. Kiểm tra hậu từ (Suffix Window): 1 đến 2 từ đứng ngay sau (VD: "đăng ký đâu", "học chi nữa")
        const endIndex = Math.min(words.length, i + kwLength + 2);
        const suffixTokens = words.slice(i + kwLength, endIndex);
        const suffixStr = suffixTokens.join(' ');

        for (const postMarker of NEGATION_POST_MARKERS) {
          const postRegex = new RegExp(`\\b${postMarker}\\b`, 'i');
          if (postRegex.test(suffixStr)) {
            // Nếu có hậu từ phủ định (như "đâu", "nữa") kết hợp với tiền tố phủ định hoặc đứng một mình
            return true;
          }
        }
      }
    }
  }

  return false;
}
