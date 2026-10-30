import type { Channel } from "../channel.js";
import {
    DEFAULT_TAG_MAPPING_CONFIG,
    TAG_MAPPING_DEFAULTS,
    CRM_LEAD_STATUS,
    CRM_PIPELINE_STAGES,
    CRM_LEAD_STATUS_RANK,
    CRM_PIPELINE_STAGE_RANK,
} from "./tag-mapping.constants.js";
import {
    CHANNEL_SCOPE_ALL,
    TAG_MATCHING_TYPE,
    TAG_REMOVAL_POLICY,
    UNMAPPED_TAG_POLICY,
    type TagMappingEngineConfig,
    type TagMappingRule,
    type TagSyncContext,
    type TagSyncResult,
} from "./tag-mapping.types.js";
import {
    tagSyncLogger,
    TAG_SYNC_STAGE,
    TAG_SYNC_ERROR_TYPE,
    TAG_EVENT_SOURCE,
} from "./tag-sync-logger.js";

/**
 * Hàm tiện ích làm sạch và chuẩn hóa chuỗi tag
 */
export function sanitizeTagName(tag: string, maxLength: number = TAG_MAPPING_DEFAULTS.MAX_TAG_LENGTH): string {
    if (!tag) return '';
    // Xóa ký tự điều khiển ẩn, khoảng trắng thừa
    const cleaned = tag.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
    return cleaned.slice(0, maxLength);
}

/**
 * Kiểm tra xem có thể nâng cấp trạng thái khách hàng mà không bị hạ cấp do out-of-order event
 */
export function canUpgradeLeadStatus(
    existingStatus?: string | null,
    suggestedStatus?: string | null
): boolean {
    if (!suggestedStatus) return false;
    if (!existingStatus || existingStatus === CRM_LEAD_STATUS.NEW) return true;
    const currentRank = CRM_LEAD_STATUS_RANK[existingStatus] ?? 0;
    const suggestedRank = CRM_LEAD_STATUS_RANK[suggestedStatus] ?? 0;
    return suggestedRank > currentRank;
}

/**
 * Kiểm tra xem có thể nâng cấp giai đoạn phễu mà không bị hạ cấp do out-of-order event
 */
export function canUpgradeLeadStage(
    existingStage?: string | null,
    suggestedStage?: string | null
): boolean {
    if (!suggestedStage) return false;
    if (!existingStage || existingStage === CRM_PIPELINE_STAGES.STAGE_NEW) return true;
    const currentRank = CRM_PIPELINE_STAGE_RANK[existingStage] ?? 0;
    const suggestedRank = CRM_PIPELINE_STAGE_RANK[suggestedStage] ?? 0;
    return suggestedRank > currentRank;
}

/**
 * Kiểm tra so khớp tag nguồn với rule
 */
export function matchesTagRule(sourceTag: string, rule: TagMappingRule, channel: Channel): boolean {
    if (rule.sourceChannel !== CHANNEL_SCOPE_ALL && rule.sourceChannel !== channel) {
        return false;
    }

    const cleanSource = sanitizeTagName(sourceTag);
    if (!cleanSource) return false;

    const candidateSources = [rule.sourceTag, ...(rule.sourceTagAliases || [])];

    switch (rule.matchingType) {
        case TAG_MATCHING_TYPE.EXACT:
            return candidateSources.some((cand) => cand === cleanSource);

        case TAG_MATCHING_TYPE.CASE_INSENSITIVE:
        case TAG_MATCHING_TYPE.ALIAS: {
            const lowerSource = cleanSource.toLowerCase();
            return candidateSources.some((cand) => cand.toLowerCase() === lowerSource);
        }

        case TAG_MATCHING_TYPE.REGEX:
            try {
                const regex = new RegExp(rule.sourceTag, 'i');
                return regex.test(cleanSource);
            } catch (err) {
                tagSyncLogger.logError({
                    stage: TAG_SYNC_STAGE.MAP,
                    errorType: TAG_SYNC_ERROR_TYPE.TAG_MAPPING_ERROR,
                    message: `Biểu thức Regex không hợp lệ trong quy tắc "${rule.name}": ${(err as Error).message}`,
                    eventSource: TAG_EVENT_SOURCE.SYSTEM_BACKGROUND_JOB,
                    channel,
                    error: err,
                    sourceTags: [sourceTag],
                    metadata: { ruleId: rule.id, pattern: rule.sourceTag },
                });
                return false;
            }

        default:
            return false;
    }
}

/**
 * Hợp nhất và khử trùng lặp danh sách tags (Idempotent Merge)
 * So sánh không phân biệt hoa thường để tránh trùng dạng ['Lead', 'lead']
 */
export function deduplicateTags(tags: readonly string[]): string[] {
    const result: string[] = [];
    const seenLower = new Set<string>();

    for (const raw of tags) {
        const cleaned = sanitizeTagName(raw);
        if (!cleaned) continue;

        const lower = cleaned.toLowerCase();
        if (!seenLower.has(lower)) {
            seenLower.add(lower);
            result.push(cleaned);
        }
    }

    return result;
}

/**
 * Engine cốt lõi phân giải tag mapping
 * Đảm bảo tính Idempotent, xử lý ánh xạ, unmapped tags, removal rules và out-of-order events
 */
export function resolveTagMappings(
    context: TagSyncContext,
    config: TagMappingEngineConfig = DEFAULT_TAG_MAPPING_CONFIG
): TagSyncResult {
    const {
        channel,
        currentTags,
        sourceTags,
        isCustomerTouched = false,
        existingLeadStatus,
        existingLeadStage,
        eventTimestamp,
        lastSyncTimestamp,
        explicitEmptyLabels = false,
        manuallyRemovedTags = [],
    } = context;

    // Kiểm tra sự kiện out-of-order (sự kiện đồng bộ cũ hơn trạng thái hiện tại trong hệ thống)
    const isOutOfOrder = Boolean(
        eventTimestamp &&
        lastSyncTimestamp &&
        new Date(eventTimestamp).getTime() < new Date(lastSyncTimestamp).getTime()
    );

    const manuallyRemovedLower = new Set(manuallyRemovedTags.map((t) => t.toLowerCase()));
    const matchedRules: Array<{ sourceTag: string; ruleId: string; targetTag: string }> = [];
    const unmappedList: string[] = [];
    const targetTagsToAdd: string[] = [];
    const sourceTagsToKeep: string[] = [];

    // Danh sách active target tags từ nguồn gửi đến lần này
    const currentSyncTargetTags = new Set<string>();

    // 1. Phân loại từng tag nhận từ nguồn Meta / ngoại vi
    for (const rawSource of sourceTags) {
        const cleanSource = sanitizeTagName(rawSource);
        if (!cleanSource) continue;

        // Tìm rule khớp có priority cao nhất
        const matchingRule = [...config.rules]
            .sort((a, b) => b.priority - a.priority)
            .find((rule) => matchesTagRule(cleanSource, rule, channel));

        if (matchingRule) {
            // Kiểm tra nếu tag đích này đã bị người dùng gỡ thủ công qua CRM -> tôn trọng quyết định của CRM
            if (manuallyRemovedLower.has(matchingRule.targetTag.toLowerCase())) {
                continue;
            }

            matchedRules.push({
                sourceTag: cleanSource,
                ruleId: matchingRule.id,
                targetTag: matchingRule.targetTag,
            });
            targetTagsToAdd.push(matchingRule.targetTag);
            currentSyncTargetTags.add(matchingRule.targetTag.toLowerCase());

            if (matchingRule.keepSourceTag) {
                sourceTagsToKeep.push(cleanSource);
            }
        } else {
            // Tag chưa được cấu hình ánh xạ
            unmappedList.push(cleanSource);
        }
    }

    // 2. Xử lý các tag chưa được ánh xạ (Unmapped Tag Policy)
    const unmappedTagsProcessed: string[] = [];
    switch (config.unmappedPolicy) {
        case UNMAPPED_TAG_POLICY.PASS_THROUGH:
            for (const unmapped of unmappedList) {
                unmappedTagsProcessed.push(unmapped);
            }
            break;

        case UNMAPPED_TAG_POLICY.PREFIX_SOURCE: {
            const prefix = config.unmappedPrefix || `${channel}: `;
            for (const unmapped of unmappedList) {
                unmappedTagsProcessed.push(`${prefix}${unmapped}`);
            }
            break;
        }

        case UNMAPPED_TAG_POLICY.IGNORE:
        default:
            // Không đưa vào tags
            break;
    }

    // 3. Xử lý trường hợp Tag nguồn bị GỠ (Removal Policy)
    // LƯU Ý IDEMPOTENT: Nếu sự kiện là out-of-order, KHÔNG được gỡ tag vì dữ liệu này cũ hơn trạng thái hiện tại trong DB
    const tagsToRemove: string[] = [];
    if (!isOutOfOrder) {
        for (const rule of config.rules) {
            if (rule.sourceChannel !== CHANNEL_SCOPE_ALL && rule.sourceChannel !== channel) continue;

            const ruleTargetLower = rule.targetTag.toLowerCase();
            const hasSourceInCurrentSync = currentSyncTargetTags.has(ruleTargetLower);

            // Nếu lần sync này không có tag nguồn tương ứng với rule (kể cả khi Meta gửi nhãn rỗng explicitEmptyLabels)
            const isSourceAbsent = !hasSourceInCurrentSync && (sourceTags.length > 0 || explicitEmptyLabels);
            if (isSourceAbsent) {
                const hasTargetInCurrentDb = currentTags.some((t) => t.toLowerCase() === ruleTargetLower);
                if (hasTargetInCurrentDb) {
                    if (rule.removalPolicy === TAG_REMOVAL_POLICY.FORCE_REMOVE_TARGET) {
                        tagsToRemove.push(rule.targetTag);
                    } else if (rule.removalPolicy === TAG_REMOVAL_POLICY.REMOVE_TARGET_IF_UNTOUCHED && !isCustomerTouched) {
                        tagsToRemove.push(rule.targetTag);
                    }
                    // Nếu RETAIN_TARGET: giữ nguyên, không đưa vào tagsToRemove
                }
            }
        }
    }

    // 4. Hợp nhất các tags hiện tại và tags mới
    const removedLower = new Set(tagsToRemove.map((t) => t.toLowerCase()));
    const remainingCurrent = currentTags.filter((t) => !removedLower.has(t.toLowerCase()));

    const candidateTags = [
        ...remainingCurrent,
        ...targetTagsToAdd,
        ...sourceTagsToKeep,
        ...unmappedTagsProcessed,
    ];

    const finalTags = deduplicateTags(candidateTags);

    // Tính toán danh sách tags thực sự được thêm mới
    const currentLowerSet = new Set(currentTags.map((t) => t.toLowerCase()));
    const addedTags = finalTags.filter((t) => !currentLowerSet.has(t.toLowerCase()));

    // Kiểm tra xem tag nội bộ đích đã có sẵn từ trước trong DB chưa
    const isTargetTagAlreadyPresent = matchedRules.some((m) => currentLowerSet.has(m.targetTag.toLowerCase()));

    // Tính toán thay đổi thực tế
    const hasChanges = addedTags.length > 0 || tagsToRemove.length > 0;

    // Xác định gợi ý cập nhật Lead Status / Stage từ rule cao nhất
    let suggestedLeadStatus: string | undefined;
    let suggestedLeadStage: string | undefined;
    if (matchedRules.length > 0) {
        const topRule = config.rules.find((r) => r.id === matchedRules[0]?.ruleId);
        if (topRule) {
            suggestedLeadStatus = topRule.autoUpdateLeadStatus;
            suggestedLeadStage = topRule.autoUpdateLeadStage;
        }
    }

    // Đánh giá xem có được phép cập nhật leadStatus / leadStage không (chống hạ cấp khi out-of-order)
    const canPromoteStatus = canUpgradeLeadStatus(existingLeadStatus, suggestedLeadStatus);
    const canPromoteStage = canUpgradeLeadStage(existingLeadStage, suggestedLeadStage);
    const shouldUpgradeLead = !isOutOfOrder && (canPromoteStatus || canPromoteStage);

    return {
        finalTags,
        addedTags,
        removedTags: tagsToRemove,
        mappedMatches: matchedRules,
        unmappedTags: unmappedList,
        suggestedLeadStatus: shouldUpgradeLead ? suggestedLeadStatus : undefined,
        suggestedLeadStage: shouldUpgradeLead ? suggestedLeadStage : undefined,
        hasChanges,
        isTargetTagAlreadyPresent,
        isOutOfOrder,
        shouldUpgradeLead,
    };
}

/**
 * Lớp trừu tượng dịch vụ Domain Service phục vụ Dependency Injection
 */
export class TagMappingEngine {
    constructor(private readonly config: TagMappingEngineConfig = DEFAULT_TAG_MAPPING_CONFIG) {}

    resolve(context: TagSyncContext): TagSyncResult {
        return resolveTagMappings(context, this.config);
    }

    deduplicate(tags: readonly string[]): string[] {
        return deduplicateTags(tags);
    }

    sanitize(tag: string, maxLength?: number): string {
        return sanitizeTagName(tag, maxLength);
    }

    matches(sourceTag: string, rule: TagMappingRule, channel: Channel): boolean {
        return matchesTagRule(sourceTag, rule, channel);
    }

    canUpgradeStatus(existingStatus?: string | null, suggestedStatus?: string | null): boolean {
        return canUpgradeLeadStatus(existingStatus, suggestedStatus);
    }

    canUpgradeStage(existingStage?: string | null, suggestedStage?: string | null): boolean {
        return canUpgradeLeadStage(existingStage, suggestedStage);
    }
}
