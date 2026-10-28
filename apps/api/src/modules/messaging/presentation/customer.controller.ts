import {
    Controller,
    Get,
    Patch,
    Param,
    Body,
    Headers,
    Query,
    Optional,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { RealtimeService } from '../../realtime/realtime.service.js';

/**
 * Controller managing workspace customers, recruitment leads, and pipeline stages.
 */
@Controller('customers')
export class CustomerController {
    private readonly logger = new Logger(CustomerController.name);

    constructor(
        private readonly prisma: PrismaService,
        @Optional() private readonly realtime?: RealtimeService,
    ) { }

    /**
     * Retrieve list of customers within a workspace, supporting search and conversation snippet retrieval.
     */
    @Get()
    async getCustomers(
        @Headers('x-workspace-id') headerWsId?: string,
        @Query('workspaceId') queryWsId?: string,
        @Query('search') search?: string,
    ) {
        const workspaceId = queryWsId || headerWsId;
        const where: any = {};

        if (workspaceId) {
            where.workspaceId = workspaceId;
        }

        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const items = await this.prisma.customer.findMany({
            where,
            include: {
                conversations: {
                    include: {
                        channelAccount: {
                            select: {
                                displayName: true,
                                channel: true,
                                avatarUrl: true,
                            },
                        },
                    },
                    orderBy: { lastMessageAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
        });

        const mappedItems = items.map((c: any) => {
            const identities = (c.channelIdentities as any) || {};

            return {
                ...c,
                leadStatus: c.leadStatus || identities.leadStatus || 'NEW',
                leadStage: c.leadStage || identities.leadStage || null,
                interestCourses: identities.interestCourses || [],
                estimatedValue: identities.estimatedValue || 0,
            };
        });

        return { items: mappedItems, total: items.length };
    }

    /**
     * Update customer profile, recruitment pipeline stage, and lead qualification status.
     * Automatically broadcasts real-time pipeline changes to connected staff.
     */
    @Patch(':id')
    async updateCustomer(
        @Param('id') id: string,
        @Body() body: {
            fullName?: string;
            phone?: string;
            email?: string;
            interestCourses?: string[];
            estimatedValue?: number;
            leadStage?: string;
            leadStatus?: string;
            updatedBy?: string;
        },
    ) {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let existing: any = null;

        //Match exact standard UUID
        if (UUID_REGEX.test(id)) {
            try {
                existing = await this.prisma.customer.findUnique({ where: { id } });
            } catch {
                existing = null;
            }
        }

        //Match prefixed UUIDs (e.g., cust-<uuid> or cand-<uuid>)
        if (!existing) {
            const strippedUuid = id.replace(/^(cust|cand)-/, '');
            if (UUID_REGEX.test(strippedUuid)) {
                try {
                    existing = await this.prisma.customer.findUnique({ where: { id: strippedUuid } });
                } catch {
                    existing = null;
                }
            }
        }

        //Fallback to socialId or personal identifier lookups
        if (!existing) {
            const cleanSocialId = id.replace(/^(cust|cand)-(facebook-|zalo-)?/, '').replace(/^(facebook|zalo)-/, '');
            try {
                existing = await this.prisma.customer.findFirst({
                    where: {
                        OR: [
                            { channelIdentities: { path: ['facebook'], equals: cleanSocialId } },
                            { channelIdentities: { path: ['zalo'], equals: cleanSocialId } },
                            { channelIdentities: { path: ['socialId'], equals: cleanSocialId } },
                            { channelIdentities: { path: ['facebook'], equals: id } },
                            ...(body.phone ? [{ phone: body.phone }] : []),
                            ...(body.email ? [{ email: body.email }] : []),
                            ...(body.fullName ? [{ fullName: body.fullName }] : []),
                        ],
                    },
                });
            } catch {
                existing = null;
            }
        }

        //Upsert fallback: Provision new Customer if not found in database
        if (!existing) {
            const cleanSocialId = id.replace(/^(cust|cand)-(facebook-|zalo-)?/, '').replace(/^(facebook|zalo)-/, '');
            let newCust: any;
            try {
                newCust = await this.prisma.customer.create({
                    data: {
                        fullName: body.fullName || (id.startsWith('cand-') ? 'Ứng viên mới' : 'Khách hàng'),
                        phone: body.phone || null,
                        email: body.email || null,
                        leadStatus: body.leadStatus || 'NEW',
                        leadStage: body.leadStage || 'STAGE_NEW',
                        channelIdentities: {
                            socialId: cleanSocialId,
                            facebook: cleanSocialId,
                            leadStatus: body.leadStatus || 'NEW',
                            leadStage: body.leadStage || 'STAGE_NEW',
                            ...(body.interestCourses !== undefined ? { interestCourses: body.interestCourses } : {}),
                            ...(body.estimatedValue !== undefined ? { estimatedValue: body.estimatedValue } : {}),
                        },
                    },
                });
            } catch {
                newCust = await this.prisma.customer.create({
                    data: {
                        fullName: body.fullName || (id.startsWith('cand-') ? 'Ứng viên mới' : 'Khách hàng'),
                        phone: body.phone || null,
                        email: body.email || null,
                        channelIdentities: {
                            socialId: cleanSocialId,
                            facebook: cleanSocialId,
                            leadStatus: body.leadStatus || 'NEW',
                            leadStage: body.leadStage || 'STAGE_NEW',
                            ...(body.interestCourses !== undefined ? { interestCourses: body.interestCourses } : {}),
                            ...(body.estimatedValue !== undefined ? { estimatedValue: body.estimatedValue } : {}),
                        },
                    },
                });
            }

            if (body.leadStage !== undefined || body.leadStatus !== undefined) {
                try {
                    this.realtime?.broadcastPipelineChange({
                        customerId: newCust.id,
                        customerName: newCust.fullName,
                        newStage: (body.leadStage || 'STAGE_NEW') as string,
                        previousStage: 'STAGE_NEW',
                        updatedBy: body.updatedBy || 'Hệ thống CRM',
                    });
                } catch { }
            }

            return {
                ...newCust,
                leadStatus: newCust.leadStatus || body.leadStatus || 'NEW',
                leadStage: newCust.leadStage || body.leadStage || 'STAGE_NEW',
                interestCourses: body.interestCourses || [],
                estimatedValue: body.estimatedValue || 0,
            };
        }

        const currentIdentities = (existing.channelIdentities as any) || {};
        const updatedIdentities = {
            ...currentIdentities,
            ...(body.interestCourses !== undefined ? { interestCourses: body.interestCourses } : {}),
            ...(body.estimatedValue !== undefined ? { estimatedValue: body.estimatedValue } : {}),
            ...(body.leadStage !== undefined ? { leadStage: body.leadStage } : {}),
            ...(body.leadStatus !== undefined ? { leadStatus: body.leadStatus } : {}),
        };

        let updated: any;
        try {
            updated = await this.prisma.customer.update({
                where: { id: existing.id },
                data: {
                    ...(body.fullName ? { fullName: body.fullName } : {}),
                    ...(body.phone !== undefined ? { phone: body.phone } : {}),
                    ...(body.email !== undefined ? { email: body.email } : {}),
                    ...(body.leadStatus !== undefined ? { leadStatus: body.leadStatus } : {}),
                    ...(body.leadStage !== undefined ? { leadStage: body.leadStage } : {}),
                    channelIdentities: updatedIdentities,
                },
            });
        } catch {
            updated = await this.prisma.customer.update({
                where: { id: existing.id },
                data: {
                    ...(body.fullName ? { fullName: body.fullName } : {}),
                    ...(body.phone !== undefined ? { phone: body.phone } : {}),
                    ...(body.email !== undefined ? { email: body.email } : {}),
                    channelIdentities: updatedIdentities,
                },
            });
        }

        if (body.leadStage !== undefined || body.leadStatus !== undefined) {
            try {
                this.realtime?.broadcastPipelineChange({
                    customerId: existing.id,
                    customerName: updated.fullName,
                    newStage: (body.leadStage || existing.leadStage || 'STAGE_NEW') as string,
                    previousStage: (existing.leadStage || 'STAGE_NEW') as string,
                    updatedBy: body.updatedBy || 'Hệ thống CRM',
                });
            } catch { }
        }

        return {
            ...updated,
            leadStatus: updated.leadStatus || updatedIdentities.leadStatus || 'NEW',
            leadStage: updated.leadStage || updatedIdentities.leadStage || null,
            interestCourses: updatedIdentities.interestCourses || [],
            estimatedValue: updatedIdentities.estimatedValue || 0,
        };
    }
}
