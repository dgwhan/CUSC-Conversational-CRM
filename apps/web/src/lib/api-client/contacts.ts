import type { BaseApiClient } from './core.js';

export function createContactApi(client: BaseApiClient) {
  return {
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

