import { describe, it, expect } from 'vitest';
import { normalize } from '../../src/modules/nlp/text-normalizer.js';
import { extractEntities, extractPhoneNumber, extractDocuments } from '../../src/modules/nlp/entity-extractor.js';
import {
  evaluateKeywordRules,
  INITIAL_SEED_KEYWORD_RULES,
  KeywordRuleItem,
} from '../../src/modules/nlp/keyword-scoring.js';

describe('NLP & Information Extraction Engine', () => {
  describe('1. Hàm normalize() - Chuẩn hóa văn bản tiếng Việt', () => {
    it('tiêu chí hoàn thành: "HP bn vậy ạ" cho ra chuỗi chứa "hoc phi" và "bao nhieu"', () => {
      const input = 'HP bn vậy ạ';
      const output = normalize(input);

      expect(output).toContain('hoc phi');
      expect(output).toContain('bao nhieu');
      expect(output).toBe('hoc phi bao nhieu vay a');
    });

    it('rút gọn ký tự lặp do teencode: "họcccc phí" -> "hoc phi"', () => {
      const input = 'họcccc phí';
      const output = normalize(input);

      expect(output).toBe('hoc phi');
    });

    it('rút gọn ký tự lặp kéo dài: "dạaaaaaa bao nhiuuuu zậy" -> chuẩn hóa', () => {
      const input = 'dạaaaaaa bao nhiuuuu zậy';
      const output = normalize(input);

      expect(output).toContain('da');
      expect(output).toContain('bao nhieu');
    });

    it('mở rộng các từ viết tắt phổ biến: sdt, ib, dk, cccd', () => {
      expect(normalize('ib sdt cho em')).toBe('inbox so dien thoai cho em');
      expect(normalize('em muon dk')).toBe('em muon dang ky');
      expect(normalize('gui cccd va hb')).toBe('gui can cuoc cong dan va hoc ba');
    });
  });

  describe('2. Trích xuất Thực thể Nghiệp vụ (SĐT CUS-03, Hồ sơ, Khóa học)', () => {
    it('tiêu chí hoàn thành: "em gửi cccd với học bạ, sđt 0912345678" trả đủ 3 loại thông tin', () => {
      const input = 'em gửi cccd với học bạ, sđt 0912345678';
      const result = extractEntities(input);

      // 1. Số điện thoại chuẩn CUS-03
      expect(result.phoneNumber).toBe('0912345678');

      // 2. Danh sách hồ sơ đính kèm
      expect(result.documents).toContain('CCCD');
      expect(result.documents).toContain('Học bạ');
      expect(result.documents).toHaveLength(2);

      // 3. Khóa học (rỗng vì không nhắc trong câu)
      expect(result.detectedCourses).toEqual([]);
    });

    it('trích xuất SĐT có định dạng chấm hoặc khoảng cách theo CUS-03', () => {
      expect(extractPhoneNumber('Alo tư vấn qua số 0912.345.678 nhé')).toBe('0912345678');
      expect(extractPhoneNumber('Số của mẹ em là +84 988 777 666')).toBe('0988777666');
    });

    it('trích xuất khóa học từ danh mục sản phẩm (productCatalog)', () => {
      const catalog = [
        { id: 'c1', name: 'Lập trình viên Quốc tế Aptech ADSE', code: 'APTECH-ADSE' },
        { id: 'c2', name: 'Thiết kế Đồ họa Multimedia Arena', code: 'ARENA' },
        { id: 'c3', name: 'Lập trình Python & Trí tuệ Nhân tạo AI', code: 'AI-PYTHON' },
      ];

      const input = 'Em muốn hỏi học phí khóa lập trình python ai, sđt 0909123456';
      const result = extractEntities(input, catalog);

      expect(result.phoneNumber).toBe('0909123456');
      expect(result.detectedCourses.length).toBeGreaterThanOrEqual(1);
      expect(result.detectedCourses[0].name).toContain('Python');
    });
  });

  describe('3. Bảng luật từ khóa động (keyword_rules) & Chấm điểm Lead', () => {
    it('chấm điểm chính xác theo bộ luật Seed ban đầu', () => {
      const input = 'hoc phi bao nhieu vay a';
      const result = evaluateKeywordRules(input, INITIAL_SEED_KEYWORD_RULES);

      // Khớp "hoc phi bao nhieu" (weight: 25) và "hoc phi" (weight: 10)
      expect(result.totalScore).toBeGreaterThanOrEqual(25);
      expect(result.matchedGroups).toContain('QUAN_TAM_SAU');
      expect(result.isExcluded).toBe(false);
    });

    it('tiêu chí hoàn thành: đổi trọng số trong bảng thì kết quả đổi theo mà không sửa code', () => {
      const input = 'cho em xin so tai khoan de chuyen khoan coc';

      // 1. Chấm điểm với luật gốc (so tai khoan = 50, chuyen khoan coc = 50 -> 100 điểm)
      const scoreOriginal = evaluateKeywordRules(input, INITIAL_SEED_KEYWORD_RULES);
      expect(scoreOriginal.totalScore).toBe(100);

      // 2. Mô phỏng quản trị viên đổi trọng số trong DB (không sửa code logic)
      // Tăng "so tai khoan" từ 50 lên 80, và "chuyen khoan coc" từ 50 lên 70
      const modifiedRules: KeywordRuleItem[] = INITIAL_SEED_KEYWORD_RULES.map((r) => {
        if (r.keyword === 'so tai khoan') return { ...r, weight: 80 };
        if (r.keyword === 'chuyen khoan coc') return { ...r, weight: 70 };
        return r;
      });

      // 3. Chấm lại: kết quả đổi ngay lập tức thành 80 + 70 = 150
      const scoreModified = evaluateKeywordRules(input, modifiedRules);
      expect(scoreModified.totalScore).toBe(150);

      // 4. Mô phỏng tắt một luật (isActive = false)
      const disabledRules: KeywordRuleItem[] = modifiedRules.map((r) => {
        if (r.keyword === 'so tai khoan') return { ...r, isActive: false };
        return r;
      });

      const scoreDisabled = evaluateKeywordRules(input, disabledRules);
      // Chỉ còn "chuyen khoan coc" (70 điểm)
      expect(scoreDisabled.totalScore).toBe(70);
    });

    it('nhận diện nhóm LOAI_TRU và đánh dấu isExcluded', () => {
      const input = 'chúng tôi chuyên cung cấp dịch vụ tuyển dụng nhân sự quảng cáo spam';
      const result = evaluateKeywordRules(input, INITIAL_SEED_KEYWORD_RULES);

      expect(result.isExcluded).toBe(true);
      expect(result.totalScore).toBeLessThan(0);
    });
  });
});
