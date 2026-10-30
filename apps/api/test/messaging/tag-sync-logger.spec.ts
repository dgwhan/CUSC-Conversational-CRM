import { describe, it, expect, beforeEach, vi } from "vitest";
import { Channel } from "../../src/modules/messaging/domain/channel.js";
import {
    tagSyncLogger,
    TAG_SYNC_STAGE,
    TAG_SYNC_ERROR_TYPE,
    TAG_EVENT_SOURCE,
    sanitizeSensitiveData,
    sanitizeSensitiveString,
    isSensitiveKey,
} from "../../src/modules/messaging/domain/tag-mapping/tag-sync-logger.js";
import {
    TagMappingEngine,
    TAG_MATCHING_TYPE,
    TAG_REMOVAL_POLICY,
    UNMAPPED_TAG_POLICY,
} from "../../src/modules/messaging/domain/tag-mapping/index.js";

describe("Sub-task 5: Add Synchronization Error Logging", () => {
    beforeEach(() => {
        tagSyncLogger.clearBuffer();
        vi.clearAllMocks();
    });

    describe("1. Ghi log khi các giai đoạn (READ, MAP, UPDATE, DELETE) thất bại", () => {
        it("ghi log lỗi khi đọc tag từ nguồn ngoại vi thất bại (READ)", () => {
            const entry = tagSyncLogger.logError({
                stage: TAG_SYNC_STAGE.READ,
                errorType: TAG_SYNC_ERROR_TYPE.TAG_READ_ERROR,
                message: "Không thể trích xuất nhãn từ webhook Meta: payload hỏng",
                eventSource: TAG_EVENT_SOURCE.META_WEBHOOK,
                channel: Channel.FACEBOOK,
                error: new Error("Unexpected end of JSON input"),
                channelAccountId: "acc-fb-123",
                senderExternalId: "sender-999",
            });

            expect(entry.stage).toBe("READ");
            expect(entry.errorType).toBe("TAG_READ_ERROR");
            expect(entry.eventSource).toBe("META_WEBHOOK");
            expect(entry.channel).toBe("FACEBOOK");
            expect(entry.message).toContain("Không thể trích xuất nhãn");
            expect(entry.errorDetails?.message).toBe("Unexpected end of JSON input");
            expect(entry.context.channelAccountId).toBe("acc-fb-123");
            expect(entry.context.senderExternalId).toBe("sender-999");
            expect(entry.occurredAt).toBeDefined();
            expect(new Date(entry.occurredAt).getTime()).toBeGreaterThan(0);
        });

        it("ghi log lỗi khi ánh xạ quy tắc tag thất bại (MAP)", () => {
            const entry = tagSyncLogger.logError({
                stage: TAG_SYNC_STAGE.MAP,
                errorType: TAG_SYNC_ERROR_TYPE.TAG_MAPPING_ERROR,
                message: "Lỗi so khớp Regex trong quy tắc ánh xạ",
                eventSource: TAG_EVENT_SOURCE.SYSTEM_BACKGROUND_JOB,
                channel: Channel.FACEBOOK,
                sourceTags: ["facebook_lead", "vip"],
                metadata: {
                    ruleId: "rule-invalid-regex",
                    pattern: "[a-z+",
                },
            });

            expect(entry.stage).toBe("MAP");
            expect(entry.errorType).toBe("TAG_MAPPING_ERROR");
            expect(entry.context.sourceTags).toEqual(["facebook_lead", "vip"]);
            expect(entry.context.metadata?.ruleId).toBe("rule-invalid-regex");
        });

        it("ghi log lỗi khi cập nhật nhãn vào CSDL thất bại (UPDATE)", () => {
            const entry = tagSyncLogger.logError({
                stage: TAG_SYNC_STAGE.UPDATE,
                errorType: TAG_SYNC_ERROR_TYPE.TAG_DATABASE_ERROR,
                message: "Lỗi Prisma khi update nhãn Customer",
                eventSource: TAG_EVENT_SOURCE.META_GRAPH_API,
                channel: Channel.FACEBOOK,
                customerId: "cust-001",
                conversationId: "conv-001",
                sourceTags: ["Facebook Lead"],
                targetTags: ["Lead"],
                error: new Error("P2002: Unique constraint failed on the fields: (id)"),
            });

            expect(entry.stage).toBe("UPDATE");
            expect(entry.errorType).toBe("TAG_DATABASE_ERROR");
            expect(entry.context.customerId).toBe("cust-001");
            expect(entry.context.conversationId).toBe("conv-001");
            expect(entry.context.targetTags).toEqual(["Lead"]);
            expect(entry.errorDetails?.message).toContain("P2002");
        });

        it("ghi log lỗi khi gỡ nhãn thất bại (DELETE)", () => {
            const entry = tagSyncLogger.logError({
                stage: TAG_SYNC_STAGE.DELETE,
                errorType: TAG_SYNC_ERROR_TYPE.TAG_REMOVAL_ERROR,
                message: "Không thể gỡ nhãn Lead khỏi khách hàng",
                eventSource: TAG_EVENT_SOURCE.CRM_MANUAL_ACTION,
                customerId: "cust-002",
                targetTags: ["Khách hàng mới"],
                error: new Error("Connection timeout"),
            });

            expect(entry.stage).toBe("DELETE");
            expect(entry.errorType).toBe("TAG_REMOVAL_ERROR");
            expect(entry.eventSource).toBe("CRM_MANUAL_ACTION");
            expect(entry.context.customerId).toBe("cust-002");
        });
    });

    describe("2. Thông tin phục vụ truy vết (Traceability & Correlation)", () => {
        it("lưu trữ thời điểm xảy ra chuẩn ISO 8601", () => {
            const testTime = new Date("2026-10-30T01:15:00.000Z");
            const entry = tagSyncLogger.logError({
                stage: TAG_SYNC_STAGE.MAP,
                errorType: TAG_SYNC_ERROR_TYPE.TAG_MAPPING_ERROR,
                message: "Trace test",
                eventSource: TAG_EVENT_SOURCE.META_WEBHOOK,
                occurredAt: testTime,
            });

            expect(entry.occurredAt).toBe("2026-10-30T01:15:00.000Z");
        });

        it("hỗ trợ correlationId và metadata mở rộng phục vụ truy vết phân tán", () => {
            const correlationId = "corr-req-8899-aabb";
            const entry = tagSyncLogger.logError({
                stage: TAG_SYNC_STAGE.UPDATE,
                errorType: TAG_SYNC_ERROR_TYPE.TAG_UPDATE_ERROR,
                message: "Distributed trace test",
                eventSource: TAG_EVENT_SOURCE.META_WEBHOOK,
                correlationId,
                metadata: {
                    ip: "127.0.0.1",
                    retryCount: 3,
                },
            });

            expect(entry.context.correlationId).toBe(correlationId);
            expect(entry.context.metadata?.retryCount).toBe(3);
        });

        it("lưu và truy vấn các lỗi gần nhất qua getRecentErrors / getLastError", () => {
            tagSyncLogger.logError({
                stage: TAG_SYNC_STAGE.READ,
                errorType: TAG_SYNC_ERROR_TYPE.TAG_READ_ERROR,
                message: "Error 1",
                eventSource: TAG_EVENT_SOURCE.META_WEBHOOK,
            });
            tagSyncLogger.logError({
                stage: TAG_SYNC_STAGE.MAP,
                errorType: TAG_SYNC_ERROR_TYPE.TAG_MAPPING_ERROR,
                message: "Error 2",
                eventSource: TAG_EVENT_SOURCE.META_GRAPH_API,
            });

            const recent = tagSyncLogger.getRecentErrors();
            expect(recent.length).toBe(2);
            expect(tagSyncLogger.getLastError()?.message).toBe("Error 2");
        });
    });

    describe("3. Bảo mật: Tuyệt đối KHÔNG ghi access token hoặc dữ liệu nhạy cảm vào log", () => {
        it("nhận diện chuẩn xác các khóa thuộc tính nhạy cảm (isSensitiveKey)", () => {
            expect(isSensitiveKey("access_token")).toBe(true);
            expect(isSensitiveKey("accessToken")).toBe(true);
            expect(isSensitiveKey("encryptedAccessToken")).toBe(true);
            expect(isSensitiveKey("appSecret")).toBe(true);
            expect(isSensitiveKey("app_secret")).toBe(true);
            expect(isSensitiveKey("authorization")).toBe(true);
            expect(isSensitiveKey("cookie")).toBe(true);
            expect(isSensitiveKey("password")).toBe(true);
            expect(isSensitiveKey("apiKey")).toBe(true);
            expect(isSensitiveKey("credential")).toBe(true);

            expect(isSensitiveKey("customerId")).toBe(false);
            expect(isSensitiveKey("channel")).toBe(false);
            expect(isSensitiveKey("tags")).toBe(false);
        });

        it("làm sạch chuỗi URL chứa access_token trong Graph API query (sanitizeSensitiveString)", () => {
            const secretToken = "EAABwzL1234567890abcdefghijklmnopqrstuvwxyz";
            const dirtyUrl = `https://graph.facebook.com/v19.0/12345/conversations?fields=id,labels&access_token=${secretToken}`;

            const cleanUrl = sanitizeSensitiveString(dirtyUrl);

            expect(cleanUrl).not.toContain(secretToken);
            expect(cleanUrl).toContain("access_token=***REDACTED***");
        });

        it("làm sạch Bearer token và Facebook Hub signature", () => {
            const bearerHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload";
            const cleanBearer = sanitizeSensitiveString(bearerHeader);
            expect(cleanBearer).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
            expect(cleanBearer).toBe("Bearer ***REDACTED***");

            const hubSig = "sha256=d3b07384d113edec49eaa6238ad5ff00";
            const cleanSig = sanitizeSensitiveString(hubSig);
            expect(cleanSig).toBe("sha256=***REDACTED***");
        });

        it("lọc sạch đệ quy object chứa token lồng nhau trong metadata (sanitizeSensitiveData)", () => {
            const dirtyPayload = {
                pageId: "page-123",
                account: {
                    name: "Fanpage Tuyển Sinh",
                    accessToken: "EAABsecret_page_token_value",
                    credentials: {
                        appSecret: "super_secret_app_key",
                        nestedToken: {
                            token: "refresh_token_xyz",
                        },
                    },
                },
                tags: ["Lead", "Facebook Lead"],
            };

            const sanitized = sanitizeSensitiveData(dirtyPayload);

            expect(sanitized.pageId).toBe("page-123");
            expect(sanitized.tags).toEqual(["Lead", "Facebook Lead"]);
            expect(sanitized.account.accessToken).toBe("***REDACTED***");
            expect(sanitized.account.credentials.appSecret).toBe("***REDACTED***");
            expect(sanitized.account.credentials.nestedToken.token).toBe("***REDACTED***");
        });

        it("xử lý an toàn khi logError được gọi với metadata và error chứa access token", () => {
            const fakeToken = "EAABwzSecretTokenHere";
            const entry = tagSyncLogger.logError({
                stage: TAG_SYNC_STAGE.READ,
                errorType: TAG_SYNC_ERROR_TYPE.TAG_READ_ERROR,
                message: `Failed to fetch from https://graph.facebook.com/v19.0/page-123?access_token=${fakeToken}`,
                eventSource: TAG_EVENT_SOURCE.META_GRAPH_API,
                error: new Error(`Graph error with token: ${fakeToken}`),
                metadata: {
                    requestUrl: `https://graph.facebook.com/v19.0/page-123?fields=labels&access_token=${fakeToken}`,
                    accessToken: fakeToken,
                    appSecret: "app_secret_123456",
                },
            });

            // Kiểm tra message không rò rỉ token
            expect(entry.message).not.toContain(fakeToken);
            expect(entry.message).toContain("access_token=***REDACTED***");

            // Kiểm tra errorDetails không rò rỉ token
            expect(entry.errorDetails?.message).not.toContain(fakeToken);
            expect(entry.errorDetails?.message).toContain("***REDACTED***");

            // Kiểm tra metadata không rò rỉ token
            expect(entry.context.metadata?.requestUrl).not.toContain(fakeToken);
            expect(entry.context.metadata?.requestUrl).toContain("access_token=***REDACTED***");
            expect(entry.context.metadata?.accessToken).toBe("***REDACTED***");
            expect(entry.context.metadata?.appSecret).toBe("***REDACTED***");
        });
    });

    describe("4. Tích hợp thực tế với TagMappingEngine", () => {
        it("tự động ghi log lỗi MAP khi quy tắc chứa biểu thức Regex không hợp lệ", () => {
            const engine = new TagMappingEngine({
                rules: [
                    {
                        id: "broken-regex-rule",
                        name: "Broken Regex Rule",
                        sourceChannel: Channel.FACEBOOK,
                        sourceTag: "[a-z+broken(regex",
                        matchingType: TAG_MATCHING_TYPE.REGEX,
                        targetTag: "Lead",
                        removalPolicy: TAG_REMOVAL_POLICY.RETAIN_TARGET,
                        keepSourceTag: false,
                        priority: 100,
                    },
                ],
                unmappedPolicy: UNMAPPED_TAG_POLICY.IGNORE,
            });

            const result = engine.resolve({
                channel: Channel.FACEBOOK,
                currentTags: [],
                sourceTags: ["any_tag"],
            });

            expect(result.finalTags).toEqual([]);
            const lastError = tagSyncLogger.getLastError();
            expect(lastError).toBeDefined();
            expect(lastError?.stage).toBe("MAP");
            expect(lastError?.errorType).toBe("TAG_MAPPING_ERROR");
            expect(lastError?.message).toContain("Biểu thức Regex không hợp lệ");
            expect(lastError?.context.metadata?.ruleId).toBe("broken-regex-rule");
        });
    });
});
