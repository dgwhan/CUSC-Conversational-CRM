import { Injectable, Logger } from "@nestjs/common";
import { Channel } from "../../domain/channel.js";
import { CustomerGateway, CustomerLookupResult } from "../../domain/customer-gateway.port.js";

@Injectable()
export class DefaultCustomerGateway implements CustomerGateway {
    private readonly logger = new Logger(DefaultCustomerGateway.name);

    async findOrCreate(params: {
        channel: Channel;
        senderExternalId: string;
        displayName?: string | null;
        rawPayload?: unknown;
    }): Promise<CustomerLookupResult> {
        this.logger.log(`Find or create customer for ${params.channel}:${params.senderExternalId}`);
        return {
            id: `cust-${params.channel.toLowerCase()}-${params.senderExternalId}`,
            isNew: false,
        };
    }
}
