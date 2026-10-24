import React from 'react';
import { Home, ArrowLeft, Search, FileQuestion } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';

interface Error404PageProps {
  onGoHome?: () => void;
  onGoBack?: () => void;
  path?: string;
}

export const Error404Page: React.FC<Error404PageProps> = ({
  onGoHome = () => (window.location.href = '/'),
  onGoBack = () => window.history.back(),
  path = window.location.pathname,
}) => {
  return (
    <div className="crm-error-page-wrapper">
      <div className="crm-error-page-container">
        {/* Số 404 lớn với Gradient */}
        <div className="error-code-badge error-code-404">
          <span>404</span>
        </div>

        <div className="error-icon-circle">
          <FileQuestion size={40} className="text-primary" />
        </div>

        <h1 className="error-title">Không Tìm Thấy Trang Yêu Cầu</h1>

        <p className="error-desc">
          Đường dẫn <code>{path}</code> không tồn tại trên hệ thống CUSC CRM, đã bị thay đổi địa chỉ hoặc đã bị xóa.
        </p>

        {/* Bảng chẩn đoán vị trí */}
        <div className="error-diagnostic-box">
          <div className="diagnostic-header">
            <Search size={15} />
            <span>Gợi ý khắc phục:</span>
          </div>
          <ul className="diagnostic-list">
            <li>Kiểm tra lại tính chính xác của đường dẫn URL trên thanh địa chỉ trình duyệt.</li>
            <li>Nếu bạn đang tìm tính năng Import tin nhắn, vui lòng truy cập menu <strong>Tin nhắn Tư vấn (MSG-06)</strong>.</li>
            <li>Liên hệ quản trị viên hệ thống nếu bạn cho rằng đây là một sự cố định tuyến.</li>
          </ul>
        </div>

        {/* Nút hành động */}
        <div className="error-actions-group">
          <Button
            variant="primary"
            size="lg"
            icon={<Home size={16} />}
            onClick={onGoHome}
          >
            Về Trang Chủ CRM
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<ArrowLeft size={16} />}
            onClick={onGoBack}
          >
            Quay Lại Trang Trước
          </Button>
        </div>
      </div>
    </div>
  );
};
