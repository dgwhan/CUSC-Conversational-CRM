import {
    Controller,
    Get,
    Patch,
    Param,
    Body,
    Headers,
    Query,
    NotFoundException,
    Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { RealtimeService } from '../../realtime/realtime.service.js';

@Controller('customers')
export class CustomerController {
    constructor(
        private readonly prisma: PrismaService,
        @Optional() private readonly realtime?: RealtimeService,
    ) {}

    /**
     * Lấy danh sách khách hàng trong Workspace để hiển thị trên Phễu Kanban & Quản lý danh bạ
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
     * Cập nhật thông tin khách hàng (bao gồm Khóa học / Dự án / Gói dịch vụ quan tâm và giá trị dự kiến)
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

        // 1. Tìm nếu id truyền vào là định dạng UUID chuẩn
        if (UUID_REGEX.test(id)) {
            try {
                existing = await this.prisma.customer.findUnique({ where: { id } });
            } catch {
                existing = null;
            }
        }

        // 2. Tìm nếu id có tiền tố như cust-<uuid> hoặc cand-<uuid>
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

        // 3. Tìm theo Social ID (facebook, zalo, socialId) hoặc theo Email, Phone, Tên
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

        // 4. Nếu khách hàng chưa tồn tại trong CSDL (ví dụ ứng viên mới thêm thủ công hoặc từ tin nhắn chưa tạo Customer),
        // tự động tạo mới Customer vào DB với trạng thái đã chọn thay vì lỗi 404
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
                // Fallback nếu CSDL chưa có cột lead_status / lead_stage
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
                        newStage: (body.leadStage || body.leadStatus || 'STAGE_NEW') as string,
                        previousStage: 'STAGE_NEW',
                        updatedBy: body.updatedBy || 'Hệ thống CRM',
                    });
                } catch {}
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
            // Fallback an toàn nếu cột lead_status / lead_stage chưa có trong CSDL
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
                    newStage: (body.leadStage || body.leadStatus || 'STAGE_NEW') as string,
                    previousStage: (existing.leadStage || existing.leadStatus || 'STAGE_NEW') as string,
                    updatedBy: body.updatedBy || 'Hệ thống CRM',
                });
            } catch {}
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
