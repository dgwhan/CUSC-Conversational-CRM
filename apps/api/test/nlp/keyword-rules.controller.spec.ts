import { describe, expect, it, vi, beforeEach } from 'vitest';
import { KeywordRulesController } from '../../src/modules/nlp/keyword-rules.controller.js';
import type { KeywordRulesService } from '../../src/modules/nlp/keyword-rules.service.js';

describe('KeywordRulesController', () => {
  let controller: KeywordRulesController;
  let mockService: Partial<KeywordRulesService>;

  beforeEach(() => {
    mockService = {
      getRules: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      seedInitialRules: vi.fn(),
      evaluateMessage: vi.fn(),
    };

    controller = new KeywordRulesController(
      mockService as unknown as KeywordRulesService,
    );
  });

  it('GET /keyword-rules: lấy danh sách các luật từ khóa theo workspace', async () => {
    const rules = [
      { id: 'rule-1', group: 'QUAN_TAM', keyword: 'hoc phi', weight: 10, isActive: true },
    ];
    vi.mocked(mockService.getRules!).mockResolvedValue(rules as any);

    const result = await controller.getRules('ws-1');

    expect(mockService.getRules).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual(rules);
  });

  it('POST /keyword-rules: tạo mới một luật từ khóa', async () => {
    const newRuleDto = {
      workspaceId: 'ws-1',
      group: 'SAN_SANG_DANG_KY' as const,
      keyword: 'giữ chỗ',
      weight: 50,
      isActive: true,
    };
    const createdRule = { id: 'rule-new', ...newRuleDto };
    vi.mocked(mockService.createRule!).mockResolvedValue(createdRule as any);

    const result = await controller.createRule(newRuleDto);

    expect(mockService.createRule).toHaveBeenCalledWith(newRuleDto);
    expect(result).toEqual(createdRule);
  });

  it('PATCH /keyword-rules/:id: cập nhật trọng số và trạng thái luật', async () => {
    const updated = { id: 'rule-1', weight: 45, isActive: false };
    vi.mocked(mockService.updateRule!).mockResolvedValue(updated as any);

    const result = await controller.updateRule('rule-1', { weight: 45, isActive: false });

    expect(mockService.updateRule).toHaveBeenCalledWith('rule-1', { weight: 45, isActive: false });
    expect(result).toEqual(updated);
  });

  it('DELETE /keyword-rules/:id: xóa một luật khỏi hệ thống', async () => {
    vi.mocked(mockService.deleteRule!).mockResolvedValue(true as any);

    const result = await controller.deleteRule('rule-1');

    expect(mockService.deleteRule).toHaveBeenCalledWith('rule-1');
    expect(result.success).toBe(true);
  });

  it('POST /keyword-rules/seed: nạp bộ luật ban đầu', async () => {
    const fakeRules = new Array(16).fill({ id: 'rule' });
    vi.mocked(mockService.seedInitialRules!).mockResolvedValue(fakeRules as any);

    const result = await controller.seedRules('ws-1');

    expect(mockService.seedInitialRules).toHaveBeenCalledWith('ws-1');
    expect(result.count).toBe(16);
  });

  it('POST /keyword-rules/evaluate: đánh giá và chấm điểm nội dung tin nhắn', async () => {
    const evaluation = {
      rawText: 'HP bn vậy',
      normalizedText: 'hoc phi bao nhieu vay',
      totalScore: 25,
      isExcluded: false,
      matchedRules: [],
      entities: {
        phoneNumber: null,
        documents: [],
        detectedCourses: [],
        normalizedText: 'hoc phi bao nhieu vay',
      },
    };
    vi.mocked(mockService.evaluateMessage!).mockResolvedValue(evaluation as any);

    const result = await controller.evaluateMessage(
      { text: 'HP bn vậy' },
      'ws-1',
    );

    expect(mockService.evaluateMessage).toHaveBeenCalledWith('HP bn vậy', 'ws-1', []);
    expect(result.totalScore).toBe(25);
  });
});
