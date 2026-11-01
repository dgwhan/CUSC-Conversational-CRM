export const OFFICIAL_CHANNEL_ICONS = {
  FACEBOOK: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg',
  ZALO: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg',
  ZALO_OA: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg',
  ZALO_PERSONAL: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg',
  TIKTOK: 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
  INSTAGRAM: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg',
} as const;

export interface ResolvedChannelInfo {
  key: string;
  label: string;
  iconUrl?: string;
  badgeBg: string;
  badgeText: string;
  externalLink?: string | null;
  externalLinkLabel?: string | null;
}

export function resolveChannelInfo(
  channel?: string,
  socialId?: string,
  profileUrl?: string,
): ResolvedChannelInfo {
  const ch = (channel || '').toUpperCase();

  if (ch.includes('FACEBOOK') || ch.includes('FB')) {
    return {
      key: 'FACEBOOK',
      label: 'Facebook Messenger',
      iconUrl: OFFICIAL_CHANNEL_ICONS.FACEBOOK,
      badgeBg: '#1877F2',
      badgeText: 'f',
      externalLink:
        profileUrl ||
        (socialId
          ? `https://business.facebook.com/latest/inbox/messenger?selected_item_id=${socialId}`
          : null),
      externalLinkLabel: profileUrl ? 'Trang cá nhân Facebook' : 'Mở trên Meta Business Suite',
    };
  }

  if (ch === 'ZALO_PERSONAL') {
    return {
      key: 'ZALO_PERSONAL',
      label: 'Zalo Cá nhân',
      iconUrl: OFFICIAL_CHANNEL_ICONS.ZALO_PERSONAL,
      badgeBg: '#0068FF',
      badgeText: 'ZL',
      externalLink: 'https://chat.zalo.me/',
      externalLinkLabel: 'Mở trên Zalo Web',
    };
  }

  if (ch === 'ZALO' || ch === 'ZALO_OA' || ch.includes('ZALO')) {
    return {
      key: 'ZALO',
      label: 'Zalo OA',
      iconUrl: OFFICIAL_CHANNEL_ICONS.ZALO_OA,
      badgeBg: '#0068FF',
      badgeText: 'OA',
      externalLink: 'https://oa.zalo.me/chat',
      externalLinkLabel: 'Mở trên Zalo OA Manager',
    };
  }

  if (ch.includes('TIKTOK')) {
    return {
      key: 'TIKTOK',
      label: 'TikTok',
      iconUrl: OFFICIAL_CHANNEL_ICONS.TIKTOK,
      badgeBg: '#000000',
      badgeText: 'TT',
      externalLink: profileUrl || null,
      externalLinkLabel: 'Mở trang TikTok',
    };
  }

  if (ch.includes('INSTAGRAM') || ch.includes('IG')) {
    return {
      key: 'INSTAGRAM',
      label: 'Instagram',
      iconUrl: OFFICIAL_CHANNEL_ICONS.INSTAGRAM,
      badgeBg: '#E4405F',
      badgeText: 'IG',
      externalLink: profileUrl || null,
      externalLinkLabel: 'Mở trang Instagram',
    };
  }

  return {
    key: 'MANUAL',
    label: channel || 'Kênh CRM',
    badgeBg: '#64748B',
    badgeText: 'CRM',
    externalLink: profileUrl || null,
    externalLinkLabel: profileUrl ? 'Mở liên kết ngoài' : null,
  };
}

