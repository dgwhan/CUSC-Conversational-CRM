import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service.js';
import { RealtimeController } from './realtime.controller.js';

@Module({
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
