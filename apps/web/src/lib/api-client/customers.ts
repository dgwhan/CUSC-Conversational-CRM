import type { BaseApiClient } from './core.js';

export function createCustomerApi(client: BaseApiClient) {
  return {
    getMessages(params?: {
      page?: number;
      limit?: number;
      channel?: string;
      search?: string;
      workspaceId?: string;
    }) {
      return client.get<{
        items: Array<{
          id: string;
          channel: string;
          externalMessageId: string;
          senderExternalId: string;
          content: string | null;
          direction: 'INBOUND' | 'OUTBOUND';
          sentAt: string;
          channelAccountId?: string;
          channelAccount?: { displayName: string; externalAccountId: string };
        }>;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>('/messages', {
        params,
        headers: params?.workspaceId ? { 'x-workspace-id': params.workspaceId } : {},
      });
    },

    getCustomers(params?: { workspaceId?: string; search?: string }) {
      return client.get<{
        items: Array<{
          id: string;
          workspaceId?: string | null;
          fullName: string;
          phone?: string | null;
          email?: string | null;
          avatarUrl?: string | null;
          leadStatus?: string;
          channelIdentities?: any;
          interestCourses?: string[];
          estimatedValue?: number;
          leadStage?: string;
          tags?: string[];
          conversations?: Array<{
            id: string;
            snippet?: string | null;
            lastMessageAt?: string | null;
            channelAccount?: { displayName: string; channel: string; avatarUrl?: string };
          }>;
          createdAt: string;
          updatedAt: string;
        }>;
        total: number;
      }>('/customers', {
        params,
        headers: params?.workspaceId ? { 'x-workspace-id': params.workspaceId } : {},
      });
    },

    updateCustomer(id: string, data: Record<string, unknown>, workspaceId?: string) {
      return client.patch<Record<string, unknown>>(`/customers/${id}`, data, {
        headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
      });
    },

    assignConversation(
      conversationId: string,
      data: { staffId?: string | null; staffName?: string | null },
      workspaceId?: string,
    ) {
      return client.patch<Record<string, unknown>>(
        `/customers/conversations/${encodeURIComponent(conversationId)}/assign`,
        data,
        {
          headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
        },
      );
    },

    deleteCustomerTag(id: string, tag: string, conversationId?: string, workspaceId?: string) {
      return client.delete<Record<string, unknown>>(`/customers/${id}/tags/${encodeURIComponent(tag)}`, {
        params: conversationId ? { conversationId } : undefined,
        headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
      });
    },

    getContacts() {
      return client.get<{ items: any[]; total: number }>('/contacts');
    },

    checkDuplicatePhone(phone: string, excludeContactId?: string) {
      return client.get<{
        isValid: boolean;
        normalizedPhone: string | null;
        existingContact: any | null;
        hasCollision: boolean;
      }>('/contacts/check-duplicate-phone', {
        params: { phone, excludeContactId },
      });
    },

    mergeContacts(payload: {
      targetContactId: string;
      sourceContactId: string;
      phoneNormalized?: string;
      reason?: string;
      workspaceId?: string;
    }) {
      return client.post<{
        success: boolean;
        mergeLogId: string;
        targetContact: any;
        movedIdentitiesCount: number;
        movedConversationsCount: number;
      }>('/contacts/merge', payload);
    },

    unmergeContact(mergeLogId: string, payload?: { reason?: string }) {
      return client.post<{
        success: boolean;
        message: string;
        mergeLogId: string;
        restoredContactId: string;
        targetContactId: string;
      }>(`/contacts/unmerge/${mergeLogId}`, payload || {});
    },

    getContactMergeHistory(contactId: string) {
      return client.get<{ items: any[]; total: number }>(`/contacts/${contactId}/merge-history`);
    },
  };
}

