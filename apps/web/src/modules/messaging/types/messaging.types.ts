export type ChannelType = 'ZALO' | 'FACEBOOK' | 'TIKTOK' | 'MANUAL_IMPORT';

export interface ManualImportRow {
  channel: ChannelType;
  sender: string;
  content: string;
  sentAt: string;
}

export interface RowErrorItem {
  row: number;
  csvLine?: number;
  reason: string;
  field?: string;
  errors: string[];
  raw?: Record<string, unknown>;
}

export interface ImportMessagesResponse {
  total: number;
  successCount: number;
  errorCount: number;
  errors: RowErrorItem[];
  importedIds: string[];
}

export interface SavedMessage {
  id: string;
  channelAccountId: string;
  channel: ChannelType;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string | null;
  sentAt: string;
  externalMessageId: string;
  rawPayload: unknown;
  processedAt: string | null;
  createdAt: string;
  channelAccount?: {
    displayName: string;
    externalAccountId: string;
  };
}

export interface SavedMessagesResponse {
  items: SavedMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
