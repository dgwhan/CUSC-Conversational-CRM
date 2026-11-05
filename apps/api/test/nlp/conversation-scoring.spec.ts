import { describe, it, expect } from 'vitest';
import {
  scoreConversation,
  type ScoringThresholdConfig,
  type ConversationMessageInput,
} from '../../src/modules/nlp/domain/conversation-scoring.js';
import { isKeywordNegated } from '../../src/modules/nlp/domain/negation-detector.js';
import { ConversationClassificationService } from '../../src/modules/nlp/application/conversation-classification.service.js';
import { KeywordRulesService } from '../../src/modules/nlp/keyword-rules.service.js';
import type { KeywordRuleItem } from '../../src/modules/nlp/keyword-scoring.js';

describe('Conversation Scoring & Classification Engine', () => {
  // Bộ quy tắc chuẩn để kiểm thử các tiêu chí
  const standardRules: KeywordRuleItem[] = [
    { id: 'rule-hp', keyword: 'học phí', weight: 3, group: 'QUAN_TAM', isActive: true },
    { id: 'rule-dk', keyword: 'đăng ký', weight: 5, group: 'SAN_SANG_DANG_KY', isActive: true },
    { id: 'rule-gc', keyword: 'giữ chỗ', weight: 5, group: 'SAN_SANG_DANG_KY', isActive: true },
    { id: 'rule-nh', keyword: 'nhập học', weight: 5, group: 'SAN_SANG_DANG_KY', isActive: true },
    { id: 'rule-tv', keyword: 'tư vấn', weight: 2, group: 'QUAN_TAM', isActive: true },
    { id: 'rule-lh', keyword: 'lịch học', weight: 3, group: 'QUAN_TAM', isActive: true },
    { id: 'rule-cccd', keyword: 'cccd', weight: 3, group: 'HO_SO', isActive: true },
    { id: 'rule-hb', keyword: 'học bạ', weight: 3, group: 'HO_SO', isActive: true },
    { id: 'rule-spam', keyword: 'tuyển dụng', weight: -100, group: 'LOAI_TRU', isActive: true },
  ];

  describe('PHẦN 1: Phát hiện Phủ định (Negation Engine) & Câu từ chối', () => {
    it('1. Tiêu chí hoàn thành câu phủ định: "không đăng ký đâu" -> không tính điểm cho luật đăng ký', () => {
      const messages = ['Dạ em cảm ơn, em không đăng ký đâu ạ'];
      const result = scoreConversation(messages, standardRules);

      expect(isKeywordNegated('da em cam on em khong dang ky dau a', 'dang ky')).toBe(true);
      const dkReason = result.reasons.find((r) => r.keyword === 'đăng ký');
      expect(dkReason).toBeUndefined();
      expect(result.score).toBe(0);
      expect(result.tier).toBe('IRRELEVANT');
    });

    it('2. Câu phủ định với từ "chưa": "em chưa muốn học đâu ạ"', () => {
      expect(isKeywordNegated('em chua muon hoc dau a', 'hoc')).toBe(true);
      const result = scoreConversation(['em chưa muốn học đâu ạ'], standardRules);
      expect(result.score).toBe(0);
    });

    it('3. Câu phủ định với từ "đừng": "đừng tư vấn nữa nhé ad"', () => {
      expect(isKeywordNegated('dung tu van nua nhe ad', 'tu van')).toBe(true);
      const result = scoreConversation(['đừng tư vấn nữa nhé ad'], standardRules);
      expect(result.reasons.find((r) => r.keyword === 'tư vấn')).toBeUndefined();
    });

    it('4. Câu phủ định với từ "ko cần": "dạ ko cần tư vấn đâu"', () => {
      expect(isKeywordNegated('da ko can tu van dau', 'tu van')).toBe(true);
      const result = scoreConversation(['dạ ko cần tư vấn đâu'], standardRules);
      expect(result.score).toBe(0);
    });

    it('5. Câu phủ định với từ "hủy": "cho em hủy đăng ký giữ chỗ"', () => {
      expect(isKeywordNegated('cho em huy dang ky giu cho', 'dang ky')).toBe(true);
      const result = scoreConversation(['cho em hủy đăng ký giữ chỗ'], standardRules);
      expect(result.reasons.find((r) => r.keyword === 'đăng ký')).toBeUndefined();
    });

    it('6. Câu phủ định với từ "ko có nhu cầu": "mình ko có nhu cầu học nha"', () => {
      expect(isKeywordNegated('minh ko co nhu cau hoc nha', 'hoc')).toBe(true);
    });

    it('7. Câu phủ định có trợ từ "chi nữa": "học chi nữa bạn ơi"', () => {
      expect(isKeywordNegated('hoc chi nua ban oi', 'hoc')).toBe(true);
    });

    it('8. Phủ định ở vế trước nhưng vế sau đồng ý: "không học web, em đăng ký aptech"', () => {
      const messages = ['Em không học web, nhưng em muốn đăng ký khóa Aptech'];
      const result = scoreConversation(messages, standardRules);
      expect(result.reasons.some((r) => r.keyword === 'đăng ký')).toBe(true);
      expect(result.score).toBe(5);
    });

    it('9. Phủ định lặp từ teencode: "dạ k0 có nhu cầu đk đâu ạ"', () => {
      const result = scoreConversation(['dạ k0 có nhu cầu đk đâu ạ'], standardRules);
      expect(result.reasons.find((r) => r.keyword === 'đăng ký')).toBeUndefined();
      expect(result.score).toBe(0);
    });

    it('10. Phủ định với từ "thôi": "thôi mình không nhập học nữa"', () => {
      const result = scoreConversation(['thôi mình không nhập học nữa'], standardRules);
      expect(result.reasons.find((r) => r.keyword === 'nhập học')).toBeUndefined();
    });
  });

  describe('PHẦN 2: Tin nhắn Không dấu & Viết tắt (Teencode)', () => {
    it('11. Tin không dấu viết tắt học phí: "hp bn v"', () => {
      const result = scoreConversation(['hp bn v'], standardRules);
      expect(result.reasons.some((r) => r.keyword === 'học phí')).toBe(true);
      expect(result.score).toBe(3);
    });

    it('12. Tin không dấu đăng ký: "em muon dk aptech"', () => {
      const result = scoreConversation(['em muon dk aptech'], standardRules);
      expect(result.reasons.some((r) => r.keyword === 'đăng ký')).toBe(true);
      expect(result.score).toBe(5);
    });

    it('13. Tin không dấu SĐT viết tắt: "ib sdt cho em"', () => {
      const result = scoreConversation(['ib sdt cho em'], standardRules);
      expect(result.entities.normalizedText).toContain('so dien thoai');
    });

    it('14. Tin không dấu chi phí: "khoa nay hoc phi bnhieu"', () => {
      const result = scoreConversation(['khoa nay hoc phi bnhieu'], standardRules);
      expect(result.reasons.some((r) => r.keyword === 'học phí')).toBe(true);
    });

    it('15. Tin không dấu hồ sơ viết tắt: "em gui cccd va hb"', () => {
      const result = scoreConversation(['em gui cccd va hb'], standardRules);
      expect(result.reasons.some((r) => r.keyword === 'cccd')).toBe(true);
      expect(result.reasons.some((r) => r.keyword === 'học bạ')).toBe(true);
      expect(result.score).toBe(6);
    });

    it('16. Tin không dấu giữ chỗ: "em muon giu cho"', () => {
      const result = scoreConversation(['em muon giu cho'], standardRules);
      expect(result.reasons.some((r) => r.keyword === 'giữ chỗ')).toBe(true);
      expect(result.score).toBe(5);
    });

    it('17. Tin không dấu lịch học: "cho e xin lich hoc chi tiet"', () => {
      const result = scoreConversation(['cho e xin lich hoc chi tiet'], standardRules);
      expect(result.reasons.some((r) => r.keyword === 'lịch học')).toBe(true);
    });

    it('18. Tin không dấu tư vấn: "ad tv cho e voi"', () => {
      const result = scoreConversation(['ad tv cho e voi'], standardRules);
      expect(result.reasons.some((r) => r.keyword === 'tư vấn')).toBe(true);
      expect(result.score).toBe(2);
    });
  });

  describe('PHẦN 3: Cộng dồn Toàn bộ Hội thoại & Khử Trùng Lặp Luật', () => {
    it('19. Tiêu chí cộng dồn: Điểm được cộng dồn tích lũy qua nhiều tin nhắn', () => {
      const conversation = [
        'Học phí khóa này bao nhiêu ạ?', // +3 (học phí)
        'Lịch học các buổi tối trong tuần', // +3 (lịch học)
        'Em muốn đăng ký giữ chỗ', // +5 (đăng ký), +5 (giữ chỗ)
      ];
      const result = scoreConversation(conversation, standardRules);
      expect(result.score).toBe(16);
    });

    it('20. Tiêu chí khử lặp: Khách lặp lại "học phí" ở 3 tin nhắn khác nhau, chỉ tính +3 điểm một lần', () => {
      const conversation = [
        'Học phí bao nhiêu ạ?', // Khớp "học phí" (+3)
        'Học phí có được giảm không?', // Khớp "học phí" (Trùng -> Bỏ qua)
        'Em lo tiền học phí quá', // Khớp "học phí" (Trùng -> Bỏ qua)
      ];
      const result = scoreConversation(conversation, standardRules);
      const hpOccurrences = result.reasons.filter((r) => r.keyword === 'học phí');
      expect(hpOccurrences).toHaveLength(1);
      expect(result.score).toBe(3);
    });

    it('21. Khách lặp lại "đăng ký" nhiều lần chỉ tính đúng +5 điểm một lần', () => {
      const conversation = ['Em muốn đăng ký', 'Hướng dẫn em đăng ký với'];
      const result = scoreConversation(conversation, standardRules);
      const dkOccurrences = result.reasons.filter((r) => r.keyword === 'đăng ký');
      expect(dkOccurrences).toHaveLength(1);
      expect(result.score).toBe(5);
    });

    it('22. Kết hợp nhiều luật khác nhau qua các lượt tin nhắn trong hội thoại', () => {
      const conversation = [
        'Nhờ ad tư vấn', // +2 (tư vấn)
        'Học phí kỳ 1', // +3 (học phí)
        'Em chuẩn bị cccd rồi', // +3 (cccd)
      ];
      const result = scoreConversation(conversation, standardRules);
      expect(result.score).toBe(8);
      expect(result.tier).toBe('HOT');
    });

    it('23. Bỏ qua tin nhắn của tư vấn viên (STAFF), chỉ tính tin nhắn của khách hàng (CUSTOMER)', () => {
      const conversation: ConversationMessageInput[] = [
        { senderRole: 'CUSTOMER', content: 'Học phí bao nhiêu' }, // +3
        { senderRole: 'STAFF', content: 'Em đăng ký ngay hôm nay nhé' }, // Không tính
      ];
      const result = scoreConversation(conversation, standardRules);
      expect(result.reasons.find((r) => r.keyword === 'đăng ký')).toBeUndefined();
      expect(result.score).toBe(3);
    });
  });

  describe('PHẦN 4: Thưởng SĐT & Minh Bạch Lý Do Cho Sales (Explainability)', () => {
    it('24. Tiêu chí hoàn thành: Lead Nóng hiển thị được "học phí +3, đăng ký +5, có SĐT +5"', () => {
      const conversation = [
        'Học phí bao nhiêu ạ, em muốn đăng ký, SĐT của em là 0912345678',
      ];
      const result = scoreConversation(conversation, standardRules);

      expect(result.score).toBe(13); // 3 + 5 + 5
      expect(result.tier).toBe('HOT');
      expect(result.reasonsFormatted).toBe('học phí +3, đăng ký +5, có SĐT +5');
    });

    it('25. Thưởng SĐT chuẩn CUS-03 (+5 điểm): Khách gửi định dạng có dấu chấm', () => {
      const result = scoreConversation(['Sđt em 0912.345.678'], standardRules);
      expect(result.entities.phoneNumber).toBe('0912345678');
      expect(result.reasons.some((r) => r.keyword === 'có SĐT' && r.points === 5)).toBe(true);
      expect(result.score).toBe(5);
    });

    it('26. Thưởng SĐT mã quốc gia: +84 988 777 666 (+5 điểm)', () => {
      const result = scoreConversation(['Số zalo của em: +84 988 777 666'], standardRules);
      expect(result.entities.phoneNumber).toBe('0988777666');
      expect(result.reasons.some((r) => r.keyword === 'có SĐT')).toBe(true);
    });

    it('27. Không thưởng điểm nếu SĐT không hợp lệ hoặc thiếu số', () => {
      const result = scoreConversation(['Số điện thoại 09123'], standardRules);
      expect(result.entities.phoneNumber).toBeNull();
      expect(result.reasons.find((r) => r.keyword === 'có SĐT')).toBeUndefined();
    });

    it('28. Danh sách reasons chứa chi tiết điểm số của từng từ khóa phục vụ Sales kiểm chứng', () => {
      const result = scoreConversation(['Học phí, cccd, đăng ký, 0909123456'], standardRules);
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ keyword: 'học phí', points: 3 }),
          expect.objectContaining({ keyword: 'cccd', points: 3 }),
          expect.objectContaining({ keyword: 'đăng ký', points: 5 }),
          expect.objectContaining({ keyword: 'có SĐT', points: 5 }),
        ])
      );
      expect(result.score).toBe(16);
    });
  });

  describe('PHẦN 5: Phân Hạng Nhiệt Độ & Đổi Ngưỡng Động Không Deploy Lại', () => {
    it('29. Phân hạng Nóng: score >= 8 điểm -> HOT', () => {
      const result = scoreConversation(['học phí và đăng ký'], standardRules); // 3 + 5 = 8
      expect(result.score).toBe(8);
      expect(result.tier).toBe('HOT');
    });

    it('30. Phân hạng Ấm: score từ 4 đến 7 điểm -> WARM', () => {
      const result = scoreConversation(['em muốn đăng ký'], standardRules); // 5 điểm
      expect(result.score).toBe(5);
      expect(result.tier).toBe('WARM');
    });

    it('31. Phân hạng Lạnh: score từ 1 đến 3 điểm -> COLD', () => {
      const result = scoreConversation(['nhờ ad tư vấn'], standardRules); // 2 điểm
      expect(result.score).toBe(2);
      expect(result.tier).toBe('COLD');
    });

    it('32. Phân hạng Không liên quan: score = 0 -> IRRELEVANT', () => {
      const result = scoreConversation(['xin chào ad'], standardRules);
      expect(result.score).toBe(0);
      expect(result.tier).toBe('IRRELEVANT');
    });

    it('33. Tiêu chí hoàn thành: Đổi ngưỡng có hiệu lực ngay tại runtime mà không phải deploy lại', async () => {
      const mockRulesService = {
        getRules: async () => standardRules,
      } as unknown as KeywordRulesService;

      const classificationService = new ConversationClassificationService(mockRulesService);

      const conversation = ['em muốn đăng ký khóa học']; // 5 điểm

      // Lần 1: Ngưỡng mặc định (Nóng >= 8, Ấm 4..7) -> Điểm 5 là WARM
      const res1 = await classificationService.classifyConversation({
        conversationId: 'conv-1',
        messages: conversation,
        workspaceId: 'ws-test',
      });
      expect(res1.score).toBe(5);
      expect(res1.tier).toBe('WARM');

      // Lần 2: Quản trị viên đổi ngưỡng Nóng xuống 5 điểm (không deploy lại)
      classificationService.setThresholdConfig('ws-test', {
        hotMinScore: 5,
      });

      // Lần 3: Phân loại lại hội thoại, lập tức chuyển thành HOT
      const res2 = await classificationService.classifyConversation({
        conversationId: 'conv-1',
        messages: conversation,
        workspaceId: 'ws-test',
      });
      expect(res2.score).toBe(5);
      expect(res2.tier).toBe('HOT');
    });

    it('34. Nhóm LOẠI TRỪ (tuyển dụng, spam) luôn xếp vào IRRELEVANT dù có kèm từ khóa khác', () => {
      const conversation = ['Học phí bao nhiêu, bên mình có tuyển dụng không'];
      const result = scoreConversation(conversation, standardRules);
      expect(result.isExcluded).toBe(true);
      expect(result.tier).toBe('IRRELEVANT');
    });
  });
});

