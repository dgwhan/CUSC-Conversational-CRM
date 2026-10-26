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

export const PipelineStageConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Stage name is required'),
  subtitle: z.string().default(''),
  color: z.string().default('#0284c7'),
  bgColor: z.string().default('#f0f9ff'),
  borderColor: z.string().default('#bae6fd'),
  order: z.number().int().default(0),
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
  isWon?: boolean;
  isLost?: boolean;
  isSystem?: boolean;
}

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

export interface WorkspaceConfig {
  workspaceId: string;
  workspaceName: string;
  domain: BusinessDomain;
  terminology: WorkspaceTerminology;
  pipelineStages: PipelineStageConfig[];
  productCatalog: ProductItemConfig[];
  criteria: LeadQualificationCriteria[];
}

export const WorkspaceConfigSchema: z.ZodType<WorkspaceConfig> = z.object({
  workspaceId: z.string().default('ws-default-001'),
  workspaceName: z.string().min(1).default('Tuyển Sinh & Đào Tạo'),
  domain: BusinessDomainSchema.default('EDUCATION'),
  terminology: WorkspaceTerminologySchema,
  pipelineStages: z.array(PipelineStageConfigSchema).min(2, 'Pipeline must have at least 2 stages'),
  productCatalog: z.array(ProductItemConfigSchema).min(1, 'Product catalog must have at least 1 item'),
  criteria: z.array(LeadQualificationCriteriaSchema).default([]),
}) as unknown as z.ZodType<WorkspaceConfig>;

export const ApplyPresetBodySchema = z.object({
  presetKey: BusinessDomainSchema,
  workspaceName: z.string().optional(),
});
export type ApplyPresetBody = z.infer<typeof ApplyPresetBodySchema>;
