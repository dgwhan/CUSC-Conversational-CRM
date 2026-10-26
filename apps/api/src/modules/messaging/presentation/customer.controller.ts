import {
    Controller,
    Get,
    Patch,
    Param,
    Body,
    Headers,
    Query,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';

@Controller('customers')
export class CustomerController {
    constructor(private readonly prisma: PrismaService) {}

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
                interestCourses: identities.interestCourses || [],
                estimatedValue: identities.estimatedValue || 0,
                leadStage: identities.leadStage || null,
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
        },
    ) {
        let existing = await this.prisma.customer.findUnique({ where: { id } });
        if (!existing) {
            // Hỗ trợ tìm kiếm theo ID định dạng cust-XXX nếu frontend truyền dạng tiền tố
            const rawId = id.replace(/^cust-/, '');
            existing = await this.prisma.customer.findFirst({
                where: {
                    OR: [
                        { id: rawId.length === 36 ? rawId : undefined },
                        { channelIdentities: { path: ['facebook'], equals: rawId } },
                    ],
                },
            });
        }

        if (!existing) {
            throw new NotFoundException(`Không tìm thấy khách hàng với ID ${id}`);
        }

        const currentIdentities = (existing.channelIdentities as any) || {};
        const updatedIdentities = {
            ...currentIdentities,
            ...(body.interestCourses !== undefined ? { interestCourses: body.interestCourses } : {}),
            ...(body.estimatedValue !== undefined ? { estimatedValue: body.estimatedValue } : {}),
            ...(body.leadStage !== undefined ? { leadStage: body.leadStage } : {}),
            ...(body.leadStatus !== undefined ? { leadStatus: body.leadStatus } : {}),
        };

        const updated = await this.prisma.customer.update({
            where: { id: existing.id },
            data: {
                ...(body.fullName ? { fullName: body.fullName } : {}),
                ...(body.phone !== undefined ? { phone: body.phone } : {}),
                ...(body.email !== undefined ? { email: body.email } : {}),
                channelIdentities: updatedIdentities,
            },
        });

        return updated;
    }
}
