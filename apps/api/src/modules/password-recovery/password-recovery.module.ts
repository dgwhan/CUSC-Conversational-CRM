import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { MailModule } from '../mail/mail.module.js';
import { PasswordRecoveryService } from './application/services/password-recovery.service.js';
import { PasswordRecoveryRateLimitService } from './application/services/password-recovery-rate-limit.service.js';
import { PasswordRecoveryDeliveryProcessor } from './application/services/password-recovery-delivery-processor.service.js';
import { PasswordRecoveryVerificationService } from './application/services/password-recovery-verification.service.js';
import { PasswordRecoveryCryptoService } from './infrastructure/crypto/password-recovery-crypto.service.js';
import { PasswordRecoveryController } from './presentation/controllers/password-recovery.controller.js';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [PasswordRecoveryController],
  providers: [
    PasswordRecoveryService,
    PasswordRecoveryRateLimitService,
    PasswordRecoveryDeliveryProcessor,
    PasswordRecoveryVerificationService,
    PasswordRecoveryCryptoService,
  ],
})
// Gom các thành phần request, delivery và xác minh OTP của luồng khôi phục.
export class PasswordRecoveryModule {}
