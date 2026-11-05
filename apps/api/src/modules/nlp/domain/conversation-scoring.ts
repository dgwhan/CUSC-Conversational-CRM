/**
 * Domain Logic: Chấm điểm & Phân loại Hội thoại Tuyển sinh (Pure Function)
 * Tuân thủ Clean Architecture: Hàm thuần không phụ thuộc I/O hay CSDL.
 */

import { normalize } from '../text-normalizer.js';
import { extractEntities, type CatalogProductItem, type ExtractedEntitiesResult } from '../entity-extractor.js';
import { isKeywordNegated } from './negation-detector.js';
import type { KeywordRuleItem } from '../keyword-scoring.js';

export type ConversationTier = 'HOT' | 'WARM' | 'COLD' | 'IRRELEVANT';

export interface ScoringThresholdConfig {
  hotMinScore: number;       // Mặc định: 8 (Nóng từ 8 điểm trở lên)
  warmMinScore: number;      // Mặc định: 4 (Ấm từ 4 đến 7 điểm)
  coldMinScore: number;      // Mặc định: 1 (Lạnh từ 1 đến 3 điểm)
  phoneBonusScore?: number;  // Mặc định: 5 (Cộng điểm thưởng khi phát hiện SĐT)
}

export const DEFAULT_SCORING_THRESHOLDS: ScoringThresholdConfig = {
  hotMinScore: 8,
  warmMinScore: 4,
  coldMinScore: 1,
  phoneBonusScore: 5,
};

export interface MatchedReasonItem {
  keyword: string;
  points: number;
  ruleId?: string;
  group?: string;
  sourceMessageIndex?: number;
}

export interface ConversationScoreResult {
  score: number;
  tier: ConversationTier;
  reasons: MatchedReasonItem[];
  reasonsFormatted: string; // Định dạng cho Sales: "học phí +3, đăng ký +5, có SĐT +5"
  entities: ExtractedEntitiesResult;
  isExcluded: boolean;
}

export type ConversationMessageInput =
  | string
  | {
      id?: string;
      content?: string | null;
      senderRole?: 'CUSTOMER' | 'STAFF' | 'BOT' | string;
    };

/**
 * Hàm thuần chấm điểm toàn bộ hội thoại: scoreConversation(messages, rules, thresholdConfig)
 *
 * Tiêu chí cốt lõi:
 * 1. Cộng dồn điểm theo toàn bộ hội thoại.
 * 2. Mỗi luật chỉ tính một lần duy nhất (Deduplication).
 * 3. Xử lý câu phủ định ("không đăng ký đâu" -> không tính điểm đăng ký).
 * 4. Phát hiện SĐT hợp lệ CUS-03 -> tự động cộng điểm "có SĐT +5".
 * 5. Phân hạng nhiệt độ theo cấu hình:
 *    - Nóng: >= hotMinScore (8)
 *    - Ấm: >= warmMinScore (4..7)
 *    - Lạnh: >= coldMinScore (1..3)
 *    - Không liên quan: 0 hoặc bị loại trừ
 * 6. Trả về chuỗi giải trình lý do minh bạch cho Sales (VD: "học phí +3, đăng ký +5, có SĐT +5").
 */
export function scoreConversation(
  messages: ConversationMessageInput[],
  rules: KeywordRuleItem[] = [],
  thresholdConfig: Partial<ScoringThresholdConfig> = {},
  catalog: CatalogProductItem[] = []
): ConversationScoreResult {
  const config: ScoringThresholdConfig = {
    ...DEFAULT_SCORING_THRESHOLDS,
    ...thresholdConfig,
  };

  const phoneBonus = config.phoneBonusScore ?? 5;

  // 1. Chuẩn hóa danh sách chuỗi tin nhắn đầu vào
  const messageTexts: string[] = [];
  for (const msg of messages) {
    if (!msg) continue;
    if (typeof msg === 'string') {
      if (msg.trim()) messageTexts.push(msg.trim());
    } else if (typeof msg === 'object' && msg.content) {
      // Chỉ tính tin nhắn từ phía khách hàng nếu có phân quyền senderRole
      if (msg.senderRole && msg.senderRole !== 'CUSTOMER' && msg.senderRole !== 'user') {
        continue;
      }
      if (msg.content.trim()) messageTexts.push(msg.content.trim());
    }
  }

  // Kết hợp nội dung toàn bộ hội thoại để trích xuất thực thể
  const combinedRawText = messageTexts.join('\n');
  const entities = extractEntities(combinedRawText, catalog);

  const matchedReasons: MatchedReasonItem[] = [];
  const appliedRuleIds = new Set<string>();
  const appliedKeywords = new Set<string>();
  let isExcluded = false;

  // Lọc danh sách luật đang kích hoạt (isActive === true)
  const activeRules = rules.filter((r) => r.isActive !== false);

  // 2. Quét qua từng tin nhắn để khớp luật từ khóa
  for (let msgIdx = 0; msgIdx < messageTexts.length; msgIdx++) {
    const rawMsg = messageTexts[msgIdx];
    const normMsg = normalize(rawMsg);
    if (!normMsg) continue;

    for (const rule of activeRules) {
      // Tiêu chí: Mỗi luật chỉ tính một lần duy nhất trong cả cuộc hội thoại
      if (appliedRuleIds.has(rule.id) || appliedKeywords.has(rule.keyword.toLowerCase())) {
        continue;
      }

      const normKeyword = normalize(rule.keyword);
      if (!normKeyword) continue;

      // Kiểm tra sự xuất hiện của từ khóa theo ranh giới từ
      const regex = new RegExp(`\\b${normKeyword}\\b`, 'i');
      if (regex.test(normMsg)) {
        // Kiểm tra xem từ khóa có bị phủ định trong ngữ cảnh câu không
        const negated = isKeywordNegated(normMsg, normKeyword);
        if (negated) {
          // Nếu bị phủ định (VD: "không đăng ký đâu"), KHÔNG tính điểm cho luật này
          continue;
        }

        // Ghi nhận luật đã áp dụng
        appliedRuleIds.add(rule.id);
        appliedKeywords.add(rule.keyword.toLowerCase());

        matchedReasons.push({
          keyword: rule.keyword,
          points: rule.weight,
          ruleId: rule.id,
          group: rule.group,
          sourceMessageIndex: msgIdx,
        });

        if (rule.group === 'LOAI_TRU' || rule.weight <= -50) {
          isExcluded = true;
        }
      }
    }
  }

  // 3. Thưởng điểm Số Điện Thoại hợp lệ chuẩn CUS-03
  if (entities.phoneNumber) {
    matchedReasons.push({
      keyword: 'có SĐT',
      points: phoneBonus,
      group: 'THUC_THE',
    });
  }

  // 4. Tính toán tổng điểm tích lũy
  let totalScore = 0;
  for (const reason of matchedReasons) {
    totalScore += reason.points;
  }

  // Nếu bị đánh dấu loại trừ hoặc điểm < 0, chuẩn hóa điểm
  if (isExcluded && totalScore > 0) {
    totalScore = -100;
  }

  // 5. Xác định Phân hạng nhiệt độ (Tier) dựa theo ngưỡng điểm động
  let tier: ConversationTier = 'IRRELEVANT';

  if (isExcluded || totalScore <= 0) {
    tier = 'IRRELEVANT';
  } else if (totalScore >= config.hotMinScore) {
    tier = 'HOT';
  } else if (totalScore >= config.warmMinScore) {
    tier = 'WARM';
  } else if (totalScore >= config.coldMinScore) {
    tier = 'COLD';
  } else {
    tier = 'IRRELEVANT';
  }

  // 6. Định dạng chuỗi giải trình lý do minh bạch cho Sales
  // Ví dụ yêu cầu nghiệm thu: "học phí +3, đăng ký +5, có SĐT +5"
  const formattedParts = matchedReasons.map((r) => {
    const sign = r.points >= 0 ? `+${r.points}` : `${r.points}`;
    return `${r.keyword} ${sign}`;
  });
  const reasonsFormatted = formattedParts.join(', ');

  return {
    score: totalScore,
    tier,
    reasons: matchedReasons,
    reasonsFormatted,
    entities,
    isExcluded,
  };
}

