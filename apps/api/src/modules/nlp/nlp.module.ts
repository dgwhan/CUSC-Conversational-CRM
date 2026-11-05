import { Module } from '@nestjs/common';
import { KeywordRulesService } from './keyword-rules.service.js';
import { KeywordRulesController } from './keyword-rules.controller.js';
import { ConversationClassificationService } from './application/conversation-classification.service.js';

@Module({
  controllers: [KeywordRulesController],
  providers: [KeywordRulesService, ConversationClassificationService],
  exports: [KeywordRulesService, ConversationClassificationService],
})
export class NlpModule {}

