import React from 'react';
import type {
  ConversationItem,
  ChatMessage,
  MessageAttachment,
  AssignedStaff,
  LeadStatus,
  LeadStage,
} from '../types.js';
import { deduplicateMessages } from '../utils/conversationUtils.js';
import { apiClient } from '../../../lib/api-client.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

interface UseInboxActionsProps {
  currentConv?: ConversationItem;
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>;
  staffName?: string | null;
  staffList: AssignedStaff[];
  config: { pipelineStages: any[] };
  activeWorkspaceId?: string | null;
}

export const useInboxActions = ({
  currentConv,
  setConversations,
  staffName,
  staffList,
  config,
  activeWorkspaceId,
}: UseInboxActionsProps) => {

  // 1. Gửi tin nhắn phản hồi (Outbound) qua Zalo OA API / Facebook Graph API
  const handleSendMessage = async (text: string, attachments?: MessageAttachment[]) => {
    if (!currentConv) return;

    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newMsg: ChatMessage = {
      id: tempId,
      conversationId: currentConv.id,
      direction: 'OUTBOUND' as const,
      content: text,
      sentAt: nowIso,
      senderName: staffName ? `${staffName} (Bạn)` : 'Bạn',
      status: 'SENT' as const,
      attachments,
    };

    // Cập nhật optimistic UI ngay lập tức
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          snippet: text || (attachments ? `[Đính kèm ${attachments.length} tệp]` : ''),
          lastMessageAt: nowIso,
          messages: deduplicateMessages([...c.messages, newMsg]),
        };
      }),
    );

    // Gửi thực tế qua API Outbound của kênh tương ứng (ZALO, FACEBOOK...)
    try {
      const identitiesObj = currentConv.customer.channelIdentities as any;
      const customerZaloId =
        identitiesObj?.zalo?.id ||
        (typeof identitiesObj?.zalo === 'string' ? identitiesObj.zalo : undefined) ||
        (Array.isArray(identitiesObj) ? identitiesObj.find((id: any) => id.channel === 'ZALO')?.externalUserId : undefined);
      const recipientId =
        (currentConv.channel === 'ZALO' && customerZaloId) ||
        (currentConv.customer.socialId && currentConv.customer.socialId !== 'khách' && !currentConv.customer.socialId.startsWith('cust-')
          ? currentConv.customer.socialId
          : '') ||
        currentConv.customer.id;

      const res = await apiClient.sendMessage({
        channel: currentConv.channel,
        recipientId,
        content: text,
        conversationId: currentConv.id,
      });

      // Cập nhật trạng thái tin nhắn thành DELIVERED và đồng bộ messageId
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConv.id) return c;

          const hasRealMsg = Boolean(
            res.messageId && c.messages.some((m) => m.id === res.messageId && m.id !== tempId)
          );

          let updatedMessages: ChatMessage[];
          if (hasRealMsg) {
            updatedMessages = c.messages.filter((m) => m.id !== tempId);
          } else {
            updatedMessages = c.messages.map((m) =>
              m.id === tempId ? { ...m, id: res.messageId || m.id, status: 'DELIVERED' as const } : m,
            );
          }

          return {
            ...c,
            messages: deduplicateMessages(updatedMessages),
          };
        }),
      );
    } catch (err) {
      notify.error(
        `Không thể gửi tin nhắn qua ${currentConv.channel}: ${(err as Error).message}`,
        'Lỗi gửi tin',
      );
    }
  };

  // 2. Phân công nhân sự
  const handleAssignStaff = (staffId: string) => {
    if (!currentConv) return;
    const staff = staffList.find((s) => s.id === staffId);
    setConversations((prev) =>
      prev.map((c) => (c.id === currentConv.id ? { ...c, assignedStaff: staff } : c))
    );
    notify.success(
      staff
        ? `Đã phân công ${staff.name} phụ trách cuộc hội thoại này.`
        : 'Đã hủy phân công nhân sự.'
    );
  };

  // 3. Đổi trạng thái hội thoại (OPEN / RESOLVED)
  const handleToggleStatus = () => {
    if (!currentConv) return;
    const nextStatus = currentConv.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
    setConversations((prev) =>
      prev.map((c) => (c.id === currentConv.id ? { ...c, status: nextStatus } : c))
    );
    notify.info(
      nextStatus === 'RESOLVED'
        ? 'Đã đánh dấu hoàn tất cuộc trò chuyện.'
        : 'Đã mở lại cuộc trò chuyện.'
    );
  };

  // 4. Cập nhật Lead Status (CRM)
  const handleUpdateLeadStatus = (status: LeadStatus) => {
    if (!currentConv) return;

    let stageForKanban: LeadStage =
      currentConv.customer.leadStage || (config.pipelineStages[0]?.id as LeadStage) || 'STAGE_NEW';
    if (!currentConv.customer.leadStage) {
      if (status === 'CONVERTED') stageForKanban = (config.pipelineStages.find((s) => s.isWon)?.id as LeadStage) || 'STAGE_ENROLLED';
      else if (status === 'POTENTIAL') stageForKanban = (config.pipelineStages[0]?.id as LeadStage) || 'STAGE_NEW';
      else if (status === 'UNQUALIFIED') stageForKanban = (config.pipelineStages.find((s) => s.isLost)?.id as LeadStage) || 'STAGE_LOST';
    }

    const currentTags = Array.from(new Set([
      ...(currentConv.customer?.tags || []),
      ...(currentConv.tags || []),
    ]));
    let nextTags = [...currentTags];
    if (status === 'POTENTIAL') {
      if (!nextTags.some((t) => t.trim().toLowerCase() === 'lead')) {
        nextTags.push('Lead');
      }
    } else if (status === 'NEW') {
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
        .catch((err) => {
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

  // 5. Chuyển giai đoạn tuyển sinh Kanban
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

    let computedStatus: LeadStatus = 'POTENTIAL';
    if (targetStageConfig?.isWon) {
      computedStatus = 'CONVERTED';
    } else if (targetStageConfig?.isLost) {
      computedStatus = 'UNQUALIFIED';
    } else if (isFirstStage || resolvedStageId === 'STAGE_NEW' || resolvedStageId === 'NEW') {
      const hasLeadTag = Array.isArray(currentConv.customer.tags) && currentConv.customer.tags.some(
        (t) => t.trim().toLowerCase() === 'lead' || t.trim().toLowerCase() === 'facebook lead'
      );
      computedStatus = (currentConv.customer.leadStatus === 'POTENTIAL' || hasLeadTag) ? 'POTENTIAL' : 'NEW';
    } else {
      const upper = String(resolvedStageId).toUpperCase();
      if (upper.includes('ENROLLED') || upper.includes('WON') || upper.includes('CONVERTED')) {
        computedStatus = 'CONVERTED';
      } else if (upper.includes('LOST') || upper.includes('UNQUALIFIED')) {
        computedStatus = 'UNQUALIFIED';
      } else {
        computedStatus = 'POTENTIAL';
      }
    }

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
        .catch((err) => {
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

  // 6. Gán / Gỡ nhãn (Tags)
  const handleAddTag = (tag: string) => {
    if (!currentConv) return;
    const tagNormalized = tag.trim().toLowerCase() === 'facebook lead' ? 'Lead' : tag.trim();
    const currentTags = Array.from(new Set([
      ...(currentConv.customer?.tags || []),
      ...(currentConv.tags || []),
    ]));
    if (currentTags.some((t) => t.trim().toLowerCase() === tagNormalized.toLowerCase())) return;

    const nextTags = [...currentTags, tagNormalized];
    setConversations((prev) =>
      prev.map((c) => {
        const isMatch =
          c.id === currentConv.id ||
          (c.customer?.id && currentConv.customer?.id && c.customer.id === currentConv.customer.id);
        if (!isMatch) return c;
        return {
          ...c,
          tags: nextTags,
          customer: { ...c.customer, tags: nextTags },
        };
      })
    );

    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        tags: nextTags,
        conversationId: currentConv.id,
      }).catch((err) => {
        console.warn('Lỗi lưu thêm tag vào CRM:', err);
      });
    }
    notify.success(`Đã thêm nhãn "${tagNormalized}".`);
  };

  const handleRemoveTag = (tag: string) => {
    if (!currentConv) return;
    const tagLower = tag.trim().toLowerCase();
    const isTarget = (t: string) => {
      const l = t.trim().toLowerCase();
      if (l === tagLower) return true;
      if (tagLower === 'lead' && (l === 'facebook lead' || l === 'fb lead')) return true;
      if ((tagLower === 'facebook lead' || tagLower === 'fb lead') && l === 'lead') return true;
      return false;
    };

    const currentTags = Array.from(new Set([
      ...(currentConv.customer?.tags || []),
      ...(currentConv.tags || []),
    ]));
    const nextTags = currentTags.filter((t) => !isTarget(t));

    setConversations((prev) =>
      prev.map((c) => {
        const isMatch =
          c.id === currentConv.id ||
          (c.customer?.id && currentConv.customer?.id && c.customer.id === currentConv.customer.id);
        if (!isMatch) return c;
        return {
          ...c,
          tags: nextTags,
          customer: { ...c.customer, tags: nextTags },
        };
      })
    );

    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        tags: nextTags,
        conversationId: currentConv.id,
      }).catch((err) => {
        console.warn('Lỗi lưu gỡ tag vào CRM:', err);
      });
      apiClient.deleteCustomerTag(currentConv.customer.id, tag, currentConv.id).catch(() => { });
    }
    notify.info(`Đã gỡ nhãn "${tag}" khỏi khách hàng.`);
  };

  // 7. Thêm ghi chú nội bộ
  const handleAddNote = (content: string) => {
    if (!currentConv) return;
    const newNote = {
      id: `note-${Date.now()}`,
      author: staffName ? `${staffName} (Bạn)` : 'Bạn',
      content,
      createdAt: 'Vừa xong',
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            notes: [newNote, ...c.customer.notes],
          },
        };
      })
    );
    notify.success('Đã lưu ghi chú nội bộ thành công.');
  };

  // 8. Xóa ghi chú nội bộ
  const handleRemoveNote = (noteId: string) => {
    if (!currentConv) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            notes: c.customer.notes.filter((n) => n.id !== noteId),
          },
        };
      })
    );
    notify.info('Đã xóa ghi chú nội bộ.');
  };

  // 9. Gán Khóa học / Dự án / Gói dịch vụ từ catalog & cập nhật giá trị dự kiến
  const handleUpdateProducts = (courses: string[], estimatedValue: number) => {
    if (!currentConv) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            interestCourses: courses,
            estimatedValue,
          },
        };
      })
    );

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
                interestCourses: courses,
                estimatedTuition: estimatedValue,
              };
            }
            return cand;
          });
          localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(updatedKanban));
        }
      }
    } catch { }

    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        interestCourses: courses,
        estimatedValue,
      }).catch(() => { });
    }
  };

  // 10. Cập nhật thông tin liên hệ (Phone, Email, FullName) trực tiếp từ Customer Profile Column
  const handleUpdateContactInfo = (info: { phone?: string; email?: string; fullName?: string }) => {
    if (!currentConv) return;

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConv.id) return c;
        return {
          ...c,
          customer: {
            ...c.customer,
            phone: info.phone !== undefined ? info.phone : c.customer.phone,
            email: info.email !== undefined ? info.email : c.customer.email,
            fullName: info.fullName !== undefined ? info.fullName : c.customer.fullName,
          },
        };
      })
    );

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
                ...(info.phone !== undefined ? { phone: info.phone } : {}),
                ...(info.email !== undefined ? { email: info.email } : {}),
                ...(info.fullName !== undefined ? { fullName: info.fullName } : {}),
              };
            }
            return cand;
          });
          localStorage.setItem('polarisx_crm_kanban_candidates', JSON.stringify(updatedKanban));
        }
      }
    } catch { }

    if (currentConv.customer.id) {
      apiClient.updateCustomer(currentConv.customer.id, {
        phone: info.phone !== undefined ? info.phone : currentConv.customer.phone,
        email: info.email !== undefined ? info.email : currentConv.customer.email,
        fullName: info.fullName !== undefined ? info.fullName : currentConv.customer.fullName,
      }).then(() => {
        notify.success('Đã lưu thông tin liên hệ thành công.');
      }).catch((err) => {
        console.warn('Lỗi lưu thông tin liên hệ:', err);
        notify.warning('Đã cập nhật giao diện, nhưng đồng bộ DB gặp sự cố.');
      });
    } else {
      notify.success('Đã lưu thông tin liên hệ.');
    }
  };

  return {
    handleSendMessage,
    handleAssignStaff,
    handleToggleStatus,
    handleUpdateLeadStatus,
    handleUpdateLeadStage,
    handleAddTag,
    handleRemoveTag,
    handleAddNote,
    handleRemoveNote,
    handleUpdateProducts,
    handleUpdateContactInfo,
  };
};

