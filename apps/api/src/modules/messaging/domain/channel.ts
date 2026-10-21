export const Channel = {
    ZALO: 'ZALO',
    FACEBOOK: 'FACEBOOK',
    TIKTOK: 'TIKTOK',
    MANUAL_IMPORT: 'MANUAL_IMPORT',
} as const;
export type Channel = (typeof Channel)[keyof typeof Channel];

export const MessageDirection = {
    INBOUND: 'INBOUND',
    OUTBOUND: 'OUTBOUND',
} as const;
export type MessageDirection = (typeof MessageDirection)[keyof typeof MessageDirection];