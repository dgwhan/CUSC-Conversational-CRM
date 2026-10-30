import { Channel } from "../channel.js";
import {
    CRM_LEAD_STATUS,
    CRM_PIPELINE_STAGES,
    TAG_MATCHING_TYPE,
    TAG_REMOVAL_POLICY,
    UNMAPPED_TAG_POLICY,
    type TagMappingEngineConfig,
    type TagMappingRule,
} from "./tag-mapping.types.js";

// Re-export constants for easy access
export { CRM_LEAD_STATUS, CRM_PIPELINE_STAGES } from "./tag-mapping.types.js";

/**
 * Định danh các quy tắc ánh xạ tag hệ thống
 */
export const TAG_MAPPING_RULE_IDS = {
    FACEBOOK_LEAD_TO_CRM_LEAD: 'rule_facebook_lead_to_crm_lead',
    ZALO_LEAD_TO_CRM_LEAD: 'rule_zalo_lead_to_crm_lead',
} as const;

/**
 * Tag nội bộ chuyên biệt chuẩn của hệ thống CUSC CRM
 */
export const CRM_SYSTEM_TAGS = {
    LEAD: 'Lead',
    NEW_CUSTOMER: 'Khách hàng mới',
    VIP: 'VIP',
    POTENTIAL: 'Tiềm năng',
} as const;

/**
 * Các tag và bí danh nguồn từ Meta (Facebook Page, Lead Ads)
 */
export const META_SOURCE_TAGS = {
    FACEBOOK_LEAD: 'Facebook Lead',
    ALIASES: ['fb lead', 'meta lead', 'lead ad', 'facebook_lead', 'fb_lead'] as const,
} as const;

/**
 * Các tag và bí danh nguồn từ Zalo (Zalo OA, ZCA)
 */
export const ZALO_SOURCE_TAGS = {
    ZALO_LEAD: 'Zalo Lead',
    ALIASES: ['zalo_lead', 'khách hàng tiềm năng'] as const,
} as const;

/**
 * Mức độ ưu tiên thực thi quy tắc ánh xạ
 */
export const TAG_MAPPING_PRIORITY = {
    CRITICAL: 100,
    HIGH: 90,
    NORMAL: 50,
    LOW: 10,
} as const;

/**
 * Thứ bậc tiến triển trạng thái lead (phục vụ kiểm tra out-of-order, tránh ghi đè lùi trạng thái)
 */
export const CRM_LEAD_STATUS_RANK: Record<string, number> = {
    [CRM_LEAD_STATUS.NEW]: 0,
    [CRM_LEAD_STATUS.POTENTIAL]: 1,
    [CRM_LEAD_STATUS.QUALIFIED]: 2,
    [CRM_LEAD_STATUS.CONVERTED]: 3,
    [CRM_LEAD_STATUS.UNQUALIFIED]: 0,
};

/**
 * Thứ bậc các giai đoạn phễu tuyển sinh (phục vụ bảo vệ tiến trình phễu trước sự kiện out-of-order)
 */
export const CRM_PIPELINE_STAGE_RANK: Record<string, number> = {
    [CRM_PIPELINE_STAGES.STAGE_NEW]: 0,
    [CRM_PIPELINE_STAGES.STAGE_CONTACTED]: 1,
    [CRM_PIPELINE_STAGES.STAGE_QUALIFIED]: 2,
    [CRM_PIPELINE_STAGES.STAGE_APPOINTMENT]: 3,
    [CRM_PIPELINE_STAGES.STAGE_SUBMITTED]: 4,
    [CRM_PIPELINE_STAGES.STAGE_ENROLLED]: 5,
    [CRM_PIPELINE_STAGES.STAGE_LOST]: 0,
};

/**
 * Các giá trị tham số mặc định cho hệ thống xử lý Tag Mapping
 */
export const TAG_MAPPING_DEFAULTS = {
    MAX_TAG_LENGTH: 50,
    META_UNMAPPED_PREFIX: 'Meta: ',
} as const;

/**
 * Quy tắc ánh xạ mặc định chuẩn cho hệ thống
 */
export const DEFAULT_TAG_MAPPING_RULES: readonly TagMappingRule[] = [
    {
        id: TAG_MAPPING_RULE_IDS.FACEBOOK_LEAD_TO_CRM_LEAD,
        name: 'Meta Facebook Lead -> Lead Tag',
        sourceChannel: Channel.FACEBOOK,
        sourceTag: META_SOURCE_TAGS.FACEBOOK_LEAD,
        sourceTagAliases: META_SOURCE_TAGS.ALIASES,
        targetTag: CRM_SYSTEM_TAGS.LEAD,
        matchingType: TAG_MATCHING_TYPE.CASE_INSENSITIVE,
        removalPolicy: TAG_REMOVAL_POLICY.RETAIN_TARGET,
        keepSourceTag: false, // Chuẩn hóa về tag 'Lead' duy nhất trong CRM để tránh phân mảnh tag
        autoUpdateLeadStatus: CRM_LEAD_STATUS.POTENTIAL,
        autoUpdateLeadStage: CRM_PIPELINE_STAGES.STAGE_NEW,
        isSystemRule: true,
        priority: TAG_MAPPING_PRIORITY.CRITICAL,
    },
    {
        id: TAG_MAPPING_RULE_IDS.ZALO_LEAD_TO_CRM_LEAD,
        name: 'Zalo Lead -> Lead Tag',
        sourceChannel: Channel.ZALO,
        sourceTag: ZALO_SOURCE_TAGS.ZALO_LEAD,
        sourceTagAliases: ZALO_SOURCE_TAGS.ALIASES,
        targetTag: CRM_SYSTEM_TAGS.LEAD,
        matchingType: TAG_MATCHING_TYPE.CASE_INSENSITIVE,
        removalPolicy: TAG_REMOVAL_POLICY.RETAIN_TARGET,
        keepSourceTag: false,
        autoUpdateLeadStatus: CRM_LEAD_STATUS.POTENTIAL,
        autoUpdateLeadStage: CRM_PIPELINE_STAGES.STAGE_NEW,
        isSystemRule: true,
        priority: TAG_MAPPING_PRIORITY.HIGH,
    },
];

/**
 * Cấu hình mặc định cho Tag Mapping Engine
 */
export const DEFAULT_TAG_MAPPING_CONFIG: TagMappingEngineConfig = {
    unmappedPolicy: UNMAPPED_TAG_POLICY.PASS_THROUGH,
    unmappedPrefix: TAG_MAPPING_DEFAULTS.META_UNMAPPED_PREFIX,
    maxTagLength: TAG_MAPPING_DEFAULTS.MAX_TAG_LENGTH,
    autoSanitize: true,
    rules: DEFAULT_TAG_MAPPING_RULES,
};
