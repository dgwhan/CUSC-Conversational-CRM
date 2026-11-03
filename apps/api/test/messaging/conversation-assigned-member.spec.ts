import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CustomerService } from '../../src/modules/messaging/application/customer.service.js';

describe('CustomerService - Conversation Assigned Member & Referential Integrity', () => {
    let service: CustomerService;
    let mockPrisma: any;

    const wsId = '11111111-1111-1111-1111-111111111111';
    const memberId = '22222222-2222-2222-2222-222222222222';
    const userId = '33333333-3333-3333-3333-333333333333';
    const convId = '44444444-4444-4444-4444-444444444444';
    const custId = '55555555-5555-5555-5555-555555555555';

    beforeEach(() => {
        mockPrisma = {
            workspaceMember: {
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                create: vi.fn(),
            },
            user: {
                findUnique: vi.fn(),
            },
            conversation: {
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                update: vi.fn(),
                updateMany: vi.fn(),
            },
            customer: {
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                update: vi.fn(),
                create: vi.fn(),
            },
        };

        service = new CustomerService(mockPrisma);
    });

    describe('resolveWorkspaceMemberId (Đảm bảo tính toàn vẹn tham chiếu)', () => {
        it('trả về null nếu staffId rỗng hoặc unassigned', async () => {
            expect(await service.resolveWorkspaceMemberId(null, wsId)).toBeNull();
            expect(await service.resolveWorkspaceMemberId('', wsId)).toBeNull();
            expect(await service.resolveWorkspaceMemberId('unassigned', wsId)).toBeNull();
        });

        it('trả về null nếu staffId không phải cú pháp UUID hợp lệ', async () => {
            expect(await service.resolveWorkspaceMemberId('not-a-uuid', wsId)).toBeNull();
        });

        it('phân giải thành công nếu staffId là WorkspaceMember.id trực tiếp', async () => {
            mockPrisma.workspaceMember.findUnique.mockResolvedValueOnce({
                id: memberId,
                workspaceId: wsId,
                isActive: true,
            });

            const result = await service.resolveWorkspaceMemberId(memberId, wsId);
            expect(result).toBe(memberId);
            expect(mockPrisma.workspaceMember.findUnique).toHaveBeenCalledWith({
                where: { id: memberId },
                select: { id: true, workspaceId: true, isActive: true },
            });
        });

        it('phân giải thành công nếu staffId là User.id thuộc WorkspaceMember', async () => {
            // findUnique theo id trả về null
            mockPrisma.workspaceMember.findUnique.mockResolvedValueOnce(null);
            // findUnique theo workspaceId_userId trả về memberId
            mockPrisma.workspaceMember.findUnique.mockResolvedValueOnce({
                id: memberId,
            });

            const result = await service.resolveWorkspaceMemberId(userId, wsId);
            expect(result).toBe(memberId);
            expect(mockPrisma.workspaceMember.findUnique).toHaveBeenCalledWith({
                where: {
                    workspaceId_userId: {
                        workspaceId: wsId,
                        userId: userId,
                    },
                },
                select: { id: true },
            });
        });

        it('tự động tạo WorkspaceMember (auto-provision) nếu User tồn tại trong DB nhưng chưa có trong Workspace', async () => {
            mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
            mockPrisma.user.findUnique.mockResolvedValueOnce({ id: userId });
            mockPrisma.workspaceMember.create.mockResolvedValueOnce({ id: memberId });

            const result = await service.resolveWorkspaceMemberId(userId, wsId);
            expect(result).toBe(memberId);
            expect(mockPrisma.workspaceMember.create).toHaveBeenCalledWith({
                data: {
                    workspaceId: wsId,
                    userId: userId,
                    role: 'STAFF',
                    isActive: true,
                },
                select: { id: true },
            });
        });

        it('trả về null để bảo vệ khóa ngoại (referential integrity) nếu không tìm thấy User hoặc Member nào', async () => {
            mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const unknownId = '99999999-9999-9999-9999-999999999999';
            const result = await service.resolveWorkspaceMemberId(unknownId, wsId);
            expect(result).toBeNull();
        });
    });

    describe('assignConversation', () => {
        it('cập nhật assignedMemberId cho Conversation và channelIdentities cho Customer', async () => {
            mockPrisma.conversation.findUnique.mockResolvedValueOnce({
                id: convId,
                workspaceId: wsId,
                customer: {
                    id: custId,
                    channelIdentities: {},
                },
            });
            mockPrisma.workspaceMember.findUnique.mockResolvedValueOnce({
                id: memberId,
                workspaceId: wsId,
            });
            mockPrisma.conversation.update.mockResolvedValueOnce({
                id: convId,
                assignedMemberId: memberId,
            });
            mockPrisma.customer.update.mockResolvedValueOnce({
                id: custId,
            });

            const res = await service.assignConversation(convId, memberId, 'Nguyễn Tư Vấn', wsId);

            expect(res.success).toBe(true);
            expect(res.assignedMemberId).toBe(memberId);
            expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
                where: { id: convId },
                data: { assignedMemberId: memberId },
            });
            expect(mockPrisma.customer.update).toHaveBeenCalledWith({
                where: { id: custId },
                data: {
                    channelIdentities: {
                        assignedStaffId: memberId,
                        assignedStaffName: 'Nguyễn Tư Vấn',
                        assignedMemberId: memberId,
                    },
                },
            });
        });

        it('cho phép hủy phân công (unassign) an toàn bằng cách gán null', async () => {
            mockPrisma.conversation.findUnique.mockResolvedValueOnce({
                id: convId,
                workspaceId: wsId,
                customer: {
                    id: custId,
                    channelIdentities: { assignedMemberId: memberId },
                },
            });
            mockPrisma.conversation.update.mockResolvedValueOnce({
                id: convId,
                assignedMemberId: null,
            });
            mockPrisma.customer.update.mockResolvedValueOnce({
                id: custId,
            });

            const res = await service.assignConversation(convId, null, null, wsId);

            expect(res.success).toBe(true);
            expect(res.assignedMemberId).toBeNull();
            expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
                where: { id: convId },
                data: { assignedMemberId: null },
            });
        });
    });

    describe('updateCustomer đồng bộ Conversation assignedMemberId', () => {
        it('khi cập nhật assignedStaffId, tự động đồng bộ assignedMemberId vào Conversation', async () => {
            mockPrisma.customer.findUnique.mockResolvedValueOnce({
                id: custId,
                workspaceId: wsId,
                channelIdentities: {},
                conversations: [{ id: convId }],
            });
            mockPrisma.workspaceMember.findUnique.mockResolvedValueOnce({
                id: memberId,
                workspaceId: wsId,
            });
            mockPrisma.customer.update.mockResolvedValueOnce({
                id: custId,
                fullName: 'Khách hàng A',
                channelIdentities: {
                    assignedStaffId: memberId,
                    assignedStaffName: 'Nhân viên B',
                    assignedMemberId: memberId,
                },
            });
            mockPrisma.conversation.update.mockResolvedValueOnce({
                id: convId,
                assignedMemberId: memberId,
            });

            const res = await service.updateCustomer(
                custId,
                {
                    assignedStaffId: memberId,
                    assignedStaffName: 'Nhân viên B',
                    conversationId: convId,
                },
                wsId,
            );

            expect(res.assignedStaffId).toBe(memberId);
            expect(res.assignedMemberId).toBe(memberId);
            expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
                where: { id: convId },
                data: { assignedMemberId: memberId },
            });
        });
    });
});
