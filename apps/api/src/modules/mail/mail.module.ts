import { Module } from '@nestjs/common';
import { MailService } from './application/services/mail.service.js';
import { MAIL_DELIVERY } from './domain/mail.constants.js';
import { NodemailerMailDeliveryService } from './infrastructure/nodemailer/nodemailer-mail-delivery.service.js';

@Module({
  providers: [
    MailService,
    {
      provide: MAIL_DELIVERY,
      useClass: NodemailerMailDeliveryService,
    },
  ],
  exports: [MailService],
})
// Đăng ký dịch vụ gửi mail và bộ chuyển tiếp SMTP cho các module sử dụng.
export class MailModule {}
