import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  KeywordRuleItem,
  INITIAL_SEED_KEYWORD_RULES,
  evaluateKeywordRules,
  KeywordEvaluationResult,
} from './keyword-scoring.js';
import { extractEntities, ExtractedEntitiesResult, CatalogProductItem } from './entity-extractor.js';

@Injectable()
export class KeywordRulesService {
  private readonly logger = new Logger(KeywordRulesService.name);
  // In-memory fallback if Prisma is not connected or in test mode
  private inMemoryRules: KeywordRuleItem[] = [...INITIAL_SEED_KEYWORD_RULES];

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Lấy danh sách luật từ khóa (ưu tiên từ Database, fallback in-memory)
   */
  async getRules(workspaceId?: string): Promise<KeywordRuleItem[]> {
    if (this.prisma) {
      try {
        const dbRules = await (this.prisma as any).keywordRule.findMany({
          where: workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : {},
          orderBy: [{ group: 'asc' }, { weight: 'desc' }],
        });

        if (Array.isArray(dbRules) && dbRules.length > 0) {
          return dbRules.map((r: any) => ({
            id: r.id,
            workspaceId: r.workspaceId || undefined,
            group: r.group,
            keyword: r.keyword,
            weight: r.weight,
            isActive: r.isActive,
            description: r.description || undefined,
          }));
        }

        // Tự động seed nếu DB chưa có
        await this.seedInitialRules(workspaceId);
        return this.inMemoryRules;
      } catch (err) {
        this.logger.warn(`Could not query keyword_rules from DB, using in-memory store: ${(err as Error).message}`);
      }
    }

    return this.inMemoryRules;
  }

  /**
   * Seed bộ luật ban đầu vào Database
   */
  async seedInitialRules(workspaceId?: string): Promise<KeywordRuleItem[]> {
    if (this.prisma) {
      try {
        for (const seed of INITIAL_SEED_KEYWORD_RULES) {
          await (this.prisma as any).keywordRule.create({
            data: {
              workspaceId: workspaceId || null,
              group: seed.group,
              keyword: seed.keyword,
              weight: seed.weight,
              isActive: seed.isActive,
              description: seed.description || null,
            },
          }).catch(() => {});
        }
        this.logger.log(`Seeded initial keyword rules into database.`);
      } catch (e) {
        this.logger.warn(`Seed keyword rules error: ${(e as Error).message}`);
      }
    }
    return this.inMemoryRules;
  }

  /**
   * Tạo luật từ khóa mới
   */
  async createRule(data: Omit<KeywordRuleItem, 'id'>): Promise<KeywordRuleItem> {
    if (this.prisma) {
      try {
        const created = await (this.prisma as any).keywordRule.create({
          data: {
            workspaceId: data.workspaceId || null,
            group: data.group,
            keyword: data.keyword,
            weight: data.weight ?? 10,
            isActive: data.isActive ?? true,
            description: data.description || null,
          },
        });
        return {
          id: created.id,
          workspaceId: created.workspaceId || undefined,
          group: created.group,
          keyword: created.keyword,
          weight: created.weight,
          isActive: created.isActive,
          description: created.description || undefined,
        };
      } catch (err) {
        this.logger.warn(`Failed to create rule in DB, adding to in-memory: ${(err as Error).message}`);
      }
    }

    const newRule: KeywordRuleItem = {
      id: `rule-${Date.now()}`,
      ...data,
      weight: data.weight ?? 10,
      isActive: data.isActive ?? true,
    };
    this.inMemoryRules.push(newRule);
    return newRule;
  }

  /**
   * Cập nhật trọng số hoặc trạng thái luật (Không cần sửa code)
   */
  async updateRule(id: string, patch: Partial<KeywordRuleItem>): Promise<KeywordRuleItem | null> {
    if (this.prisma) {
      try {
        const updated = await (this.prisma as any).keywordRule.update({
          where: { id },
          data: {
            ...(patch.group ? { group: patch.group } : {}),
            ...(patch.keyword ? { keyword: patch.keyword } : {}),
            ...(typeof patch.weight === 'number' ? { weight: patch.weight } : {}),
            ...(typeof patch.isActive === 'boolean' ? { isActive: patch.isActive } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
          },
        });
        return {
          id: updated.id,
          workspaceId: updated.workspaceId || undefined,
          group: updated.group,
          keyword: updated.keyword,
          weight: updated.weight,
          isActive: updated.isActive,
          description: updated.description || undefined,
        };
      } catch (err) {
        this.logger.warn(`Failed to update rule in DB, updating in-memory: ${(err as Error).message}`);
      }
    }

    const idx = this.inMemoryRules.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.inMemoryRules[idx] = { ...this.inMemoryRules[idx], ...patch };
      return this.inMemoryRules[idx];
    }
    return null;
  }

  /**
   * Xóa luật từ khóa
   */
  async deleteRule(id: string): Promise<boolean> {
    if (this.prisma) {
      try {
        await (this.prisma as any).keywordRule.delete({ where: { id } });
        return true;
      } catch (err) {
        this.logger.warn(`Failed to delete rule in DB: ${(err as Error).message}`);
      }
    }
    const before = this.inMemoryRules.length;
    this.inMemoryRules = this.inMemoryRules.filter((r) => r.id !== id);
    return this.inMemoryRules.length < before;
  }

  /**
   * Đánh giá và chấm điểm tự động một tin nhắn / văn bản
   * Đọc luật trực tiếp từ CSDL để đảm bảo khi trọng số thay đổi thì điểm đổi theo mà không sửa code.
   */
  async evaluateMessage(
    rawText: string,
    workspaceId?: string,
    catalog: CatalogProductItem[] = []
  ): Promise<KeywordEvaluationResult & { entities: ExtractedEntitiesResult }> {
    const rules = await this.getRules(workspaceId);
    const scoringResult = evaluateKeywordRules(rawText, rules);
    const entities = extractEntities(rawText, catalog);

    return {
      ...scoringResult,
      entities,
    };
  }
}

