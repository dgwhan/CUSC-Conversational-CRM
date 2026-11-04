/**
 * Bộ tiền xử lý và chuẩn hóa văn bản tiếng Việt tự nhiên (NLP Text Normalization Engine)
 * Xử lý teencode, viết tắt, ký tự lặp và dấu tiếng Việt phục vụ trích xuất thực thể & chấm điểm lead.
 */

export const VIETNAMESE_ABBREVIATION_DICTIONARY: Record<string, string> = {
  // Nhóm tài chính & chi phí
  hp: 'hoc phi',
  bn: 'bao nhieu',
  bnhieu: 'bao nhieu',
  bnh: 'bao nhieu',
  nhiu: 'nhieu',
  nhieu: 'nhieu',
  k: 'nghin',
  tr: 'trieu',
  cu: 'trieu',

  // Nhóm liên hệ & tư vấn
  ib: 'inbox',
  inb: 'inbox',
  sdt: 'so dien thoai',
  dt: 'dien thoai',
  alo: 'so dien thoai',
  tv: 'tu van',
  ad: 'admin',
  qtv: 'quan tri vien',

  // Nhóm đăng ký & thủ tục
  dk: 'dang ky',
  dky: 'dang ky',
  reg: 'dang ky',
  hs: 'ho so',
  cccd: 'can cuoc cong dan',
  cmnd: 'chung minh nhan dan',
  gks: 'giay khai sinh',
  hb: 'hoc ba',

  // Nhóm trợ từ & câu hỏi thông dụng
  ko: 'khong',
  k0: 'khong',
  kh: 'khong',
  hok: 'khong',
  dc: 'duoc',
  ntn: 'nhu the nao',
  sao: 'nhu the nao',
  j: 'gi',
  z: 'gi',
  zay: 'vay',
  vs: 'voi',
  thac: 'thang',
  t7: 'thu bay',
  cn: 'chu nhat',
};

/**
 * Loại bỏ dấu tiếng Việt (Unaccent)
 */
export function stripVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

/**
 * Rút gọn các ký tự lặp liên tiếp (>= 3 ký tự liên tiếp -> 1 ký tự)
 * Ví dụ: "họcccc" -> "học", "dạaaaa" -> "dạ", "quaaaa" -> "qua"
 * Ngoại lệ: Giữ nguyên từ viết tắt đặc thù như "cccd"
 */
export function deduplicateRepeatedChars(str: string): string {
  if (!str) return '';
  return str.replace(/\b([a-z0-9_]+)\b/gi, (word) => {
    if (word.toLowerCase() === 'cccd') return word;
    return word.replace(/(.)\1{2,}/gi, '$1');
  });
}

/**
 * Mở rộng từ viết tắt và teencode theo từ điển
 */
export function expandAbbreviations(str: string): string {
  if (!str) return '';
  // Phân tách theo token từ để thay thế chính xác theo ranh giới từ
  const words = str.split(/\s+/);
  const expandedWords = words.map((word) => {
    // Tách phần ký tự chữ và ký tự chấm câu nếu có
    const cleanWord = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (VIETNAMESE_ABBREVIATION_DICTIONARY[cleanWord]) {
      const replacement = VIETNAMESE_ABBREVIATION_DICTIONARY[cleanWord];
      return word.replace(new RegExp(`\\b${cleanWord}\\b`, 'i'), replacement);
    }
    return word;
  });

  return expandedWords.join(' ');
}

/**
 * Hàm chuẩn hóa văn bản chính normalize()
 * Thực hiện:
 * 1. Chữ thường & chuẩn hóa Unicode NFC
 * 2. Bỏ dấu tiếng Việt (giúp xử lý triệt để ký tự lặp nguyên âm có dấu như "dạaaaa" -> "daaaaa" -> "da")
 * 3. Rút gọn ký tự lặp (VD: "hocccc phi" -> "hoc phi")
 * 4. Mở rộng từ viết tắt (VD: "hp bn" -> "hoc phi bao nhieu")
 * 5. Gộp khoảng trắng liên tiếp và cắt viền
 *
 * Tiêu chí nghiệm thu: "HP bn vậy ạ" -> "hoc phi bao nhieu vay a" (chứa cả "hoc phi" và "bao nhieu")
 */
export function normalize(rawText: string | null | undefined): string {
  if (!rawText || typeof rawText !== 'string') return '';

  // 1. Chữ thường & Unicode NFC
  let text = rawText.toLowerCase().normalize('NFC').trim();

  // 2. Bỏ dấu tiếng Việt trước để đồng nhất nguyên âm kéo dài teencode (dạaaaa -> daaaaa)
  text = stripVietnameseAccents(text);

  // 3. Rút gọn ký tự lặp
  text = deduplicateRepeatedChars(text);

  // 4. Mở rộng từ viết tắt theo từ điển
  text = expandAbbreviations(text);

  // 5. Gộp khoảng trắng thừa
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
