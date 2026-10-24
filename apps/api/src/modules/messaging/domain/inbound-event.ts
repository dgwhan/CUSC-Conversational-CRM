import type { Channel, MessageDirection } from "./channel.js";

export interface InboundEvent {
    readonly workspaceId?: string;
    readonly channel: Channel;
    readonly externalAccountId: string;
    readonly externalMessageId: string;
    readonly senderExternalId: string;
    readonly direction: MessageDirection;
    readonly content: string | null;
    readonly sentAt: Date;
    readonly rawPayload: unknown;
}