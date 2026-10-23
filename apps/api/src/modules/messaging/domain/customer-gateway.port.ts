import { Channel } from "./channel.js";

export const CUSTOMER_GATEWAY = Symbol('CUSTOMER_GATEWAY');

export interface CustomerLookupResult {
    readonly id: string;
    readonly isNew?: boolean;
    readonly [key: string]: unknown;
}

export interface CustomerGateway {
    findOrCreate(params: {
        channel: Channel;
        senderExternalId: string;
        displayName?: string | null;
        rawPayload?: unknown;
    }): Promise<CustomerLookupResult>;
}
