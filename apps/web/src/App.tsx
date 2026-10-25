import { useState, useEffect, lazy, Suspense } from 'react';
import { MainLayout } from './layouts/index.js';
import type { ActiveNavTab } from './app/Sidebar.js';
import { ErrorBoundary } from './app/ErrorBoundary.js';
import { I18nProvider } from './i18n/I18nContext.js';
import { ToastProvider } from './components/feedback/ToastContext.js';
import { ToastContainer } from './components/feedback/ToastContainer.js';
import { UserRoleProvider, useUserRole } from './modules/auth/index.js';
import { RealtimeProvider } from './modules/realtime/RealtimeContext.js';
import { WorkspaceConfigProvider } from './modules/workspace/WorkspaceConfigContext.js';
import { AuthPage } from './features/auth/pages/AuthPage.js';

// Lazy load CRM internal pages and components for high performance initial load
const AppLayout = lazy(() => import('./app/AppLayout.js').then((m) => ({ default: m.AppLayout })));
const UnifiedInboxPage = lazy(() => import('./modules/inbox/pages/UnifiedInboxPage.js').then((m) => ({ default: m.UnifiedInboxPage })));
const AdmissionKanbanBoard = lazy(() => import('./modules/kanban/AdmissionKanbanBoard.js').then((m) => ({ default: m.AdmissionKanbanBoard })));
const WorkspaceSettingsPage = lazy(() => import('./modules/workspace/pages/WorkspaceSettingsPage.js').then((m) => ({ default: m.WorkspaceSettingsPage })));
const OnboardingWizardPage = lazy(() => import('./modules/onboarding/pages/OnboardingWizardPage.js').then((m) => ({ default: m.OnboardingWizardPage })));
const MessagingImportPage = lazy(() => import('./modules/messaging/pages/MessagingImportPage.js').then((m) => ({ default: m.MessagingImportPage })));
const Error404Page = lazy(() => import('./pages/errors/Error404Page.js').then((m) => ({ default: m.Error404Page })));
const HttpErrorPage = lazy(() => import('./pages/errors/HttpErrorPage.js').then((m) => ({ default: m.HttpErrorPage })));
const ErrorSimulationBar = lazy(() => import('./pages/errors/ErrorSimulationBar.js').then((m) => ({ default: m.ErrorSimulationBar })));

// Component phụ mô phỏng lỗi crash để kiểm tra ErrorBoundary
function CrashTriggerComponent(): React.ReactNode {
  throw new Error('Mô phỏng lỗi ngoại lệ chưa xử lý: TypeError: Cannot read properties of undefined (reading "candidate_name") tại MessagingContainer.tsx:142');
}

function CRMMainContent() {
  const { isAuthenticated, login } = useUserRole();

  // Bắt callback từ popup OAuth Meta / Zalo nếu cửa sổ này được mở dạng popup
  useEffect(() => {
    if (typeof window !== 'undefined' && window.opener && window.location.search.includes('code=')) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      if (code) {
        window.opener.postMessage(
          { type: 'OAUTH_CALLBACK', code, state },
          window.location.origin,
        );
        window.close();
      }
    }
  }, []);
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

  // Chưa đăng nhập: hiển thị trang Auth (Login / Sign Up)
  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <AuthPage onLoginSuccess={login} />
      </>
    );
  }

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
      <MainLayout currentTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'inbox' && (
          <UnifiedInboxPage
            onNavigateToKanban={() => setActiveTab('kanban')}
            initialConversationId={activeChatConvId}
          />
        )}
        {activeTab === 'kanban' && (
          <AdmissionKanbanBoard
            onOpenChat={handleOpenChatFromKanban}
            onNavigateToSettings={() => setActiveTab('workspace-settings')}
          />
        )}
        {activeTab === 'workspace-settings' && <WorkspaceSettingsPage />}
        {activeTab === 'onboarding' && (
          <OnboardingWizardPage
            onComplete={() => setActiveTab('inbox')}
            onSkipToInbox={() => setActiveTab('inbox')}
          />
        )}
        {activeTab === 'import' && <MessagingImportPage />}
      </MainLayout>
    );
  };

  return (
    <>
      {/* Khung hiển thị Toast Thông Báo */}
      <ToastContainer />

      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans text-sm text-slate-500">
            Đang tải dữ liệu...
          </div>
        }
      >
        {/* Thanh công cụ kiểm thử lỗi & thông báo */}
        <ErrorSimulationBar
          currentSimulatedCode={simulatedErrorCode}
          onSimulatePage={(code) => setSimulatedErrorCode(code)}
          onTriggerCrash={() => setShouldCrash(true)}
        />

        {/* Màn hình chính hoặc màn hình lỗi */}
        {renderCurrentView()}
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ToastProvider>
          <UserRoleProvider>
            <RealtimeProvider>
              <WorkspaceConfigProvider>
                <CRMMainContent />
              </WorkspaceConfigProvider>
            </RealtimeProvider>
          </UserRoleProvider>
        </ToastProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
