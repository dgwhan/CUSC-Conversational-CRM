import { Logger, Module, Provider } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { ChannelAdapterRegistry, CHANNEL_ADAPTERS } from './application/channel-adapter.registry.js';
import { ReceiveInboundMessage } from './application/receive-inbound-message.usecase.js';
import { MessageRepository } from './infrastructure/message.repository.js';
import { WebhookController } from './presentation/webhook.controller.js';
import { INBOUND_QUEUE, InboundMessageQueue } from './domain/channel-adapter.port.js';
import { ManualImportAdapter } from './infrastructure/adapters/manual-import.adapter.js';
import { ZaloAdapter } from './infrastructure/adapters/zalo.adapter.js';
import { FacebookAdapter } from './infrastructure/adapters/facebook.adapter.js';

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

const adaptersProvider: Provider = {
    provide: CHANNEL_ADAPTERS,
    useFactory: (manual: ManualImportAdapter, zalo: ZaloAdapter, fb: FacebookAdapter) => {
        return [manual, zalo, fb];
    },
    inject: [ManualImportAdapter, ZaloAdapter, FacebookAdapter],
};

@Module({
    imports: [PrismaModule],
    controllers: [WebhookController],
    providers: [
        MessageRepository,
        ChannelAdapterRegistry,
        ReceiveInboundMessage,
        ManualImportAdapter,
        ZaloAdapter,
        FacebookAdapter,
        queueProvider,
        adaptersProvider,
    ],
    exports: [
        MessageRepository,
        ChannelAdapterRegistry,
        ReceiveInboundMessage,
        INBOUND_QUEUE,
        CHANNEL_ADAPTERS,
    ],
})
export class MessagingModule {}
