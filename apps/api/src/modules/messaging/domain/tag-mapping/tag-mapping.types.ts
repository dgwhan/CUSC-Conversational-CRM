import type { Channel } from "../channel.js";

/**
 * Hằng số định danh phạm vi áp dụng cho tất cả các kênh
 */
export const CHANNEL_SCOPE_ALL = 'ALL' as const;

/**
 * Phạm vi kênh áp dụng quy tắc ánh xạ (Kênh cụ thể hoặc toàn bộ các kênh)
 */
export type ChannelScope = Channel | typeof CHANNEL_SCOPE_ALL;

/**
 * Các loại so khớp tag nguồn từ nền tảng ngoại vi (Meta, Zalo,...)
 */
export const TAG_MATCHING_TYPE = {
    EXACT: 'EXACT',
    CASE_INSENSITIVE: 'CASE_INSENSITIVE',
    REGEX: 'REGEX',
    ALIAS: 'ALIAS',
} as const;

export type TagMatchingType = (typeof TAG_MATCHING_TYPE)[keyof typeof TAG_MATCHING_TYPE];

/**
 * Chính sách xử lý tag đích nội bộ CRM khi tag nguồn trên nền tảng bị gỡ (un-tagged / deleted)
 */
export const TAG_REMOVAL_POLICY = {
    RETAIN_TARGET: 'RETAIN_TARGET',                            // Giữ nguyên tag CRM nội bộ (an toàn nhất cho sales/chăm sóc khách hàng)
    REMOVE_TARGET_IF_UNTOUCHED: 'REMOVE_TARGET_IF_UNTOUCHED', // Gỡ tag CRM nếu khách hàng vẫn ở trạng thái mới (chưa có tương tác thủ công)
    FORCE_REMOVE_TARGET: 'FORCE_REMOVE_TARGET',               // Luôn gỡ tag CRM theo nguồn Meta
} as const;

export type TagRemovalPolicy = (typeof TAG_REMOVAL_POLICY)[keyof typeof TAG_REMOVAL_POLICY];

/**
 * Chính sách xử lý khi gặp tag nguồn chưa được cấu hình ánh xạ trong hệ thống
 */
export const UNMAPPED_TAG_POLICY = {
    PASS_THROUGH: 'PASS_THROUGH',   // Lưu trực tiếp tag nguồn vào hội thoại (sau khi làm sạch/sanitize)
    IGNORE: 'IGNORE',               // Bỏ qua hoàn toàn, không lưu
    PREFIX_SOURCE: 'PREFIX_SOURCE', // Thêm tiền tố nguồn (ví dụ: 'Meta: Hẹn gọi lại')
} as const;

export type UnmappedTagPolicy = (typeof UNMAPPED_TAG_POLICY)[keyof typeof UNMAPPED_TAG_POLICY];

/**
 * Trạng thái khách hàng tiềm năng CRM (Customer.leadStatus)
 */
export const CRM_LEAD_STATUS = {
    NEW: 'NEW',
    POTENTIAL: 'POTENTIAL',
    QUALIFIED: 'QUALIFIED',
    CONVERTED: 'CONVERTED',
    UNQUALIFIED: 'UNQUALIFIED',
} as const;

export type CRMLeadStatus = (typeof CRM_LEAD_STATUS)[keyof typeof CRM_LEAD_STATUS];

/**
 * Các giai đoạn trong phễu tuyển sinh CRM (Customer.leadStage)
 */
export const CRM_PIPELINE_STAGES = {
    STAGE_NEW: 'STAGE_NEW',
    STAGE_CONTACTED: 'STAGE_CONTACTED',
    STAGE_QUALIFIED: 'STAGE_QUALIFIED',
    STAGE_APPOINTMENT: 'STAGE_APPOINTMENT',
    STAGE_SUBMITTED: 'STAGE_SUBMITTED',
    STAGE_ENROLLED: 'STAGE_ENROLLED',
    STAGE_LOST: 'STAGE_LOST',
} as const;

export type CRMPipelineStage = (typeof CRM_PIPELINE_STAGES)[keyof typeof CRM_PIPELINE_STAGES];

/**
 * Định nghĩa quy tắc ánh xạ tag từ nền tảng vào CRM
 */
export interface TagMappingRule {
    readonly id: string;
    readonly name: string;
    readonly sourceChannel: ChannelScope;
    readonly sourceTag: string;
    readonly sourceTagAliases?: readonly string[];
    readonly targetTag: string;
    readonly matchingType: TagMatchingType;
    readonly removalPolicy: TagRemovalPolicy;
    readonly keepSourceTag: boolean; // Có giữ lại cả tag nguồn song song với tag đích không
    readonly autoUpdateLeadStatus?: CRMLeadStatus | (string & {}); // Tự động cập nhật leadStatus
    readonly autoUpdateLeadStage?: CRMPipelineStage | (string & {});  // Tự động cập nhật leadStage
    readonly isSystemRule?: boolean;
    readonly priority: number; // Ưu tiên xử lý (số lớn hơn xử lý trước)
}

/**
 * Cấu hình tổng thể cho hệ thống xử lý Tag Mapping
 */
export interface TagMappingEngineConfig {
    readonly unmappedPolicy: UnmappedTagPolicy;
    readonly unmappedPrefix?: string;
    readonly maxTagLength?: number;
    readonly autoSanitize?: boolean;
    readonly rules: readonly TagMappingRule[];
}

/**
 * Ngữ cảnh đồng bộ tag
 */
export interface TagSyncContext {
    readonly channel: Channel;
    readonly currentTags: readonly string[]; // Tags hiện tại của Conversation/Customer trong DB
    readonly sourceTags: readonly string[];  // Tags vừa nhận được từ Meta / webhook / sync
    readonly isCustomerTouched?: boolean;    // Khách hàng đã được Sales tương tác chưa
    readonly existingLeadStatus?: CRMLeadStatus | (string & {}) | null;
    readonly existingLeadStage?: CRMPipelineStage | (string & {}) | null;
    readonly eventTimestamp?: Date | string | null;    // Thời gian của tin nhắn/sự kiện đang đồng bộ
    readonly lastSyncTimestamp?: Date | string | null; // Thời gian tin nhắn/đồng bộ mới nhất trong DB
    readonly explicitEmptyLabels?: boolean;            // Nguồn Meta trả về danh sách nhãn rỗng xác nhận đã gỡ toàn bộ nhãn
    readonly manuallyRemovedTags?: readonly string[];  // Danh sách các tag nội bộ đã được người dùng gỡ thủ công qua CRM
}

/**
 * Kết quả sau khi phân giải ánh xạ tag
 */
export interface TagSyncResult {
    readonly finalTags: string[];           // Danh sách tags cuối cùng đã deduplicate
    readonly addedTags: string[];           // Tags mới được bổ sung
    readonly removedTags: string[];         // Tags bị gỡ bỏ theo policy
    readonly mappedMatches: Array<{
        readonly sourceTag: string;
        readonly ruleId: string;
        readonly targetTag: string;
    }>;
    readonly unmappedTags: string[];        // Các tag nguồn không có rule ánh xạ
    readonly suggestedLeadStatus?: CRMLeadStatus | (string & {});  // Gợi ý cập nhật leadStatus nếu có
    readonly suggestedLeadStage?: CRMPipelineStage | (string & {});   // Gợi ý cập nhật leadStage nếu có
    readonly hasChanges: boolean;           // True nếu có tag mới thêm vào hoặc tag bị gỡ
    readonly isTargetTagAlreadyPresent: boolean; // True nếu tag nội bộ đích đã tồn tại trong DB từ trước
    readonly isOutOfOrder: boolean;         // True nếu sự kiện này cũ hơn thời điểm đồng bộ gần nhất trong DB
    readonly shouldUpgradeLead: boolean;    // True nếu có thể nâng cấp leadStatus/leadStage an toàn (không bị hạ cấp)
}
