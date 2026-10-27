import { Logger, Module, Provider } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { ChannelAdapterRegistry, CHANNEL_ADAPTERS } from './application/channel-adapter.registry.js';
import { ReceiveInboundMessage } from './application/receive-inbound-message.usecase.js';
import { ProcessMessageReceived } from './application/process-message-received.usecase.js';
import { ImportMessagesUseCase } from './application/import-messages.usecase.js';
import { MessageRepository } from './infrastructure/message.repository.js';
import { WebhookController } from './presentation/webhook.controller.js';
import { MessageImportController } from './presentation/message-import.controller.js';
import { CustomerController } from './presentation/customer.controller.js';
import { ContactController } from './presentation/contact.controller.js';
import { INBOUND_QUEUE, InboundMessageQueue } from './domain/channel-adapter.port.js';
import { ManualImportAdapter } from './infrastructure/adapters/manual-import.adapter.js';
import { ZaloAdapter } from './infrastructure/adapters/zalo.adapter.js';
import { FacebookAdapter } from './infrastructure/adapters/facebook.adapter.js';
import { CUSTOMER_GATEWAY } from './domain/customer-gateway.port.js';
import { CLASSIFICATION_GATEWAY } from './domain/classification-gateway.port.js';
import { DefaultCustomerGateway } from './infrastructure/gateways/default-customer.gateway.js';
import { DefaultClassificationGateway } from './infrastructure/gateways/default-classification.gateway.js';

class DefaultInboundQueue implements InboundMessageQueue {
    private readonly logger = new Logger(DefaultInboundQueue.name);

    async enqueue(messageIds: string[]): Promise<void> {
        this.logger.log(`Enqueued ${messageIds.length} message(s) for processing`);
    }
}

const queueProvider: Provider = {
    provide: INBOUND_QUEUE,
    useClass: DefaultInboundQueue,
};

const customerGatewayProvider: Provider = {
    provide: CUSTOMER_GATEWAY,
    useClass: DefaultCustomerGateway,
};

const classificationGatewayProvider: Provider = {
    provide: CLASSIFICATION_GATEWAY,
    useClass: DefaultClassificationGateway,
};

const adaptersProvider: Provider = {
    provide: CHANNEL_ADAPTERS,
    useFactory: (manual: ManualImportAdapter, zalo: ZaloAdapter, fb: FacebookAdapter) => {
        return [manual, zalo, fb];
    },
    inject: [ManualImportAdapter, ZaloAdapter, FacebookAdapter],
};

@Module({
    imports: [PrismaModule, RealtimeModule],
    controllers: [WebhookController, MessageImportController, CustomerController, ContactController],
    providers: [
        MessageRepository,
        ChannelAdapterRegistry,
        ReceiveInboundMessage,
        ProcessMessageReceived,
        ImportMessagesUseCase,
        DefaultCustomerGateway,
        DefaultClassificationGateway,
        ManualImportAdapter,
        ZaloAdapter,
        FacebookAdapter,
        queueProvider,
        adaptersProvider,
        customerGatewayProvider,
        classificationGatewayProvider,
    ],
    exports: [
        MessageRepository,
        ChannelAdapterRegistry,
        ReceiveInboundMessage,
        ProcessMessageReceived,
        ImportMessagesUseCase,
        INBOUND_QUEUE,
        CHANNEL_ADAPTERS,
        CUSTOMER_GATEWAY,
        CLASSIFICATION_GATEWAY,
    ],
})
export class MessagingModule {}
