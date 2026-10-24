import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { MailMessage } from '../../domain/types/mail-message.js';
import type { MailDelivery } from '../../domain/types/mail-delivery.js';

@Injectable()
// Adapter console bị vô hiệu hóa để tránh lộ nội dung mail trong log.
export class ConsoleMailDeliveryService implements MailDelivery {
  constructor() {}

  async sendEmail(_message: MailMessage): Promise<void> {
    throw new ServiceUnavailableException('Console mail delivery is disabled');
  }
}
