import React, { useRef } from 'react';
import { Download, Sparkles, UploadCloud, FileText, Send } from 'lucide-react';
import { Button } from '../../../components/ui/Button.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../../components/ui/Card.js';

interface CsvImportSectionProps {
  csvContent: string;
  onCsvChange: (text: string) => void;
  fileName: string | null;
  onFileUpload: (file: File) => void;
  onDownloadTemplate: () => void;
  onGenerate100Rows: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export const CsvImportSection: React.FC<CsvImportSectionProps> = ({
  csvContent,
  onCsvChange,
  fileName,
  onFileUpload,
  onDownloadTemplate,
  onGenerate100Rows,
  onSubmit,
  loading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.csv')) {
      onFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <Card className="crm-section-card">
      <CardHeader>
        <div>
          <CardTitle>Nhập Dữ Liệu Qua File CSV</CardTitle>
          <CardDescription>
            Tải lên file CSV chứa các cột: <code>kênh</code>, <code>người gửi</code>, <code>nội dung</code>, <code>thời gian</code>. Hệ thống sẽ kiểm thực từng dòng qua Zod.
          </CardDescription>
        </div>
        <div className="crm-header-actions">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={15} />}
            onClick={onDownloadTemplate}
          >
            Tải File Mẫu (.csv)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles size={15} />}
            onClick={onGenerate100Rows}
          >
            Nạp 100 dòng mẫu (DoD)
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Dropzone */}
        <div
          className="crm-dropzone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) onFileUpload(e.target.files[0]);
            }}
          />
          <div className="dropzone-icon">
            <UploadCloud size={32} />
          </div>
          <div className="dropzone-text">
            <span className="dropzone-main">Nhấp để chọn file CSV hoặc kéo thả vào đây</span>
            <span className="dropzone-sub">Định dạng hỗ trợ: .csv (mã hóa UTF-8)</span>
          </div>
          {fileName && (
            <div className="dropzone-file-pill">
              <FileText size={14} />
              <span>{fileName}</span>
            </div>
          )}
        </div>

        {/* Textarea Preview */}
        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label">Xem trước và chỉnh sửa nội dung CSV:</label>
          <textarea
            className="form-textarea"
            rows={10}
            value={csvContent}
            onChange={(e) => onCsvChange(e.target.value)}
            placeholder="kênh,người gửi,nội dung,thời gian&#10;ZALO,0912345678,Tư vấn giúp em khóa Lập trình Web,2026-10-24T08:30:00Z"
          />
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
          {loading ? 'Đang kiểm thực và import...' : 'Tiến Hành Import CSV'}
        </Button>
      </CardFooter>
    </Card>
  );
};
