/**
 * Module Unified Inbox
 * Phân tầng kiến trúc:
 * - pages/: Giao diện trang chính UnifiedInboxPage
 * - components/:
 *     - conversation-list/: Cột 1 - Danh sách hội thoại
 *     - chat-window/: Cột 2 - Khung chat trực tuyến
 *     - contact-detail/: Cột 3 - Hồ sơ chi tiết khách hàng
 *     - modals/: Các popup nghiệp vụ (QuickReply, LogPersonalZalo)
 *     - banners/: Cảnh báo đa kênh (InboxZaloAlertBanner)
 *     - empty-view/: Trạng thái rỗng
 * - hooks/: Nghiệp vụ dữ liệu & actions
 * - utils/: Tiện ích xử lý hội thoại & tin nhắn
 * - types.ts: Định nghĩa dữ liệu toàn module
 * - mockData.ts: Mock data phục vụ phát triển & test
 */

export * from './pages/UnifiedInboxPage.js';
export * from './components/index.js';
export * from './hooks/index.js';
export * from './utils/index.js';
export * from './types.js';
export * from './mockData.js';

