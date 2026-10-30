import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { WorkspaceConfigService } from '../workspace-config/workspace-config.service.js';
import type { PipelineStageConfig } from '../../contracts/workspace-config.js';

const isUuid = (val?: string): boolean =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export interface OverviewFilterDto {
  workspaceId?: string;
  ownerId?: string;
  currentStaffId?: string;
  timeRange?: '7days' | '30days' | 'thisMonth' | 'quarter' | 'year' | 'all';
  channel?: string;
  staffId?: string;
  courseId?: string;
  productId?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: WorkspaceConfigService,
  ) {}

  /**
   * Tổng hợp báo cáo số liệu toàn diện cho Dashboard linh hoạt theo cấu hình ngành (Workspace Domain)
   */
  async getOverview(filter: OverviewFilterDto) {
    const {
      workspaceId,
      ownerId,
      currentStaffId,
      timeRange = '30days',
      channel,
      staffId,
      courseId,
      productId,
    } = filter;

    // 1. Tải cấu hình linh hoạt của Workspace (Domain, Terminology, PipelineStages, ProductCatalog)
    const config = await this.configService.getConfig(
      workspaceId || 'ws-default-001',
      ownerId,
      currentStaffId,
    );

    // Xác định workspaceId dạng UUID nếu có
    const targetWsId =
      workspaceId && isUuid(workspaceId)
        ? workspaceId
        : config.workspaceId && isUuid(config.workspaceId)
          ? config.workspaceId
          : undefined;

    // 2. Xác định mốc thời gian lọc
    const now = new Date();
    let startDate: Date | undefined;
    let prevStartDate: Date | undefined;
    let prevEndDate: Date | undefined;

    switch (timeRange) {
      case '7days': {
        const ms = 7 * 24 * 60 * 60 * 1000;
        startDate = new Date(now.getTime() - ms);
        prevStartDate = new Date(now.getTime() - 2 * ms);
        prevEndDate = startDate;
        break;
      }
      case '30days': {
        const ms = 30 * 24 * 60 * 60 * 1000;
        startDate = new Date(now.getTime() - ms);
        prevStartDate = new Date(now.getTime() - 2 * ms);
        prevEndDate = startDate;
        break;
      }
      case 'thisMonth': {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = startDate;
        break;
      }
      case 'quarter': {
        const qMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), qMonth, 1);
        prevStartDate = new Date(now.getFullYear(), qMonth - 3, 1);
        prevEndDate = startDate;
        break;
      }
      case 'year': {
        startDate = new Date(now.getFullYear(), 0, 1);
        prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
        prevEndDate = startDate;
        break;
      }
      case 'all':
      default:
        startDate = undefined;
        break;
    }

    const customerWhere: any = {};
    if (targetWsId) {
      customerWhere.workspaceId = targetWsId;
    }
    if (startDate) {
      customerWhere.createdAt = { gte: startDate };
    }

    // 3. Lấy toàn bộ khách hàng / hồ sơ từ DB
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
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Tính số lượng khách hàng kỳ trước để đo lường % tăng trưởng
    let prevPeriodCount = 0;
    if (prevStartDate && prevEndDate) {
      const prevWhere: any = { createdAt: { gte: prevStartDate, lt: prevEndDate } };
      if (targetWsId) prevWhere.workspaceId = targetWsId;
      prevPeriodCount = await this.prisma.customer.count({ where: prevWhere });
    }

    // 4. Lấy danh sách nhân viên trong workspace
    const workspaceMembers = targetWsId
      ? await this.prisma.workspaceMember.findMany({
          where: { workspaceId: targetWsId },
          include: { staff: { select: { id: true, fullName: true, email: true } } },
        })
      : [];

    // 5. Chuẩn bị phễu giai đoạn động từ Workspace Config
    const pipelineStages: PipelineStageConfig[] =
      config.pipelineStages && config.pipelineStages.length > 0
        ? [...config.pipelineStages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        : [
            { id: 'NEW', name: 'Khách mới tiếp cận', subtitle: '', color: '#0284c7', bgColor: '#f0f9ff', borderColor: '#bae6fd', order: 0, isWon: false, isLost: false },
            { id: 'QUALIFIED', name: 'Đã xác nhận nhu cầu', subtitle: '', color: '#0d9488', bgColor: '#f0fdfa', borderColor: '#99f6e4', order: 1, isWon: false, isLost: false },
            { id: 'CONSULTING', name: 'Đang tư vấn chuyên sâu', subtitle: '', color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a', order: 2, isWon: false, isLost: false },
            { id: 'WON', name: 'Chốt thành công', subtitle: '', color: '#16a34a', bgColor: '#f0fdf4', borderColor: '#bbf7d0', order: 3, isWon: true, isLost: false },
            { id: 'LOST', name: 'Hủy / Thất bại', subtitle: '', color: '#64748b', bgColor: '#f8fafc', borderColor: '#e2e8f0', order: 4, isWon: false, isLost: true },
          ];

    const stageCountMap = new Map<string, { stage: PipelineStageConfig; count: number; value: number }>();
    for (const stage of pipelineStages) {
      stageCountMap.set(stage.id.toLowerCase(), { stage, count: 0, value: 0 });
    }

    // 6. Tổng hợp dữ liệu
    let totalLeads = 0;
    let totalEstimatedValue = 0;
    let totalCollectedValue = 0;
    let wonCount = 0;
    let lostCount = 0;
    let totalResponseMinutes = 0;
    let responseCount = 0;
    const staffResponseMap: Record<string, { total: number; count: number }> = {};

    const channelMap: Record<string, { count: number; value: number }> = {
      FACEBOOK: { count: 0, value: 0 },
      ZALO: { count: 0, value: 0 },
      TIKTOK: { count: 0, value: 0 },
      MANUAL: { count: 0, value: 0 },
      WEBSITE: { count: 0, value: 0 },
    };

    const productMap: Record<string, { count: number; revenue: number }> = {};
    const staffMap: Record<string, {
      staffId: string;
      name: string;
      avatar?: string;
      leadsCount: number;
      wonCount: number;
      revenue: number;
      avgResponseTime?: string;
    }> = {};

    // Khởi tạo staff map từ workspace members
    for (const m of workspaceMembers) {
      staffMap[m.staff.id] = {
        staffId: m.staff.id,
        name: m.staff.fullName,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.staff.fullName)}&background=0284c7&color=fff&bold=true`,
        leadsCount: 0,
        wonCount: 0,
        revenue: 0,
      };
    }

    // Lọc theo channel/staff nếu người dùng chỉ định
    const targetChannel = channel && channel !== 'ALL' ? channel.toUpperCase() : undefined;
    const targetStaffId = staffId && staffId !== 'ALL' ? staffId : undefined;
    const targetItemFilter = (courseId || productId || '').trim().toLowerCase();

    for (const c of customers) {
      const identities = (c.channelIdentities as any) || {};
      const conv = c.conversations[0];
      const assignedStaff = conv?.assignedMember?.staff;

      // Xác định kênh của khách
      const custChannel = (
        conv?.channelAccount?.channel ||
        identities.channel ||
        'MANUAL'
      ).toUpperCase();

      // Bộ lọc channel
      if (targetChannel && custChannel !== targetChannel) {
        continue;
      }

      // Bộ lọc staff
      if (targetStaffId && assignedStaff?.id !== targetStaffId) {
        continue;
      }

      // Xác định sản phẩm / dịch vụ quan tâm
      let itemNames: string[] = [];
      if (Array.isArray(identities.interestCourses) && identities.interestCourses.length > 0) {
        itemNames = identities.interestCourses;
      } else if (Array.isArray(identities.products) && identities.products.length > 0) {
        itemNames = identities.products;
      } else if (typeof identities.interestProduct === 'string' && identities.interestProduct.trim()) {
        itemNames = [identities.interestProduct.trim()];
      } else if (typeof identities.productName === 'string' && identities.productName.trim()) {
        itemNames = [identities.productName.trim()];
      } else {
        itemNames = [`Chưa chọn ${config.terminology?.productLabel || 'sản phẩm'}`];
      }

      // Bộ lọc item
      if (targetItemFilter) {
        const matches = itemNames.some((it) => it.toLowerCase().includes(targetItemFilter));
        if (!matches) continue;
      }

      totalLeads++;

      const val = Number(identities.estimatedValue) || 0;
      totalEstimatedValue += val;

      // Xác định giai đoạn phễu khớp với cấu hình
      const custStageRaw = (c.leadStage || identities.leadStage || '').trim();
      const custStatusRaw = (c.leadStatus || identities.leadStatus || '').trim().toUpperCase();

      let matchedStageConfig: PipelineStageConfig | undefined;

      // 1. Khớp theo ID giai đoạn
      if (custStageRaw) {
        const entry = stageCountMap.get(custStageRaw.toLowerCase());
        if (entry) matchedStageConfig = entry.stage;
      }

      // 2. Khớp theo Tên giai đoạn
      if (!matchedStageConfig && custStageRaw) {
        for (const entry of stageCountMap.values()) {
          if (entry.stage.name.toLowerCase() === custStageRaw.toLowerCase()) {
            matchedStageConfig = entry.stage;
            break;
          }
        }
      }

      // 3. Khớp theo Lead Status (WON, LOST, NEW, v.v.)
      if (!matchedStageConfig) {
        if (custStatusRaw === 'WON' || custStatusRaw === 'CONVERTED' || custStageRaw.toUpperCase() === 'ENROLLED') {
          for (const entry of stageCountMap.values()) {
            if (entry.stage.isWon) {
              matchedStageConfig = entry.stage;
              break;
            }
          }
        } else if (custStatusRaw === 'LOST' || custStatusRaw === 'UNQUALIFIED') {
          for (const entry of stageCountMap.values()) {
            if (entry.stage.isLost) {
              matchedStageConfig = entry.stage;
              break;
            }
          }
        } else if (custStatusRaw === 'NEW') {
          matchedStageConfig = pipelineStages[0];
        } else {
          // Thử tìm theo status id
          const entry = stageCountMap.get(custStatusRaw.toLowerCase());
          if (entry) matchedStageConfig = entry.stage;
        }
      }

      // Fallback mặc định vào giai đoạn đầu tiên của phễu
      if (!matchedStageConfig) {
        matchedStageConfig = pipelineStages[0];
      }

      // Cập nhật số đếm giai đoạn
      const targetStageEntry = stageCountMap.get(matchedStageConfig.id.toLowerCase());
      if (targetStageEntry) {
        targetStageEntry.count++;
        targetStageEntry.value += val;
      }

      // Kiểm tra Won / Lost
      const isWon =
        matchedStageConfig.isWon === true ||
        custStatusRaw === 'WON' ||
        custStatusRaw === 'CONVERTED' ||
        custStageRaw.toUpperCase() === 'ENROLLED';

      const isLost =
        matchedStageConfig.isLost === true ||
        custStatusRaw === 'LOST' ||
        custStatusRaw === 'UNQUALIFIED';

      if (isWon) {
        wonCount++;
        totalCollectedValue += val;
      }
      if (isLost) {
        lostCount++;
      }

      // Kênh tiếp nhận
      const chKey = custChannel.startsWith('ZALO') ? 'ZALO' : custChannel;
      if (!channelMap[chKey]) {
        channelMap[chKey] = { count: 0, value: 0 };
      }
      channelMap[chKey].count++;
      channelMap[chKey].value += val;

      // Danh mục sản phẩm / dịch vụ / khóa học
      for (const item of itemNames) {
        if (!productMap[item]) {
          productMap[item] = { count: 0, revenue: 0 };
        }
        productMap[item].count++;
        if (isWon) {
          productMap[item].revenue += val;
        }
      }

      // Tư vấn viên phụ trách
      if (assignedStaff) {
        if (!staffMap[assignedStaff.id]) {
          staffMap[assignedStaff.id] = {
            staffId: assignedStaff.id,
            name: assignedStaff.fullName,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(assignedStaff.fullName)}&background=0284c7&color=fff&bold=true`,
            leadsCount: 0,
            wonCount: 0,
            revenue: 0,
          };
        }
        staffMap[assignedStaff.id].leadsCount++;
        if (isWon) {
          staffMap[assignedStaff.id].wonCount++;
          staffMap[assignedStaff.id].revenue += val;
        }
      }

      // Tốc độ phản hồi tin nhắn từ hội thoại (nếu có dữ liệu tin nhắn)
      if (conv?.lastCustomerMessageAt && conv?.lastMessageAt) {
        const custMsgTime = new Date(conv.lastCustomerMessageAt).getTime();
        const lastMsgTime = new Date(conv.lastMessageAt).getTime();
        if (lastMsgTime > custMsgTime) {
          const diffMin = (lastMsgTime - custMsgTime) / (1000 * 60);
          totalResponseMinutes += diffMin;
          responseCount++;

          if (assignedStaff) {
            if (!staffResponseMap[assignedStaff.id]) {
              staffResponseMap[assignedStaff.id] = { total: 0, count: 0 };
            }
            staffResponseMap[assignedStaff.id].total += diffMin;
            staffResponseMap[assignedStaff.id].count++;
          }
        }
      }
    }

    // Tỉ lệ chuyển đổi & Tỉ lệ rơi rụng
    const conversionRate = totalLeads > 0 ? Number(((wonCount / totalLeads) * 100).toFixed(1)) : 0;
    const dropOffRate = totalLeads > 0 ? Number(((lostCount / totalLeads) * 100).toFixed(1)) : 0;
    const newLeadsGrowth =
      prevPeriodCount > 0
        ? Number((((totalLeads - prevPeriodCount) / prevPeriodCount) * 100).toFixed(1))
        : totalLeads > 0
          ? 100
          : 0;

    // Danh sách Funnel Stages trả về cho biểu đồ
    const funnelStages = pipelineStages.map((s, idx) => {
      const entry = stageCountMap.get(s.id.toLowerCase());
      const count = entry ? entry.count : 0;
      const pct = totalLeads > 0 ? Number(((count / totalLeads) * 100).toFixed(1)) : 0;
      return {
        id: s.id,
        name: s.name,
        label: `${idx + 1}. ${s.name}`,
        subtitle: s.subtitle,
        count,
        color: s.color || '#0284c7',
        isWon: s.isWon || false,
        isLost: s.isLost || false,
        conversionRate: pct,
      };
    });

    // Danh sách Kênh trả về
    const channels = Object.entries(channelMap).map(([key, item]) => {
      let label = key;
      let color = '#64748b';
      if (key === 'FACEBOOK') {
        label = 'Facebook Messenger';
        color = '#1877f2';
      } else if (key === 'ZALO') {
        label = 'Zalo OA / Cá nhân';
        color = '#0068ff';
      } else if (key === 'TIKTOK') {
        label = 'TikTok Lead Gen';
        color = '#0f172a';
      } else if (key === 'MANUAL' || key === 'MANUAL_IMPORT') {
        label = 'Nhập tay / Hotline';
        color = '#10b981';
      } else if (key === 'WEBSITE') {
        label = 'Website / Form';
        color = '#8b5cf6';
      }
      return {
        channel: key,
        label,
        count: item.count,
        value: item.value,
        color,
      };
    });

    // Danh sách Sản phẩm / Dịch vụ trả về
    const products = Object.entries(productMap)
      .map(([name, data]) => ({
        productName: name,
        courseName: name, // backward compat
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.count - a.count);

    // Danh sách Hiệu suất Nhân viên
    const staffList = Object.values(staffMap)
      .map((s) => {
        const stat = staffResponseMap[s.staffId];
        const staffAvg = stat && stat.count > 0 ? `${(stat.total / stat.count).toFixed(1)} phút` : '0 phút';
        return {
          ...s,
          enrolledCount: s.wonCount, // backward compat
          conversionRate: s.leadsCount > 0 ? Number(((s.wonCount / s.leadsCount) * 100).toFixed(1)) : 0,
          avgResponseTime: s.avgResponseTime || staffAvg,
        };
      })
      .sort((a, b) => b.wonCount - a.wonCount || b.revenue - a.revenue);

    const avgResponseTimeMinutes =
      responseCount > 0 ? Number((totalResponseMinutes / responseCount).toFixed(1)) : 0;

    // 7. Tổng hợp biểu đồ xu hướng (Trends) theo ngày từ DB thực tế
    const trends = this.computeRealTrends(customers, timeRange);

    return {
      domain: config.domain,
      terminology: config.terminology,
      pipelineStages,
      overview: {
        totalLeads,
        wonCount,
        enrolledCount: wonCount, // backward compat
        conversionRate,
        dropOffRate,
        totalEstimatedValue,
        totalEstimatedTuition: totalEstimatedValue, // backward compat
        totalCollectedValue,
        totalCollectedTuition: totalCollectedValue, // backward compat
        newLeadsGrowth,
        avgResponseTimeMinutes,
      },
      funnelStages,
      channels,
      products,
      courses: products, // backward compat
      staffList,
      trends,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Tính toán các điểm xu hướng thực tế theo ngày từ danh sách khách hàng trong DB
   */
  private computeRealTrends(customers: any[], range: string) {
    const days = range === '7days' ? 7 : range === '30days' ? 14 : range === 'thisMonth' ? 12 : 8;
    const now = new Date();
    const result: Array<{ date: string; newLeads: number; won: number; enrolled: number; revenue: number }> = [];

    const stepDays = range === '7days' ? 1 : range === '30days' ? 2 : range === 'thisMonth' ? 2 : 4;

    for (let i = days - 1; i >= 0; i--) {
      const bucketEnd = new Date(now.getTime() - i * stepDays * 24 * 60 * 60 * 1000);
      const bucketStart = new Date(bucketEnd.getTime() - stepDays * 24 * 60 * 60 * 1000);
      const dateStr = `${bucketEnd.getDate()}/${bucketEnd.getMonth() + 1}`;

      const matchedInBucket = customers.filter((c) => {
        const ct = new Date(c.createdAt).getTime();
        return ct >= bucketStart.getTime() && ct <= bucketEnd.getTime();
      });

      let wonInBucket = 0;
      let revInBucket = 0;

      for (const c of matchedInBucket) {
        const identities = (c.channelIdentities as any) || {};
        const val = Number(identities.estimatedValue) || 0;
        const status = (c.leadStatus || identities.leadStatus || '').toUpperCase();
        const stage = (c.leadStage || identities.leadStage || '').toUpperCase();

        if (status === 'WON' || status === 'CONVERTED' || stage === 'ENROLLED' || stage === 'WON') {
          wonInBucket++;
          revInBucket += val;
        }
      }

      result.push({
        date: dateStr,
        newLeads: matchedInBucket.length,
        won: wonInBucket,
        enrolled: wonInBucket,
        revenue: revInBucket,
      });
    }

    return result;
  }
}
