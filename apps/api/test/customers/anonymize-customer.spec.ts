import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CustomerService } from '../../src/modules/messaging/application/customer.service.js';
import type { PrismaService } from '../../src/platform/database/prisma.service.js';
import type { RealtimeService } from '../../src/modules/realtime/realtime.service.js';

describe('Customer Anonymization (Nghị định 13/2023/NĐ-CP)', () => {
  let service: CustomerService;
  let mockPrisma: any;
  let mockRealtime: Partial<RealtimeService>;

  beforeEach(() => {
    mockRealtime = {
      broadcastPipelineChange: vi.fn(),
    };

    mockPrisma = {
      customer: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      contact: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      channelIdentity: {
        deleteMany: vi.fn(),
      },
      message: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      conversation: {
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockPrisma);
      }),
    };

    service = new CustomerService(
      mockPrisma as unknown as PrismaService,
      mockRealtime as unknown as RealtimeService,
    );
  });

  it('báo lỗi NotFoundException nếu khách hàng không tồn tại', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.anonymizeCustomer('workspace-1', 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('tiêu chí hoàn thành: sau khi ẩn danh không còn tên hay SĐT truy ra người đó, giữ lại số liệu phễu và doanh số', async () => {
    const rawCustomer = {
      id: 'cust-abc-1234',
      workspaceId: 'workspace-1',
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      phoneNormalized: '+84912345678',
      email: 'nguyenvana@gmail.com',
      avatarUrl: 'https://example.com/avatar.jpg',
      leadStatus: 'POTENTIAL',
      leadStage: 'STAGE_ENROLLED',
      interestCourses: ['Lập trình Fullstack Web'],
      estimatedValue: 35000000,
      contactId: 'contact-abc-1234',
      conversations: [
        {
          id: 'conv-1',
          messages: [
            {
              id: 'msg-1',
              content: 'Em là Nguyễn Văn A, SĐT 0912345678 nhờ tư vấn',
              attachments: [{ url: 'cccd.jpg' }],
            },
          ],
        },
      ],
    };

    mockPrisma.customer.findUnique.mockResolvedValue(rawCustomer);
    mockPrisma.customer.update.mockResolvedValue({
      ...rawCustomer,
      fullName: 'Khách hàng ẩn danh #1234',
      phone: '09********',
      phoneNormalized: null,
      email: null,
    });
    mockPrisma.contact.update.mockResolvedValue({});
    mockPrisma.channelIdentity.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.message.findMany.mockResolvedValue(rawCustomer.conversations[0].messages);
    mockPrisma.message.update.mockResolvedValue({});
    mockPrisma.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }]);
    mockPrisma.conversation.update.mockResolvedValue({});

    const result = await service.anonymizeCustomer('cust-abc-1234', 'actor-1');

    expect(result.success).toBe(true);
    expect(result.anonymizedCustomerId).toBe('cust-abc-1234');
    expect(result.retainedMetrics.leadStatus).toBe('POTENTIAL');
    expect(result.retainedMetrics.leadStage).toBe('STAGE_ENROLLED');

    // 1. Kiểm tra xóa định danh cá nhân (PII) trên Customer
    expect(mockPrisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-abc-1234' },
        data: expect.objectContaining({
          fullName: expect.stringContaining('Khách hàng ẩn danh'),
          phone: '09********',
          phoneNormalized: null,
          email: null,
          avatarUrl: null,
          notes: expect.stringContaining('Nghị định 13/2023/NĐ-CP'),
        }),
      }),
    );

    // 2. Không thay đổi trường thống kê phễu (leadStatus, leadStage, estimatedValue)
    const updateCustomerCall = mockPrisma.customer.update.mock.calls[0][0].data;
    expect(updateCustomerCall).not.toHaveProperty('leadStatus');
    expect(updateCustomerCall).not.toHaveProperty('leadStage');
    expect(updateCustomerCall).not.toHaveProperty('estimatedValue');

    // 3. Kiểm tra ẩn danh Contact liên kết
    expect(mockPrisma.contact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phoneNormalized: '+84912345678' },
        data: expect.objectContaining({
          displayName: expect.stringContaining('Liên hệ ẩn danh'),
          phoneNormalized: null,
          email: null,
        }),
      }),
    );

    // 4. Kiểm tra xóa liên kết kênh mạng xã hội (Facebook, Zalo UID)
    expect(mockPrisma.channelIdentity.deleteMany).toHaveBeenCalledWith({
      where: { customerId: 'cust-abc-1234' },
    });

    // 5. Kiểm tra bóc tách và che nội dung tin nhắn nhạy cảm (SĐT và Họ tên)
    expect(mockPrisma.message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'msg-1' },
        data: expect.objectContaining({
          content: expect.not.stringContaining('0912345678'),
          attachments: [],
        }),
      }),
    );

    // 6. Phát tín hiệu cập nhật thời gian thực đến Dashboard/Kanban
    expect(mockRealtime.broadcastPipelineChange).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-abc-1234',
      }),
    );
  });
});
