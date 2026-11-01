import React from 'react';
import type { ConversationItem } from '../../types.js';
import { apiClient } from '../../../../lib/api-client.js';
import { notify } from '../../../../components/feedback/toastEmitter.js';

interface UseCustomerDataActionsProps {
  currentConv?: ConversationItem;
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>;
  staffName?: string | null;
}

export const useCustomerDataActions = ({
  currentConv,
  setConversations,
  staffName,
}: UseCustomerDataActionsProps) => {
  // 1. Gán / Gỡ nhãn (Tags)
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
      }).catch((err: any) => {
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
      }).catch((err: any) => {
        console.warn('Lỗi lưu gỡ tag vào CRM:', err);
      });
      apiClient.deleteCustomerTag(currentConv.customer.id, tag, currentConv.id).catch(() => { });
    }
    notify.info(`Đã gỡ nhãn "${tag}" khỏi khách hàng.`);
  };

  // 2. Thêm / Xóa ghi chú nội bộ
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

  // 3. Gán Khóa học / Dự án / Gói dịch vụ từ catalog & cập nhật giá trị dự kiến
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

  // 4. Cập nhật thông tin liên hệ (Phone, Email, FullName) trực tiếp từ Customer Profile Column
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
      }).catch((err: any) => {
        console.warn('Lỗi lưu thông tin liên hệ:', err);
        notify.warning('Đã cập nhật giao diện, nhưng đồng bộ DB gặp sự cố.');
      });
    } else {
      notify.success('Đã lưu thông tin liên hệ.');
    }
  };

  return {
    handleAddTag,
    handleRemoveTag,
    handleAddNote,
    handleRemoveNote,
    handleUpdateProducts,
    handleUpdateContactInfo,
  };
};
