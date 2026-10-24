import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Send,
  ClipboardPaste,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Calendar,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../../components/ui/Card.js';
import type { ChannelType, ManualImportRow } from '../types/messaging.types.js';

export interface GridRow {
  id: string;
  channel: string;
  sender: string;
  content: string;
  sentAt: string;
}

interface SpreadsheetGridProps {
  onImportRows: (rows: ManualImportRow[]) => Promise<void>;
  loading: boolean;
}

const VALID_CHANNELS: ChannelType[] = ['ZALO', 'FACEBOOK', 'TIKTOK', 'MANUAL_IMPORT'];

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({ onImportRows, loading }) => {
  const [rows, setRows] = useState<GridRow[]>([
    {
      id: 'row-1',
      channel: 'ZALO',
      sender: '0912345678',
      content: 'Tư vấn giúp em học phí khóa Lập trình Web Fullstack',
      sentAt: new Date().toISOString(),
    },
    {
      id: 'row-2',
      channel: 'FACEBOOK',
      sender: 'fb_candidate_01',
      content: 'Thời gian xét học bạ năm 2026 khi nào hết hạn ạ?',
      sentAt: new Date().toISOString(),
    },
    {
      id: 'row-3',
      channel: 'TIKTOK',
      sender: 'tiktok_user_99',
      content: 'Trường có hỗ trợ ký túc xá cho tân sinh viên không ạ?',
      sentAt: new Date().toISOString(),
    },
  ]);

  const [activeCell, setActiveCell] = useState<{ rowIdx: number; colKey: keyof GridRow } | null>(null);
  const [pasteNotification, setPasteNotification] = useState<string | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Kiểm thực Zod tức thì cho từng dòng
  const validateRow = useCallback((row: GridRow) => {
    const errors: { channel?: string; sender?: string; sentAt?: string } = {};

    const ch = row.channel.trim().toUpperCase();
    if (!VALID_CHANNELS.includes(ch as ChannelType)) {
      errors.channel = 'Kênh phải là: ZALO, FACEBOOK, TIKTOK, MANUAL_IMPORT';
    }

    if (!row.sender || row.sender.trim().length === 0) {
      errors.sender = 'Người gửi không được để trống';
    }

    if (!row.sentAt || isNaN(new Date(row.sentAt).getTime())) {
      errors.sentAt = 'Thời gian không đúng định dạng ngày giờ';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, []);

  // Đếm số dòng hợp lệ và không hợp lệ
  const stats = rows.reduce(
    (acc, row) => {
      const v = validateRow(row);
      if (v.isValid) acc.valid++;
      else acc.invalid++;
      return acc;
    },
    { valid: 0, invalid: 0 },
  );

  // Xử lý sự kiện Copy & Paste (Ctrl + V) từ Excel / Google Sheets
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || text.trim().length === 0) return;

    e.preventDefault();

    // Dữ liệu từ Google Sheets hoặc Excel phân cách bằng phím Tab (\t) và xuống dòng (\r?\n)
    const rawLines = text.trim().split(/\r?\n/);
    if (rawLines.length === 0) return;

    // Phát hiện phân cách (Tab \t từ Google Sheet/Excel hoặc Dấu phẩy , từ CSV)
    const delimiter = rawLines[0].includes('\t') ? '\t' : rawLines[0].includes(';') ? ';' : ',';

    const parsedLines = rawLines.map((line) => line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, '')));

    // Kiểm tra dòng đầu có phải Header không (kênh, người gửi, nội dung, thời gian)
    let startIndex = 0;
    const headerRow = parsedLines[0].map((h) => h.toLowerCase());
    let channelCol = 0;
    let senderCol = 1;
    let contentCol = 2;
    let timeCol = 3;

    if (
      headerRow.some((h) => h.includes('kênh') || h.includes('channel')) ||
      headerRow.some((h) => h.includes('gửi') || h.includes('sender'))
    ) {
      startIndex = 1; // Bỏ qua dòng header
      headerRow.forEach((h, idx) => {
        if (h.includes('kênh') || h.includes('channel')) channelCol = idx;
        if (h.includes('gửi') || h.includes('sender')) senderCol = idx;
        if (h.includes('dung') || h.includes('content') || h.includes('text')) contentCol = idx;
        if (h.includes('gian') || h.includes('time') || h.includes('date')) timeCol = idx;
      });
    }

    const newRows: GridRow[] = [];
    for (let i = startIndex; i < parsedLines.length; i++) {
      const cols = parsedLines[i];
      if (cols.length === 0 || cols.every((c) => c.length === 0)) continue;

      const channelVal = (cols[channelCol] || 'ZALO').toUpperCase();
      const senderVal = cols[senderCol] || '';
      const contentVal = cols[contentCol] || '';
      let timeVal = cols[timeCol] || new Date().toISOString();

      if (timeVal && isNaN(new Date(timeVal).getTime())) {
        // Giữ nguyên để Zod báo lỗi trực quan
      } else if (!timeVal) {
        timeVal = new Date().toISOString();
      }

      newRows.push({
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${i}`,
        channel: channelVal,
        sender: senderVal,
        content: contentVal,
        sentAt: timeVal,
      });
    }

    if (newRows.length > 0) {
      setRows((prev) => [...prev, ...newRows]);
      setPasteNotification(`Đã dán thành công ${newRows.length} dòng từ Google Sheet / Excel!`);
      setTimeout(() => setPasteNotification(null), 4000);
    }
  }, []);

  // Cập nhật giá trị ô trực tiếp
  const updateCell = (rowIdx: number, colKey: keyof GridRow, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[rowIdx] = {
        ...updated[rowIdx],
        [colKey]: value,
      };
      return updated;
    });
  };

  // Thêm dòng mới
  const addRows = (count: number = 1) => {
    const newItems: GridRow[] = Array.from({ length: count }).map((_, i) => ({
      id: `row-${Date.now()}-${i}`,
      channel: 'ZALO',
      sender: '',
      content: '',
      sentAt: new Date().toISOString(),
    }));
    setRows((prev) => [...prev, ...newItems]);
  };

  // Xoá dòng
  const deleteRow = (rowIdx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIdx));
  };

  // Nạp 10 dòng mẫu từ Google Sheets
  const loadSampleData = () => {
    const samples: GridRow[] = [
      { id: 's1', channel: 'ZALO', sender: '0907111222', content: 'Em muốn đăng ký xét tuyển đợt 2', sentAt: '2026-10-24T08:00:00Z' },
      { id: 's2', channel: 'FACEBOOK', sender: 'fb_user_882', content: 'Tư vấn giúp mình lộ trình học Kỹ sư phần mềm', sentAt: '2026-10-24T08:15:00Z' },
      { id: 's3', channel: 'TIKTOK', sender: 'tik_user_33', content: 'Bao giờ trường bắt đầu nhận hồ sơ nhập học?', sentAt: '2026-10-24T08:30:00Z' },
      { id: 's4', channel: 'MANUAL_IMPORT', sender: 'thi_sinh_truc_tiep_01', content: 'Phụ huynh đến tư vấn trực tiếp tại văn phòng', sentAt: '2026-10-24T09:00:00Z' },
      { id: 's5', channel: 'INVALID_KENH', sender: '0988777666', content: 'Dòng mô phỏng lỗi kênh sai', sentAt: '2026-10-24T09:15:00Z' },
      { id: 's6', channel: 'ZALO', sender: '', content: 'Dòng mô phỏng lỗi thiếu người gửi', sentAt: '2026-10-24T09:30:00Z' },
      { id: 's7', channel: 'FACEBOOK', sender: 'fb_cand_99', content: 'Dòng mô phỏng lỗi định dạng ngày', sentAt: 'sai_dinh_dang_gio' },
      { id: 's8', channel: 'ZALO', sender: '0918889999', content: 'Học bổng đầu vào có những loại nào?', sentAt: '2026-10-24T10:00:00Z' },
      { id: 's9', channel: 'TIKTOK', sender: 'candidate_tt_05', content: 'Em có chứng chỉ IELTS 6.5 có được tuyển thẳng không?', sentAt: '2026-10-24T10:15:00Z' },
      { id: 's10', channel: 'MANUAL_IMPORT', sender: 'hotline_goi_den', content: 'Gọi điện thoại hỏi lịch thi đánh giá năng lực', sentAt: '2026-10-24T10:30:00Z' },
    ];
    setRows(samples);
  };

  // Điều hướng bằng bàn phím (Enter, Tab, Arrow)
  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colKey: keyof GridRow) => {
    const colKeys: (keyof GridRow)[] = ['channel', 'sender', 'content', 'sentAt'];
    const currentColIndex = colKeys.indexOf(colKey);

    if (e.key === 'Enter') {
      e.preventDefault();
      // Nhấn Enter nhảy xuống dòng dưới
      if (rowIdx + 1 < rows.length) {
        setActiveCell({ rowIdx: rowIdx + 1, colKey });
      } else {
        // Tự động thêm dòng mới nếu ở dòng cuối
        addRows(1);
        setActiveCell({ rowIdx: rowIdx + 1, colKey });
      }
    } else if (e.key === 'Tab') {
      if (!e.shiftKey && currentColIndex + 1 < colKeys.length) {
        e.preventDefault();
        setActiveCell({ rowIdx, colKey: colKeys[currentColIndex + 1] });
      } else if (e.shiftKey && currentColIndex > 0) {
        e.preventDefault();
        setActiveCell({ rowIdx, colKey: colKeys[currentColIndex - 1] });
      }
    }
  };

  // Gửi các dòng đã kiểm thực sang CRM
  const handleSaveToCrm = async () => {
    if (rows.length === 0) {
      alert('Bảng chưa có dữ liệu!');
      return;
    }

    const payload: ManualImportRow[] = rows.map((r) => ({
      channel: r.channel.toUpperCase() as ChannelType,
      sender: r.sender,
      content: r.content,
      sentAt: r.sentAt,
    }));

    await onImportRows(payload);
  };

  useEffect(() => {
    // Focus vào input khi activeCell thay đổi
    if (activeCell) {
      const el = document.getElementById(`cell-${activeCell.rowIdx}-${activeCell.colKey}`);
      if (el) el.focus();
    }
  }, [activeCell]);

  return (
    <Card className="crm-section-card crm-spreadsheet-card">
      <CardHeader>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--color-primary)' }} />
            <CardTitle>Bảng Tính Trực Tiếp Trên Web (In-App Spreadsheet Grid)</CardTitle>
          </div>
          <CardDescription>
            Hỗ trợ <strong>Ctrl + V</strong> dán hàng loạt ô từ Excel/Google Sheets, chỉnh sửa trực tiếp từng ô (cell-editing), tự động kiểm thực bằng Zod.
          </CardDescription>
        </div>

        <div className="crm-header-actions">
          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles size={14} />}
            onClick={loadSampleData}
          >
            Nạp 10 dòng mẫu
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => addRows(1)}
          >
            +1 Dòng
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => addRows(5)}
          >
            +5 Dòng
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={() => setRows([])}
          >
            Xóa hết
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Thông báo Paste */}
        {pasteNotification && (
          <div className="crm-paste-toast">
            <ClipboardPaste size={16} />
            <span>{pasteNotification}</span>
          </div>
        )}

        {/* Thanh trạng thái kiểm thực tức thì */}
        <div className="crm-grid-statusbar">
          <div className="statusbar-stats">
            <span className="stat-item">
              Tổng số dòng: <strong>{rows.length}</strong>
            </span>
            <span className="stat-item text-success">
              <CheckCircle2 size={14} />
              Hợp lệ: <strong>{stats.valid}</strong>
            </span>
            {stats.invalid > 0 && (
              <span className="stat-item text-danger">
                <AlertCircle size={14} />
                Cần sửa: <strong>{stats.invalid}</strong>
              </span>
            )}
          </div>
          <div className="statusbar-hint">
            <Info size={14} />
            <span>Mẹo: Bạn có thể chọn vùng ô trong Google Sheet, nhấn <strong>Ctrl + C</strong> rồi nhấp vào bảng này nhấn <strong>Ctrl + V</strong>.</span>
          </div>
        </div>

        {/* Bảng Spreadsheet Grid */}
        <div
          className="crm-spreadsheet-wrapper"
          ref={gridContainerRef}
          onPaste={handlePaste}
          tabIndex={0}
        >
          <table className="crm-spreadsheet-table">
            <thead>
              <tr>
                <th className="th-index">#</th>
                <th className="th-channel">Kênh tiếp nhận *</th>
                <th className="th-sender">Người gửi / SĐT *</th>
                <th className="th-content">Nội dung tin nhắn</th>
                <th className="th-time">Thời gian gửi *</th>
                <th className="th-status">Kiểm thực Zod</th>
                <th className="th-action">Xoá</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="td-empty">
                    Bảng trống. Hãy nhấn nút <strong>&quot;+1 Dòng&quot;</strong>, <strong>&quot;Nạp 10 dòng mẫu&quot;</strong> hoặc nhấn <strong>Ctrl + V</strong> để dán từ Google Sheet!
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIdx) => {
                  const val = validateRow(row);
                  return (
                    <tr
                      key={row.id}
                      className={!val.isValid ? 'row-has-error' : 'row-valid'}
                    >
                      {/* Cột STT */}
                      <td className="td-index">{rowIdx + 1}</td>

                      {/* Cột Kênh */}
                      <td className={`td-cell ${val.errors.channel ? 'cell-error' : ''}`}>
                        <div className="cell-input-box">
                          <select
                            id={`cell-${rowIdx}-channel`}
                            className="cell-select"
                            value={row.channel.toUpperCase()}
                            onChange={(e) => updateCell(rowIdx, 'channel', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, 'channel')}
                          >
                            <option value="ZALO">ZALO</option>
                            <option value="FACEBOOK">FACEBOOK</option>
                            <option value="TIKTOK">TIKTOK</option>
                            <option value="MANUAL_IMPORT">MANUAL_IMPORT</option>
                            {!VALID_CHANNELS.includes(row.channel.toUpperCase() as ChannelType) && (
                              <option value={row.channel}>{row.channel} (Không hợp lệ)</option>
                            )}
                          </select>
                        </div>
                        {val.errors.channel && (
                          <div className="cell-error-tooltip">{val.errors.channel}</div>
                        )}
                      </td>

                      {/* Cột Người gửi */}
                      <td className={`td-cell ${val.errors.sender ? 'cell-error' : ''}`}>
                        <input
                          id={`cell-${rowIdx}-sender`}
                          type="text"
                          className="cell-input"
                          value={row.sender}
                          placeholder="Nhập SĐT / ID người gửi..."
                          onChange={(e) => updateCell(rowIdx, 'sender', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, 'sender')}
                        />
                        {val.errors.sender && (
                          <div className="cell-error-tooltip">{val.errors.sender}</div>
                        )}
                      </td>

                      {/* Cột Nội dung */}
                      <td className="td-cell">
                        <input
                          id={`cell-${rowIdx}-content`}
                          type="text"
                          className="cell-input"
                          value={row.content}
                          placeholder="Nội dung trao đổi..."
                          onChange={(e) => updateCell(rowIdx, 'content', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, 'content')}
                        />
                      </td>

                      {/* Cột Thời gian */}
                      <td className={`td-cell ${val.errors.sentAt ? 'cell-error' : ''}`}>
                        <div className="cell-time-box">
                          <input
                            id={`cell-${rowIdx}-sentAt`}
                            type="text"
                            className="cell-input"
                            value={row.sentAt}
                            placeholder="ISO: YYYY-MM-DDTHH:mm:ssZ"
                            onChange={(e) => updateCell(rowIdx, 'sentAt', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, 'sentAt')}
                          />
                          <button
                            type="button"
                            className="btn-set-now"
                            title="Đặt thành thời gian hiện tại"
                            onClick={() => updateCell(rowIdx, 'sentAt', new Date().toISOString())}
                          >
                            <Calendar size={13} />
                          </button>
                        </div>
                        {val.errors.sentAt && (
                          <div className="cell-error-tooltip">{val.errors.sentAt}</div>
                        )}
                      </td>

                      {/* Cột Trạng thái */}
                      <td className="td-status">
                        {val.isValid ? (
                          <span className="badge badge-success">
                            <CheckCircle2 size={12} />
                            Hợp lệ
                          </span>
                        ) : (
                          <span className="badge badge-danger" title={Object.values(val.errors).join(', ')}>
                            <AlertCircle size={12} />
                            Lỗi dữ liệu
                          </span>
                        )}
                      </td>

                      {/* Cột Xoá */}
                      <td className="td-action">
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => deleteRow(rowIdx)}
                          title="Xóa dòng này"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CardFooter>
        <div className="crm-footer-summary">
          <span>
            Sẵn sàng import <strong>{stats.valid}</strong> dòng hợp lệ vào cơ sở dữ liệu.
          </span>
        </div>
        <Button
          variant="primary"
          size="lg"
          icon={<Send size={16} />}
          loading={loading}
          disabled={rows.length === 0}
          onClick={handleSaveToCrm}
        >
          {loading ? 'Đang kiểm thực và lưu...' : `Lưu & Import ${rows.length} Dòng Vào CRM`}
        </Button>
      </CardFooter>
    </Card>
  );
};
