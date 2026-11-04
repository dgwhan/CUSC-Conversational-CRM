import { Module } from '@nestjs/common';
import { KeywordRulesService } from './keyword-rules.service.js';
import { KeywordRulesController } from './keyword-rules.controller.js';

@Module({
  controllers: [KeywordRulesController],
  providers: [KeywordRulesService],
  exports: [KeywordRulesService],
})
export class NlpModule {}

