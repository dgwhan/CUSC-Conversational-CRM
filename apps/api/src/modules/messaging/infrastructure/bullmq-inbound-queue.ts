import { Injectable } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { InboundMessageQueue } from "../domain/channel-adapter.port.js";

@Injectable()
export class BullMqInboundQueue implements InboundMessageQueue {
    constructor(@InjectQueue('inbound-messages') private readonly queue: Queue) {}

    async enqueue(messageIds: string[]): Promise<void> {
        await this.queue.addBulk(
            messageIds.map((id) => ({
                name: 'process',
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

// Worker: chạy ngoài request
@Processor('inbound-messages')
export class InboundMessageProcessor extends WorkerHost {
    async process(_job: Job<{ messageId: string }>): Promise<void> {
        // 1. đọc message  2. phân loại (module classification)
        // 3. tạo/cập nhật lead  4. set processed_at = now()
    }
}
