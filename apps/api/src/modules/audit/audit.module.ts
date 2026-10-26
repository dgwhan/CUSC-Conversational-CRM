import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
