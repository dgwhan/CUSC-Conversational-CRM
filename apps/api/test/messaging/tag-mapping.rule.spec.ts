import { describe, it, expect } from 'vitest';
import { Channel } from '../../src/modules/messaging/domain/channel.js';
import {
    DEFAULT_TAG_MAPPING_CONFIG,
    DEFAULT_TAG_MAPPING_RULES,
    resolveTagMappings,
    deduplicateTags,
    sanitizeTagName,
    CRM_SYSTEM_TAGS,
    TagMappingRule,
    TagMappingEngine,
    CRM_LEAD_STATUS,
    CRM_PIPELINE_STAGES,
    TAG_MAPPING_RULE_IDS,
    META_SOURCE_TAGS,
    TAG_REMOVAL_POLICY,
    UNMAPPED_TAG_POLICY,
} from '../../src/modules/messaging/domain/tag-mapping/index.js';

describe('Sub-task 1: Tag Mapping Rules & Engine', () => {
    describe('1. Ánh xạ tag Facebook Lead -> Lead', () => {
        it('ánh xạ chính xác Facebook Lead sang tag nội bộ Lead', () => {
            const result = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: [],
                sourceTags: [META_SOURCE_TAGS.FACEBOOK_LEAD],
            });

            expect(result.finalTags).toContain(CRM_SYSTEM_TAGS.LEAD);
            expect(result.addedTags).toContain(CRM_SYSTEM_TAGS.LEAD);
            expect(result.mappedMatches).toHaveLength(1);
            expect(result.mappedMatches[0]).toEqual({
                sourceTag: META_SOURCE_TAGS.FACEBOOK_LEAD,
                ruleId: TAG_MAPPING_RULE_IDS.FACEBOOK_LEAD_TO_CRM_LEAD,
                targetTag: CRM_SYSTEM_TAGS.LEAD,
            });
            expect(result.suggestedLeadStatus).toBe(CRM_LEAD_STATUS.POTENTIAL);
            expect(result.suggestedLeadStage).toBe(CRM_PIPELINE_STAGES.STAGE_NEW);
        });

        it('hỗ trợ so khớp không phân biệt hoa thường và các aliases phổ biến', () => {
            const testAliases = ['facebook lead', 'FACEBOOK LEAD', 'fb lead', 'Meta Lead', 'fb_lead', 'lead ad'];

            for (const alias of testAliases) {
                const result = resolveTagMappings({
                    channel: Channel.FACEBOOK,
                    currentTags: [],
                    sourceTags: [alias],
                });

                expect(result.finalTags).toContain('Lead');
                expect(result.mappedMatches[0]?.targetTag).toBe('Lead');
            }
        });

        it('không áp dụng rule Facebook Lead cho các channel khác', () => {
            const result = resolveTagMappings({
                channel: Channel.ZALO,
                currentTags: [],
                sourceTags: ['Facebook Lead'],
            });

            // Không khớp rule của Facebook khi channel là Zalo
            expect(result.mappedMatches).toHaveLength(0);
            expect(result.unmappedTags).toContain('Facebook Lead');
            // Mặc định unmappedPolicy là PASS_THROUGH nên vẫn giữ nguyên tag an toàn
            expect(result.finalTags).toContain('Facebook Lead');
        });

        it('ánh xạ Zalo Lead sang tag nội bộ Lead khi từ kênh Zalo', () => {
            const result = resolveTagMappings({
                channel: Channel.ZALO,
                currentTags: [],
                sourceTags: ['Zalo Lead'],
            });

            expect(result.finalTags).toContain(CRM_SYSTEM_TAGS.LEAD);
            expect(result.mappedMatches[0]?.targetTag).toBe('Lead');
        });
    });

    describe('2. Tính Idempotency (Khử trùng lặp khi đồng bộ nhiều lần)', () => {
        it('không tạo tag trùng lặp khi chạy đồng bộ lặp lại nhiều lần', () => {
            // Lần 1: Đồng bộ lần đầu
            const firstRun = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: [],
                sourceTags: ['Facebook Lead'],
            });

            expect(firstRun.finalTags).toEqual(['Lead']);

            // Lần 2: Đồng bộ lần 2 với currentTags đã có 'Lead'
            const secondRun = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: firstRun.finalTags,
                sourceTags: ['Facebook Lead'],
            });

            expect(secondRun.finalTags).toEqual(['Lead']);
            expect(secondRun.addedTags).toEqual([]); // Không có tag mới nào được thêm

            // Lần 3: Đồng bộ với tag viết thường 'lead' trong DB
            const thirdRun = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: ['lead'],
                sourceTags: ['Facebook Lead'],
            });

            // Không bị mảng ['lead', 'Lead']
            expect(thirdRun.finalTags).toHaveLength(1);
        });

        it('deduplicateTags loại bỏ khoảng trắng và phân biệt case', () => {
            const tags = ['Lead', '  Lead  ', 'lead', 'LEAD', 'VIP', ' vip '];
            const deduped = deduplicateTags(tags);

            expect(deduped).toEqual(['Lead', 'VIP']);
        });
    });

    describe('3. Xử lý khi tag nguồn chưa được cấu hình ánh xạ (Unmapped Tags)', () => {
        it('chính sách PASS_THROUGH: giữ nguyên tag lạ để không mất thông tin tư vấn', () => {
            const result = resolveTagMappings(
                {
                    channel: Channel.FACEBOOK,
                    currentTags: ['Khách cũ'],
                    sourceTags: ['Hỏi học phí', 'Cần tư vấn ngay'],
                },
                {
                    ...DEFAULT_TAG_MAPPING_CONFIG,
                    unmappedPolicy: 'PASS_THROUGH',
                }
            );

            expect(result.unmappedTags).toEqual(['Hỏi học phí', 'Cần tư vấn ngay']);
            expect(result.finalTags).toContain('Khách cũ');
            expect(result.finalTags).toContain('Hỏi học phí');
            expect(result.finalTags).toContain('Cần tư vấn ngay');
        });

        it('chính sách PREFIX_SOURCE: gắn prefix để phân định nhãn nguồn', () => {
            const result = resolveTagMappings(
                {
                    channel: Channel.FACEBOOK,
                    currentTags: [],
                    sourceTags: ['Ưu đãi 20%'],
                },
                {
                    ...DEFAULT_TAG_MAPPING_CONFIG,
                    unmappedPolicy: 'PREFIX_SOURCE',
                    unmappedPrefix: 'Meta: ',
                }
            );

            expect(result.finalTags).toEqual(['Meta: Ưu đãi 20%']);
        });

        it('chính sách IGNORE: bỏ qua hoàn toàn các tag chưa cấu hình ánh xạ', () => {
            const result = resolveTagMappings(
                {
                    channel: Channel.FACEBOOK,
                    currentTags: ['Lead'],
                    sourceTags: ['Tag rác từ Meta'],
                },
                {
                    ...DEFAULT_TAG_MAPPING_CONFIG,
                    unmappedPolicy: 'IGNORE',
                }
            );

            expect(result.unmappedTags).toEqual(['Tag rác từ Meta']);
            expect(result.finalTags).toEqual(['Lead']);
        });

        it('làm sạch tag nguồn dài quá giới hạn hoặc chứa ký tự điều khiển ẩn', () => {
            const longTag = 'A'.repeat(80);
            const sanitized = sanitizeTagName(longTag, 50);
            expect(sanitized).toHaveLength(50);

            const dirtyTag = 'Tag \u0000 Test \u001F';
            expect(sanitizeTagName(dirtyTag)).toBe('Tag  Test');
        });
    });

    describe('4. Quy tắc khi tag nguồn bị GỠ (Removal Policy)', () => {
        it('chính sách RETAIN_TARGET: giữ nguyên tag Lead nội bộ để bảo toàn dữ liệu CRM', () => {
            const result = resolveTagMappings({
                channel: Channel.FACEBOOK,
                currentTags: ['Lead'],
                sourceTags: ['Khách bình thường'], // Không còn 'Facebook Lead'
            });

            expect(result.finalTags).toContain('Lead');
            expect(result.removedTags).toHaveLength(0);
        });

        it('chính sách REMOVE_TARGET_IF_UNTOUCHED: gỡ tag Lead nếu khách hàng chưa được sales tương tác', () => {
            const customRule: TagMappingRule = {
                ...DEFAULT_TAG_MAPPING_RULES[0],
                removalPolicy: 'REMOVE_TARGET_IF_UNTOUCHED',
            };

            const resultUntouched = resolveTagMappings(
                {
                    channel: Channel.FACEBOOK,
                    currentTags: ['Lead'],
                    sourceTags: ['Khách thường'],
                    isCustomerTouched: false,
                },
                {
                    ...DEFAULT_TAG_MAPPING_CONFIG,
                    rules: [customRule],
                }
            );

            expect(resultUntouched.removedTags).toContain('Lead');
            expect(resultUntouched.finalTags).not.toContain('Lead');

            // Nhưng nếu khách hàng ĐÃ được tương tác (isCustomerTouched = true), KHÔNG được gỡ
            const resultTouched = resolveTagMappings(
                {
                    channel: Channel.FACEBOOK,
                    currentTags: ['Lead'],
                    sourceTags: ['Khách thường'],
                    isCustomerTouched: true,
                },
                {
                    ...DEFAULT_TAG_MAPPING_CONFIG,
                    rules: [customRule],
                }
            );

            expect(resultTouched.removedTags).toHaveLength(0);
            expect(resultTouched.finalTags).toContain('Lead');
        });
    });

    describe('5. TagMappingEngine OOP Service Interface', () => {
        it('hỗ trợ khởi tạo instance và giải quyết mapping thông qua service class', () => {
            const engine = new TagMappingEngine();

            const result = engine.resolve({
                channel: Channel.FACEBOOK,
                currentTags: [],
                sourceTags: [META_SOURCE_TAGS.FACEBOOK_LEAD],
            });

            expect(result.finalTags).toEqual([CRM_SYSTEM_TAGS.LEAD]);
            expect(engine.deduplicate(['A', 'a', 'B'])).toEqual(['A', 'B']);
            expect(engine.sanitize('  dirty\u0000tag  ')).toBe('dirtytag');
        });
    });
});
