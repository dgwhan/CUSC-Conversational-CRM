import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReportsService } from '../../src/modules/reports/reports.service.js';
import type { PrismaService } from '../../src/platform/database/prisma.service.js';
import type { WorkspaceConfigService } from '../../src/modules/workspace-config/workspace-config.service.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockPrisma: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      customer: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      workspaceMember: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue({
        workspaceId: '11111111-1111-1111-1111-111111111111',
        workspaceName: 'Bất Động Sản Cao Cấp',
        domain: 'REAL_ESTATE',
        terminology: {
          entityName: 'Khách hàng tiềm năng',
          pipelineName: 'Phễu Tư Vấn Bất Động Sản',
          productLabel: 'Dự án / Căn hộ',
          valueLabel: 'Giá trị hợp đồng',
        },
        pipelineStages: [
          { id: 'stage-lead', name: 'Nhận yêu cầu', order: 0, color: '#0284c7', isWon: false, isLost: false },
          { id: 'stage-viewing', name: 'Dẫn đi xem nhà mẫu', order: 1, color: '#d97706', isWon: false, isLost: false },
          { id: 'stage-deposit', name: 'Đặt cọc / Ký hợp đồng', order: 2, color: '#16a34a', isWon: true, isLost: false },
          { id: 'stage-cancel', name: 'Khách hủy', order: 3, color: '#64748b', isWon: false, isLost: true },
        ],
        productCatalog: [
          { id: 'p1', name: 'Căn hộ Grand Park 2PN', defaultPrice: 3200000000 },
        ],
      }),
    };

    service = new ReportsService(
      mockPrisma as unknown as PrismaService,
      mockConfigService as unknown as WorkspaceConfigService,
    );
  });

  it('tổng hợp chính xác số liệu từ db và thích ứng linh hoạt theo cấu hình ngành Real Estate', async () => {
    const mockCustomers = [
      {
        id: 'c1',
        leadStage: 'stage-deposit',
        leadStatus: 'WON',
        createdAt: new Date(),
        channelIdentities: {
          estimatedValue: 3200000000,
          products: ['Căn hộ Grand Park 2PN'],
          channel: 'FACEBOOK',
        },
        conversations: [
          {
            channelAccount: { channel: 'FACEBOOK' },
            assignedMember: { staff: { id: 's1', fullName: 'Lê Văn Sales', avatarUrl: null } },
          },
        ],
      },
      {
        id: 'c2',
        leadStage: 'stage-lead',
        leadStatus: 'NEW',
        createdAt: new Date(),
        channelIdentities: {
          estimatedValue: 2500000000,
          products: ['Biệt thự ven sông'],
          channel: 'ZALO',
        },
        conversations: [
          {
            channelAccount: { channel: 'ZALO' },
            assignedMember: { staff: { id: 's1', fullName: 'Lê Văn Sales', avatarUrl: null } },
          },
        ],
      },
    ];

    mockPrisma.customer.findMany.mockResolvedValue(mockCustomers);
    mockPrisma.customer.count.mockResolvedValue(1);

    const result = await service.getOverview({
      workspaceId: '11111111-1111-1111-1111-111111111111',
      timeRange: '30days',
    });

    expect(result.domain).toBe('REAL_ESTATE');
    expect(result.terminology.productLabel).toBe('Dự án / Căn hộ');
    expect(result.overview.totalLeads).toBe(2);
    expect(result.overview.wonCount).toBe(1);
    expect(result.overview.enrolledCount).toBe(1); // backward compat
    expect(result.overview.conversionRate).toBe(50);
    expect(result.overview.totalEstimatedValue).toBe(5700000000);
    expect(result.overview.totalCollectedValue).toBe(3200000000);

    // Kiểm tra funnelStages động
    expect(result.funnelStages).toHaveLength(4);
    const depositStage = result.funnelStages.find((s) => s.id === 'stage-deposit');
    expect(depositStage?.count).toBe(1);
    expect(depositStage?.isWon).toBe(true);

    // Kiểm tra products
    expect(result.products).toHaveLength(2);
    expect(result.products[0].productName).toBe('Căn hộ Grand Park 2PN');
    expect(result.products[0].count).toBe(1);
    expect(result.products[0].revenue).toBe(3200000000);

    // Kiểm tra staff list
    expect(result.staffList).toHaveLength(1);
    expect(result.staffList[0].name).toBe('Lê Văn Sales');
    expect(result.staffList[0].wonCount).toBe(1);
    expect(result.staffList[0].revenue).toBe(3200000000);
  });

  it('xử lý chính xác trạng thái không có dữ liệu (0 leads, 0 VNĐ, không gán cứng số liệu giả)', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([]);
    mockPrisma.customer.count.mockResolvedValue(0);

    const result = await service.getOverview({
      workspaceId: '11111111-1111-1111-1111-111111111111',
      timeRange: '30days',
    });

    expect(result.overview.totalLeads).toBe(0);
    expect(result.overview.wonCount).toBe(0);
    expect(result.overview.conversionRate).toBe(0);
    expect(result.overview.dropOffRate).toBe(0);
    expect(result.overview.totalEstimatedValue).toBe(0);
    expect(result.overview.totalCollectedValue).toBe(0);
    expect(result.overview.avgResponseTimeMinutes).toBe(0);
    expect(result.products).toEqual([]);
    expect(result.staffList).toEqual([]);
    expect(result.funnelStages.every((s) => s.count === 0)).toBe(true);
  });

  it('tính toán tốc độ phản hồi tin nhắn thực tế từ hội thoại giữa khách và nhân viên', async () => {
    const custTime = new Date('2026-10-28T10:00:00.000Z');
    const staffReplyTime = new Date('2026-10-28T10:05:00.000Z'); // cách nhau 5 phút

    const mockCustomers = [
      {
        id: 'c1',
        leadStage: 'stage-lead',
        leadStatus: 'NEW',
        createdAt: new Date(),
        channelIdentities: { channel: 'FACEBOOK' },
        conversations: [
          {
            lastCustomerMessageAt: custTime,
            lastMessageAt: staffReplyTime,
            channelAccount: { channel: 'FACEBOOK' },
            assignedMember: { staff: { id: 's1', fullName: 'Lê Văn Sales', avatarUrl: null } },
          },
        ],
      },
    ];

    mockPrisma.customer.findMany.mockResolvedValue(mockCustomers);
    mockPrisma.customer.count.mockResolvedValue(0);

    const result = await service.getOverview({
      workspaceId: '11111111-1111-1111-1111-111111111111',
      timeRange: '30days',
    });

    expect(result.overview.avgResponseTimeMinutes).toBe(5);
    expect(result.staffList[0].avgResponseTime).toBe('5.0 phút');
  });
});
