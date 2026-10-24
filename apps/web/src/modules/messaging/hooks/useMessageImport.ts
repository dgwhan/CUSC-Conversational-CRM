import { useState } from 'react';
import { messagingApi } from '../api/messaging.api.js';
import type {
  ChannelType,
  ImportMessagesResponse,
  ManualImportRow,
} from '../types/messaging.types.js';

export function useMessageImport() {
  const [activeTab, setActiveTab] = useState<'csv' | 'manual'>('csv');
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ImportMessagesResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Danh sách dòng nhập tay mặc định
  const [manualRows, setManualRows] = useState<ManualImportRow[]>([
    {
      channel: 'ZALO',
      sender: '0901234567',
      content: 'Tư vấn giúp em khóa Lập trình Web Fullstack',
      sentAt: new Date().toISOString(),
    },
    {
      channel: 'FACEBOOK',
      sender: 'fb_candidate_01',
      content: 'Học phí ngành CNTT năm 2026 là bao nhiêu ạ?',
      sentAt: new Date().toISOString(),
    },
  ]);

  /**
   * Tải template file mẫu CSV
   */
  const downloadTemplate = async () => {
    try {
      const blob = await messagingApi.downloadTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'template_import_messages.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Không thể tải file mẫu');
    }
  };

  /**
   * Sinh 100 dòng mẫu kiểm thử (kèm các dòng lỗi theo tiêu chuẩn DoD)
   */
  const generate100SampleRows = () => {
    const lines = ['kênh,người gửi,nội dung,thời gian'];
    const invalidRows = new Set([5, 18, 35, 50, 72, 89, 100]);

    for (let i = 1; i <= 100; i++) {
      if (invalidRows.has(i)) {
        if (i === 5 || i === 50) {
          lines.push(`INVALID_CHANNEL_${i},candidate_${i},Nội dung kiểm thử lỗi sai tên kênh,2026-10-24T09:00:00Z`);
        } else if (i === 18 || i === 72) {
          lines.push(`ZALO,,Nội dung kiểm thử lỗi để trống người gửi,2026-10-24T09:00:00Z`);
        } else if (i === 35 || i === 89) {
          lines.push(`FACEBOOK,candidate_${i},Nội dung kiểm thử lỗi thời gian,sai_dinh_dang_thoi_gian`);
        } else {
          lines.push(`KENH_LA,,Lỗi kết hợp nhiều trường không hợp lệ,invalid_time`);
        }
      } else {
        const channel: ChannelType = i % 2 === 0 ? 'ZALO' : 'FACEBOOK';
        lines.push(`${channel},candidate_${i},Thí sinh quan tâm chương trình tuyển sinh CNTT đợt 2,2026-10-24T09:00:00Z`);
      }
    }

    setCsvContent(lines.join('\n'));
    setFileName('sample_100_rows_dod.csv');
    setResult(null);
    setErrorMessage(null);
  };

  /**
   * Đọc file CSV được chọn từ máy
   */
  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setCsvContent(text);
      setResult(null);
      setErrorMessage(null);
    };
    reader.readAsText(file);
  };

  /**
   * Gửi import CSV
   */
  const submitCsvImport = async () => {
    if (!csvContent.trim()) {
      setErrorMessage('Vui lòng nhập nội dung CSV hoặc chọn file từ máy tính.');
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const data = await messagingApi.importCsv(csvContent);
      setResult(data);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Lỗi khi gọi API import CSV');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Thao tác dòng nhập tay
   */
  const addManualRow = () => {
    setManualRows((prev) => [
      ...prev,
      {
        channel: 'ZALO',
        sender: '',
        content: '',
        sentAt: new Date().toISOString(),
      },
    ]);
  };

  const removeManualRow = (index: number) => {
    setManualRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateManualRow = (index: number, field: keyof ManualImportRow, value: string) => {
    setManualRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  /**
   * Gửi import danh sách nhập tay
   */
  const submitManualImport = async () => {
    if (manualRows.length === 0) {
      setErrorMessage('Danh sách nhập tay không được để trống.');
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const data = await messagingApi.importManual(manualRows);
      setResult(data);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Lỗi khi gọi API nhập tay');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Đồng bộ và import từ Google Sheet
   */
  const submitGoogleSheetImport = async (sheetUrl: string) => {
    setLoading(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const data = await messagingApi.importGoogleSheet(sheetUrl);
      setResult(data);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Lỗi khi đồng bộ từ Google Sheet');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Import mảng rows tuỳ chỉnh (từ Spreadsheet Grid)
   */
  const submitCustomRows = async (rows: ManualImportRow[]) => {
    setLoading(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const data = await messagingApi.importManual(rows);
      setResult(data);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Lỗi khi lưu bảng dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResult(null);
    setErrorMessage(null);
  };

  return {
    activeTab,
    setActiveTab,
    csvContent,
    setCsvContent,
    fileName,
    loading,
    result,
    errorMessage,
    setErrorMessage,
    manualRows,
    downloadTemplate,
    generate100SampleRows,
    handleFileUpload,
    submitCsvImport,
    submitManualImport,
    submitGoogleSheetImport,
    submitCustomRows,
    addManualRow,
    removeManualRow,
    updateManualRow,
    clearResults,
  };
}
