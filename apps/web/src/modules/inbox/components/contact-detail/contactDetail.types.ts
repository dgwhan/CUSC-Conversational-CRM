import {
  LEAD_STATUS,
  PIPELINE_STAGE_ID,
  type LeadStatus,
  type PipelineStageId,
} from '../../types.js';

export interface StageDefinition {
  id: PipelineStageId | (string & {});
  name: string;
  status: LeadStatus;
  isWon?: boolean;
  isLost?: boolean;
}

// 7 giai đoạn chuẩn theo cấu hình hệ thống (màu sắc được quản trị tập trung tại root CSS tokens)
export const STANDARD_7_STAGES: StageDefinition[] = [
  { id: PIPELINE_STAGE_ID.STAGE_NEW, name: '1. Tiếp nhận mới', status: LEAD_STATUS.NEW },
  { id: PIPELINE_STAGE_ID.STAGE_CONTACTED, name: '2. Đã liên hệ / Tư vấn', status: LEAD_STATUS.POTENTIAL },
  { id: PIPELINE_STAGE_ID.STAGE_QUALIFIED, name: '3. Tiềm năng cao', status: LEAD_STATUS.POTENTIAL },
  { id: PIPELINE_STAGE_ID.STAGE_APPOINTMENT, name: '4. Hẹn nộp hồ sơ', status: LEAD_STATUS.POTENTIAL },
  { id: PIPELINE_STAGE_ID.STAGE_SUBMITTED, name: '5. Đã nộp hồ sơ', status: LEAD_STATUS.POTENTIAL },
  { id: PIPELINE_STAGE_ID.STAGE_ENROLLED, name: '6. Trúng tuyển / Nhập học', status: LEAD_STATUS.CONVERTED, isWon: true },
  { id: PIPELINE_STAGE_ID.STAGE_LOST, name: '7. Hủy / Thất bại', status: LEAD_STATUS.UNQUALIFIED, isLost: true },
];
