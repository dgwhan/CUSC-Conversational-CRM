export interface ParsedCsvRow {
    csvLine: number;
    data: Record<string, string>;
}

export interface CsvParseResult {
    headers: string[];
    rows: ParsedCsvRow[];
}

/**
 * Trình phân tích cú pháp CSV hỗ trợ RFC-4180:
 * - Hỗ trợ UTF-8 BOM
 * - Dấu phẩy ngăn cách (hoặc dấu chấm phẩy)
 * - Xử lý dấu ngoặc kép "" và ký tự xuống dòng bên trong trường ngoặc kép
 * - Ghi nhận chính xác số thứ tự dòng (csvLine) trong file gốc
 */
export function parseCsv(csvText: string): CsvParseResult {
    // 1. Loại bỏ UTF-8 BOM nếu có
    let cleanText = csvText.replace(/^\uFEFF/, '').trim();
    if (!cleanText) {
        return { headers: [], rows: [] };
    }

    // 2. Tokenize ký tự để tách các dòng và các cột chính xác theo RFC-4180
    const rawLines: string[][] = [];
    let currentField = '';
    let currentRow: string[] = [];
    let inQuotes = false;
    let i = 0;

    // Tự động phát hiện dấu phân cách (dấu phẩy , hoặc dấu chấm phẩy ;)
    const firstLineEnd = cleanText.indexOf('\n');
    const firstLine = firstLineEnd === -1 ? cleanText : cleanText.substring(0, firstLineEnd);
    const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

    while (i < cleanText.length) {
        const char = cleanText[i];

        if (char === '"') {
            if (inQuotes && cleanText[i + 1] === '"') {
                // Thoát ngoặc kép: "" -> "
                currentField += '"';
                i += 2;
                continue;
            }
            inQuotes = !inQuotes;
            i++;
            continue;
        }

        if (char === delimiter && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
            i++;
            continue;
        }

        if ((char === '\r' || char === '\n') && !inQuotes) {
            // Hết 1 dòng
            if (char === '\r' && cleanText[i + 1] === '\n') {
                i++;
            }
            currentRow.push(currentField.trim());
            currentField = '';
            // Chỉ thêm dòng nếu có ít nhất 1 trường không rỗng
            if (currentRow.some((field) => field.length > 0)) {
                rawLines.push(currentRow);
            }
            currentRow = [];
            i++;
            continue;
        }

        currentField += char;
        i++;
    }

    // Trường cuối cùng của file nếu không kết thúc bằng newline
    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field.length > 0)) {
            rawLines.push(currentRow);
        }
    }

    if (rawLines.length === 0) {
        return { headers: [], rows: [] };
    }

    // Dòng đầu tiên là tiêu đề (Headers)
    const rawHeaders = rawLines[0];
    const headers = rawHeaders.map((h) => h.trim().toLowerCase());

    const rows: ParsedCsvRow[] = [];
    for (let lineIdx = 1; lineIdx < rawLines.length; lineIdx++) {
        const line = rawLines[lineIdx];
        const rowData: Record<string, string> = {};

        rawHeaders.forEach((header, colIdx) => {
            const rawCol = line[colIdx] ?? '';
            // Ghi cả tiêu đề gốc lẫn tiêu đề chữ thường để tra cứu linh hoạt
            rowData[header.trim()] = rawCol;
            rowData[header.trim().toLowerCase()] = rawCol;
        });

        rows.push({
            csvLine: lineIdx + 1, // Dòng 1 là header, dòng dữ liệu bắt đầu từ 2
            data: rowData,
        });
    }

    return { headers, rows };
}

/**
 * Tạo file mẫu CSV chuẩn với đầy đủ các cột nghiệp vụ
 */
export function generateCsvTemplate(): string {
    const headers = ['kênh', 'người gửi', 'nội dung', 'thời gian'];
    const sampleRows = [
        ['ZALO', '0912345678', 'Tư vấn giúp em khóa học Lập trình Web', '2026-10-24T08:30:00Z'],
        ['FACEBOOK', 'fb_user_102', 'Học phí ngành CNTT tại CUSC là bao nhiêu ạ?', '2026-10-24T09:15:00Z'],
        ['TIKTOK', 'tiktok_user_55', 'Trường có xét học bạ THPT không ad?', '2026-10-24T10:00:00Z'],
        ['MANUAL_IMPORT', 'thi_sinh_01', 'Thí sinh đến trực tiếp văn phòng tư vấn tuyển sinh', '2026-10-24T10:45:00Z'],
    ];

    const lines = [
        headers.join(','),
        ...sampleRows.map((row) =>
            row
                .map((cell) => (cell.includes(',') || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell))
                .join(','),
        ),
    ];

    return '\uFEFF' + lines.join('\r\n');
}
