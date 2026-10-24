import React, { useState, useEffect } from 'react';
import type { LeadStage, ChannelType } from '../inbox/types.js';
import type { KanbanCandidate } from './kanban.types.js';
import { INITIAL_KANBAN_CANDIDATES } from './kanban.config.js';
import { NewCandidateModal } from './NewCandidateModal.js';
import { useRealtime } from '../realtime/RealtimeContext.js';
import { useUserRole } from '../auth/UserRoleContext.js';
import { useWorkspaceConfig } from '../workspace/WorkspaceConfigContext.js';
import { notify } from '../../components/feedback/toastEmitter.js';
import {
  Search,
  UserPlus,
  MessageSquare,
  DollarSign,
  Award,
  Users,
  Copy,
  Check,
  Clock,
  Sparkles,
  Lock,
  Sliders,
} from 'lucide-react';

interface AdmissionKanbanBoardProps {
  onOpenChat?: (conversationId?: string) => void;
  onNavigateToSettings?: () => void;
}

export const AdmissionKanbanBoard: React.FC<AdmissionKanbanBoardProps> = ({
  onOpenChat,
  onNavigateToSettings,
}) => {
  const { staffPresences, onPipelineChange } = useRealtime();
const { isOwner, isAgent, staffId, staffName } = useUserRole();
  const { config } = useWorkspaceConfig();

  const [candidates, setCandidates] = useState<KanbanCandidate[]>(() => {
    try {
      const saved = localStorage.getItem('cusc_crm_kanban_candidates');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_KANBAN_CANDIDATES;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | ChannelType>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Lưu lại danh sách mỗi khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem('cusc_crm_kanban_candidates', JSON.stringify(candidates));
    } catch {}
  }, [candidates]);

  // Lắng nghe sự kiện cập nhật Kanban từ Realtime SSE
  useEffect(() => {
    const unsubscribe = onPipelineChange((event) => {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === event.customerId ? { ...c, stage: event.newStage as LeadStage } : c
        )
      );
      notify.info(
        `${event.updatedBy} đã chuyển ${config.terminology.entityName.toLowerCase()} "${event.customerName}" sang giai đoạn "${event.newStage}".`,
        'Đồng bộ Phễu Realtime'
      );
    });
    return unsubscribe;
  }, [onPipelineChange, config.terminology.entityName]);

  // Format tiền tệ VNĐ
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Copy số điện thoại
  const handleCopyPhone = (e: React.MouseEvent, phone: string, candId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedId(candId);
    notify.success(`Đã sao chép SĐT: ${phone}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Xử lý kéo thả (HTML5 Drag and Drop)
  const handleDragStart = (e: React.DragEvent, candId: string) => {
    e.dataTransfer.setData('text/plain', candId);
    setDraggedId(candId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const candId = e.dataTransfer.getData('text/plain') || draggedId;
    if (!candId) return;

    moveCandidateStage(candId, targetStage as LeadStage);
    setDraggedId(null);
  };

  // Cập nhật giai đoạn
  const moveCandidateStage = (candId: string, nextStage: LeadStage) => {
    const candidate = candidates.find((c) => c.id === candId);
    if (!candidate || candidate.stage === nextStage) return;

    const targetStageConfig = config.pipelineStages.find(
      (s) => s.id === nextStage || s.id === `STAGE_${nextStage}`
    );

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candId
          ? {
              ...c,
              stage: nextStage,
              lastActivityAt: 'Vừa xong',
            }
          : c
      )
    );

    notify.success(
      `Đã chuyển "${candidate.fullName}" sang giai đoạn "${targetStageConfig?.name || nextStage}".`,
      `Cập nhật ${config.terminology.pipelineName}`
    );
  };

  // Lọc danh sách thẻ
  const filteredCandidates = candidates.filter((item) => {
    if (channelFilter !== 'ALL' && item.channel !== channelFilter) return false;
    if (staffFilter !== 'ALL' && item.assignedStaffId !== staffFilter) return false;
    if (courseFilter !== 'ALL' && !item.interestCourses.some((c) => c.includes(courseFilter))) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.fullName.toLowerCase().includes(q);
      const matchPhone = item.phone.toLowerCase().includes(q);
      const matchEmail = item.email.toLowerCase().includes(q);
      const matchCourse = item.interestCourses.some((c) => c.toLowerCase().includes(q));
      if (!matchName && !matchPhone && !matchEmail && !matchCourse) return false;
    }
    return true;
  });

  // Map ứng viên vào các stage của workspace config
  // (hỗ trợ cả stage id mới lẫn legacy id như NEW -> STAGE_NEW)
  const isCandidateInStage = (candidateStage: string, stageConfigId: string) => {
    if (candidateStage === stageConfigId) return true;
    if (`STAGE_${candidateStage}` === stageConfigId) return true;
    if (stageConfigId.replace('STAGE_', '') === candidateStage) return true;
    return false;
  };

  // Số liệu tổng quan KPI (Phương án A: Agent chỉ thấy doanh số của hồ sơ mình phụ trách)
  const totalLeads = candidates.length;
  const totalTuition = candidates.reduce((sum, c) => sum + c.estimatedTuition, 0);
  const myAssignedCandidates = candidates.filter((c) => c.assignedStaffId === staffId);
  const myTuition = myAssignedCandidates.reduce((sum, c) => sum + c.estimatedTuition, 0);

  // Xác định giai đoạn thành công (Won) & giai đoạn tiếp nhận (New)
  const wonStages = config.pipelineStages.filter((s) => s.isWon).map((s) => s.id);
  const wonCount = candidates.filter((c) =>
    wonStages.some((wId) => isCandidateInStage(c.stage, wId))
  ).length;

  const firstStage = config.pipelineStages[0];
  const newLeadCount = firstStage
    ? candidates.filter((c) => isCandidateInStage(c.stage, firstStage.id)).length
    : 0;

  const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

  return (
    <div className="kanban-pipeline-wrapper">
      {/* 1. THANH CHỈ SỐ KPI TỔNG QUAN */}
      <div className="kanban-kpi-banner">
        <div className="kpi-metric-card">
          <div className="kpi-icon-box total">
            <Users size={18} />
          </div>
          <div className="kpi-metric-info">
            <span className="kpi-label">Tổng {config.terminology.entityName}</span>
            <span className="kpi-value">{totalLeads}</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-icon-box new">
            <Sparkles size={18} />
          </div>
          <div className="kpi-metric-info">
            <span className="kpi-label">
              {firstStage?.name || 'Tiếp nhận Mới'}
            </span>
            <span className="kpi-value" style={{ color: '#0284c7' }}>{newLeadCount}</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-icon-box tuition">
            <DollarSign size={18} />
          </div>
          <div className="kpi-metric-info">
            <span className="kpi-label">
              {isOwner
                ? `${config.terminology.valueLabel} (Toàn DN)`
                : `${config.terminology.valueLabel} (Bạn Chăm Sóc)`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="kpi-value" style={{ color: '#0d9488' }}>
                {formatCurrency(isOwner ? totalTuition : myTuition)}
              </span>
              {isAgent && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '10px',
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}
                  title="Theo chính sách bảo mật RBAC, tổng doanh số toàn doanh nghiệp chỉ hiển thị cho Chủ doanh nghiệp."
                >
                  <Lock size={10} />
                  <span>Ẩn tổng trường</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-icon-box conversion">
            <Award size={18} />
          </div>
          <div className="kpi-metric-info">
            <span className="kpi-label">Chốt Thành Công</span>
            <div className="kpi-sub-row">
              <span className="kpi-value" style={{ color: '#16a34a' }}>{wonCount}</span>
              <span className="kpi-rate-badge">Tỷ lệ chốt: {conversionRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THANH CÔNG CỤ TÌM KIẾM & BỘ LỌC */}
      <div className="kanban-toolbar">
        <div className="toolbar-left-group">
          {/* Ô tìm kiếm */}
          <div className="kanban-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder={`Tìm theo tên ${config.terminology.entityName.toLowerCase()}, SĐT, email...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="kanban-search-input"
            />
          </div>

          {/* Lọc Kênh */}
          <select
            className="kanban-filter-select"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as 'ALL' | ChannelType)}
          >
            <option value="ALL">Tất cả nguồn kênh</option>
            <option value="FACEBOOK">Facebook Messenger</option>
            <option value="ZALO">Zalo OA</option>
            <option value="ZALO_PERSONAL">Zalo Cá nhân (Tư vấn)</option>
            <option value="TIKTOK">TikTok Channel</option>
            <option value="MANUAL">Nhập trực tiếp / Hotline</option>
          </select>

          {/* Lọc Nhân viên */}
          <select
            className="kanban-filter-select"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
<option value="ALL">Tất cả nhân viên tư vấn</option>
            <option value="staff-1">{staffName ? `${staffName} (Bạn)` : 'Nguyễn Văn Minh (Bạn)'}</option>
            <option value="staff-2">Lê Thị Thu Lan</option>
            <option value="staff-3">Trần Hoàng Nam</option>
          </select>

          {/* Lọc Sản phẩm / Khóa học theo catalog của workspace */}
          <select
            className="kanban-filter-select"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="ALL">Tất cả {config.terminology.productLabel.toLowerCase()}</option>
            {config.productCatalog.map((prod) => (
              <option key={prod.id} value={prod.name}>
                {prod.name}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-right-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Nút tùy biến Phễu cho Owner */}
          {onNavigateToSettings && isOwner && (
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              onClick={onNavigateToSettings}
              title="Tùy biến các giai đoạn phễu và danh mục sản phẩm cho Workspace"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sliders size={14} />
              <span>Cấu hình Phễu</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            <UserPlus size={15} />
            <span>Thêm {config.terminology.entityName}</span>
          </button>
        </div>
      </div>

      {/* 3. BẢNG KANBAN ĐỘNG THEO GIAI ĐOẠN CỦA WORKSPACE */}
      <div className="kanban-columns-container">
        {config.pipelineStages.map((column) => {
          const colCandidates = filteredCandidates.filter((c) =>
            isCandidateInStage(c.stage, column.id)
          );
          const colTuition = colCandidates.reduce((sum, c) => sum + c.estimatedTuition, 0);
          const isDragTarget = dragOverCol === column.id;

          return (
            <div
              key={column.id}
              className={`kanban-column ${isDragTarget ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Header Cột */}
              <div
                className="kanban-column-header"
                style={{ borderTopColor: column.color }}
              >
                <div className="column-title-row">
                  <h3 className="column-title" style={{ color: column.color }}>
                    {column.name}
                  </h3>
                  <span
                    className="column-count-badge"
                    style={{ backgroundColor: column.bgColor, color: column.color }}
                  >
                    {colCandidates.length}
                  </span>
                </div>
                {column.subtitle && <div className="column-subtitle">{column.subtitle}</div>}
                <div className="column-tuition-sum">
                  {formatCurrency(colTuition)}
                </div>
              </div>

              {/* Danh sách thẻ trong cột */}
              <div className="kanban-cards-scroll">
                {colCandidates.length === 0 ? (
                  <div className="kanban-empty-dropzone">
                    <span>Kéo thẻ vào đây</span>
                  </div>
                ) : (
                  colCandidates.map((candidate) => {
                    const staffPresence = candidate.assignedStaffId
                      ? staffPresences[candidate.assignedStaffId]?.status || 'ONLINE'
                      : 'ONLINE';

                    const isBeingDragged = draggedId === candidate.id;

                    return (
                      <div
                        key={candidate.id}
                        className={`kanban-card ${isBeingDragged ? 'dragging' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, candidate.id)}
                      >
                        {/* Header Thẻ: Kênh & Nút hành động */}
                        <div className="card-top-row">
                          <span className={`channel-badge-pill ${candidate.channel.toLowerCase()}`}>
                            {candidate.channel === 'FACEBOOK' && 'FB Messenger'}
                            {candidate.channel === 'ZALO' && 'Zalo OA'}
                            {candidate.channel === 'ZALO_PERSONAL' && 'Zalo Cá nhân'}
                            {candidate.channel === 'TIKTOK' && 'TikTok'}
                            {candidate.channel === 'MANUAL' && 'Trực tiếp'}
                          </span>

                          <span className="card-time-ago">
                            <Clock size={11} />
                            <span>{candidate.lastActivityAt}</span>
                          </span>
                        </div>

                        {/* Thông tin Ứng viên / Khách hàng */}
                        <div className="card-candidate-info">
                          <img
                            src={candidate.avatarUrl}
                            alt={candidate.fullName}
                            className="card-avatar"
                          />
                          <div className="card-name-group">
                            <h4 className="card-name">{candidate.fullName}</h4>
                            <div className="card-phone-row">
                              <span className="card-phone">{candidate.phone}</span>
                              <button
                                type="button"
                                className="card-copy-btn"
                                onClick={(e) => handleCopyPhone(e, candidate.phone, candidate.id)}
                                title="Sao chép SĐT"
                              >
                                {copiedId === candidate.id ? (
                                  <Check size={11} color="#16a34a" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Sản phẩm / Khóa học & Giá trị */}
                        <div className="card-course-pill">
                          <span>{candidate.interestCourses.join(', ')}</span>
                        </div>

                        <div className="card-tuition-row">
                          <span className="tuition-label">{config.terminology.valueLabel}:</span>
                          <span className="tuition-amount">
                            {formatCurrency(candidate.estimatedTuition)}
                          </span>
                        </div>

                        {/* Tags */}
                        <div className="card-tags-row">
                          {candidate.tags && candidate.tags.length > 0 ? (
                            <>
                              {candidate.tags.slice(0, 2).map((tag, tIdx) => (
                                <span key={tIdx} className="card-tag-badge">
                                  {tag}
                                </span>
                              ))}
                              {candidate.tags.length > 2 && (
                                <span className="card-tag-more">+{candidate.tags.length - 2}</span>
                              )}
                            </>
                          ) : null}
                        </div>

                        {/* Footer Thẻ: Nhân viên phụ trách & Nút mở Chat */}
                        <div className="card-footer-row">
                          <div className="card-staff-info">
                            <div className="staff-avatar-wrapper">
                              <div className="staff-avatar-circle">
                                {candidate.assignedStaffAvatar || 'MV'}
                              </div>
                              <span className={`staff-dot ${staffPresence.toLowerCase()}`} />
                            </div>
                            <span className="staff-name">
                              {candidate.assignedStaffName || 'Chưa gán'}
                            </span>
                          </div>

                          <div className="card-actions-group">
                            {onOpenChat && candidate.conversationId && (
                              <button
                                type="button"
                                className="card-chat-btn"
                                onClick={() => onOpenChat(candidate.conversationId)}
                                title="Mở trực tiếp cuộc trò chuyện"
                              >
                                <MessageSquare size={13} />
                                <span>Chat</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Thêm Thí sinh / Khách hàng mới */}
      <NewCandidateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddCandidate={(newCand) => {
          setCandidates((prev) => [newCand, ...prev]);
        }}
      />
    </div>
  );
};
