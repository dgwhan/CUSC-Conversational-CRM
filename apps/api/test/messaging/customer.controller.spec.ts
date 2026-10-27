import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CustomerController } from '../../src/modules/messaging/presentation/customer.controller.js';
import type { PrismaService } from '../../src/platform/database/prisma.service.js';
import type { RealtimeService } from '../../src/modules/realtime/realtime.service.js';

describe('CustomerController', () => {
    let controller: CustomerController;
    let mockPrisma: any;
    let mockRealtime: Partial<RealtimeService>;

    beforeEach(() => {
        mockPrisma = {
            customer: {
                findMany: vi.fn(),
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                update: vi.fn(),
            },
        };

        mockRealtime = {
            broadcastPipelineChange: vi.fn(),
        };

        controller = new CustomerController(
            mockPrisma as unknown as PrismaService,
            mockRealtime as unknown as RealtimeService,
        );
    });

    describe('getCustomers', () => {
        it('trả về danh sách khách hàng kèm leadStatus và leadStage', async () => {
            mockPrisma.customer.findMany.mockResolvedValue([
                {
                    id: 'cust-1',
                    fullName: 'Nguyễn Văn A',
                    phone: '0901234567',
                    email: 'a@example.com',
                    leadStatus: 'POTENTIAL',
                    leadStage: 'STAGE_QUALIFIED',
                    channelIdentities: { interestCourses: ['Lập trình viên'], estimatedValue: 25000000 },
                    conversations: [],
                },
                {
                    id: 'cust-2',
                    fullName: 'Trần Thị B',
                    phone: '0907654321',
                    email: null,
                    leadStatus: null,
                    leadStage: null,
                    channelIdentities: { leadStatus: 'CONVERTED', leadStage: 'STAGE_ENROLLED' },
                    conversations: [],
                },
            ]);

            const result = await controller.getCustomers('ws-1');

            expect(result.total).toBe(2);
            expect(result.items[0].leadStatus).toBe('POTENTIAL');
            expect(result.items[0].leadStage).toBe('STAGE_QUALIFIED');
            expect(result.items[0].interestCourses).toEqual(['Lập trình viên']);

            // Fallback sang channelIdentities nếu cột null
            expect(result.items[1].leadStatus).toBe('CONVERTED');
            expect(result.items[1].leadStage).toBe('STAGE_ENROLLED');
        });
    });

    describe('updateCustomer', () => {
        it('cập nhật leadStatus, leadStage vào cơ sở dữ liệu và broadcast realtime event', async () => {
            const customerUuid = '11111111-1111-1111-1111-111111111111';
            const existingCustomer = {
                id: customerUuid,
                fullName: 'Nguyễn Văn A',
                leadStatus: 'NEW',
                leadStage: 'STAGE_NEW',
                channelIdentities: {},
            };

            mockPrisma.customer.findUnique.mockResolvedValue(existingCustomer);
            mockPrisma.customer.update.mockResolvedValue({
                ...existingCustomer,
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_QUALIFIED',
                channelIdentities: { leadStatus: 'POTENTIAL', leadStage: 'STAGE_QUALIFIED' },
            });

            const result = await controller.updateCustomer(customerUuid, {
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_QUALIFIED',
                updatedBy: 'Tư vấn viên Lan',
            });

            expect(mockPrisma.customer.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: customerUuid },
                    data: expect.objectContaining({
                        leadStatus: 'POTENTIAL',
                        leadStage: 'STAGE_QUALIFIED',
                    }),
                }),
            );

            expect(mockRealtime.broadcastPipelineChange).toHaveBeenCalledWith({
                customerId: customerUuid,
                customerName: 'Nguyễn Văn A',
                newStage: 'STAGE_QUALIFIED',
                previousStage: 'STAGE_NEW',
                updatedBy: 'Tư vấn viên Lan',
            });

            expect(result.leadStatus).toBe('POTENTIAL');
            expect(result.leadStage).toBe('STAGE_QUALIFIED');
        });

        it('tự động tạo mới Customer vào DB khi ID chưa có trong DB (upsert an toàn)', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue(null);
            mockPrisma.customer.findFirst.mockResolvedValue(null);
            mockPrisma.customer.create = vi.fn().mockResolvedValue({
                id: '22222222-2222-2222-2222-222222222222',
                fullName: 'Ứng viên mới',
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_QUALIFIED',
                channelIdentities: {},
            });

            const result = await controller.updateCustomer('cand-123456', {
                fullName: 'Ứng viên mới',
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_QUALIFIED',
            });

            expect(mockPrisma.customer.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        fullName: 'Ứng viên mới',
                        leadStatus: 'POTENTIAL',
                        leadStage: 'STAGE_QUALIFIED',
                    }),
                }),
            );
            expect(result.leadStatus).toBe('POTENTIAL');
        });
    });
});
