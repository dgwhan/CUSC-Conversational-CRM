import type { ConversationScoreResult } from '../conversation-scoring.js';

/**
 * Domain Event: ConversationClassified
 * Được phát khi một hội thoại được tính điểm và phân loại nhiệt độ thành công.
 * Các module bên ngoài (Leads, Customers, Notifications) có thể đăng ký lắng nghe
 * mà không làm vi phạm nguyên tắc đảo ngược phụ thuộc (Inversion of Control).
 */
export class ConversationClassifiedEvent {
  public static readonly EVENT_NAME = 'conversation.classified';

  constructor(
    public readonly conversationId: string,
    public readonly customerId: string | undefined,
    public readonly workspaceId: string | undefined,
    public readonly result: ConversationScoreResult,
    public readonly classifiedAt: Date = new Date(),
  ) {}
}

