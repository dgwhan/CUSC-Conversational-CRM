import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { InboundMessageQueue } from "../domain/channel-adapter.port.js";
import { ProcessMessageReceived } from "../application/process-message-received.usecase.js";

export const INBOUND_MESSAGES_QUEUE = 'inbound-messages';
export const MESSAGE_RECEIVED_JOB = 'message.received';

@Injectable()
export class BullMqInboundQueue implements InboundMessageQueue {
    constructor(@InjectQueue(INBOUND_MESSAGES_QUEUE) private readonly queue: Queue) {}

    async enqueue(messageIds: string[]): Promise<void> {
        await this.queue.addBulk(
            messageIds.map((id) => ({
                name: MESSAGE_RECEIVED_JOB,
                data: { messageId: id },
                opts: {
                    jobId: id,
                    attempts: 5,
                    backoff: { type: 'exponential', delay: 2000 },
                    removeOnComplete: true,
                },
            })),
        );
    }
}

// Worker: chạy ngoài request lắng nghe các job inbound message
@Processor(INBOUND_MESSAGES_QUEUE)
export class InboundMessageProcessor extends WorkerHost {
    private readonly logger = new Logger(InboundMessageProcessor.name);

    constructor(private readonly processUseCase: ProcessMessageReceived) {
        super();
    }

    async process(job: Job<{ messageId: string }>): Promise<void> {
        this.logger.log(`Worker processing job [${job.name}] #${job.id} for message: ${job.data.messageId}`);
        // Chạy usecase: tìm hoặc tạo khách, gọi classification, đặt processed_at
        // Nếu có lỗi, không catch để BullMQ tự động retry theo attempts và backoff
        await this.processUseCase.execute(job.data.messageId);
    }
}
