import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../../../platform/database/prisma.service.js";
import { Channel } from "../../domain/channel.js";
import { CustomerGateway, CustomerLookupResult } from "../../domain/customer-gateway.port.js";

@Injectable()
export class DefaultCustomerGateway implements CustomerGateway {
    private readonly logger = new Logger(DefaultCustomerGateway.name);

    constructor(
        @Optional() private readonly prisma?: PrismaService,
    ) { }

    async findOrCreate(params: {
        channel: Channel;
        senderExternalId: string;
        displayName?: string | null;
        rawPayload?: unknown;
    }): Promise<CustomerLookupResult> {
        this.logger.log(`Find or create customer for ${params.channel}:${params.senderExternalId}`);

        if (!this.prisma) {
            return {
                id: `cust-${params.channel.toLowerCase()}-${params.senderExternalId}`,
                isNew: false,
            };
        }

        //Check existing identity
        const existingIdentity = await this.prisma.channelIdentity.findUnique({
            where: {
                channel_externalUserId: {
                    channel: params.channel,
                    externalUserId: params.senderExternalId,
                },
            },
            include: {
                contact: true,
            },
        });

        if (existingIdentity) {
            this.logger.log(
                `Found existing identity for ${params.channel}:${params.senderExternalId} pointing to contact ${existingIdentity.contactId}`,
            );

            //Update placeholder name if profile provides a better name
            const profileDisplayName = await this.resolveDisplayName(params);
            if (
                profileDisplayName &&
                existingIdentity.contact &&
                (existingIdentity.contact.displayName.startsWith('Khách hàng') ||
                    existingIdentity.contact.displayName.startsWith('Unknown'))
            ) {
                await this.prisma.contact
                    .update({
                        where: { id: existingIdentity.contactId },
                        data: { displayName: profileDisplayName },
                    })
                    .catch(() => { });
            }

            return {
                id: existingIdentity.contactId,
                contactId: existingIdentity.contactId,
                isNew: false,
                contact: existingIdentity.contact,
                identity: existingIdentity,
            };
        }

        // 2. Resolve display name
        const displayName =
            (await this.resolveDisplayName(params)) ||
            `Khách hàng ${params.channel} #${params.senderExternalId.slice(-4)}`;

        try {
            // 3. Create contact
            const contact = await this.prisma.contact.create({
                data: {
                    displayName,
                },
            });

            // 4. Link channel identity
            const identity = await this.prisma.channelIdentity.upsert({
                where: {
                    channel_externalUserId: {
                        channel: params.channel,
                        externalUserId: params.senderExternalId,
                    },
                },
                update: {
                    contactId: contact.id,
                },
                create: {
                    contactId: contact.id,
                    channel: params.channel,
                    externalUserId: params.senderExternalId,
                },
                include: {
                    contact: true,
                },
            });

            // If race condition occurred, clean up orphan contact
            if (identity.contactId !== contact.id) {
                await this.prisma.contact.delete({ where: { id: contact.id } }).catch(() => { });
                return {
                    id: identity.contactId,
                    contactId: identity.contactId,
                    isNew: false,
                    contact: identity.contact,
                    identity,
                };
            }

            this.logger.log(
                `Created new contact ${contact.id} and linked identity for ${params.channel}:${params.senderExternalId}`,
            );

            return {
                id: contact.id,
                contactId: contact.id,
                isNew: true,
                contact,
                identity,
            };
        } catch (err: any) {
            // Handle unique constraint conflict (P2002)
            if (err?.code === 'P2002') {
                const found = await this.prisma.channelIdentity.findUnique({
                    where: {
                        channel_externalUserId: {
                            channel: params.channel,
                            externalUserId: params.senderExternalId,
                        },
                    },
                    include: { contact: true },
                });
                if (found) {
                    return {
                        id: found.contactId,
                        contactId: found.contactId,
                        isNew: false,
                        contact: found.contact,
                        identity: found,
                    };
                }
            }
            throw err;
        }
    }

    private async resolveDisplayName(params: {
        channel: Channel;
        senderExternalId: string;
        displayName?: string | null;
        rawPayload?: unknown;
    }): Promise<string | null> {
        //Explicit displayName
        if (params.displayName && params.displayName.trim()) {
            return params.displayName.trim();
        }

        //Extract from raw payload
        if (params.rawPayload && typeof params.rawPayload === 'object') {
            const raw = params.rawPayload as Record<string, unknown>;
            if (typeof raw.customerName === 'string' && raw.customerName.trim()) {
                return raw.customerName.trim();
            }
            if (typeof raw.displayName === 'string' && raw.displayName.trim()) {
                return raw.displayName.trim();
            }
            if (typeof raw.name === 'string' && raw.name.trim()) {
                return raw.name.trim();
            }
            if (raw.sender && typeof raw.sender === 'object') {
                const sender = raw.sender as Record<string, unknown>;
                if (typeof sender.name === 'string' && sender.name.trim()) return sender.name.trim();
                if (typeof sender.displayName === 'string' && sender.displayName.trim()) return sender.displayName.trim();
            }
            if (raw.profile && typeof raw.profile === 'object') {
                const profile = raw.profile as Record<string, unknown>;
                if (typeof profile.name === 'string' && profile.name.trim()) return profile.name.trim();
                if (typeof profile.displayName === 'string' && profile.displayName.trim()) return profile.displayName.trim();
            }
            if (raw.user && typeof raw.user === 'object') {
                const user = raw.user as Record<string, unknown>;
                if (typeof user.name === 'string' && user.name.trim()) return user.name.trim();
            }
        }

        //Fetch from channel API
        if (!this.prisma) return null;

        try {
            if (params.channel === Channel.FACEBOOK) {
                const account = await this.prisma.channelAccount.findFirst({
                    where: {
                        channel: Channel.FACEBOOK,
                        isActive: true,
                        encryptedAccessToken: { not: null },
                    },
                    orderBy: { updatedAt: 'desc' },
                });
                const token = account?.encryptedAccessToken || process.env.META_PAGE_ACCESS_TOKEN;
                if (token && params.senderExternalId && params.senderExternalId !== 'unknown-sender') {
                    const res = await fetch(
                        `https://graph.facebook.com/v19.0/${params.senderExternalId}?fields=name,first_name,last_name&access_token=${token}`,
                    );
                    if (res.ok) {
                        const data = (await res.json()) as { name?: string };
                        if (data?.name && data.name.trim()) {
                            return data.name.trim();
                        }
                    }
                }
            } else if (params.channel === Channel.ZALO) {
                const account = await this.prisma.channelAccount.findFirst({
                    where: {
                        channel: Channel.ZALO,
                        isActive: true,
                        encryptedAccessToken: { not: null },
                    },
                    orderBy: { updatedAt: 'desc' },
                });
                const token = account?.encryptedAccessToken || process.env.ZALO_OA_ACCESS_TOKEN;
                if (token && params.senderExternalId && params.senderExternalId !== 'unknown-sender') {
                    const res = await fetch(
                        `https://openapi.zalo.me/v3.0/oa/user/detail?data={"user_id":"${params.senderExternalId}"}`,
                        { headers: { access_token: token } },
                    );
                    if (res.ok) {
                        const data = (await res.json()) as { data?: { display_name?: string } };
                        if (data?.data?.display_name && data.data.display_name.trim()) {
                            return data.data.display_name.trim();
                        }
                    }
                }
            }
        } catch {
            // Ignore profile API errors
        }

        return null;
    }
}
