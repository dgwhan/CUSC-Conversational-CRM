import React, { useState } from 'react';
import {
  Bug,
  Bell,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '../../components/feedback/useToast.js';

interface ErrorSimulationBarProps {
  onSimulatePage: (code: number | null) => void;
  currentSimulatedCode: number | null;
  onTriggerCrash: () => void;
}

export const ErrorSimulationBar: React.FC<ErrorSimulationBarProps> = ({
  onSimulatePage,
  currentSimulatedCode,
  onTriggerCrash,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();

  return (
    <div className="crm-simulation-bar">
      <div className="simulation-bar-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="simulation-title">
          <Bug size={15} className="text-warning" />
          <span>Bộ Công Cụ Kiểm Thử Lỗi & Thông Báo (Error & Alert Testing Suite)</span>
          {currentSimulatedCode !== null && (
            <span className="badge badge-danger">Đang xem trang lỗi {currentSimulatedCode}</span>
          )}
        </div>
        <button type="button" className="simulation-toggle-btn">
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {isOpen && (
        <div className="simulation-bar-body">
          {/* Nhóm 1: Kiểm thử hệ thống Alert / Toast */}
          <div className="simulation-group">
            <span className="group-label">
              <Bell size={13} /> Thử nghiệm Alert/Toast Toàn cục:
            </span>
            <div className="simulation-buttons">
              <button
                type="button"
                className="btn-sim sim-success"
                onClick={() =>
                  toast.success(
                    'Dữ liệu 100 tin nhắn đã được nạp thành công vào hệ thống!',
                    'Import Thành Công',
                  )
                }
              >
                <CheckCircle2 size={13} /> Toast Success
              </button>
              <button
                type="button"
                className="btn-sim sim-error"
                onClick={() =>
                  toast.error(
                    'Không thể phân tích dữ liệu dòng 5: Kênh không hợp lệ (ZALO, FACEBOOK, TIKTOK, MANUAL_IMPORT).',
                    'Lỗi Kiểm Thực Zod',
                    {
                      location: 'apps/web/src/modules/messaging/SpreadsheetGrid.tsx:88',
                      details: {
                        field: 'channel',
                        received: 'INVALID_KENH',
                        expected: ['ZALO', 'FACEBOOK', 'TIKTOK', 'MANUAL_IMPORT'],
                        timestamp: new Date().toISOString(),
                      },
                    },
                  )
                }
              >
                <AlertCircle size={13} /> Toast Error (Có vị trí lỗi)
              </button>
              <button
                type="button"
                className="btn-sim sim-warning"
                onClick={() =>
                  toast.warning(
                    'Có 3 dòng thiếu số điện thoại người gửi, vui lòng kiểm tra lại trước khi lưu.',
                    'Cảnh Báo Dữ Liệu',
                  )
                }
              >
                <AlertTriangle size={13} /> Toast Warning
              </button>
              <button
                type="button"
                className="btn-sim sim-info"
                onClick={() =>
                  toast.info(
                    'Hệ thống đang chuẩn bị đồng bộ 50 bản ghi từ Google Sheets.',
                    'Thông Báo Tiến Trình',
                  )
                }
              >
                <Info size={13} /> Toast Info
              </button>
            </div>
          </div>

          {/* Nhóm 2: Kiểm thử các Trang Lỗi Chuyên Biệt */}
          <div className="simulation-group">
            <span className="group-label">
              <AlertCircle size={13} /> Thử nghiệm các Trang Lỗi HTTP chuyên biệt:
            </span>
            <div className="simulation-buttons">
              <button
                type="button"
                className={`btn-sim ${currentSimulatedCode === 404 ? 'active' : ''}`}
                onClick={() => onSimulatePage(404)}
              >
                Trang 404 (Riêng biệt)
              </button>
              <button
                type="button"
                className={`btn-sim ${currentSimulatedCode === 400 ? 'active' : ''}`}
                onClick={() => onSimulatePage(400)}
              >
                Lỗi 400 (Bad Request)
              </button>
              <button
                type="button"
                className={`btn-sim ${currentSimulatedCode === 401 ? 'active' : ''}`}
                onClick={() => onSimulatePage(401)}
              >
                Lỗi 401 (Unauthorized)
              </button>
              <button
                type="button"
                className={`btn-sim ${currentSimulatedCode === 403 ? 'active' : ''}`}
                onClick={() => onSimulatePage(403)}
              >
                Lỗi 403 (Forbidden)
              </button>
              <button
                type="button"
                className={`btn-sim ${currentSimulatedCode === 429 ? 'active' : ''}`}
                onClick={() => onSimulatePage(429)}
              >
                Lỗi 429 (Rate Limit)
              </button>
              <button
                type="button"
                className={`btn-sim ${currentSimulatedCode === 500 ? 'active' : ''}`}
                onClick={() => onSimulatePage(500)}
              >
                Lỗi 500 (Internal Error)
              </button>
              <button
                type="button"
                className={`btn-sim ${currentSimulatedCode === 503 ? 'active' : ''}`}
                onClick={() => onSimulatePage(503)}
              >
                Lỗi 503 (Maintenance)
              </button>
              <button
                type="button"
                className="btn-sim sim-crash"
                onClick={onTriggerCrash}
                title="Mô phỏng Exception trong React để kích hoạt ErrorBoundary"
              >
                💥 Kích hoạt Crash (ErrorBoundary)
              </button>
              {currentSimulatedCode !== null && (
                <button
                  type="button"
                  className="btn-sim sim-reset"
                  onClick={() => onSimulatePage(null)}
                >
                  <RotateCcw size={12} /> Trở về CRM Bình thường
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
