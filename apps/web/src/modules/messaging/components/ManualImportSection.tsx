import React from 'react';
import { Plus, Trash2, Send } from 'lucide-react';
import { Button } from '../../../components/ui/Button.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../../components/ui/Card.js';
import type { ChannelType, ManualImportRow } from '../types/messaging.types.js';

interface ManualImportSectionProps {
  rows: ManualImportRow[];
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onUpdateRow: (index: number, field: keyof ManualImportRow, value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export const ManualImportSection: React.FC<ManualImportSectionProps> = ({
  rows,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  onSubmit,
  loading,
}) => {
  return (
    <Card className="crm-section-card">
      <CardHeader>
        <div>
          <CardTitle>Nhập Tay Tin Nhắn Trực Tiếp</CardTitle>
          <CardDescription>
            Điền thông tin trực tiếp vào bảng danh sách. Kiểm thực Zod sẽ kiểm tra các trường bắt buộc (Kênh, Người gửi, Thời gian).
          </CardDescription>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={15} />}
          onClick={onAddRow}
        >
          Thêm dòng mới
        </Button>
      </CardHeader>

      <CardContent>
        <div className="table-container">
          <table className="crm-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>STT</th>
                <th style={{ width: '180px' }}>Kênh tiếp nhận *</th>
                <th style={{ width: '200px' }}>Người gửi / SĐT *</th>
                <th>Nội dung tư vấn</th>
                <th style={{ width: '220px' }}>Thời gian gửi *</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Xóa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    #{idx + 1}
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={row.channel}
                      onChange={(e) => onUpdateRow(idx, 'channel', e.target.value as ChannelType)}
                    >
                      <option value="ZALO">ZALO OA</option>
                      <option value="FACEBOOK">FACEBOOK Messenger</option>
                      <option value="TIKTOK">TIKTOK Channel</option>
                      <option value="MANUAL_IMPORT">MANUAL IMPORT (Thủ công)</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      value={row.sender}
                      onChange={(e) => onUpdateRow(idx, 'sender', e.target.value)}
                      placeholder="VD: 0912345678"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      value={row.content}
                      onChange={(e) => onUpdateRow(idx, 'content', e.target.value)}
                      placeholder="Nội dung tin nhắn tư vấn..."
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      value={row.sentAt}
                      onChange={(e) => onUpdateRow(idx, 'sentAt', e.target.value)}
                      placeholder="YYYY-MM-DDTHH:mm:ssZ"
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn-icon-danger"
                      onClick={() => onRemoveRow(idx)}
                      disabled={rows.length === 1}
                      title="Xóa dòng"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="primary"
          size="lg"
          icon={<Send size={16} />}
          loading={loading}
          onClick={onSubmit}
        >
          {loading ? 'Đang kiểm thực và lưu...' : `Nhập ${rows.length} Dòng Tin Nhắn`}
        </Button>
      </CardFooter>
    </Card>
  );
};
