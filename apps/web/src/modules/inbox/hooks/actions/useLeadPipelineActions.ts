import React from 'react';
import {
  LEAD_STATUS,
  PIPELINE_STAGE_ID,
  type ConversationItem,
  type LeadStatus,
  type LeadStage,
} from '../../types.js';
import { resolveLeadStatusFromStage } from '../../utils/conversationUtils.js';
import { apiClient } from '../../../../lib/api-client.js';
import { notify } from '../../../../components/feedback/toastEmitter.js';

interface UseLeadPipelineActionsProps {
  currentConv?: ConversationItem;
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>;
  staffName?: string | null;
  config: { pipelineStages: any[] };
  activeWorkspaceId?: string | null;
}

export const useLeadPipelineActions = ({
  currentConv,
  setConversations,
  staffName,
  config,
  activeWorkspaceId,
}: UseLeadPipelineActionsProps) => {
  // 1. Cập nhật Lead Status (CRM)
  const handleUpdateLeadStatus = (status: LeadStatus) => {
    if (!currentConv) return;

    let stageForKanban: LeadStage =
      currentConv.customer.leadStage || (config.pipelineStages[0]?.id as LeadStage) || PIPELINE_STAGE_ID.STAGE_NEW;

    if (!currentConv.customer.leadStage) {
      if (status === LEAD_STATUS.CONVERTED) {
        stageForKanban = (config.pipelineStages.find((s) => s.isWon)?.id as LeadStage) || PIPELINE_STAGE_ID.STAGE_ENROLLED;
      } else if (status === LEAD_STATUS.POTENTIAL) {
        stageForKanban = (config.pipelineStages[0]?.id as LeadStage) || PIPELINE_STAGE_ID.STAGE_NEW;
      } else if (status === LEAD_STATUS.UNQUALIFIED) {
        stageForKanban = (config.pipelineStages.find((s) => s.isLost)?.id as LeadStage) || PIPELINE_STAGE_ID.STAGE_LOST;
      }
    }

    const currentTags = Array.from(new Set([
      ...(currentConv.customer?.tags || []),
      ...(currentConv.tags || []),
    ]));
    let nextTags = [...currentTags];
    if (status === LEAD_STATUS.POTENTIAL) {
      if (!nextTags.some((t) => t.trim().toLowerCase() === 'lead')) {
        nextTags.push('Lead');
      }
    } else if (status === LEAD_STATUS.NEW) {
      nextTags = nextTags.filter((t) => {
        const l = t.trim().toLowerCase();
        return l !== 'lead' && l !== 'facebook lead' && l !== 'fb lead';
      });
    }

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          tags: nextTags,
          customer: {
            ...c.customer,
            leadStatus: status,
            leadStage: stageForKanban,
            tags: nextTags,
          },
        };
      })
    );

    // Đồng bộ sang phễu Kanban trong LocalStorage để bên Kanban nhận ngay
    try {
      const kanbanRaw = localStorage.getItem('polarisx_crm_kanban_candidates') || localStorage.getItem('cusc_crm_kanban_candidates');
      if (kanbanRaw) {
        const kanbanList = JSON.parse(kanbanRaw);
        if (Array.isArray(kanbanList)) {
          const updatedKanban = kanbanList.map((cand: any) => {
            if (
              cand.conversationId === currentConv.id ||
              cand.id === currentConv.customer.id ||
              cand.fullName === currentConv.customer.fullName
            ) {
              return {
                ...cand,
                stage: stageForKanban,
                tags: nextTags,
              };
            }
            return cand;
          });
          localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(updatedKanban));
        }
      }
    } catch { }

    // Lưu vào Backend Database Customer qua API
    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        fullName: currentConv.customer.fullName,
        phone: currentConv.customer.phone && currentConv.customer.phone !== 'Chưa có SĐT' ? currentConv.customer.phone : undefined,
        email: currentConv.customer.email && currentConv.customer.email !== 'Chưa có Email' ? currentConv.customer.email : undefined,
        leadStatus: status,
        leadStage: stageForKanban,
        tags: nextTags,
        conversationId: currentConv.id,
        updatedBy: staffName || undefined,
      }, activeWorkspaceId || undefined)
        .then((res: any) => {
          if (res?.id && res.id !== currentConv.customer.id) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === currentConv.id
                  ? { ...c, customer: { ...c.customer, id: res.id } }
                  : c
              )
            );
          }
        })
        .catch((err: any) => {
          console.warn('Lỗi cập nhật leadStatus vào DB:', err);
        });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('crm:lead-updated', {
          detail: {
            customerId: currentConv.customer.id,
            fullName: currentConv.customer.fullName,
            conversationId: currentConv.id,
            leadStatus: status,
            leadStage: stageForKanban,
            tags: nextTags,
          },
        })
      );
    }

    notify.success(`Đã cập nhật trạng thái khách hàng sang "${status}".`);
  };

  // 2. Chuyển giai đoạn tuyển sinh Kanban
  const handleUpdateLeadStage = (stage: LeadStage) => {
    if (!currentConv) return;

    const targetStageConfig = config.pipelineStages.find(
      (s) =>
        s.id === stage ||
        s.id === `STAGE_${stage}` ||
        s.id.replace('STAGE_', '') === stage ||
        s.name.toLowerCase() === String(stage).toLowerCase()
    );
    const stageIdx = config.pipelineStages.findIndex(
      (s) =>
        s.id === stage ||
        s.id === `STAGE_${stage}` ||
        s.id.replace('STAGE_', '') === stage ||
        s.name.toLowerCase() === String(stage).toLowerCase()
    );
    const resolvedStageId = targetStageConfig ? (targetStageConfig.id as LeadStage) : stage;
    const isFirstStage = stageIdx === 0 || targetStageConfig?.order === 1;

    const hasLeadTag = Array.isArray(currentConv.customer.tags) && currentConv.customer.tags.some(
      (t) => t.trim().toLowerCase() === 'lead' || t.trim().toLowerCase() === 'facebook lead'
    );
    const isAlreadyPotential = currentConv.customer.leadStatus === LEAD_STATUS.POTENTIAL || hasLeadTag;

    // Sử dụng helper chuẩn hóa tập trung thay vì kiểm tra chuỗi rải rác
    const computedStatus = resolveLeadStatusFromStage(
      targetStageConfig,
      resolvedStageId,
      isFirstStage,
      isAlreadyPotential
    );

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: { ...c.customer, leadStage: resolvedStageId, leadStatus: computedStatus },
        };
      })
    );

    try {
      const kanbanRaw = localStorage.getItem('polarisx_crm_kanban_candidates') || localStorage.getItem('cusc_crm_kanban_candidates');
      const kanbanList = kanbanRaw ? JSON.parse(kanbanRaw) : [];
      let found = false;
      const updatedKanban = (Array.isArray(kanbanList) ? kanbanList : []).map((cand: any) => {
        if (
          cand.conversationId === currentConv.id ||
          cand.id === currentConv.customer.id ||
          cand.fullName === currentConv.customer.fullName
        ) {
          found = true;
          return {
            ...cand,
            stage: resolvedStageId,
          };
        }
        return cand;
      });

      if (!found) {
        updatedKanban.unshift({
          id: currentConv.customer.id,
          fullName: currentConv.customer.fullName,
          phone: currentConv.customer.phone && currentConv.customer.phone !== 'Chưa có SĐT' ? currentConv.customer.phone : 'Chưa có SĐT',
          email: currentConv.customer.email && currentConv.customer.email !== 'Chưa có Email' ? currentConv.customer.email : 'Chưa có Email',
          avatarUrl: currentConv.customer.avatarUrl,
          channel: currentConv.channel,
          channelAccountName: currentConv.channelAccountName,
          stage: resolvedStageId,
          estimatedTuition: currentConv.customer.estimatedValue || 0,
          priority: 'MEDIUM',
          interestCourses: currentConv.customer.interestCourses || [],
          lastActivityAt: 'Vừa xong',
          notesCount: 0,
          tags: currentConv.tags || currentConv.customer.tags || ['Lead'],
          conversationId: currentConv.id,
        });
      }
      localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(updatedKanban));
    } catch { }

    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        fullName: currentConv.customer.fullName,
        phone: currentConv.customer.phone && currentConv.customer.phone !== 'Chưa có SĐT' ? currentConv.customer.phone : undefined,
        email: currentConv.customer.email && currentConv.customer.email !== 'Chưa có Email' ? currentConv.customer.email : undefined,
        leadStage: resolvedStageId,
        leadStatus: computedStatus,
        conversationId: currentConv.id,
        updatedBy: staffName || undefined,
      }, activeWorkspaceId || undefined)
        .then((res: any) => {
          if (res?.id && res.id !== currentConv.customer.id) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === currentConv.id
                  ? { ...c, customer: { ...c.customer, id: res.id } }
                  : c
              )
            );
          }
        })
        .catch((err: any) => {
          console.warn('Lỗi cập nhật leadStage vào DB:', err);
        });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('crm:lead-updated', {
          detail: {
            customerId: currentConv.customer.id,
            fullName: currentConv.customer.fullName,
            conversationId: currentConv.id,
            leadStage: resolvedStageId,
            leadStatus: computedStatus,
            phone: currentConv.customer.phone,
            email: currentConv.customer.email,
            avatarUrl: currentConv.customer.avatarUrl,
            channel: currentConv.channel,
            channelAccountName: currentConv.channelAccountName,
            estimatedTuition: currentConv.customer.estimatedValue || 0,
            interestCourses: currentConv.customer.interestCourses || [],
            tags: currentConv.tags || currentConv.customer.tags || ['Lead'],
          },
        })
      );
    }

    notify.success(`Đã chuyển sang giai đoạn "${targetStageConfig?.name || resolvedStageId}".`);
  };

  return {
    handleUpdateLeadStatus,
    handleUpdateLeadStage,
  };
};
