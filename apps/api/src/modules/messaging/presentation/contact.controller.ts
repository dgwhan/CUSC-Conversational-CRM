import {
    Controller,
    Get,
    Query,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { Channel } from '../domain/channel.js';

/**
 * Controller managing Contact and ChannelIdentity query endpoints.
 * Part of the "Find or create a customer when a message arrives" phase.
 */
@Controller('contacts')
export class ContactController {
    private readonly logger = new Logger(ContactController.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Retrieve all contacts along with their linked channel identities.
     */
    @Get()
    async getContacts() {
        const items = await this.prisma.contact.findMany({
            include: { channelIdentities: true },
            orderBy: { updatedAt: 'desc' },
        });
        return { items, total: items.length };
    }

    /**
     * Look up a contact and its channel identities by channel & external user ID, phone, or email.
     */
    @Get('lookup')
    async lookupContact(
        @Query('channel') channel?: string,
        @Query('externalUserId') externalUserId?: string,
        @Query('phone') phone?: string,
        @Query('email') email?: string,
    ) {
        if (channel && externalUserId) {
            const identity = await this.prisma.channelIdentity.findUnique({
                where: {
                    channel_externalUserId: {
                        channel: channel.toUpperCase() as Channel,
                        externalUserId,
                    },
                },
                include: {
                    contact: {
                        include: { channelIdentities: true },
                    },
                },
            });
            if (identity) {
                return { contact: identity.contact, channelIdentities: identity.contact.channelIdentities };
            }
        }

        if (phone) {
            const contact = await this.prisma.contact.findFirst({
                where: { phoneNormalized: phone },
                include: { channelIdentities: true },
            });
            if (contact) return { contact, channelIdentities: contact.channelIdentities };
        }

        if (email) {
            const contact = await this.prisma.contact.findFirst({
                where: { email },
                include: { channelIdentities: true },
            });
            if (contact) return { contact, channelIdentities: contact.channelIdentities };
        }

        return { contact: null, channelIdentities: [] };
    }
}
