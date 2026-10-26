import type { ConversationItem, QuickReplyItem, AssignedStaff } from './types.js';

/**
 * Danh sách nhân viên tư vấn được cập nhật động từ hệ thống Realtime / Cơ sở dữ liệu
 */
export const MOCK_STAFF_LIST: AssignedStaff[] = [];

/**
 * Các mẫu phản hồi nhanh (Quick Replies) tiện ích cho tư vấn viên
 */
export const MOCK_QUICK_REPLIES: QuickReplyItem[] = [
  {
    id: 'qr-1',
    label: 'Lời chào & Giới thiệu',
    content: 'Chào bạn! Cảm ơn bạn đã quan tâm đến các chương trình đào tạo tại CUSC - Đại học Cần Thơ. Mình có thể hỗ trợ thông tin khóa học nào cho bạn ạ?',
    shortcut: '/chao',
  },
  {
    id: 'qr-2',
    label: 'Học phí & Học bổng',
    content: 'Dạ học phí chương trình Quốc tế đang có chính sách học bổng hỗ trợ từ 15% - 30% cho thí sinh đăng ký sớm trong tháng này. Bạn cho mình xin số điện thoại để gửi biểu phí chi tiết nhé!',
    shortcut: '/hocphi',
  },
  {
    id: 'qr-3',
    label: 'Địa chỉ & Hotline',
    content: 'Trung tâm CUSC tọa lạc tại: Số 01 Lý Tự Trọng, P. An Phú, Q. Ninh Kiều, TP. Cần Thơ. Hotline tư vấn tuyển sinh 24/7: 0292.3835.581.',
    shortcut: '/diachi',
  },
  {
    id: 'qr-4',
    label: 'Link Đăng ký Trực tuyến',
    content: 'Bạn có thể điền thông tin giữ suất học bổng trực tiếp tại cổng đăng ký: https://tuyensinh.cusc.vn/dang-ky',
    shortcut: '/link',
  },
];

/**
 * Khởi tạo danh sách hộp thoại rỗng.
 * Toàn bộ tin nhắn sẽ được nhận và hiển thị tự động qua Webhook & kết nối WebSocket Realtime.
 */
export const INITIAL_CONVERSATIONS: ConversationItem[] = [];
