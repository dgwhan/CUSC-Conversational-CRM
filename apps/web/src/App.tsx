import { useState } from 'react';
import { AppLayout } from './app/AppLayout.js';
import { ErrorBoundary } from './app/ErrorBoundary.js';
import { ToastProvider } from './components/feedback/ToastContext.js';
import { ToastContainer } from './components/feedback/ToastContainer.js';
import { MessagingImportPage } from './modules/messaging/pages/MessagingImportPage.js';
import { Error404Page } from './pages/errors/Error404Page.js';
import { HttpErrorPage } from './pages/errors/HttpErrorPage.js';
import { ErrorSimulationBar } from './pages/errors/ErrorSimulationBar.js';
import './App.css';

// Component phụ mô phỏng lỗi crash để kiểm tra ErrorBoundary
function CrashTriggerComponent(): React.ReactNode {
  throw new Error('Mô phỏng lỗi ngoại lệ chưa xử lý: TypeError: Cannot read properties of undefined (reading "candidate_name") tại MessagingContainer.tsx:142');
}

export default function App() {
  const [simulatedErrorCode, setSimulatedErrorCode] = useState<number | null>(null);
  const [shouldCrash, setShouldCrash] = useState(false);

  // Nếu người dùng yêu cầu crash để test ErrorBoundary
  if (shouldCrash) {
    return <CrashTriggerComponent />;
  }

  // Render trang lỗi nếu đang trong chế độ mô phỏng hoặc bắt lỗi HTTP
  const renderCurrentView = () => {
    if (simulatedErrorCode === 404) {
      return (
        <Error404Page
          path="/api/messages/undefined-endpoint"
          onGoHome={() => setSimulatedErrorCode(null)}
          onGoBack={() => setSimulatedErrorCode(null)}
        />
      );
    }

    if (simulatedErrorCode !== null) {
      return (
        <HttpErrorPage
          statusCode={simulatedErrorCode}
          errorLocation={`POST /api/messages/import (Client ID: CUSC-SRV-01)`}
          errorDetails={{
            status: simulatedErrorCode,
            timestamp: new Date().toISOString(),
            request: {
              url: '/api/messages/import',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            },
            traceId: 'req-simulated-trace-01',
          }}
          onGoHome={() => setSimulatedErrorCode(null)}
          onRetry={() => setSimulatedErrorCode(null)}
        />
      );
    }

    return (
      <AppLayout>
        <MessagingImportPage />
      </AppLayout>
    );
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        {/* Khung hiển thị Toast Thông Báo */}
        <ToastContainer />

        {/* Thanh công cụ kiểm thử lỗi & thông báo */}
        <ErrorSimulationBar
          currentSimulatedCode={simulatedErrorCode}
          onSimulatePage={(code) => setSimulatedErrorCode(code)}
          onTriggerCrash={() => setShouldCrash(true)}
        />

        {/* Màn hình chính hoặc màn hình lỗi */}
        {renderCurrentView()}
      </ToastProvider>
    </ErrorBoundary>
  );
}
