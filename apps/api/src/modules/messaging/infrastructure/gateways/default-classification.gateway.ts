import { Injectable, Logger } from "@nestjs/common";
import { ClassificationGateway, ClassificationResult } from "../../domain/classification-gateway.port.js";

@Injectable()
export class DefaultClassificationGateway implements ClassificationGateway {
    private readonly logger = new Logger(DefaultClassificationGateway.name);

    async classify(params: {
        messageId: string;
        content: string | null;
        customerId?: string;
    }): Promise<ClassificationResult> {
        this.logger.log(`Classify message ${params.messageId}: "${params.content ?? ''}"`);
        return {
            intent: 'GENERAL_INQUIRY',
            confidence: 0.9,
        };
    }
}
