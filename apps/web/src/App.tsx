import { useState } from 'react';
import { AppLayout } from './app/AppLayout.js';
import type { ActiveNavTab } from './app/Sidebar.js';
import { ErrorBoundary } from './app/ErrorBoundary.js';
import { I18nProvider } from './i18n/I18nContext.js';
import { ToastProvider } from './components/feedback/ToastContext.js';
import { ToastContainer } from './components/feedback/ToastContainer.js';
import { RealtimeProvider } from './modules/realtime/RealtimeContext.js';
import { UnifiedInboxPage } from './modules/inbox/pages/UnifiedInboxPage.js';
import { AdmissionKanbanBoard } from './modules/kanban/index.js';
import { OnboardingWizardPage } from './modules/onboarding/pages/OnboardingWizardPage.js';
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
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('inbox');
  const [activeChatConvId, setActiveChatConvId] = useState<string | null>(null);
  const [simulatedErrorCode, setSimulatedErrorCode] = useState<number | null>(null);
  const [shouldCrash, setShouldCrash] = useState(false);

  // Mở trực tiếp khung chat từ Kanban card
  const handleOpenChatFromKanban = (conversationId?: string) => {
    if (conversationId) {
      setActiveChatConvId(conversationId);
    }
    setActiveTab('inbox');
  };

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

    // Giao diện chính điều hướng theo Tab
    return (
      <AppLayout currentTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'inbox' && (
          <UnifiedInboxPage
            onNavigateToKanban={() => setActiveTab('kanban')}
            initialConversationId={activeChatConvId}
          />
        )}
        {activeTab === 'kanban' && (
          <AdmissionKanbanBoard onOpenChat={handleOpenChatFromKanban} />
        )}
        {activeTab === 'onboarding' && (
          <OnboardingWizardPage
            onComplete={() => setActiveTab('inbox')}
            onSkipToInbox={() => setActiveTab('inbox')}
          />
        )}
        {activeTab === 'import' && <MessagingImportPage />}
      </AppLayout>
    );
  };

  return (
    <ErrorBoundary>
      <I18nProvider>
        <ToastProvider>
          <RealtimeProvider>
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
          </RealtimeProvider>
        </ToastProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
