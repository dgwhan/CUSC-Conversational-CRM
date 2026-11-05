import type {
  ChatMessage,
  ConversationClassificationData,
  ConversationTier,
} from '../types.js';
import { removeVietnameseTones } from '../../../lib/unaccent.js';
import { standardizeVietnamesePhoneNumber } from '../../../lib/phone.js';

interface ScoringRuleDef {
  id: string;
  keyword: string;
  normKeyword: string;
  points: number;
  group: 'QUAN_TAM' | 'SAN_SANG_DANG_KY' | 'HO_SO' | 'LOAI_TRU';
}

const DEFAULT_RULES: ScoringRuleDef[] = [
  // 1. Quan tâm báo giá, chi phí, giải pháp / dịch vụ
  { id: 'r_bg', keyword: 'báo giá', normKeyword: 'bao gia', points: 3, group: 'QUAN_TAM' },
  { id: 'r_cp', keyword: 'chi phí', normKeyword: 'chi phi', points: 3, group: 'QUAN_TAM' },
  { id: 'r_gia', keyword: 'giá', normKeyword: 'gia', points: 3, group: 'QUAN_TAM' },
  { id: 'r_hp', keyword: 'học phí', normKeyword: 'hoc phi', points: 3, group: 'QUAN_TAM' },
  { id: 'r_lh', keyword: 'lịch hẹn', normKeyword: 'lich hen', points: 3, group: 'QUAN_TAM' },
  { id: 'r_lt', keyword: 'lộ trình', normKeyword: 'lo trinh', points: 3, group: 'QUAN_TAM' },
  { id: 'r_tv', keyword: 'tư vấn', normKeyword: 'tu van', points: 2, group: 'QUAN_TAM' },
  { id: 'r_dv', keyword: 'dịch vụ', normKeyword: 'dich vu', points: 2, group: 'QUAN_TAM' },
  { id: 'r_sp', keyword: 'sản phẩm', normKeyword: 'san pham', points: 2, group: 'QUAN_TAM' },
  { id: 'r_kh', keyword: 'khóa học', normKeyword: 'khoa hoc', points: 2, group: 'QUAN_TAM' },

  // 2. Sẵn sàng chốt nhu cầu / ký kết / đăng ký
  { id: 'r_dk', keyword: 'đăng ký', normKeyword: 'dang ky', points: 5, group: 'SAN_SANG_DANG_KY' },
  { id: 'r_mua', keyword: 'mua', normKeyword: 'mua', points: 5, group: 'SAN_SANG_DANG_KY' },
  { id: 'r_hd', keyword: 'hợp đồng', normKeyword: 'hop dong', points: 5, group: 'SAN_SANG_DANG_KY' },
  { id: 'r_gc', keyword: 'giữ chỗ', normKeyword: 'giu cho', points: 5, group: 'SAN_SANG_DANG_KY' },
  { id: 'r_nh', keyword: 'nhập học', normKeyword: 'nhap hoc', points: 5, group: 'SAN_SANG_DANG_KY' },

  // 3. Hồ sơ & thông tin xác nhận
  { id: 'r_cccd', keyword: 'cccd', normKeyword: 'cccd', points: 3, group: 'HO_SO' },
  { id: 'r_email', keyword: 'email', normKeyword: 'email', points: 3, group: 'HO_SO' },
  { id: 'r_hs', keyword: 'hồ sơ', normKeyword: 'ho so', points: 3, group: 'HO_SO' },
  { id: 'r_hb', keyword: 'học bạ', normKeyword: 'hoc ba', points: 3, group: 'HO_SO' },
  { id: 'r_gks', keyword: 'giấy khai sinh', normKeyword: 'giay khai sinh', points: 3, group: 'HO_SO' },

  // 4. Loại trừ
  { id: 'r_td', keyword: 'tuyển dụng', normKeyword: 'tuyen dung', points: -100, group: 'LOAI_TRU' },
  { id: 'r_xv', keyword: 'xin việc', normKeyword: 'xin viec', points: -100, group: 'LOAI_TRU' },
  { id: 'r_spam', keyword: 'spam', normKeyword: 'spam', points: -100, group: 'LOAI_TRU' },
];

const NEGATION_MARKERS = [
  'khong',
  'chua',
  'ko',
  'k0',
  'k',
  'hong',
  'chang',
  'dung',
  'huy',
  'thoi',
  'khoi',
];

const NEGATION_POST_MARKERS = [
  'dau',
  'nua',
  'gi dau',
  'chi nua',
];

/**
 * Kiểm tra xem từ khóa có bị phủ định trong câu hay không
 */
function isKeywordNegatedInText(normText: string, normKw: string): boolean {
  if (!normText.includes(normKw)) return false;

  const clauses = normText.split(/[,.;!?\n]+/).map((c) => c.trim()).filter(Boolean);

  for (const clause of clauses) {
    if (!clause.includes(normKw)) continue;

    const words = clause.split(/\s+/);
    const kwTokens = normKw.split(/\s+/);
    const kwLen = kwTokens.length;

    for (let i = 0; i <= words.length - kwLen; i++) {
      if (words.slice(i, i + kwLen).join(' ') === normKw) {
        // Kiểm tra tiền từ (1 đến 4 từ đứng trước)
        const prefix = words.slice(Math.max(0, i - 4), i).join(' ');
        for (const marker of NEGATION_MARKERS) {
          if (new RegExp(`\\b${marker}\\b`, 'i').test(prefix)) {
            return true;
          }
        }

        // Kiểm tra hậu từ (1 đến 2 từ đứng sau: "đâu", "nữa")
        const suffix = words.slice(i + kwLen, Math.min(words.length, i + kwLen + 2)).join(' ');
        for (const postMarker of NEGATION_POST_MARKERS) {
          if (new RegExp(`\\b${postMarker}\\b`, 'i').test(suffix)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Chuẩn hóa tin nhắn và mở rộng từ viết tắt cơ bản (hp, bn, dk, cccd, hb)
 */
function normalizeClientText(text: string): string {
  let norm = removeVietnameseTones(text);

  // Mở rộng từ viết tắt thông dụng
  norm = norm
    .replace(/\bhp\b/gi, 'hoc phi')
    .replace(/\bbn\b|\bbnhieu\b|\bbnh\b/gi, 'bao nhieu')
    .replace(/\bdk\b|\bdky\b/gi, 'dang ky')
    .replace(/\bib\b|\binb\b/gi, 'inbox')
    .replace(/\bsdt\b|\bdt\b/gi, 'so dien thoai')
    .replace(/\bhb\b/gi, 'hoc ba')
    .replace(/\bgks\b/gi, 'giay khai sinh');

  return norm;
}

/**
 * Đánh giá điểm và phân loại hội thoại động DỰA TRÊN THÔNG TIN VÀ TIN NHẮN THỰC TẾ
 */
export function evaluateConversationScore(
  messages: ChatMessage[] = [],
  customerPhone?: string
): ConversationClassificationData {
  const matchedReasons: Array<{ keyword: string; points: number }> = [];
  const appliedRuleIds = new Set<string>();
  let isExcluded = false;

  // 1. Quét toàn bộ tin nhắn trao đổi trong hội thoại
  // Khách hàng là người gửi (INBOUND hoặc tin nhắn trò chuyện)
  for (const msg of messages) {
    const rawContent = msg.content || '';
    if (!rawContent.trim()) continue;

    // Chỉ tính tin nhắn của khách (INBOUND) để đánh giá ý định của thí sinh
    if (msg.direction === 'OUTBOUND') continue;

    const normContent = normalizeClientText(rawContent);

    for (const rule of DEFAULT_RULES) {
      if (appliedRuleIds.has(rule.id)) continue;

      if (normContent.includes(rule.normKeyword)) {
        // Kiểm tra phủ định (ví dụ: "không đăng ký đâu")
        if (isKeywordNegatedInText(normContent, rule.normKeyword)) {
          continue;
        }

        appliedRuleIds.add(rule.id);
        matchedReasons.push({
          keyword: rule.keyword,
          points: rule.points,
        });

        if (rule.group === 'LOAI_TRU') {
          isExcluded = true;
        }
      }
    }
  }

  // 2. Kiểm tra xem có Số Điện Thoại hay không (từ thông tin khách hàng hoặc trong tin nhắn)
  let hasValidPhone = false;

  if (customerPhone && customerPhone !== 'Chưa có SĐT' && !customerPhone.includes('**')) {
    const std = standardizeVietnamesePhoneNumber(customerPhone);
    if (std) hasValidPhone = true;
  }

  if (!hasValidPhone) {
    for (const msg of messages) {
      if (msg.direction === 'OUTBOUND') continue;
      const phoneMatch = (msg.content || '').match(/(?:\+84|0)(?:[\s.\-–—]?[0-9]){9}\b/);
      if (phoneMatch) {
        const std = standardizeVietnamesePhoneNumber(phoneMatch[0]);
        if (std) {
          hasValidPhone = true;
          break;
        }
      }
    }
  }

  if (hasValidPhone) {
    matchedReasons.push({
      keyword: 'SĐT',
      points: 5,
    });
  }

  // 3. Tính tổng điểm
  let totalScore = 0;
  for (const r of matchedReasons) {
    totalScore += r.points;
  }

  if (isExcluded || totalScore < 0) {
    totalScore = 0;
  }

  // 4. Xác định Tier
  let tier: ConversationTier = 'IRRELEVANT';
  if (!isExcluded && totalScore >= 8) {
    tier = 'HOT';
  } else if (!isExcluded && totalScore >= 4) {
    tier = 'WARM';
  } else if (!isExcluded && totalScore >= 1) {
    tier = 'COLD';
  } else {
    tier = 'IRRELEVANT';
  }

  // 5. Chuỗi giải trình
  const reasonsFormatted =
    matchedReasons.length > 0
      ? matchedReasons.map((r) => `${r.keyword} ${r.points >= 0 ? `+${r.points}` : r.points}`).join(', ')
      : 'Chưa phát hiện từ khóa quan tâm';

  return {
    score: totalScore,
    tier,
    reasons: matchedReasons,
    reasonsFormatted,
  };
}

