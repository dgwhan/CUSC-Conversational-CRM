export type TimeRangeFilter = '7days' | '30days' | 'thisMonth' | 'quarter' | 'year' | 'all';

export interface OverviewMetrics {
  totalLeads: number;
  newLeadsGrowth: number; // e.g. +14.5%
  enrolledCount: number;
  conversionRate: number; // e.g. 18.2%
  dropOffRate: number;
  totalEstimatedTuition: number;
  totalCollectedTuition: number;
  avgResponseTimeMinutes: number;
}

export interface FunnelStageReport {
  id: string;
  label: string;
  count: number;
  color: string;
  conversionRate?: number;
}

export interface ChannelReport {
  channel: string;
  label: string;
  count: number;
  value: number;
  color: string;
}

export interface CourseReport {
  courseName: string;
  count: number;
  revenue: number;
}

export interface StaffPerformanceReport {
  staffId: string;
  name: string;
  avatar?: string;
  leadsCount: number;
  enrolledCount: number;
  revenue: number;
  conversionRate: number;
  avgResponseTime: string;
}

export interface TrendDataPoint {
  date: string;
  newLeads: number;
  enrolled: number;
  revenue: number;
}

export interface ReportsData {
  overview: OverviewMetrics;
  funnelStages: FunnelStageReport[];
  channels: ChannelReport[];
  courses: CourseReport[];
  staffList: StaffPerformanceReport[];
  trends: TrendDataPoint[];
  generatedAt: string;
}
