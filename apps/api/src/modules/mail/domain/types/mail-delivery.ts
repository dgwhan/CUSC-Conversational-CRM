import { MailMessage } from "./mail-message.js"

// Hợp đồng chung cho các phương thức gửi mail.
export interface MailDelivery {
    sendEmail(message: MailMessage): Promise<void>;
}
