import React from 'react';
import { Copy, Check } from 'lucide-react';
import type { ChannelIdentityItem } from '../../types.js';

interface ChannelIdentitiesSectionProps {
  identities: ChannelIdentityItem[];
  copiedField: string | null;
  onCopy: (text: string, fieldName: string) => void;
}

export const ChannelIdentitiesSection: React.FC<ChannelIdentitiesSectionProps> = ({
  identities,
  copiedField,
  onCopy,
}) => {
  return (
    <section className="flat-section">
      <div className="flat-section-header">
        <h3 className="flat-section-title">Danh Tính Đa Kênh</h3>
        <span className="flat-section-meta">{identities.length} Kênh</span>
      </div>

      <div className="flat-identities-list">
        {identities.map((identity, idx) => {
          const channelUpper = (identity.channel || 'FACEBOOK').toUpperCase();
          const isFb = channelUpper.includes('FACEBOOK');
          const isZalo = channelUpper.includes('ZALO');
          const channelLabel = isFb
            ? 'Facebook Messenger'
            : isZalo
              ? 'Zalo OA / Chat'
              : identity.channel;

          return (
            <div key={idx} className="flat-identity-row">
              <div className="flat-identity-main">
                <span
                  className={`flat-channel-badge ${isFb ? 'facebook' : isZalo ? 'zalo' : 'tiktok'}`}
                  style={{ position: 'static', width: 20, height: 20 }}
                >
                  {isFb ? 'f' : isZalo ? 'Z' : 'C'}
                </span>
                <div className="flat-identity-info">
                  <span className="flat-identity-channel">{channelLabel}</span>
                  <span
                    className="flat-identity-ext-id"
                    title={`External ID: ${identity.externalUserId}`}
                  >
                    ID: {identity.externalUserId}
                  </span>
                </div>
              </div>

              <div className="flat-identity-status-group">
                <button
                  type="button"
                  className="flat-copy-btn"
                  onClick={() => onCopy(identity.externalUserId, `Kênh ${identity.channel}`)}
                  title="Sao chép External ID"
                >
                  {copiedField === `Kênh ${identity.channel}` ? (
                    <Check size={12} color="#16803C" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
