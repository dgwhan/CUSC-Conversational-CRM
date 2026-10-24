import React, { useState } from 'react';
import {
  Link2,
  ExternalLink,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../../components/ui/Card.js';

interface GoogleSheetIntegrationSectionProps {
  onImportGoogleSheet: (sheetUrl: string) => Promise<void>;
  loading: boolean;
}

export const GoogleSheetIntegrationSection: React.FC<GoogleSheetIntegrationSectionProps> = ({
  onImportGoogleSheet,
  loading,
}) => {
  const [sheetUrl, setSheetUrl] = useState(
    'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing',
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sheetUrl.trim()) {
      onImportGoogleSheet(sheetUrl.trim());
    }
  };

  return (
    <div className="crm-gsheet-container">
      {/* 1. Form Đồng Bộ Từ Google Sheet Link */}
      <Card className="crm-section-card">
        <CardHeader>
          <div>
            <CardTitle>Đồng Bộ Trực Tiếp Từ Google Sheets</CardTitle>
            <CardDescription>
              Dán đường liên kết bảng tính Google Sheets (được đặt quyền <strong>&quot;Bất kỳ ai có đường liên kết đều có thể xem&quot;</strong>). Hệ thống sẽ tự động xuất dữ liệu, kiểm thực từng dòng bằng Zod và nạp vào CRM.
            </CardDescription>
          </div>
          <div className="crm-header-actions">
            <a
              href="https://docs.google.com/spreadsheets/create"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink size={14} />
              <span>Tạo Sheet Mới</span>
            </a>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label form-label-required">
                Đường link Google Sheet (Cần chứa các cột: kênh, người gửi, nội dung, thời gian):
              </label>
              <div className="crm-input-with-icon">
                <Link2 size={16} className="input-icon" />
                <input
                  type="url"
                  className="form-input form-input-with-padding"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit..."
                  required
                />
              </div>
              <span className="form-help-text">
                Ví dụ: <code>https://docs.google.com/spreadsheets/d/1.../edit?usp=sharing</code>
              </span>
            </div>

            <div className="crm-gsheet-tips">
              <div className="tip-header">
                <Info size={16} />
                <span>Yêu cầu định dạng các cột trong Google Sheet:</span>
              </div>
              <div className="tip-columns">
                <span className="tip-col-pill">Cột A: <strong>kênh</strong> (ZALO, FACEBOOK, TIKTOK, MANUAL_IMPORT)</span>
                <span className="tip-col-pill">Cột B: <strong>người gửi</strong> (SĐT hoặc External ID)</span>
                <span className="tip-col-pill">Cột C: <strong>nội dung</strong> (Nội dung tin nhắn tư vấn)</span>
                <span className="tip-col-pill">Cột D: <strong>thời gian</strong> (Định dạng ISO 8601 hoặc ngày giờ)</span>
              </div>
            </div>
          </form>
        </CardContent>

        <CardFooter>
          <Button
            variant="primary"
            size="lg"
            icon={<RefreshCw size={16} />}
            loading={loading}
            onClick={handleSubmit}
          >
            {loading ? 'Đang đồng bộ từ Google Sheet...' : 'Đồng Bộ & Import Vào CRM'}
          </Button>
        </CardFooter>
      </Card>

      {/* 2. Đề Xuất Kiến Trúc Tích Hợp Google Sheet Toàn Diện */}
      {/* <Card className="crm-section-card">
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--color-primary)' }} />
            <CardTitle>Đề Xuất Kiến Trúc Tích Hợp Google Sheet 2 Chiều (Realtime 2-Way Sync)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="crm-proposal-grid">
            <div className="crm-proposal-item">
              <div className="proposal-badge">
                <ArrowRightLeft size={16} />
                <span>Mô hình 2 chiều</span>
              </div>
              <h4>1. Đồng bộ Realtime từ CRM sang Google Sheet</h4>
              <p>
                Mỗi khi có tin nhắn mới từ Zalo OA, Facebook Messenger hay Webhook, worker CRM tự động append dòng dữ liệu mới vào Google Sheet thông qua <strong>Google Sheets API v4 (Service Account)</strong>.
              </p>
              <ul>
                <li><CheckCircle2 size={13} className="text-success" /> Ban tuyển sinh xem dữ liệu trực quan trên Google Sheet bất cứ lúc nào.</li>
                <li><CheckCircle2 size={13} className="text-success" /> Tận dụng bộ lọc, pivot table, biểu đồ và tính năng chia sẻ của Google.</li>
              </ul>
            </div>

            <div className="crm-proposal-item">
              <div className="proposal-badge">
                <Sparkles size={16} />
                <span>Chỉnh sửa tức thì</span>
              </div>
              <h4>2. Chỉnh sửa trên Sheet & Tự Động Cập Nhật CRM</h4>
              <p>
                Cài đặt một đoạn mã <strong>Google Apps Script (onEdit Trigger)</strong> trên bảng tính. Khi nhân viên tư vấn cập nhật trạng thái hoặc chỉnh sửa ghi chú trên Sheet, Apps Script sẽ bắn Webhook về CRM:
              </p>
              <code>POST /api/messages/webhook/google-sheet</code>
              <p style={{ marginTop: '8px' }}>
                Hệ thống CRM nhận webhook, xác thực qua Zod và cập nhật trạng thái bản ghi trong PostgreSQL.
              </p>
            </div>
          </div>
        </CardContent>
      </Card> */}
    </div>
  );
};
