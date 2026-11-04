import { normalize } from './text-normalizer.js';

export type KeywordRuleGroup =
  | 'QUAN_TAM'
  | 'QUAN_TAM_SAU'
  | 'SAN_SANG_DANG_KY'
  | 'HO_SO'
  | 'LOAI_TRU';

export interface KeywordRuleItem {
  id: string;
  workspaceId?: string;
  group: KeywordRuleGroup | string;
  keyword: string;
  weight: number;
  isActive: boolean;
  description?: string;
}

/**
 * Bộ quy tắc từ khóa mẫu ban đầu (Initial Seed Rules)
 */
export const INITIAL_SEED_KEYWORD_RULES: KeywordRuleItem[] = [
  // 1. Nhóm Quan tâm cơ bản (+10 điểm)
  {
    id: 'seed-rule-qt-1',
    group: 'QUAN_TAM',
    keyword: 'hoc phi',
    weight: 10,
    isActive: true,
    description: 'Khách hỏi học phí chung',
  },
  {
    id: 'seed-rule-qt-2',
    group: 'QUAN_TAM',
    keyword: 'khoa hoc',
    weight: 10,
    isActive: true,
    description: 'Khách hỏi thông tin khóa học',
  },
  {
    id: 'seed-rule-qt-3',
    group: 'QUAN_TAM',
    keyword: 'nganh dao tao',
    weight: 10,
    isActive: true,
    description: 'Khách hỏi các ngành đào tạo',
  },
  {
    id: 'seed-rule-qt-4',
    group: 'QUAN_TAM',
    keyword: 'thoi gian hoc',
    weight: 10,
    isActive: true,
    description: 'Khách hỏi thời lượng khóa học',
  },
  {
    id: 'seed-rule-qt-5',
    group: 'QUAN_TAM',
    keyword: 'tu van',
    weight: 10,
    isActive: true,
    description: 'Khách yêu cầu tư vấn',
  },

  // 2. Nhóm Quan tâm sâu (+25 điểm)
  {
    id: 'seed-rule-qts-1',
    group: 'QUAN_TAM_SAU',
    keyword: 'hoc phi bao nhieu',
    weight: 25,
    isActive: true,
    description: 'Khách hỏi học phí cụ thể (hp bn)',
  },
  {
    id: 'seed-rule-qts-2',
    group: 'QUAN_TAM_SAU',
    keyword: 'lich hoc chi tiet',
    weight: 25,
    isActive: true,
    description: 'Khách hỏi lịch học các buổi trong tuần',
  },
  {
    id: 'seed-rule-qts-3',
    group: 'QUAN_TAM_SAU',
    keyword: 'giang vien',
    weight: 25,
    isActive: true,
    description: 'Khách quan tâm chất lượng giảng viên',
  },
  {
    id: 'seed-rule-qts-4',
    group: 'QUAN_TAM_SAU',
    keyword: 'cam ket viec lam',
    weight: 25,
    isActive: true,
    description: 'Khách hỏi chính sách đầu ra việc làm',
  },
  {
    id: 'seed-rule-qts-5',
    group: 'QUAN_TAM_SAU',
    keyword: 'hoc online hay offline',
    weight: 25,
    isActive: true,
    description: 'Khách hỏi hình thức học trực tiếp hay từ xa',
  },

  // 3. Nhóm Sẵn sàng đăng ký (+50 điểm)
  {
    id: 'seed-rule-sdk-1',
    group: 'SAN_SANG_DANG_KY',
    keyword: 'chuyen khoan coc',
    weight: 50,
    isActive: true,
    description: 'Khách muốn đặt cọc giữ chỗ',
  },
  {
    id: 'seed-rule-sdk-2',
    group: 'SAN_SANG_DANG_KY',
    keyword: 'link dang ky',
    weight: 50,
    isActive: true,
    description: 'Khách xin đường link đăng ký form',
  },
  {
    id: 'seed-rule-sdk-3',
    group: 'SAN_SANG_DANG_KY',
    keyword: 'so tai khoan',
    weight: 50,
    isActive: true,
    description: 'Khách xin số tài khoản thanh toán',
  },
  {
    id: 'seed-rule-sdk-4',
    group: 'SAN_SANG_DANG_KY',
    keyword: 'thu tuc nhap hoc',
    weight: 50,
    isActive: true,
    description: 'Khách hỏi quy trình nhập học chính thức',
  },
  {
    id: 'seed-rule-sdk-5',
    group: 'SAN_SANG_DANG_KY',
    keyword: 'giu cho',
    weight: 50,
    isActive: true,
    description: 'Khách yêu cầu giữ suất học',
  },

  // 4. Nhóm Hồ sơ (+30 điểm)
  {
    id: 'seed-rule-hs-1',
    group: 'HO_SO',
    keyword: 'can cuoc cong dan',
    weight: 30,
    isActive: true,
    description: 'Khách nhắc tới CCCD',
  },
  {
    id: 'seed-rule-hs-2',
    group: 'HO_SO',
    keyword: 'hoc ba',
    weight: 30,
    isActive: true,
    description: 'Khách gửi học bạ',
  },
  {
    id: 'seed-rule-hs-3',
    group: 'HO_SO',
    keyword: 'giay khai sinh',
    weight: 30,
    isActive: true,
    description: 'Khách chuẩn bị giấy khai sinh',
  },
  {
    id: 'seed-rule-hs-4',
    group: 'HO_SO',
    keyword: 'bang tot nghiep',
    weight: 30,
    isActive: true,
    description: 'Khách nộp bằng tốt nghiệp',
  },

  // 5. Nhóm Loại trừ (-100 điểm)
  {
    id: 'seed-rule-lt-1',
    group: 'LOAI_TRU',
    keyword: 'tuyen dung',
    weight: -100,
    isActive: true,
    description: 'Tin tuyển dụng / đối tác cung cấp dịch vụ',
  },
  {
    id: 'seed-rule-lt-2',
    group: 'LOAI_TRU',
    keyword: 'xin viec lam',
    weight: -100,
    isActive: true,
    description: 'Ứng viên nộp CV xin việc làm',
  },
  {
    id: 'seed-rule-lt-3',
    group: 'LOAI_TRU',
    keyword: 'nham so',
    weight: -100,
    isActive: true,
    description: 'Nhắn nhầm người hoặc nhầm số',
  },
  {
    id: 'seed-rule-lt-4',
    group: 'LOAI_TRU',
    keyword: 'spam',
    weight: -100,
    isActive: true,
    description: 'Quảng cáo, tin rác',
  },
  {
    id: 'seed-rule-lt-5',
    group: 'LOAI_TRU',
    keyword: 'khong co nhu cau',
    weight: -100,
    isActive: true,
    description: 'Khách từ chối, không có nhu cầu',
  },
];

export interface KeywordEvaluationResult {
  totalScore: number;
  matchedRules: Array<{
    ruleId: string;
    keyword: string;
    group: string;
    weight: number;
  }>;
  matchedGroups: string[];
  isExcluded: boolean;
  normalizedText: string;
}

/**
 * Đánh giá điểm và phân loại lead động dựa trên bảng luật keyword_rules từ Database
 *
 * Tiêu chí nghiệm thu:
 * - Khi đổi trọng số (weight) trong bảng keyword_rules, kết quả điểm số tự động thay đổi
 *   tương ứng mà KHÔNG CẦN sửa đổi mã nguồn.
 */
export function evaluateKeywordRules(
  rawText: string,
  rules: KeywordRuleItem[] = INITIAL_SEED_KEYWORD_RULES
): KeywordEvaluationResult {
  const normalizedText = normalize(rawText);
  let totalScore = 0;
  const matchedRules: KeywordEvaluationResult['matchedRules'] = [];
  const groupsSet = new Set<string>();
  let isExcluded = false;

  // Lọc các rule đang kích hoạt
  const activeRules = rules.filter((r) => r.isActive);

  for (const rule of activeRules) {
    const normKeyword = normalize(rule.keyword);
    if (!normKeyword) continue;

    // So khớp theo ranh giới từ hoặc cụm từ
    const regex = new RegExp(`\\b${normKeyword}\\b`, 'i');
    if (regex.test(normalizedText) || normalizedText.includes(normKeyword)) {
      totalScore += rule.weight;
      matchedRules.push({
        ruleId: rule.id,
        keyword: rule.keyword,
        group: rule.group,
        weight: rule.weight,
      });
      groupsSet.add(rule.group);

      if (rule.group === 'LOAI_TRU' || rule.weight <= -50) {
        isExcluded = true;
      }
    }
  }

  return {
    totalScore,
    matchedRules,
    matchedGroups: Array.from(groupsSet),
    isExcluded,
    normalizedText,
  };
}

