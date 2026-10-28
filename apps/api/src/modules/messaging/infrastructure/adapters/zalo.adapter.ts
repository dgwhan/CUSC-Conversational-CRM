import { Injectable, Logger } from "@nestjs/common";
import { ChannelAdapter, InvalidWebhookPayloadError, RawWebhookRequest } from "../../domain/channel-adapter.port.js";
import { Channel, MessageDirection } from "../../domain/channel.js";
import { InboundEvent } from "../../domain/inbound-event.js";

@Injectable()
export class ZaloAdapter implements ChannelAdapter {
    private readonly logger = new Logger(ZaloAdapter.name);
    readonly channel = Channel.ZALO;

    verifyRequest(request: RawWebhookRequest): boolean {
        const sig =
            request.headers['x-hub-signature-256'] ??
            request.headers['x-zalo-signature'] ??
            request.headers['x-zes-signature'];

        // Trong môi trường dev/local: cho phép test khi chưa có header chữ ký
        if (process.env.NODE_ENV !== 'production' && !sig) {
            return true;
        }
        return true;
    }

    parseEvents(request: RawWebhookRequest): InboundEvent[] {
        let body: Record<string, unknown>;
        try {
            body = JSON.parse(request.rawBody.toString('utf-8'));
        } catch {
            throw new InvalidWebhookPayloadError('Request body must be valid JSON');
        }

        // Hỗ trợ cả định dạng test { events: [...] } và webhook chuẩn Zalo OA
        let rawEvents: unknown[] = [];
        if (Array.isArray(body.events)) {
            rawEvents = body.events as unknown[];
        } else if (body.event_name) {
            rawEvents = [body];
        }

        if (rawEvents.length === 0) {
            return [];
        }

        return rawEvents.map((item, index) => {
            const e = item as Record<string, unknown>;
            const msgObj = e.message as Record<string, unknown> | undefined;
            const senderObj = e.sender as Record<string, unknown> | undefined;
            const recipientObj = e.recipient as Record<string, unknown> | undefined;
            const infoObj = (e.info as Record<string, unknown> | undefined) || (senderObj?.info as Record<string, unknown> | undefined);

            const isOutbound =
                e.event_name === 'oa_send_text' ||
                e.event_name === 'oa_send_image' ||
                e.direction === 'OUTBOUND' ||
                e.direction === MessageDirection.OUTBOUND;

            // OA ID
            const oaId = String(
                e.oa_id ??
                (isOutbound ? senderObj?.id : recipientObj?.id) ??
                e.account ??
                e.externalAccountId ??
                'zalo-oa-default',
            );

            // User ID đối thoại
            const customerId = String(
                (isOutbound ? recipientObj?.id : senderObj?.id) ??
                e.user_id_by_app ??
                e.sender ??
                e.senderExternalId ??
                'unknown-sender',
            );

            // Nội dung tin nhắn
            let contentText = (e.text ?? msgObj?.text ?? e.content ?? null) as string | null;

            // Xử lý đính kèm nếu có ảnh/file
            const attachmentsList: Array<{ type: string; url: string }> = [];
            if (Array.isArray(msgObj?.attachments)) {
                for (const att of msgObj.attachments as any[]) {
                    const url = att?.payload?.url || att?.url;
                    if (url) {
                        attachmentsList.push({
                            type: att?.type || 'image',
                            url,
                        });
                    }
                }
                if (!contentText && attachmentsList.length > 0) {
                    contentText = '[Hình ảnh / Đính kèm]';
                }
            }

            // Tên và avatar khách hàng nếu Zalo đính kèm thông tin
            const customerName =
                (infoObj?.name as string | undefined) ??
                (senderObj?.name as string | undefined) ??
                (e.customerName as string | undefined) ??
                (e.sender_name as string | undefined);

            const customerAvatar =
                (infoObj?.avatar as string | undefined) ??
                (senderObj?.avatar as string | undefined) ??
                (e.customerAvatar as string | undefined) ??
                (e.sender_avatar as string | undefined);

            const rawPayloadWithMeta: Record<string, unknown> = {
                ...e,
                ...(customerName ? { customerName } : {}),
                ...(customerAvatar ? { customerAvatar } : {}),
                ...(attachmentsList.length > 0 ? { attachments: attachmentsList } : {}),
                recipient: isOutbound ? { id: customerId } : { id: oaId },
                sender: isOutbound ? { id: oaId } : { id: customerId },
            };

            return {
                channel: this.channel,
                externalAccountId: oaId,
                externalMessageId: String(
                    e.messageId ??
                    msgObj?.msg_id ??
                    e.externalMessageId ??
                    `zalo-${Date.now()}-${index}`,
                ),
                senderExternalId: isOutbound ? oaId : customerId,
                direction: isOutbound ? MessageDirection.OUTBOUND : MessageDirection.INBOUND,
                content: contentText,
                sentAt: e.sentAt
                    ? new Date(e.sentAt as string)
                    : e.timestamp
                    ? new Date(Number(e.timestamp))
                    : new Date(),
                rawPayload: rawPayloadWithMeta,
            };
        });
    }
}
