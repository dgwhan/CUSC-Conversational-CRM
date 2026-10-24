import React, { useState, useEffect } from 'react';
import type { LeadStage, ChannelType } from '../inbox/types.js';
import type { KanbanCandidate } from './kanban.types.js';
import { KANBAN_COLUMNS, INITIAL_KANBAN_CANDIDATES } from './kanban.config.js';
import { NewCandidateModal } from './NewCandidateModal.js';
import { useRealtime } from '../realtime/RealtimeContext.js';
import { useUserRole } from '../auth/UserRoleContext.js';
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
} from 'lucide-react';

interface AdmissionKanbanBoardProps {
  onOpenChat?: (conversationId?: string) => void;
}

export const AdmissionKanbanBoard: React.FC<AdmissionKanbanBoardProps> = ({ onOpenChat }) => {
  const { staffPresences, onPipelineChange } = useRealtime();
  const { isOwner, isAgent, staffId, staffName } = useUserRole();

  const [candidates, setCandidates] = useState<KanbanCandidate[]>(() => {
    // Thử khôi phục từ localStorage nếu có
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
  const [dragOverCol, setDragOverCol] = useState<LeadStage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Lưu lại danh sách mỗi khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem('cusc_crm_kanban_candidates', JSON.stringify(candidates));
    } catch {}
  }, [candidates]);

  // Lắng nghe sự kiện cập nhật Kanban từ Realtime SSE (các nhân viên khác thay đổi)
  useEffect(() => {
    const unsubscribe = onPipelineChange((event) => {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === event.customerId ? { ...c, stage: event.newStage as LeadStage } : c
        )
      );
      notify.info(
        `${event.updatedBy} đã chuyển thí sinh "${event.customerName}" sang cột "${event.newStage}".`,
        'Đồng bộ Phễu Realtime'
      );
    });
    return unsubscribe;
  }, [onPipelineChange]);

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

  const handleDragOver = (e: React.DragEvent, colId: LeadStage) => {
    e.preventDefault();
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    setDragOverCol(null);
    const candId = e.dataTransfer.getData('text/plain') || draggedId;
    if (!candId) return;

    moveCandidateStage(candId, targetStage);
    setDraggedId(null);
  };

  // Cập nhật giai đoạn
  const moveCandidateStage = (candId: string, nextStage: LeadStage) => {
    const candidate = candidates.find((c) => c.id === candId);
    if (!candidate || candidate.stage === nextStage) return;

    const targetCol = KANBAN_COLUMNS.find((col) => col.id === nextStage);

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
      `Đã chuyển thí sinh "${candidate.fullName}" sang giai đoạn "${targetCol?.title || nextStage}".`,
      'Cập nhật Tuyển sinh'
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

  // Số liệu tổng quan KPI (Phương án A: Agent chỉ thấy doanh số của thí sinh mình phụ trách)
  const totalLeads = candidates.length;
  const totalTuition = candidates.reduce((sum, c) => sum + c.estimatedTuition, 0);
  const myAssignedCandidates = candidates.filter((c) => c.assignedStaffId === staffId);
  const myTuition = myAssignedCandidates.reduce((sum, c) => sum + c.estimatedTuition, 0);

  const enrolledCount = candidates.filter((c) => c.stage === 'ENROLLED').length;
  const newLeadCount = candidates.filter((c) => c.stage === 'NEW').length;
  const conversionRate = totalLeads > 0 ? Math.round((enrolledCount / totalLeads) * 100) : 0;

  // Lấy danh sách khóa học duy nhất để làm filter
  const allCourses = Array.from(
    new Set(candidates.flatMap((c) => c.interestCourses))
  );

  return (
    <div className="kanban-pipeline-wrapper">
      {/* 1. THANH CHỈ SỐ KPI TỔNG QUAN */}
      <div className="kanban-kpi-banner">
        <div className="kpi-metric-card">
          <div className="kpi-icon-box total">
            <Users size={18} />
          </div>
          <div className="kpi-metric-info">
            <span className="kpi-label">Tổng Thí sinh trong Phễu</span>
            <span className="kpi-value">{totalLeads}</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-icon-box new">
            <Sparkles size={18} />
          </div>
          <div className="kpi-metric-info">
            <span className="kpi-label">Tiếp nhận Mới (Cần gọi ngay)</span>
            <span className="kpi-value" style={{ color: '#0284c7' }}>{newLeadCount}</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-icon-box tuition">
            <DollarSign size={18} />
          </div>
          <div className="kpi-metric-info">
            <span className="kpi-label">
              {isOwner ? 'Doanh thu Dự kiến (Toàn trường)' : 'Học phí Thí sinh bạn chăm sóc'}
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
                  title="Theo chính sách bảo mật RBAC, tổng doanh số toàn trường chỉ hiển thị cho Chủ doanh nghiệp."
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
            <span className="kpi-label">Trúng tuyển / Đã nhập học</span>
            <div className="kpi-sub-row">
              <span className="kpi-value" style={{ color: '#16a34a' }}>{enrolledCount}</span>
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
              placeholder="Tìm theo tên, SĐT, email, khóa học..."
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
            <option value="ALL">Mọi kênh liên hệ</option>
            <option value="FACEBOOK">Facebook Messenger</option>
            <option value="ZALO">Zalo Official Account</option>
            <option value="ZALO_PERSONAL">Zalo Cá nhân (Tư vấn viên)</option>
            <option value="TIKTOK">TikTok Channel</option>
            <option value="MANUAL">Nhập tay / Hotline</option>
          </select>

          {/* Lọc Nhân sự phụ trách */}
          <select
            className="kanban-filter-select"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="ALL">Mọi tư vấn viên</option>
            <option value="staff-1">{staffName ? `${staffName} (Bạn)` : 'Bạn'}</option>
            <option value="staff-2">Lê Thị Thu Lan</option>
            <option value="staff-3">Trần Hoàng Nam</option>
          </select>

          {/* Lọc Khóa học */}
          <select
            className="kanban-filter-select"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="ALL">Mọi khóa học quan tâm</option>
            {allCourses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-right-group">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            <UserPlus size={15} />
            <span>Thêm Thí sinh</span>
          </button>
        </div>
      </div>

      {/* 3. BẢNG KANBAN 7 CỘT KÉO THẢ */}
      <div className="kanban-columns-container">
        {KANBAN_COLUMNS.map((column) => {
          const colCandidates = filteredCandidates.filter((c) => c.stage === column.id);
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
                    {column.title}
                  </h3>
                  <span
                    className="column-count-badge"
                    style={{ backgroundColor: column.bgColor, color: column.color }}
                  >
                    {colCandidates.length}
                  </span>
                </div>
                <div className="column-subtitle">{column.subtitle}</div>
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

                        {/* Thí sinh: Avatar & Tên */}
                        <div className="card-candidate-row">
                          <img
                            src={candidate.avatarUrl}
                            alt={candidate.fullName}
                            className="candidate-card-avatar"
                          />
                          <div className="candidate-card-info">
                            <h4 className="candidate-card-name">{candidate.fullName}</h4>
                            <div className="candidate-contact-sub">
                              <span className="candidate-phone">{candidate.phone}</span>
                              <button
                                type="button"
                                className="copy-icon-btn"
                                onClick={(e) => handleCopyPhone(e, candidate.phone, candidate.id)}
                                title="Sao chép SĐT"
                              >
                                {copiedId === candidate.id ? <Check size={11} /> : <Copy size={11} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Khóa học quan tâm */}
                        <div className="card-courses-box">
                          {candidate.interestCourses.map((crs, idx) => (
                            <span key={idx} className="course-chip">
                              {crs}
                            </span>
                          ))}
                        </div>

                        {/* Học phí & Tag */}
                        <div className="card-tuition-row">
                          <span className="card-tuition-val">
                            {formatCurrency(candidate.estimatedTuition)}
                          </span>
                          {candidate.tags[0] && (
                            <span className="card-tag-pill">{candidate.tags[0]}</span>
                          )}
                        </div>

                        {/* Footer Thẻ: Nhân viên phụ trách + Nút chat */}
                        <div className="card-footer-row">
                          <div
                            className="card-staff-avatar-wrapper"
                            title={`Phụ trách: ${candidate.assignedStaffName || 'Chưa gán'} (${staffPresence})`}
                          >
                            <div className="card-staff-avatar">
                              {candidate.assignedStaffAvatar || 'NV'}
                            </div>
                            <span
                              className={`staff-status-dot ${staffPresence.toLowerCase()}`}
                            />
                            <span className="card-staff-name-small">
                              {candidate.assignedStaffName?.split(' ')[0]}
                            </span>
                          </div>

                          <div className="card-action-btns">
                            {/* Nút 1-click mở chat trực tuyến */}
                            <button
                              type="button"
                              className="card-chat-btn"
                              onClick={() => onOpenChat?.(candidate.conversationId)}
                              title="Mở cuộc hội thoại trong Hộp thư Live Chat"
                            >
                              <MessageSquare size={13} />
                              <span>Chat</span>
                            </button>

                            {/* Dropdown chuyển nhanh giai đoạn không cần kéo */}
                            <select
                              className="card-quick-move-select"
                              value={candidate.stage}
                              onChange={(e) =>
                                moveCandidateStage(candidate.id, e.target.value as LeadStage)
                              }
                              title="Chuyển nhanh giai đoạn tuyển sinh"
                            >
                              {KANBAN_COLUMNS.map((col) => (
                                <option key={col.id} value={col.id}>
                                  → {col.title}
                                </option>
                              ))}
                            </select>
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

      {/* MODAL THÊM THÍ SINH MỚI */}
      <NewCandidateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddCandidate={(newCand) => setCandidates((prev) => [newCand, ...prev])}
      />
    </div>
  );
};
