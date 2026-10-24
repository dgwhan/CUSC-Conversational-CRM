import React, { useState } from 'react';
import { TableProperties, FileSpreadsheet, PenLine, Database, Sheet } from 'lucide-react';
import { Alert } from '../../../components/ui/Alert.js';
import { useMessageImport } from '../hooks/useMessageImport.js';
import { SpreadsheetGrid } from '../components/SpreadsheetGrid.js';
import { CsvImportSection } from '../components/CsvImportSection.js';
import { ManualImportSection } from '../components/ManualImportSection.js';
import { GoogleSheetIntegrationSection } from '../components/GoogleSheetIntegrationSection.js';
import { SavedMessagesTable } from '../components/SavedMessagesTable.js';
import { ImportResultsSummary } from '../components/ImportResultsSummary.js';
import { ImportErrorTable } from '../components/ImportErrorTable.js';
import type { ManualImportRow } from '../types/messaging.types.js';

export type TabKey = 'grid' | 'csv' | 'manual' | 'gsheet' | 'saved';

export const MessagingImportPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabKey>('grid');

  const {
    csvContent,
    setCsvContent,
    fileName,
    loading,
    result,
    errorMessage,
    setErrorMessage,
    manualRows,
    downloadTemplate,
    generate100SampleRows,
    handleFileUpload,
    submitCsvImport,
    submitManualImport,
    submitGoogleSheetImport,
    submitCustomRows,
    addManualRow,
    removeManualRow,
    updateManualRow,
  } = useMessageImport();

  const handleImportGridRows = async (rows: ManualImportRow[]) => {
    await submitCustomRows(rows);
  };

  return (
    <div className="crm-page-container">
      {/* Page Title & Context */}
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-title">Quản Lý & Tiếp Nhận Tin Nhắn Tuyển Sinh</h1>
          <p className="crm-page-description">
            Bảng tính trực quan hỗ trợ copy/paste từ Google Sheets & Excel, kiểm thực nghiêm ngặt qua Zod và quản lý toàn bộ kho tin nhắn tư vấn đã lưu.
          </p>
        </div>
      </div>

      {/* Global Alert */}
      {errorMessage && (
        <Alert
          variant="danger"
          title="Thông báo lỗi"
          onClose={() => setErrorMessage(null)}
          className="crm-page-alert"
        >
          {errorMessage}
        </Alert>
      )}

      {/* Navigation Tab Bar */}
      <div className="crm-tab-bar">
        <button
          className={`crm-tab-btn ${currentTab === 'grid' ? 'active' : ''}`}
          onClick={() => setCurrentTab('grid')}
        >
          <TableProperties size={16} />
          <span>Bảng Tính In-App Grid (Ctrl+V)</span>
        </button>
        <button
          className={`crm-tab-btn ${currentTab === 'csv' ? 'active' : ''}`}
          onClick={() => setCurrentTab('csv')}
        >
          <FileSpreadsheet size={16} />
          <span>Import File CSV</span>
        </button>
        <button
          className={`crm-tab-btn ${currentTab === 'manual' ? 'active' : ''}`}
          onClick={() => setCurrentTab('manual')}
        >
          <PenLine size={16} />
          <span>Nhập Tay Cơ Bản</span>
        </button>
        <button
          className={`crm-tab-btn ${currentTab === 'gsheet' ? 'active' : ''}`}
          onClick={() => setCurrentTab('gsheet')}
        >
          <Sheet size={16} />
          <span>Đồng Bộ Google Sheet</span>
        </button>
        <button
          className={`crm-tab-btn ${currentTab === 'saved' ? 'active' : ''}`}
          onClick={() => setCurrentTab('saved')}
        >
          <Database size={16} />
          <span>Tin Nhắn Đã Lưu (Database)</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="crm-tab-content">
        {currentTab === 'grid' && (
          <SpreadsheetGrid
            onImportRows={handleImportGridRows}
            loading={loading}
          />
        )}

        {currentTab === 'csv' && (
          <CsvImportSection
            csvContent={csvContent}
            onCsvChange={setCsvContent}
            fileName={fileName}
            onFileUpload={handleFileUpload}
            onDownloadTemplate={downloadTemplate}
            onGenerate100Rows={generate100SampleRows}
            onSubmit={submitCsvImport}
            loading={loading}
          />
        )}

        {currentTab === 'manual' && (
          <ManualImportSection
            rows={manualRows}
            onAddRow={addManualRow}
            onRemoveRow={removeManualRow}
            onUpdateRow={updateManualRow}
            onSubmit={submitManualImport}
            loading={loading}
          />
        )}

        {currentTab === 'gsheet' && (
          <GoogleSheetIntegrationSection
            onImportGoogleSheet={submitGoogleSheetImport}
            loading={loading}
          />
        )}

        {currentTab === 'saved' && (
          <SavedMessagesTable />
        )}
      </div>

      {/* Results Section */}
      {result && currentTab !== 'saved' && (
        <div className="crm-results-container" id="results">
          <div className="crm-section-divider">
            <span>KẾT QUẢ XỬ LÝ VÀ KIỂM THỰC</span>
          </div>

          <ImportResultsSummary result={result} />

          <ImportErrorTable errors={result.errors} />
        </div>
      )}
    </div>
  );
};
