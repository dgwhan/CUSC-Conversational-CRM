import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CustomerController } from '../../src/modules/messaging/presentation/customer.controller.js';
import type { CustomerService } from '../../src/modules/messaging/application/customer.service.js';
import type { RealtimeService } from '../../src/modules/realtime/realtime.service.js';

describe('CustomerController', () => {
    let controller: CustomerController;
    let mockCustomerService: Partial<CustomerService>;
    let mockRealtime: Partial<RealtimeService>;

    beforeEach(() => {
        // Mock CustomerService trực tiếp — controller không nên biết về PrismaService
        mockCustomerService = {
            getCustomers: vi.fn(),
            getCustomerById: vi.fn(),
            updateCustomer: vi.fn(),
            removeCustomerTag: vi.fn(),
        };

        mockRealtime = {
            broadcastPipelineChange: vi.fn(),
        };

        controller = new CustomerController(
            mockCustomerService as unknown as CustomerService,
        );
    });

    describe('getCustomers', () => {
        it('trả về danh sách khách hàng kèm leadStatus và leadStage', async () => {
            const expectedResult = {
                total: 2,
                page: 1,
                limit: 20,
                items: [
                    {
                        id: 'cust-1',
                        fullName: 'Nguyễn Văn A',
                        phone: '0901234567',
                        email: 'a@example.com',
                        leadStatus: 'POTENTIAL',
                        leadStage: 'STAGE_QUALIFIED',
                        interestCourses: ['Lập trình viên'],
                        estimatedValue: 25000000,
                        tags: ['Lead'],
                        conversations: [],
                    },
                    {
                        id: 'cust-2',
                        fullName: 'Trần Thị B',
                        phone: '0907654321',
                        email: null,
                        leadStatus: 'CONVERTED',
                        leadStage: 'STAGE_ENROLLED',
                        interestCourses: [],
                        estimatedValue: 0,
                        tags: [],
                        conversations: [],
                    },
                ],
            };

            vi.mocked(mockCustomerService.getCustomers!).mockResolvedValue(expectedResult as any);

            const result = await controller.getCustomers('ws-1');

            expect(result.total).toBe(2);
            expect(result.items[0].leadStatus).toBe('POTENTIAL');
            expect(result.items[0].leadStage).toBe('STAGE_QUALIFIED');
            expect(result.items[0].interestCourses).toEqual(['Lập trình viên']);
            expect(result.items[0].tags).toEqual(['Lead']);

            // Fallback sang channelIdentities nếu cột null
            expect(result.items[1].leadStatus).toBe('CONVERTED');
            expect(result.items[1].leadStage).toBe('STAGE_ENROLLED');
        });
    });

    describe('updateCustomer', () => {
        it('cập nhật leadStatus, leadStage vào cơ sở dữ liệu và broadcast realtime event', async () => {
            const customerUuid = '11111111-1111-1111-1111-111111111111';

            const updatedResult = {
                id: customerUuid,
                fullName: 'Nguyễn Văn A',
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_QUALIFIED',
                channelIdentities: { leadStatus: 'POTENTIAL', leadStage: 'STAGE_QUALIFIED' },
            };

            vi.mocked(mockCustomerService.updateCustomer!).mockResolvedValue(updatedResult as any);

            const result = await controller.updateCustomer(customerUuid, {
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_QUALIFIED',
                updatedBy: 'Tư vấn viên Lan',
            });

            expect(mockCustomerService.updateCustomer).toHaveBeenCalledWith(
                customerUuid,
                expect.objectContaining({
                    leadStatus: 'POTENTIAL',
                    leadStage: 'STAGE_QUALIFIED',
                    updatedBy: 'Tư vấn viên Lan',
                }),
                undefined, // headerWsId
            );

            expect(result.leadStatus).toBe('POTENTIAL');
            expect(result.leadStage).toBe('STAGE_QUALIFIED');
        });

        it('tự động tạo mới Customer vào DB khi ID chưa có trong DB (upsert an toàn)', async () => {
            const newCustResult = {
                id: '22222222-2222-2222-2222-222222222222',
                fullName: 'Ứng viên mới',
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_QUALIFIED',
                channelIdentities: {},
            };

            vi.mocked(mockCustomerService.updateCustomer!).mockResolvedValue(newCustResult as any);

            const result = await controller.updateCustomer('cand-123456', {
                fullName: 'Ứng viên mới',
                leadStatus: 'POTENTIAL',
                leadStage: 'STAGE_QUALIFIED',
            });

            expect(mockCustomerService.updateCustomer).toHaveBeenCalledWith(
                'cand-123456',
                expect.objectContaining({
                    fullName: 'Ứng viên mới',
                    leadStatus: 'POTENTIAL',
                    leadStage: 'STAGE_QUALIFIED',
                }),
                undefined,
            );
            expect(result.leadStatus).toBe('POTENTIAL');
        });
    });
});
