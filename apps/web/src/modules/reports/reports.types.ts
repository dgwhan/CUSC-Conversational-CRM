export type TimeRangeFilter = '7days' | '30days' | 'thisMonth' | 'quarter' | 'year' | 'all';

export interface OverviewMetrics {
  totalLeads: number;
  newLeadsGrowth: number; // e.g. +14.5%
  wonCount: number;
  enrolledCount: number; // backward compat alias for wonCount
  conversionRate: number; // e.g. 18.2%
  dropOffRate: number;
  totalEstimatedValue: number;
  totalEstimatedTuition: number; // backward compat alias for totalEstimatedValue
  totalCollectedValue: number;
  totalCollectedTuition: number; // backward compat alias for totalCollectedValue
  avgResponseTimeMinutes: number;
}

export interface FunnelStageReport {
  id: string;
  name?: string;
  label: string;
  subtitle?: string;
  count: number;
  value?: number;
  color: string;
  isWon?: boolean;
  isLost?: boolean;
  conversionRate?: number;
}

export interface ChannelReport {
  channel: string;
  label: string;
  count: number;
  value: number;
  color: string;
}

export interface ProductReport {
  productName: string;
  courseName?: string;
  count: number;
  revenue: number;
}

export type CourseReport = ProductReport;

export interface StaffPerformanceReport {
  staffId: string;
  name: string;
  avatar?: string;
  leadsCount: number;
  wonCount?: number;
  enrolledCount: number;
  revenue: number;
  conversionRate: number;
  avgResponseTime: string;
}

export interface TrendDataPoint {
  date: string;
  newLeads: number;
  won?: number;
  enrolled: number;
  revenue: number;
}

export interface ReportsData {
  domain?: string;
  terminology?: {
    entityName: string;
    pipelineName: string;
    productLabel: string;
    valueLabel: string;
  };
  overview: OverviewMetrics;
  funnelStages: FunnelStageReport[];
  channels: ChannelReport[];
  products: ProductReport[];
  courses: CourseReport[];
  staffList: StaffPerformanceReport[];
  trends: TrendDataPoint[];
  generatedAt: string;
}
