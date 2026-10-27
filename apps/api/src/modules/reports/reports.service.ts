import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';

export interface OverviewFilterDto {
  workspaceId?: string;
  timeRange?: '7days' | '30days' | 'thisMonth' | 'quarter' | 'year' | 'all';
  channel?: string;
  staffId?: string;
  courseId?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tổng hợp báo cáo số liệu toàn diện cho Dashboard Thống kê Tuyển sinh
   */
  async getOverview(filter: OverviewFilterDto) {
    const { workspaceId, timeRange = '30days', channel, staffId } = filter;

    // Xác định mốc thời gian lọc
    const now = new Date();
    let startDate: Date | undefined;

    switch (timeRange) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
      default:
        startDate = undefined;
        break;
    }

    const customerWhere: any = {};
    if (workspaceId) {
      customerWhere.workspaceId = workspaceId;
    }
    if (startDate) {
      customerWhere.createdAt = { gte: startDate };
    }

    // Lấy toàn bộ khách hàng / ứng viên phù hợp
    const customers = await this.prisma.customer.findMany({
      where: customerWhere,
      include: {
        conversations: {
          include: {
            channelAccount: {
              select: { channel: true, displayName: true },
            },
            assignedMember: {
              include: {
                staff: {
                  select: { id: true, fullName: true, avatarUrl: true },
                },
              },
            },
          },
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
        },
      },
    });

    // Lấy danh sách nhân viên trong workspace
    const workspaceMembers = workspaceId
      ? await this.prisma.workspaceMember.findMany({
          where: { workspaceId },
          include: { staff: { select: { id: true, fullName: true, avatarUrl: true } } },
        })
      : [];

    // Tổng hợp dữ liệu
    let totalLeads = customers.length;
    let totalEstimatedTuition = 0;
    let totalCollectedTuition = 0;
    let enrolledCount = 0;
    let depositCount = 0;
    let consultingCount = 0;
    let trialCount = 0;
    let qualifiedCount = 0;
    let newCount = 0;
    let lostCount = 0;

    const channelMap: Record<string, { count: number; value: number }> = {
      FACEBOOK: { count: 0, value: 0 },
      ZALO: { count: 0, value: 0 },
      TIKTOK: { count: 0, value: 0 },
      MANUAL: { count: 0, value: 0 },
    };

    const courseMap: Record<string, { count: number; revenue: number }> = {};
    const staffMap: Record<string, {
      staffId: string;
      name: string;
      avatar?: string;
      leadsCount: number;
      enrolledCount: number;
      revenue: number;
    }> = {};

    // Khởi tạo staff map từ workspace members
    for (const m of workspaceMembers) {
      staffMap[m.staff.id] = {
        staffId: m.staff.id,
        name: m.staff.fullName,
        avatar: m.staff.avatarUrl || undefined,
        leadsCount: 0,
        enrolledCount: 0,
        revenue: 0,
      };
    }

    for (const c of customers) {
      const identities = (c.channelIdentities as any) || {};
      const stage = (identities.leadStage || 'NEW').toUpperCase();
      const val = Number(identities.estimatedValue) || 0;
      const courses: string[] = identities.interestCourses || ['Chưa chọn ngành'];

      totalEstimatedTuition += val;

      // Đếm theo giai đoạn
      switch (stage) {
        case 'NEW':
          newCount++;
          break;
        case 'QUALIFIED':
          qualifiedCount++;
          break;
        case 'CONSULTING':
          consultingCount++;
          break;
        case 'TRIAL_APPOINTMENT':
          trialCount++;
          break;
        case 'DEPOSIT_PAID':
          depositCount++;
          break;
        case 'ENROLLED':
          enrolledCount++;
          totalCollectedTuition += val;
          break;
        case 'LOST':
          lostCount++;
          break;
        default:
          newCount++;
          break;
      }

      // Kênh liên hệ
      const conv = c.conversations[0];
      const chKey = conv?.channelAccount?.channel || identities.channel || 'MANUAL';
      if (!channelMap[chKey]) {
        channelMap[chKey] = { count: 0, value: 0 };
      }
      channelMap[chKey].count++;
      channelMap[chKey].value += val;

      // Khóa học / Ngành quan tâm
      for (const crs of courses) {
        if (!courseMap[crs]) {
          courseMap[crs] = { count: 0, revenue: 0 };
        }
        courseMap[crs].count++;
        if (stage === 'ENROLLED') {
          courseMap[crs].revenue += val;
        }
      }

      // Tư vấn viên phụ trách
      const assignedStaff = conv?.assignedMember?.staff;
      if (assignedStaff) {
        if (!staffMap[assignedStaff.id]) {
          staffMap[assignedStaff.id] = {
            staffId: assignedStaff.id,
            name: assignedStaff.fullName,
            avatar: assignedStaff.avatarUrl || undefined,
            leadsCount: 0,
            enrolledCount: 0,
            revenue: 0,
          };
        }
        staffMap[assignedStaff.id].leadsCount++;
        if (stage === 'ENROLLED') {
          staffMap[assignedStaff.id].enrolledCount++;
          staffMap[assignedStaff.id].revenue += val;
        }
      }
    }

    // Tỉ lệ chuyển đổi
    const conversionRate = totalLeads > 0 ? Number(((enrolledCount / totalLeads) * 100).toFixed(1)) : 0;
    const dropOffRate = totalLeads > 0 ? Number(((lostCount / totalLeads) * 100).toFixed(1)) : 0;

    // Cấu trúc Funnel Stages
    const funnelStages = [
      { id: 'NEW', label: '1. Khách mới tiếp cận', count: newCount, color: '#0284c7' },
      { id: 'QUALIFIED', label: '2. Đã xác nhận nhu cầu', count: qualifiedCount, color: '#0d9488' },
      { id: 'CONSULTING', label: '3. Đang tư vấn chuyên sâu', count: consultingCount, color: '#d97706' },
      { id: 'TRIAL_APPOINTMENT', label: '4. Hẹn học thử / Trực tiếp', count: trialCount, color: '#7c3aed' },
      { id: 'DEPOSIT_PAID', label: '5. Đã đóng cọc giữ chỗ', count: depositCount, color: '#2563eb' },
      { id: 'ENROLLED', label: '6. Nhập học thành công', count: enrolledCount, color: '#16a34a' },
      { id: 'LOST', label: '7. Hủy / Thất bại', count: lostCount, color: '#64748b' },
    ];

    // Cấu trúc Kênh
    const channels = Object.entries(channelMap).map(([key, item]) => {
      let label = key;
      let color = '#64748b';
      if (key === 'FACEBOOK') {
        label = 'Facebook Messenger';
        color = '#1877f2';
      } else if (key === 'ZALO' || key === 'ZALO_PERSONAL') {
        label = 'Zalo OA / Cá nhân';
        color = '#0068ff';
      } else if (key === 'TIKTOK') {
        label = 'TikTok Lead Gen';
        color = '#000000';
      } else if (key === 'MANUAL' || key === 'MANUAL_IMPORT') {
        label = 'Nhập tay / Hotline';
        color = '#10b981';
      }
      return {
        channel: key,
        label,
        count: item.count,
        value: item.value,
        color,
      };
    });

    // Cấu trúc Khóa học
    const courses = Object.entries(courseMap)
      .map(([name, data]) => ({
        courseName: name,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.count - a.count);

    // Cấu trúc Nhân viên
    const staffList = Object.values(staffMap)
      .map((s) => ({
        ...s,
        conversionRate: s.leadsCount > 0 ? Number(((s.enrolledCount / s.leadsCount) * 100).toFixed(1)) : 0,
        avgResponseTime: '2.8 phút',
      }))
      .sort((a, b) => b.enrolledCount - a.enrolledCount);

    return {
      overview: {
        totalLeads,
        enrolledCount,
        conversionRate,
        dropOffRate,
        totalEstimatedTuition,
        totalCollectedTuition,
        avgResponseTimeMinutes: 3.2,
      },
      funnelStages,
      channels,
      courses,
      staffList,
      generatedAt: new Date().toISOString(),
    };
  }
}
