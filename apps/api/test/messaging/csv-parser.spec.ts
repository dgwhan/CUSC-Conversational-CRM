import { describe, expect, it } from 'vitest';
import { parseCsv, generateCsvTemplate } from '../../src/modules/messaging/application/csv-parser.js';

describe('CSV Parser', () => {
    it('parses basic CSV content correctly', () => {
        const csv = `kênh,người gửi,nội dung,thời gian\nZALO,user1,xin chao,2026-10-24T10:00:00Z\nFACEBOOK,user2,tu van hoc phi,2026-10-24T11:00:00Z`;
        const result = parseCsv(csv);

        expect(result.rows).toHaveLength(2);
        expect(result.rows[0].csvLine).toBe(2);
        expect(result.rows[0].data['kênh']).toBe('ZALO');
        expect(result.rows[0].data['người gửi']).toBe('user1');
        expect(result.rows[0].data['nội dung']).toBe('xin chao');
        expect(result.rows[0].data['thời gian']).toBe('2026-10-24T10:00:00Z');

        expect(result.rows[1].csvLine).toBe(3);
        expect(result.rows[1].data['kênh']).toBe('FACEBOOK');
    });

    it('handles quoted fields with commas and escaped quotes', () => {
        const csv = `kênh,người gửi,nội dung,thời gian\nZALO,"Nguyen, Van A","Tôi cần tư vấn ""khoá học CNTT"", cảm ơn",2026-10-24T10:00:00Z`;
        const result = parseCsv(csv);

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].data['người gửi']).toBe('Nguyen, Van A');
        expect(result.rows[0].data['nội dung']).toBe('Tôi cần tư vấn "khoá học CNTT", cảm ơn');
    });

    it('handles UTF-8 BOM properly', () => {
        const csv = '\uFEFFkênh,người gửi,nội dung,thời gian\nTIKTOK,user99,Hello,2026-10-24T12:00:00Z';
        const result = parseCsv(csv);

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].data['kênh']).toBe('TIKTOK');
    });

    it('generates valid CSV template with required headers', () => {
        const template = generateCsvTemplate();
        expect(template).toContain('kênh,người gửi,nội dung,thời gian');
        expect(template).toContain('ZALO');
        expect(template).toContain('FACEBOOK');
    });
});
