import { z } from 'zod';

export const BusinessDomainSchema = z.enum([
  'EDUCATION',
  'REAL_ESTATE',
  'BEAUTY_SPA',
  'B2B_SAAS',
  'RETAIL',
  'CUSTOM',
]);
export type BusinessDomain = z.infer<typeof BusinessDomainSchema>;

export const SystemStageCategorySchema = z.enum([
  'NEW',
  'IN_PROGRESS',
  'QUALIFIED',
  'WON',
  'LOST',
]);
export type SystemStageCategory = z.infer<typeof SystemStageCategorySchema>;

export const PipelineStageConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Stage name is required'),
  subtitle: z.string().default(''),
  color: z.string().default('#0284c7'),
  bgColor: z.string().default('#f0f9ff'),
  borderColor: z.string().default('#bae6fd'),
  order: z.number().int().default(0),
  category: SystemStageCategorySchema.optional().default('IN_PROGRESS'),
  isWon: z.boolean().optional().default(false),
  isLost: z.boolean().optional().default(false),
  isSystem: z.boolean().optional().default(false),
});
export interface PipelineStageConfig {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  bgColor: string;
  borderColor: string;
  order: number;
  category?: SystemStageCategory;
  isWon?: boolean;
  isLost?: boolean;
  isSystem?: boolean;
}

export const WorkspaceTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().default('#0284c7'),
  isSystem: z.boolean().default(false),
  aliases: z.array(z.string()).default([]),
});
export type WorkspaceTag = z.infer<typeof WorkspaceTagSchema>;

export const ProductItemConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Product/Course name is required'),
  code: z.string().optional(),
  category: z.string().default('Chung'),
  defaultPrice: z.number().min(0).default(0),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type ProductItemConfig = z.infer<typeof ProductItemConfigSchema>;

export const WorkspaceTerminologySchema = z.object({
  entityName: z.string().min(1).default('Khách hàng'),
  pipelineName: z.string().min(1).default('Phễu Bán Hàng & Chăm Sóc'),
  productLabel: z.string().min(1).default('Sản phẩm / Dịch vụ quan tâm'),
  valueLabel: z.string().min(1).default('Giá trị dự kiến (VNĐ)'),
});
export type WorkspaceTerminology = z.infer<typeof WorkspaceTerminologySchema>;

export const LeadQualificationCriteriaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['TEXT', 'SELECT', 'NUMBER', 'BOOLEAN']).default('TEXT'),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().default(false),
});
export type LeadQualificationCriteria = z.infer<typeof LeadQualificationCriteriaSchema>;

export const DayWorkingScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(7), // 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7, 0/7: CN
  dayName: z.string().default(''),
  isOpen: z.boolean().default(true),
  openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ mở cửa phải là HH:mm').default('07:00'),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Định dạng giờ đóng cửa phải là HH:mm').default('17:00'),
});
export type DayWorkingSchedule = z.infer<typeof DayWorkingScheduleSchema>;

export const WorkingHoursConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timezone: z.string().default('Asia/Ho_Chi_Minh'),
  schedules: z.array(DayWorkingScheduleSchema).default([]),
  autoReplyMessage: z.string().default(
    'Cảm ơn bạn đã liên hệ! Hiện tại đang ngoài khung giờ làm việc của chúng tôi (Thứ 2 - Thứ 6: 07:00 - 17:00). Chúng tôi đã ghi nhận tin nhắn và tư vấn viên sẽ liên hệ lại với bạn ngay vào đầu giờ làm việc tiếp theo. Chúc bạn một ngày tốt lành!',
  ),
  outOfOfficeTag: z.string().default('HẸN TƯ VẤN SÁNG HÔM SAU'),
  cooldownMinutes: z.number().min(0).max(1440).default(60),
});
export type WorkingHoursConfig = z.infer<typeof WorkingHoursConfigSchema>;

export function getDefaultWorkingHoursConfig(): WorkingHoursConfig {
  return {
    enabled: true,
    timezone: 'Asia/Ho_Chi_Minh',
    schedules: [
      { dayOfWeek: 1, dayName: 'Thứ Hai', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 2, dayName: 'Thứ Ba', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 3, dayName: 'Thứ Tư', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 4, dayName: 'Thứ Năm', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 5, dayName: 'Thứ Sáu', isOpen: true, openTime: '07:00', closeTime: '17:00' },
      { dayOfWeek: 6, dayName: 'Thứ Bảy', isOpen: false, openTime: '07:00', closeTime: '12:00' },
      { dayOfWeek: 7, dayName: 'Chủ Nhật', isOpen: false, openTime: '07:00', closeTime: '12:00' },
    ],
    autoReplyMessage:
      'Cảm ơn bạn đã liên hệ! Hiện tại đang ngoài khung giờ làm việc của chúng tôi (Thứ 2 - Thứ 6: 07:00 - 17:00). Chúng tôi đã ghi nhận tin nhắn và tư vấn viên sẽ liên hệ lại với bạn ngay vào đầu giờ làm việc tiếp theo. Chúc bạn một ngày tốt lành!',
    outOfOfficeTag: 'HẸN TƯ VẤN SÁNG HÔM SAU',
    cooldownMinutes: 60,
  };
}

export interface WorkspaceConfig {
  workspaceId: string;
  workspaceName: string;
  domain: BusinessDomain;
  terminology: WorkspaceTerminology;
  pipelineStages: PipelineStageConfig[];
  productCatalog: ProductItemConfig[];
  criteria: LeadQualificationCriteria[];
  unresponsiveAlertMinutes?: number;
  workingHours?: WorkingHoursConfig;
}

export const WorkspaceConfigSchema: z.ZodType<WorkspaceConfig> = z.object({
  workspaceId: z.string().default('ws-default-001'),
  workspaceName: z.string().min(1).default('Tuyển Sinh & Đào Tạo'),
  domain: BusinessDomainSchema.default('EDUCATION'),
  terminology: WorkspaceTerminologySchema,
  pipelineStages: z.array(PipelineStageConfigSchema).min(2, 'Pipeline must have at least 2 stages'),
  productCatalog: z.array(ProductItemConfigSchema).min(1, 'Product catalog must have at least 1 item'),
  criteria: z.array(LeadQualificationCriteriaSchema).default([]),
  unresponsiveAlertMinutes: z.number().min(0).max(1440).optional().default(15),
  workingHours: WorkingHoursConfigSchema.optional().default(getDefaultWorkingHoursConfig()),
}) as unknown as z.ZodType<WorkspaceConfig>;

export const ApplyPresetBodySchema = z.object({
  presetKey: BusinessDomainSchema,
  workspaceName: z.string().optional(),
});
export type ApplyPresetBody = z.infer<typeof ApplyPresetBodySchema>;
