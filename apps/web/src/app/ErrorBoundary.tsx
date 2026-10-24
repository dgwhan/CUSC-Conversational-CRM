import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, Copy, Check } from 'lucide-react';
import { Button } from '../components/ui/Button.js';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  handleCopyError = (): void => {
    const { error, errorInfo } = this.state;
    const text = `ERROR REPORT:
Time: ${new Date().toISOString()}
Message: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}`;

    navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, copied } = this.state;

      return (
        <div className="crm-error-boundary-screen">
          <div className="crm-error-boundary-card">
            <div className="error-card-badge">
              <AlertCircle size={24} className="text-danger" />
            </div>

            <h1 className="error-card-title">Đã Xảy Ra Lỗi Giao Diện Hệ Thống</h1>
            <p className="error-card-desc">
              Ứng dụng phát hiện sự cố không mong muốn trong quá trình kết xuất dữ liệu. Thông tin chi tiết kỹ thuật bên dưới giúp lập trình viên xác định chính xác vị trí bị lỗi.
            </p>

            {/* Vị trí và thông điệp lỗi */}
            <div className="error-diagnostic-panel">
              <div className="diagnostic-row">
                <span className="diagnostic-label">Thông điệp lỗi:</span>
                <span className="diagnostic-value text-danger font-bold">
                  {error?.message || 'Lỗi không xác định'}
                </span>
              </div>
              <div className="diagnostic-row">
                <span className="diagnostic-label">Thời gian phát sinh:</span>
                <span className="diagnostic-value">
                  {new Date().toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            {/* Stack trace chi tiết */}
            <div className="error-stack-wrapper">
              <label className="form-label">Chi tiết Stack Trace & Vị trí Component:</label>
              <pre className="error-stack-pre">
                {error?.stack}
                {errorInfo?.componentStack}
              </pre>
            </div>

            {/* Nút hành động */}
            <div className="error-card-actions">
              <Button
                variant="primary"
                icon={<RefreshCw size={15} />}
                onClick={this.handleReload}
              >
                Tải lại trang
              </Button>
              <Button
                variant="secondary"
                icon={<Home size={15} />}
                onClick={this.handleGoHome}
              >
                Về Trang Chủ
              </Button>
              <Button
                variant="outline"
                icon={copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                onClick={this.handleCopyError}
              >
                {copied ? 'Đã sao chép báo cáo' : 'Sao chép chi tiết lỗi'}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
