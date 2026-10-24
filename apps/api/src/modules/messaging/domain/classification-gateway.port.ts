export const CLASSIFICATION_GATEWAY = Symbol('CLASSIFICATION_GATEWAY');

export interface ClassificationResult {
    readonly intent?: string;
    readonly confidence?: number;
    readonly [key: string]: unknown;
}

export interface ClassificationGateway {
    classify(params: {
        messageId: string;
        content: string | null;
        customerId?: string;
    }): Promise<ClassificationResult>;
}
