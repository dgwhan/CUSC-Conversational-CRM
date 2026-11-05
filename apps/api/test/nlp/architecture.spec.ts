import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Architecture Test (Kiểm thử kiến trúc):
 * Xác nhận ràng buộc Clean Architecture: Tầng nlp/application/ và nlp/domain/
 * tuyệt đối không import module leads hoặc các thành phần của leads.
 */
describe('NLP Architecture Test (Clean Architecture Boundary)', () => {
  const nlpSrcDir = path.resolve(__dirname, '../../src/modules/nlp');

  function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it('tiêu chí hoàn thành: module classification và toàn bộ modules/nlp KHÔNG phụ thuộc module leads', () => {
    const allNlpFiles = getAllFiles(nlpSrcDir);
    expect(allNlpFiles.length).toBeGreaterThan(0);

    const violations: Array<{ file: string; line: string }> = [];

    const importRegex = /(?:import|from)\s+['"][^'"]*leads[^'"]*['"]/i;

    for (const filePath of allNlpFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        // Bỏ qua dòng comment
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

        if (importRegex.test(line)) {
          violations.push({
            file: path.relative(nlpSrcDir, filePath),
            line: `Line ${lineNum + 1}: ${line.trim()}`,
          });
        }
      }
    }

    expect(
      violations,
      `Phát hiện vi phạm kiến trúc: Module NLP không được phép import module leads! Chi tiết: ${JSON.stringify(
        violations,
        null,
        2
      )}`
    ).toEqual([]);
  });

  it('xác nhận ConversationClassificationService giao tiếp hoàn toàn qua Event mà không gọi trực tiếp Leads', () => {
    const servicePath = path.join(nlpSrcDir, 'application/conversation-classification.service.ts');
    expect(fs.existsSync(servicePath)).toBe(true);

    const content = fs.readFileSync(servicePath, 'utf8');
    expect(content).not.toContain('LeadsService');
    expect(content).not.toContain('LeadRepository');
    expect(content).toContain('ConversationClassifiedEvent');
  });
});

