import { Inject, Injectable } from "@nestjs/common";
import type { MailDelivery } from "../../domain/types/mail-delivery.js";
import { MAIL_DELIVERY } from "../../domain/mail.constants.js";
import { MailMessage } from "../../domain/types/mail-message.js";

@Injectable() 
// Chuyển tiếp yêu cầu gửi mail đến adapter được cấu hình trong MailModule.
export class MailService {
    constructor(
        @Inject(MAIL_DELIVERY)
        private readonly mailDelivery: MailDelivery,
    ) {}

    sendEmail(message: MailMessage): Promise<void> {
        return this.mailDelivery.sendEmail(message);
    }
}
