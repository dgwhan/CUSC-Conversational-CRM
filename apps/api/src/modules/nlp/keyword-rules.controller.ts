import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
} from '@nestjs/common';
import { KeywordRulesService } from './keyword-rules.service.js';
import type { KeywordRuleItem } from './keyword-scoring.js';
import type { CatalogProductItem } from './entity-extractor.js';

@Controller('keyword-rules')
export class KeywordRulesController {
  constructor(private readonly service: KeywordRulesService) {}

  @Get()
  async getRules(
    @Query('workspaceId') queryWsId?: string,
    @Headers('x-workspace-id') headerWsId?: string
  ): Promise<KeywordRuleItem[]> {
    const wsId = queryWsId || headerWsId;
    return this.service.getRules(wsId);
  }

  @Post()
  async createRule(
    @Body() body: Omit<KeywordRuleItem, 'id'>,
    @Headers('x-workspace-id') headerWsId?: string
  ): Promise<KeywordRuleItem> {
    return this.service.createRule({
      ...body,
      workspaceId: body.workspaceId || headerWsId,
    });
  }

  @Patch(':id')
  async updateRule(
    @Param('id') id: string,
    @Body() patch: Partial<KeywordRuleItem>
  ): Promise<KeywordRuleItem | null> {
    return this.service.updateRule(id, patch);
  }

  @Delete(':id')
  async deleteRule(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.service.deleteRule(id);
    return { success };
  }

  @Post('seed')
  async seedRules(
    @Query('workspaceId') queryWsId?: string,
    @Headers('x-workspace-id') headerWsId?: string
  ) {
    const wsId = queryWsId || headerWsId;
    const rules = await this.service.seedInitialRules(wsId);
    return { success: true, count: rules.length };
  }

  @Post('evaluate')
  async evaluateMessage(
    @Body() body: { text: string; catalog?: CatalogProductItem[]; workspaceId?: string },
    @Headers('x-workspace-id') headerWsId?: string
  ) {
    const wsId = body.workspaceId || headerWsId;
    return this.service.evaluateMessage(body.text || '', wsId, body.catalog || []);
  }
}

