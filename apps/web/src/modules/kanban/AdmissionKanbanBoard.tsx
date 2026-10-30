import React, { useState, useEffect } from 'react';
import type { LeadStage, ChannelType } from '../inbox/types.js';
import type { KanbanCandidate } from './kanban.types.js';
import { INITIAL_KANBAN_CANDIDATES } from './kanban.config.js';
import { NewCandidateModal } from './NewCandidateModal.js';
import { useRealtime } from '../realtime/RealtimeContext.js';
import { useUserRole } from '../auth/UserRoleContext.js';
import { useWorkspaceConfig } from '../workspace/WorkspaceConfigContext.js';
import { notify } from '../../components/feedback/toastEmitter.js';
import { apiClient } from '../../lib/api-client.js';
import { Avatar } from '../../components/common/Avatar.js';
import { AssignProductModal } from '../../components/common/AssignProductModal.js';
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
  Plus,
  Edit2,
} from 'lucide-react';

interface AdmissionKanbanBoardProps {
  onOpenChat?: (conversationId?: string) => void;
  onNavigateToSettings?: () => void;
}

export const AdmissionKanbanBoard: React.FC<AdmissionKanbanBoardProps> = ({
  onOpenChat,
  onNavigateToSettings,
}) => {
  const { staffPresences, onPipelineChange, onNewMessage } = useRealtime();
const { isOwner, isAgent, staffId } = useUserRole();
  const { config } = useWorkspaceConfig();

  const [candidates, setCandidates] = useState<KanbanCandidate[]>(() => {
    try {
      const saved = localStorage.getItem('polarisx_crm_kanban_candidates') || localStorage.getItem('cusc_crm_kanban_candidates');
      if (saved) {
        const parsed: KanbanCandidate[] = JSON.parse(saved);
        // Tự động lọc sạch các ứng viên mẫu gán cứng cũ lưu trong localStorage của trình duyệt
        const cleanList = parsed.filter(
          (c) =>
            !c.id.startsWith('cand-1') &&
            !c.id.startsWith('cand-2') &&
            !c.id.startsWith('cand-3') &&
            !c.id.startsWith('cand-4') &&
            !c.id.startsWith('cand-5') &&
            !c.id.startsWith('cand-6') &&
            !['Nguyễn Văn An', 'Trần Thị Thu Hà', 'Lê Hoàng Nam', 'Phạm Minh Đức', 'Đoàn Gia Huy', 'Võ Thị Mai Anh'].includes(c.fullName) &&
            !['Lê Thị Thu Lan', 'Trần Hoàng Nam', 'Nguyễn Văn Minh (Bạn)'].includes(c.assignedStaffName || '')
        );
        if (cleanList.length !== parsed.length) {
          localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(cleanList));
        }
        return cleanList;
      }
    } catch {}
    return INITIAL_KANBAN_CANDIDATES;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | ChannelType>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductCandidate, setEditingProductCandidate] = useState<KanbanCandidate | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Lưu lại danh sách mỗi khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(candidates));
    } catch {}
  }, [candidates]);

  // Lắng nghe sự kiện cập nhật Kanban từ Realtime SSE
  useEffect(() => {
    const unsubscribe = onPipelineChange((event) => {
      const matchedStage = config.pipelineStages.find(
        (s) =>
          s.id === event.newStage ||
          s.id === `STAGE_${event.newStage}` ||
          s.id.replace('STAGE_', '') === event.newStage ||
          s.name.toLowerCase() === String(event.newStage).toLowerCase()
      );
      const stageToSet = matchedStage ? (matchedStage.id as LeadStage) : (event.newStage as LeadStage);

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === event.customerId || c.fullName === event.customerName || (event.customerId && c.conversationId?.includes(event.customerId))
            ? { ...c, stage: stageToSet }
            : c
        )
      );
      notify.info(
        `${event.updatedBy} đã chuyển ${config.terminology.entityName.toLowerCase()} "${event.customerName}" sang giai đoạn "${matchedStage?.name || event.newStage}".`,
        'Đồng bộ Phễu Realtime'
      );
    });
    return unsubscribe;
  }, [onPipelineChange, config.pipelineStages, config.terminology.entityName]);

  // Lắng nghe sự kiện cập nhật trạng thái Lead nội bộ từ Inbox
  useEffect(() => {
    const handleLeadUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ customerId?: string; fullName?: string; conversationId?: string; leadStage?: LeadStage }>;
      if (!customEvent.detail) return;
      const { customerId, fullName, conversationId, leadStage } = customEvent.detail;
      if (!leadStage) return;

      const matchedStage = config.pipelineStages.find(
        (s) =>
          s.id === leadStage ||
          s.id === `STAGE_${leadStage}` ||
          s.id.replace('STAGE_', '') === leadStage ||
          s.name.toLowerCase() === String(leadStage).toLowerCase()
      );
      const targetStage = matchedStage ? (matchedStage.id as LeadStage) : leadStage;

      setCandidates((prev) =>
        prev.map((c) =>
          (customerId && c.id === customerId) ||
          (conversationId && c.conversationId === conversationId) ||
          (fullName && c.fullName === fullName)
            ? { ...c, stage: targetStage }
            : c
        )
      );
    };
    window.addEventListener('crm:lead-updated', handleLeadUpdated);
    return () => window.removeEventListener('crm:lead-updated', handleLeadUpdated);
  }, [config.pipelineStages]);

  // Tự động tải danh sách khách hàng từ CSDL vào Phễu Kanban
  useEffect(() => {
    let isMounted = true;
    const loadDbCustomers = async () => {
      try {
        const data = await apiClient.getCustomers();
        if (!isMounted || !data?.items || data.items.length === 0) return;

        const firstStageId = config.pipelineStages[0]?.id || 'STAGE_NEW';

        setCandidates((prev) => {
          let updated = [...prev];
          for (const cust of data.items) {
            const latestConv = cust.conversations?.[0];
            const existingIdx = updated.findIndex(
              (c) => c.id === cust.id || (latestConv?.id && c.conversationId === latestConv.id) || c.fullName === cust.fullName
            );
            const dbStage = cust.leadStage || cust.channelIdentities?.leadStage;
            const matchedConfig = config.pipelineStages.find(
              (s) =>
                s.id === dbStage ||
                s.id === `STAGE_${dbStage}` ||
                s.id.replace('STAGE_', '') === dbStage ||
                s.name.toLowerCase() === String(dbStage).toLowerCase()
            );

            if (existingIdx >= 0) {
              const existing = updated[existingIdx];
              const resolvedStage = matchedConfig ? (matchedConfig.id as LeadStage) : ((dbStage as LeadStage) || existing.stage);
              // Cập nhật lại các mục đã gán từ DB nếu có thay đổi
              const shouldUpdateTuition =
                cust.interestCourses &&
                cust.interestCourses.length > 0 &&
                (!existing.interestCourses || existing.interestCourses.length === 0 || existing.estimatedTuition === 0);

              updated[existingIdx] = {
                ...existing,
                stage: resolvedStage,
                interestCourses: shouldUpdateTuition ? (cust.interestCourses || []) : existing.interestCourses,
                estimatedTuition: shouldUpdateTuition ? (cust.estimatedValue || existing.estimatedTuition) : existing.estimatedTuition,
              };
            } else {
              const resolvedStage = matchedConfig ? (matchedConfig.id as LeadStage) : ((dbStage as LeadStage) || (firstStageId as LeadStage));
              const avatar = cust.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(cust.fullName)}&background=0284c7&color=fff&bold=true`;
              const chType = (latestConv?.channelAccount?.channel as ChannelType) || 'FACEBOOK';
              const chName = latestConv?.channelAccount?.displayName || `Kênh ${chType}`;
              const timeStr = latestConv?.lastMessageAt ? new Date(latestConv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong';

              updated.unshift({
                id: cust.id,
                fullName: cust.fullName,
                phone: cust.phone || 'Chưa có SĐT',
                email: cust.email || 'Chưa có Email',
                avatarUrl: avatar,
                channel: chType,
                channelAccountName: chName,
                stage: resolvedStage || (firstStageId as LeadStage),
                estimatedTuition: cust.estimatedValue || 0,
                priority: 'MEDIUM',
                interestCourses: cust.interestCourses || [],
                lastActivityAt: timeStr,
                notesCount: 0,
                tags: Array.isArray(cust.tags) && cust.tags.length > 0
                  ? cust.tags.map((t: string) => t.trim().toLowerCase() === 'facebook lead' ? 'Lead' : t)
                  : ['Khách hàng DB', 'Lead'],
                conversationId: latestConv?.id,
              });
            }
          }
          return updated;
        });
      } catch {
        // Backend có thể chưa khởi động
      }
    };

    loadDbCustomers();
    return () => { isMounted = false; };
  }, [config.pipelineStages]);

  // Lắng nghe tin nhắn mới để tự động đổ khách hàng vào phễu Kanban theo thời gian thực
  useEffect(() => {
    const unsubscribe = onNewMessage((msg) => {
      if (msg.direction === 'INBOUND') {
        const firstStageId = config.pipelineStages[0]?.id || 'STAGE_NEW';
        setCandidates((prev) => {
          const exists = prev.some(
            (c) => (msg.conversationId && c.conversationId === msg.conversationId) || c.fullName === msg.senderName
          );
          if (exists) {
            return prev.map((c) =>
              (msg.conversationId && c.conversationId === msg.conversationId) || c.fullName === msg.senderName
                ? { ...c, lastActivityAt: 'Vừa xong' }
                : c
            );
          }

          const newAvatar = msg.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'Lead')}&background=0284c7&color=fff&bold=true`;
          const newCand: KanbanCandidate = {
            id: `cand-${Date.now()}`,
            fullName: msg.senderName || 'Khách hàng mới',
            phone: msg.customerPhone || 'Chưa có SĐT',
            email: msg.customerEmail || 'Chưa có Email',
            avatarUrl: newAvatar,
            channel: (msg.channel as ChannelType) || 'FACEBOOK',
            channelAccountName: `Kênh ${msg.channel || 'Facebook'}`,
            stage: firstStageId as LeadStage,
            estimatedTuition: 0,
            priority: 'MEDIUM',
            interestCourses: [],
            lastActivityAt: 'Vừa xong',
            notesCount: 0,
            tags: ['Lead Mới', 'Facebook'],
            conversationId: msg.conversationId,
          };

          notify.info(
            `Ứng viên mới "${newCand.fullName}" từ Facebook đã tự động được thêm vào Phễu!`,
            'Tự động đổ phễu'
          );

          return [newCand, ...prev];
        });
      }
    });

    return unsubscribe;
  }, [onNewMessage, config.pipelineStages]);

  


  // Gán / Cập nhật Khóa học / Dự án BĐS / Gói dịch vụ từ catalog cho Ứng viên trên Kanban
  const handleSaveCandidateProducts = (courses: string[], tuition: number) => {
    if (!editingProductCandidate) return;
    const candId = editingProductCandidate.id;
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candId
          ? {
              ...c,
              interestCourses: courses,
              estimatedTuition: tuition,
            }
          : c
      )
    );

    // Đồng bộ sang danh sách hội thoại Inbox trong LocalStorage
    try {
      const inboxRaw = localStorage.getItem('crm_inbox_conversations_v1');
      if (inboxRaw) {
        const convList = JSON.parse(inboxRaw);
        if (Array.isArray(convList)) {
          const updatedInbox = convList.map((conv: any) => {
            if (
              conv.id === editingProductCandidate.conversationId ||
              conv.customer?.id === editingProductCandidate.id ||
              conv.customer?.fullName === editingProductCandidate.fullName
            ) {
              return {
                ...conv,
                customer: {
                  ...conv.customer,
                  interestCourses: courses,
                  estimatedValue: tuition,
                },
              };
            }
            return conv;
          });
          localStorage.setItem('crm_inbox_conversations_v1', JSON.stringify(updatedInbox));
        }
      }
    } catch {}

    // Lưu vào Backend Database Customer
    if (editingProductCandidate.id) {
      apiClient.updateCustomer(editingProductCandidate.id, {
        interestCourses: courses,
        estimatedValue: tuition,
      }).catch(() => {});
    }

    notify.success(
      `Đã gán ${config.terminology.productLabel.toLowerCase()} cho "${editingProductCandidate.fullName}".`,
      'Cập nhật thành công'
    );
  };

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
      (s) => s.id === nextStage || s.id === `STAGE_${nextStage}` || s.id.replace('STAGE_', '') === nextStage
    );
    const stageIdx = config.pipelineStages.findIndex(
      (s) => s.id === nextStage || s.id === `STAGE_${nextStage}` || s.id.replace('STAGE_', '') === nextStage
    );
    const isFirstStage = stageIdx === 0 || targetStageConfig?.order === 1;

    let computedStatus: 'NEW' | 'POTENTIAL' | 'CONVERTED' | 'UNQUALIFIED' = 'POTENTIAL';
    if (targetStageConfig?.isWon) {
      computedStatus = 'CONVERTED';
    } else if (targetStageConfig?.isLost) {
      computedStatus = 'UNQUALIFIED';
    } else if (isFirstStage || nextStage === 'STAGE_NEW' || nextStage === 'NEW') {
      computedStatus = 'NEW';
    } else {
      const upper = String(nextStage).toUpperCase();
      if (upper.includes('ENROLLED') || upper.includes('WON') || upper.includes('CONVERTED')) {
        computedStatus = 'CONVERTED';
      } else if (upper.includes('LOST') || upper.includes('UNQUALIFIED')) {
        computedStatus = 'UNQUALIFIED';
      } else {
        computedStatus = 'POTENTIAL';
      }
    }

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

    // Đồng bộ sang hội thoại Inbox trong LocalStorage
    try {
      const inboxRaw = localStorage.getItem('crm_inbox_conversations_v1');
      if (inboxRaw) {
        const convList = JSON.parse(inboxRaw);
        if (Array.isArray(convList)) {
          const updatedInbox = convList.map((conv: any) => {
            if (
              conv.id === candidate.conversationId ||
              conv.customer?.id === candidate.id ||
              conv.customer?.fullName === candidate.fullName
            ) {
              return {
                ...conv,
                customer: {
                  ...conv.customer,
                  leadStage: nextStage,
                  leadStatus: computedStatus,
                },
              };
            }
            return conv;
          });
          localStorage.setItem('crm_inbox_conversations_v1', JSON.stringify(updatedInbox));
        }
      }
    } catch {}

    // Gọi API cập nhật vào Database Customer
    if (candidate.id) {
      apiClient.updateCustomer(candidate.id, {
        fullName: candidate.fullName,
        phone: candidate.phone,
        email: candidate.email,
        leadStage: nextStage,
        leadStatus: computedStatus,
        updatedBy: staffId ? 'Tư vấn viên' : 'Hệ thống CRM',
      }).catch((err) => {
        console.warn('Could not update customer in DB from Kanban:', err);
      });
    }

    // Phát sự kiện đồng bộ toàn cục cho Inbox nếu đang mở
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('crm:lead-updated', {
          detail: {
            customerId: candidate.id,
            fullName: candidate.fullName,
            conversationId: candidate.conversationId,
            leadStage: nextStage,
            leadStatus: computedStatus,
          },
        })
      );
    }

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
    if (!candidateStage || !stageConfigId) return false;
    if (candidateStage === stageConfigId) return true;
    if (`STAGE_${candidateStage}` === stageConfigId) return true;
    if (stageConfigId.replace('STAGE_', '') === candidateStage) return true;
    if (candidateStage.toLowerCase() === stageConfigId.toLowerCase()) return true;
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
            {Object.values(staffPresences).map((staff) => (
              <option key={staff.staffId} value={staff.staffId}>
                {staff.name}
              </option>
            ))}
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
                          <Avatar
                            src={candidate.avatarUrl}
                            name={candidate.fullName}
                            size={36}
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

                        {/* Sản phẩm / Khóa học & Giá trị theo cấu hình Domain */}
                        {candidate.interestCourses && candidate.interestCourses.length > 0 ? (
                          <div
                            className="card-course-pill"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProductCandidate(candidate);
                            }}
                            title={`Nhấp để gán lại hoặc chỉnh sửa ${config.terminology.productLabel.toLowerCase()}`}
                            style={{
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                              background: '#f0f9ff',
                              borderColor: '#bae6fd',
                              color: '#0369a1',
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {candidate.interestCourses.join(', ')}
                            </span>
                            <Edit2 size={11} color="#0284c7" style={{ flexShrink: 0 }} />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProductCandidate(candidate);
                            }}
                            title={`Gán ${config.terminology.productLabel.toLowerCase()} cho ứng viên này`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#0284c7',
                              background: '#f8fafc',
                              border: '1px dashed #cbd5e1',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              width: '100%',
                              fontWeight: 500,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Plus size={12} />
                            <span>+ Gán {config.terminology.productLabel.split('/')[0].trim()}</span>
                          </button>
                        )}

                        <div
                          className="card-tuition-row"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProductCandidate(candidate);
                          }}
                          title={`Nhấp để điều chỉnh ${config.terminology.valueLabel.toLowerCase()}`}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="tuition-label">{config.terminology.valueLabel}:</span>
                          <span className="tuition-amount" style={{ color: '#059669', fontWeight: 600 }}>
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

      {/* Modal Gán Khóa học / Dự án BĐS / Gói dịch vụ từ catalog cho Ứng viên */}
      {editingProductCandidate && (
        <AssignProductModal
          isOpen={!!editingProductCandidate}
          onClose={() => setEditingProductCandidate(null)}
          customerName={editingProductCandidate.fullName}
          productLabel={config.terminology.productLabel}
          valueLabel={config.terminology.valueLabel}
          catalog={config.productCatalog}
          initialSelected={editingProductCandidate.interestCourses || []}
          initialValue={editingProductCandidate.estimatedTuition || 0}
          onSave={handleSaveCandidateProducts}
        />
      )}
    </div>
  );
};
