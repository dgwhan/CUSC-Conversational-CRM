import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe.js';
import { PasswordRecoveryService } from '../../application/services/password-recovery.service.js';
import { PasswordRecoveryVerificationService } from '../../application/services/password-recovery-verification.service.js';
import {
  requestPasswordRecoverySchema,
  type RequestPasswordRecoveryDto,
  verifyPasswordRecoveryOtpSchema,
  type VerifyPasswordRecoveryOtpDto,
} from '../dto/request-password-recovery.dto.js';

const ACCEPTED_RESPONSE = {
  message: 'If the account is eligible, recovery instructions will be sent.',
};

// Công bố endpoint yêu cầu gửi OTP và xác minh OTP; không tiết lộ tài khoản.
@Controller('auth/password-recovery')
export class PasswordRecoveryController {
  constructor(
    private readonly passwordRecoveryService: PasswordRecoveryService,
    private readonly verificationService: PasswordRecoveryVerificationService,
  ) {}

  @Post('request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestOtp(
    @Body(new ZodValidationPipe(requestPasswordRecoverySchema))
    input: RequestPasswordRecoveryDto,
    @Ip() ipAddress: string,
  ): Promise<typeof ACCEPTED_RESPONSE> {
    await this.passwordRecoveryService.requestOtp(input.email, ipAddress);
    return ACCEPTED_RESPONSE;
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  // Chỉ trả kết quả xác minh OTP, không cấp credential cho bước đặt lại mật khẩu.
  verifyOtp(
    @Body(new ZodValidationPipe(verifyPasswordRecoveryOtpSchema))
    input: VerifyPasswordRecoveryOtpDto,
    @Ip() ipAddress: string,
  ): Promise<{ verified: true }> {
    return this.verificationService.verifyOtp(
      input.email,
      input.otp,
      ipAddress,
    );
  }
}
