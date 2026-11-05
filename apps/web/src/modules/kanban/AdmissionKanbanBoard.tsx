import React, { useState, useEffect } from 'react';
import type { LeadStage, ChannelType } from '../inbox/types.js';
import type { KanbanCandidate } from './kanban.types.js';
import { INITIAL_KANBAN_CANDIDATES } from './kanban.config.js';
import { NewCandidateModal } from './NewCandidateModal.js';
import { useRealtime } from '../realtime/RealtimeContext.js';
import { useUserRole } from '../auth/UserRoleContext.js';
import { useWorkspaceConfig } from '../workspace/WorkspaceConfigContext.js';
import { SearchInput } from '../../components/ui/SearchInput.js';
import { matchesSmartSearch } from '../../lib/unaccent.js';
import { notify } from '../../components/feedback/toastEmitter.js';
import { apiClient } from '../../lib/api-client/index.js';
import { Avatar } from '../../components/common/Avatar.js';
import { AssignProductModal } from '../../components/common/AssignProductModal.js';
import {
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
  Filter,
  Layers,
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
  const { config, activeWorkspaceId, activeWorkspace } = useWorkspaceConfig();

  const [candidates, setCandidates] = useState<KanbanCandidate[]>(INITIAL_KANBAN_CANDIDATES);

  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | ChannelType>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductCandidate, setEditingProductCandidate] = useState<KanbanCandidate | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Đã loại bỏ lưu localStorage - CSDL PostgreSQL là Nguồn Chân Lý duy nhất

  // Lắng nghe sự kiện cập nhật Kanban từ Realtime WebSocket
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

      setCandidates((prev) => {
        let found = false;
        const updated = prev.map((c) => {
          if (
            c.id === event.customerId ||
            c.fullName === event.customerName ||
            (event.customerId && c.conversationId?.includes(event.customerId))
          ) {
            found = true;
            return {
              ...c,
              stage: stageToSet,
              phone: event.phone && event.phone !== 'Chưa có SĐT' ? event.phone : c.phone,
              email: event.email && event.email !== 'Chưa có Email' ? event.email : c.email,
              avatarUrl: event.avatarUrl || c.avatarUrl,
              estimatedTuition: event.estimatedValue !== undefined ? event.estimatedValue : c.estimatedTuition,
              interestCourses: event.interestCourses || c.interestCourses,
              tags: event.tags || c.tags,
            };
          }
          return c;
        });

        if (!found && event.customerName) {
          // Khách hàng vừa được phân loại ở Inbox -> Đổ ngay vào Kanban
          const firstStageId = config.pipelineStages[0]?.id || 'STAGE_NEW';
          const avatar = event.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(event.customerName)}&background=0284c7&color=fff&bold=true`;
          updated.unshift({
            id: event.customerId || `cand-${Date.now()}`,
            fullName: event.customerName,
            phone: event.phone || 'Chưa có SĐT',
            email: event.email || 'Chưa có Email',
            avatarUrl: avatar,
            channel: (event.channel as ChannelType) || 'ZALO',
            channelAccountName: event.channelAccountName || 'Kênh trực tuyến',
            stage: stageToSet || (firstStageId as LeadStage),
            estimatedTuition: event.estimatedValue || 0,
            priority: 'MEDIUM',
            interestCourses: event.interestCourses || [],
            lastActivityAt: 'Vừa xong',
            notesCount: 0,
            tags: event.tags || ['Lead'],
            conversationId: event.conversationId,
          });
        }
        return updated;
      });

      notify.info(
        `${event.updatedBy || 'Tư vấn viên'} đã chuyển "${event.customerName}" sang giai đoạn "${matchedStage?.name || event.newStage}".`,
        'Đồng bộ Phễu Realtime'
      );
    });
    return unsubscribe;
  }, [onPipelineChange, config.pipelineStages, config.terminology.entityName]);

  // Lắng nghe sự kiện cập nhật trạng thái Lead nội bộ từ Inbox
  useEffect(() => {
    const handleLeadUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{
        customerId?: string;
        fullName?: string;
        conversationId?: string;
        leadStage?: LeadStage;
        phone?: string;
        email?: string;
        avatarUrl?: string;
        channel?: ChannelType;
        channelAccountName?: string;
        estimatedTuition?: number;
        interestCourses?: string[];
        tags?: string[];
      }>;
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

      setCandidates((prev) => {
        let found = false;
        const updated = prev.map((c) => {
          if (
            (customerId && c.id === customerId) ||
            (conversationId && c.conversationId === conversationId) ||
            (fullName && c.fullName === fullName)
          ) {
            found = true;
            return {
              ...c,
              stage: targetStage,
              phone: customEvent.detail.phone || c.phone,
              email: customEvent.detail.email || c.email,
              avatarUrl: customEvent.detail.avatarUrl || c.avatarUrl,
              estimatedTuition: customEvent.detail.estimatedTuition !== undefined ? customEvent.detail.estimatedTuition : c.estimatedTuition,
              interestCourses: customEvent.detail.interestCourses || c.interestCourses,
              tags: customEvent.detail.tags || c.tags,
            };
          }
          return c;
        });

        if (!found && fullName) {
          // Khách hàng vừa được phân loại ở Inbox -> Đổ ngay vào Kanban
          const firstStageId = config.pipelineStages[0]?.id || 'STAGE_NEW';
          updated.unshift({
            id: customerId || `cand-${Date.now()}`,
            fullName: fullName,
            phone: customEvent.detail.phone || 'Chưa có SĐT',
            email: customEvent.detail.email || 'Chưa có Email',
            avatarUrl: customEvent.detail.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0284c7&color=fff&bold=true`,
            channel: customEvent.detail.channel || 'ZALO',
            channelAccountName: customEvent.detail.channelAccountName || 'Kênh trực tuyến',
            stage: targetStage || (firstStageId as LeadStage),
            estimatedTuition: customEvent.detail.estimatedTuition || 0,
            priority: 'MEDIUM',
            interestCourses: customEvent.detail.interestCourses || [],
            lastActivityAt: 'Vừa xong',
            notesCount: 0,
            tags: customEvent.detail.tags || ['Lead'],
            conversationId: conversationId,
          });
        }
        return updated;
      });
    };
    window.addEventListener('crm:lead-updated', handleLeadUpdated);
    return () => window.removeEventListener('crm:lead-updated', handleLeadUpdated);
  }, [config.pipelineStages]);

  // Tự động tải danh sách khách hàng từ CSDL vào Phễu Kanban (Nguồn chân lý chuẩn xác)
  useEffect(() => {
    let isMounted = true;
    const loadDbCustomers = async () => {
      try {
        const data = await apiClient.getCustomers({ workspaceId: activeWorkspaceId || undefined });
        if (!isMounted) return;
        if (!data || !Array.isArray(data.items)) return;

        const firstStageId = config.pipelineStages[0]?.id || 'STAGE_NEW';

        setCandidates((prev) => {
          // Ánh xạ toàn bộ khách hàng từ DB - Đảm bảo số lượng và thông tin khớp tuyệt đối với DB
          return data.items.map((cust: any) => {
            const latestConv = cust.conversations?.[0];
            const identities = (cust.channelIdentities as any) || {};
            const existing = prev.find(
              (c) => c.id === cust.id || (latestConv?.id && c.conversationId === latestConv.id) || c.fullName === cust.fullName
            );
            const dbStage = cust.leadStage || identities.leadStage;
            const matchedConfig = config.pipelineStages.find(
              (s) =>
                s.id === dbStage ||
                s.id === `STAGE_${dbStage}` ||
                s.id.replace('STAGE_', '') === dbStage ||
                s.name.toLowerCase() === String(dbStage).toLowerCase()
            );
            const resolvedStage = matchedConfig ? (matchedConfig.id as LeadStage) : ((dbStage as LeadStage) || existing?.stage || (firstStageId as LeadStage));
            const avatar = cust.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(cust.fullName)}&background=0284c7&color=fff&bold=true`;
            const chType = (latestConv?.channelAccount?.channel as ChannelType) || (identities.channel as ChannelType) || 'ZALO';
            const chName = latestConv?.channelAccount?.displayName || `Kênh ${chType}`;
            const timeStr = latestConv?.lastMessageAt
              ? new Date(latestConv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : (existing?.lastActivityAt || 'Vừa xong');

            return {
              id: cust.id,
              fullName: cust.fullName,
              phone: cust.phone || existing?.phone || 'Chưa có SĐT',
              email: cust.email || existing?.email || 'Chưa có Email',
              avatarUrl: avatar,
              channel: chType,
              channelAccountName: chName,
              stage: resolvedStage,
              estimatedTuition: cust.estimatedValue !== undefined ? cust.estimatedValue : (existing?.estimatedTuition || 0),
              priority: existing?.priority || 'MEDIUM',
              interestCourses: (cust.interestCourses && cust.interestCourses.length > 0) ? cust.interestCourses : (existing?.interestCourses || []),
              lastActivityAt: timeStr,
              notesCount: existing?.notesCount || 0,
              tags: Array.isArray(cust.tags) && cust.tags.length > 0
                ? cust.tags.map((t: string) => t.trim().toLowerCase() === 'facebook lead' ? 'Lead' : t)
                : (existing?.tags || ['Lead']),
              conversationId: latestConv?.id || existing?.conversationId,
            };
          });
        });
      } catch {
        // Backend có thể chưa khởi động
      }
    };

    loadDbCustomers();
    return () => { isMounted = false; };
  }, [config.pipelineStages, activeWorkspaceId]);

  // Lắng nghe tin nhắn mới để tự động đổ khách hàng vào phễu Kanban theo thời gian thực
  useEffect(() => {
    const unsubscribe = onNewMessage((msg) => {
      if (msg.direction === 'INBOUND') {
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
          return prev;
        });

        // Tự động kéo từ DB nếu đây là khách hàng mới để đảm bảo dữ liệu chuẩn xác
        apiClient.getCustomers({ workspaceId: activeWorkspaceId || undefined }).then((data) => {
          if (!data?.items) return;
          const firstStageId = config.pipelineStages[0]?.id || 'STAGE_NEW';
          setCandidates((prev) => {
            return data.items.map((cust: any) => {
              const latestConv = cust.conversations?.[0];
              const identities = (cust.channelIdentities as any) || {};
              const existing = prev.find((c) => c.id === cust.id || c.fullName === cust.fullName);
              const dbStage = cust.leadStage || identities.leadStage;
              const matchedConfig = config.pipelineStages.find(
                (s) =>
                  s.id === dbStage ||
                  s.id === `STAGE_${dbStage}` ||
                  s.id.replace('STAGE_', '') === dbStage ||
                  s.name.toLowerCase() === String(dbStage).toLowerCase()
              );
              const resolvedStage = matchedConfig ? (matchedConfig.id as LeadStage) : ((dbStage as LeadStage) || existing?.stage || (firstStageId as LeadStage));
              const avatar = cust.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(cust.fullName)}&background=0284c7&color=fff&bold=true`;
              const chType = (latestConv?.channelAccount?.channel as ChannelType) || (identities.channel as ChannelType) || 'ZALO';
              const chName = latestConv?.channelAccount?.displayName || `Kênh ${chType}`;
              const timeStr = latestConv?.lastMessageAt ? new Date(latestConv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong';

              return {
                id: cust.id,
                fullName: cust.fullName,
                phone: cust.phone || existing?.phone || 'Chưa có SĐT',
                email: cust.email || existing?.email || 'Chưa có Email',
                avatarUrl: avatar,
                channel: chType,
                channelAccountName: chName,
                stage: resolvedStage,
                estimatedTuition: cust.estimatedValue !== undefined ? cust.estimatedValue : (existing?.estimatedTuition || 0),
                priority: existing?.priority || 'MEDIUM',
                interestCourses: (cust.interestCourses && cust.interestCourses.length > 0) ? cust.interestCourses : (existing?.interestCourses || []),
                lastActivityAt: timeStr,
                notesCount: existing?.notesCount || 0,
                tags: Array.isArray(cust.tags) && cust.tags.length > 0
                  ? cust.tags.map((t: string) => t.trim().toLowerCase() === 'facebook lead' ? 'Lead' : t)
                  : (existing?.tags || ['Lead']),
                conversationId: latestConv?.id || existing?.conversationId,
              };
            });
          });
        }).catch(() => { });
      }
    });

    return unsubscribe;
  }, [onNewMessage, config.pipelineStages, activeWorkspaceId]);




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

    // Đồng bộ sự kiện bộ nhớ nội bộ thay vì localStorage

    // Lưu vào Backend Database Customer
    if (editingProductCandidate.id) {
      apiClient.updateCustomer(editingProductCandidate.id, {
        interestCourses: courses,
        estimatedValue: tuition,
      }).catch(() => { });
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

    // Role STAFF chỉ được chỉnh sửa trạng thái khách hàng mà mình phụ trách
    if (!isOwner && staffId && candidate.assignedStaffId && candidate.assignedStaffId !== staffId) {
      notify.error('Bạn chỉ có quyền chỉnh sửa trạng thái khách hàng mà mình phụ trách (403 Forbidden).', 'Không có quyền');
      return;
    }

    const targetStageConfig = config.pipelineStages.find(
      (s) => s.id === nextStage || s.id === `STAGE_${nextStage}` || s.id.replace('STAGE_', '') === nextStage
    );
    const stageIdx = config.pipelineStages.findIndex(
      (s) => s.id === nextStage || s.id === `STAGE_${nextStage}` || s.id.replace('STAGE_', '') === nextStage
    );
    const isFirstStage = stageIdx === 0 || targetStageConfig?.order === 1;

    let computedStatus: 'NEW' | 'POTENTIAL' | 'CONVERTED' | 'UNQUALIFIED';
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

    // Đồng bộ sự kiện bộ nhớ nội bộ thay vì localStorage

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
    // Role STAFF chỉ xem khách hàng mà mình phụ trách (OWNER xem toàn bộ)
    if (!isOwner && staffId && item.assignedStaffId && item.assignedStaffId !== staffId) return false;
    if (staffFilter !== 'ALL' && item.assignedStaffId !== staffFilter) return false;
    if (courseFilter !== 'ALL' && !item.interestCourses.some((c) => c.includes(courseFilter))) return false;

    if (searchQuery.trim()) {
      const isMatched = matchesSmartSearch(
        {
          fullName: item.fullName,
          phone: item.phone,
          email: item.email,
          interestCourses: item.interestCourses,
        },
        searchQuery
      );
      if (!isMatched) return false;
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

  const pageTitle = React.useMemo(() => {
    const wsName = activeWorkspace?.name || config.workspaceName || '';
    const rawPipeline = config.terminology?.pipelineName || 'Phễu Tuyển Sinh & Đào Tạo';
    const pipelineName = rawPipeline.startsWith('Phễu')
      ? rawPipeline
      : `Phễu ${rawPipeline}`;

    if (wsName) {
      if (pipelineName.toLowerCase().includes(wsName.toLowerCase())) {
        return pipelineName;
      }
      return `${pipelineName} - ${wsName}`;
    }

    return pipelineName;
  }, [activeWorkspace?.name, config.workspaceName, config.terminology?.pipelineName]);

  return (
    <div className="kanban-pipeline-wrapper">
      {/* 0. HEADER TIÊU ĐỀ TRANG - Flat section chuẩn SaaS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý và chuyển đổi {config.terminology.entityName.toLowerCase()} theo các giai đoạn quy trình
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Dữ liệu thời gian thực</span>
        </div>
      </div>

      {/* 1. THANH CHỈ SỐ KPI TỔNG QUAN - Đồng bộ MetricCardsGrid chuẩn hệ thống */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
        {/* Card 1: Tổng khách hàng */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <span className="text-xs font-medium text-slate-500 truncate" title={`Tổng ${config.terminology.entityName}`}>
              Tổng {config.terminology.entityName.split('/')[0].trim()}
            </span>
            <div className="w-7 h-7 rounded-lg border border-slate-200/80 bg-slate-50/80 flex items-center justify-center shrink-0">
              <Users size={16} className="text-blue-600" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {totalLeads}
          </div>
        </div>

        {/* Card 2: Tiếp nhận mới */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <span className="text-xs font-medium text-slate-500 truncate" title={firstStage?.name || 'Tiếp nhận Mới'}>
              {firstStage?.name || 'Tiếp nhận Mới'}
            </span>
            <div className="w-7 h-7 rounded-lg border border-slate-200/80 bg-slate-50/80 flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-sky-600" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-sky-600 tracking-tight">
            {newLeadCount}
          </div>
        </div>

        {/* Card 3: Giá trị phễu dự kiến */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <span className="text-xs font-medium text-slate-500 truncate" title={isOwner ? `${config.terminology.valueLabel} (Toàn DN)` : `${config.terminology.valueLabel} (Bạn chăm sóc)`}>
              {isOwner
                ? `${config.terminology.valueLabel.replace(/\s*\(VNĐ\)/gi, '').trim()} (Toàn DN)`
                : `${config.terminology.valueLabel.replace(/\s*\(VNĐ\)/gi, '').trim()} (Bạn chăm sóc)`}
            </span>
            <div className="w-7 h-7 rounded-lg border border-slate-200/80 bg-slate-50/80 flex items-center justify-center shrink-0">
              <DollarSign size={16} className="text-amber-600" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(isOwner ? totalTuition : myTuition)}
            </span>
            {isAgent && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md"
                title="Theo chính sách bảo mật RBAC, tổng doanh số toàn doanh nghiệp chỉ hiển thị cho Chủ doanh nghiệp."
              >
                <Lock size={10} />
                <span>Ẩn tổng trường</span>
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Chốt thành công */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <span className="text-xs font-medium text-slate-500 truncate">
              Chốt thành công
            </span>
            <div className="w-7 h-7 rounded-lg border border-slate-200/80 bg-slate-50/80 flex items-center justify-center shrink-0">
              <Award size={16} className="text-emerald-600" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg sm:text-xl font-bold text-emerald-600 tracking-tight">
              {wonCount}
            </span>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
              Tỷ lệ chốt: {conversionRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. THANH CÔNG CỤ TÌM KIẾM & BỘ LỌC - Flat section */}
      <div className="kanban-toolbar">
        <div className="toolbar-left-group">
          {/* Ô tìm kiếm */}
          <div className="kanban-search-box" style={{ padding: '0', background: 'transparent', border: 'none' }}>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Tìm theo tên (không dấu), SĐT, email..."
              size="sm"
              className="w-full min-w-[260px]"
            />
          </div>

          {/* Lọc Kênh */}
          <div className="relative inline-flex items-center">
            <Filter size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <select
              className="kanban-filter-select pl-7"
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
          </div>

          {/* Lọc Nhân viên */}
          <div className="relative inline-flex items-center">
            <Users size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <select
              className="kanban-filter-select pl-7"
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
          </div>

          {/* Lọc Sản phẩm / Khóa học theo catalog của workspace */}
          <div className="relative inline-flex items-center">
            <Layers size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <select
              className="kanban-filter-select pl-7"
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
        </div>

        <div className="toolbar-right-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Nút tùy biến Phễu cho Owner */}
          {onNavigateToSettings && isOwner && (
            <button
              type="button"
              className="kanban-config-btn"
              onClick={onNavigateToSettings}
              title="Tùy biến các giai đoạn phễu và danh mục sản phẩm cho Workspace"
            >
              <Sliders size={13} />
              <span>Cấu hình Phễu</span>
            </button>
          )}

          <button
            type="button"
            className="kanban-add-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <UserPlus size={14} />
            <span>Thêm {config.terminology.entityName.split('/')[0].trim()}</span>
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
