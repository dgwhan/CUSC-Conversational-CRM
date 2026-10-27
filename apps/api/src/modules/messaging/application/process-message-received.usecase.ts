import { Inject, Injectable, Logger } from "@nestjs/common";
import { MessageRepository } from "../infrastructure/message.repository.js";
import { CUSTOMER_GATEWAY } from "../domain/customer-gateway.port.js";
import type { CustomerGateway } from "../domain/customer-gateway.port.js";
import { CLASSIFICATION_GATEWAY } from "../domain/classification-gateway.port.js";
import type { ClassificationGateway } from "../domain/classification-gateway.port.js";

@Injectable()
export class ProcessMessageReceived {
    private readonly logger = new Logger(ProcessMessageReceived.name);

    constructor(
        private readonly messages: MessageRepository,
        @Inject(CUSTOMER_GATEWAY) private readonly customers: CustomerGateway,
        @Inject(CLASSIFICATION_GATEWAY) private readonly classification: ClassificationGateway,
    ) {}

    async execute(messageId: string): Promise<boolean> {
        // 1. Đọc tin nhắn từ DB
        const message = await this.messages.findById(messageId);
        if (!message) {
            this.logger.warn(`Message ${messageId} not found, skipping processing`);
            return false;
        }

        // 2. Chống xử lý trùng lặp (Idempotent):
        // Nếu đã có processedAt (ví dụ worker bị restart sau khi đã xử lý xong), bỏ qua ngay
        if (message.processedAt !== null) {
            this.logger.log(`Message ${messageId} was already processed at ${message.processedAt.toISOString()}, skipping duplicate execution.`);
            return false;
        }

        // 3. Tìm hoặc tạo khách hàng (customer/lead)
        const senderExternalId = this.extractSenderId(message.rawPayload);
        const customer = await this.customers.findOrCreate({
            channel: message.channel,
            senderExternalId,
            rawPayload: message.rawPayload,
        });

        // 4. Gọi phân loại (classification)
        await this.classification.classify({
            messageId: message.id,
            content: message.content,
            customerId: customer.id,
        });

        // 5. Đặt processed_at = now()
        await this.messages.markProcessed(message.id, new Date());
        this.logger.log(`Successfully processed message ${messageId} for customer ${customer.id}`);

        return true;
    }

    private extractSenderId(rawPayload: unknown): string {
        if (!rawPayload || typeof rawPayload !== 'object') return 'unknown-sender';
        const raw = rawPayload as Record<string, unknown>;
        if (typeof raw.senderExternalId === 'string' && raw.senderExternalId) return raw.senderExternalId;
        if (typeof raw.external_user_id === 'string' && raw.external_user_id) return raw.external_user_id;
        if (typeof raw.externalUserId === 'string' && raw.externalUserId) return raw.externalUserId;
        if (typeof raw.sender === 'string' && raw.sender) return raw.sender;
        if (raw.sender && typeof raw.sender === 'object') {
            const senderObj = raw.sender as Record<string, unknown>;
            if (typeof senderObj.id === 'string' && senderObj.id) return senderObj.id;
        }
        return 'unknown-sender';
    }
}
