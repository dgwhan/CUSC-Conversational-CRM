import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { MailDelivery } from '../../domain/types/mail-delivery.js';
import type { MailMessage } from '../../domain/types/mail-message.js';

function safeSmtpErrorCategory(error: unknown): string {
  // Chỉ trích mã lỗi an toàn, không ghi nội dung phản hồi có thể chứa bí mật.
  if (typeof error !== 'object' || error === null) return 'UnknownError';

  const code = 'code' in error && typeof error.code === 'string'
    ? error.code
    : error instanceof Error
      ? error.name
      : 'UnknownError';
  const safeCode = /^[A-Z0-9_-]{1,32}$/.test(code) ? code : 'UnknownError';
  const responseCode =
    'responseCode' in error &&
    typeof error.responseCode === 'number' &&
    Number.isInteger(error.responseCode) &&
    error.responseCode >= 400 &&
    error.responseCode <= 599
      ? error.responseCode
      : undefined;

  return responseCode ? `${safeCode}, response ${responseCode}` : safeCode;
}

@Injectable()
// Gửi mail qua SMTP với thông tin xác thực lấy từ cấu hình môi trường.
export class NodemailerMailDeliveryService implements MailDelivery {
  private readonly logger = new Logger(NodemailerMailDeliveryService.name);
  private readonly transporter?: ReturnType<typeof nodemailer.createTransport>;
  private readonly sender?: string;

  constructor(configService: ConfigService) {
    const host = configService.get<string>('MAIL_HOST');
    const port = configService.get<number>('MAIL_PORT');
    const sender = configService.get<string>('MAIL_FROM');

    if (!host || !port || !sender) {
      return;
    }

    const user = configService.get<string>('MAIL_USER');
    const password = configService.get<string>('MAIL_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: configService.getOrThrow<boolean>('MAIL_SECURE'),
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });
    this.sender = sender;
  }

  async sendEmail(message: MailMessage): Promise<void> {
    // Không cho gửi mail nếu SMTP hoặc địa chỉ người gửi chưa được cấu hình.
    if (!this.transporter || !this.sender) {
      throw new ServiceUnavailableException(
        'SMTP mail delivery is not configured',
      );
    }

    try {
      await this.transporter.sendMail({
        ...message,
        from: this.sender,
      });
    } catch (error: unknown) {
      this.logger.error(
        `SMTP delivery attempt failed (${safeSmtpErrorCategory(error)}): ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('Email delivery failed');
    }
  }
}
