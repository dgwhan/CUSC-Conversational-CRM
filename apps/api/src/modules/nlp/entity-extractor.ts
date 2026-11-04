import { normalize, stripVietnameseAccents } from './text-normalizer.js';
import { standardizeVietnamesePhoneNumber } from '../customers/domain/phone-standardizer.js';

export interface CatalogProductItem {
  id: string;
  name: string;
  code?: string;
  category?: string;
  defaultPrice?: number;
}

export interface ExtractedEntitiesResult {
  phoneNumber: string | null;
  documents: string[];
  detectedCourses: Array<{
    id: string;
    name: string;
    code?: string;
  }>;
  normalizedText: string;
}

const DOCUMENT_PATTERNS: Array<{
  name: string;
  keywords: string[];
}> = [
  {
    name: 'CCCD',
    keywords: ['can cuoc cong dan', 'cccd', 'can cuoc', 'cmnd', 'chung minh nhan dan', 'chung minh thu'],
  },
  {
    name: 'Học bạ',
    keywords: ['hoc ba', 'bang diem'],
  },
  {
    name: 'Giấy khai sinh',
    keywords: ['giay khai sinh', 'khai sinh', 'ban sao khai sinh'],
  },
  {
    name: 'Bằng tốt nghiệp',
    keywords: ['bang tot nghiep', 'giay chung nhan tot nghiep', 'bang cap'],
  },
  {
    name: 'Ảnh thẻ',
    keywords: ['anh the', 'anh 3x4', 'anh 4x6'],
  },
];

/**
 * Biểu thức tìm kiếm các chuỗi số điện thoại Việt Nam trong nội dung tin nhắn tự nhiên
 */
const VIETNAMESE_PHONE_CANDIDATE_REGEX = /(?:\+84|0)(?:[\s.\-–—]?[0-9]){9}\b/g;

/**
 * Trích xuất Số điện thoại từ nội dung văn bản sử dụng chuẩn CUS-03 (phone-standardizer)
 */
export function extractPhoneNumber(text: string): string | null {
  if (!text) return null;

  const matches = text.match(VIETNAMESE_PHONE_CANDIDATE_REGEX);
  if (!matches) return null;

  for (const candidate of matches) {
    const standardized = standardizeVietnamesePhoneNumber(candidate);
    if (standardized) {
      return standardized;
    }
  }

  return null;
}

/**
 * Trích xuất danh sách Loại hồ sơ được nhắc đến trong văn bản
 */
export function extractDocuments(normalizedText: string): string[] {
  if (!normalizedText) return [];

  const foundDocs: string[] = [];
  for (const doc of DOCUMENT_PATTERNS) {
    const hasMatch = doc.keywords.some((kw) => {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(normalizedText);
    });

    if (hasMatch) {
      foundDocs.push(doc.name);
    }
  }

  return foundDocs;
}

/**
 * Trích xuất Khóa học / Dịch vụ quan tâm theo danh mục cấu hình
 */
export function extractCourses(
  normalizedText: string,
  catalog: CatalogProductItem[] = []
): Array<{ id: string; name: string; code?: string }> {
  if (!normalizedText || !catalog || catalog.length === 0) return [];

  const matched: Array<{ id: string; name: string; code?: string }> = [];

  for (const item of catalog) {
    const normName = normalize(item.name);
    const normCode = item.code ? normalize(item.code) : '';

    let isMatch = false;

    // So khớp mã định danh (Code)
    if (normCode && normCode.length >= 2) {
      const codeRegex = new RegExp(`\\b${normCode}\\b`, 'i');
      if (codeRegex.test(normalizedText)) {
        isMatch = true;
      }
    }

    // So khớp tên đầy đủ hoặc từ khóa đặc trưng trong tên khóa học
    if (!isMatch && normName) {
      if (normalizedText.includes(normName)) {
        isMatch = true;
      } else {
        // Tách các từ khóa đặc thù (VD: "aptech", "arena", "python", "fullstack")
        const significantWords = normName
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !['khoa', 'hoc', 'nganh', 'dao', 'tao', 'chuong', 'trinh'].includes(w));

        const matchedWords = significantWords.filter((w) => normalizedText.includes(w));
        if (matchedWords.length >= 2 || (significantWords.length === 1 && matchedWords.length === 1)) {
          isMatch = true;
        }
      }
    }

    if (isMatch) {
      matched.push({
        id: item.id,
        name: item.name,
        code: item.code,
      });
    }
  }

  return matched;
}

/**
 * Trích xuất toàn diện các thực thể nghiệp vụ từ tin nhắn
 *
 * Tiêu chí nghiệm thu: "em gửi cccd với học bạ, sđt 0912345678" -> trả đủ:
 * - phoneNumber: "0912345678"
 * - documents: ["CCCD", "Học bạ"]
 * - detectedCourses: []
 */
export function extractEntities(
  rawText: string,
  catalog: CatalogProductItem[] = []
): ExtractedEntitiesResult {
  const normalizedText = normalize(rawText);
  const phoneNumber = extractPhoneNumber(rawText);
  const documents = extractDocuments(normalizedText);
  const detectedCourses = extractCourses(normalizedText, catalog);

  return {
    phoneNumber,
    documents,
    detectedCourses,
    normalizedText,
  };
}

