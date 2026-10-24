import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Code,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowDownLeft,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card.js';
import { messagingApi } from '../api/messaging.api.js';
import type { ChannelType, SavedMessage } from '../types/messaging.types.js';

export const SavedMessagesTable: React.FC = () => {
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<SavedMessage | null>(null);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      try {
        setLoading(true);
        const res = await messagingApi.getSavedMessages({
          page,
          limit,
          channel: channelFilter || undefined,
          search: searchTerm.trim() || undefined,
        });
        if (!ignore) {
          setMessages(res.items || []);
          setTotal(res.total || 0);
          setTotalPages(res.totalPages || 1);
        }
      } catch {
        if (!ignore) {
          setMessages([]);
          setTotal(0);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, [page, limit, channelFilter, searchTerm, reloadTrigger]);

  const handleRefresh = () => {
    setReloadTrigger((prev) => prev + 1);
  };

  const getChannelBadge = (ch: ChannelType) => {
    switch (ch) {
      case 'ZALO':
        return <Badge variant="primary">ZALO</Badge>;
      case 'FACEBOOK':
        return <Badge variant="secondary" className="badge-fb">FACEBOOK</Badge>;
      case 'TIKTOK':
        return <Badge variant="secondary" className="badge-tiktok">TIKTOK</Badge>;
      case 'MANUAL_IMPORT':
        return <Badge variant="warning">MANUAL</Badge>;
      default:
        return <Badge variant="secondary">{ch}</Badge>;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="crm-saved-messages-container">
      <Card className="crm-section-card">
        <CardHeader>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={20} style={{ color: 'var(--color-primary)' }} />
              <CardTitle>Dữ Liệu Tin Nhắn Đã Lưu Trong Hệ Thống ({total} tin nhắn)</CardTitle>
            </div>
            <CardDescription>
              Toàn bộ tin nhắn thu thập đa kênh (Zalo, Facebook, TikTok, Nhập thủ công) đã được lưu vĩnh viễn trong cơ sở dữ liệu PostgreSQL.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={handleRefresh}
            loading={loading}
          >
            Làm mới
          </Button>
        </CardHeader>

        <CardContent>
          {/* Thanh Tìm Kiếm và Lọc Kênh */}
          <div className="crm-filter-toolbar">
            <div className="crm-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="form-input form-input-with-padding"
                placeholder="Tìm kiếm nội dung hoặc mã tin nhắn..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="crm-channel-filter">
              <Filter size={15} className="filter-icon" />
              <select
                className="form-select form-select-sm"
                value={channelFilter}
                onChange={(e) => {
                  setChannelFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả các kênh</option>
                <option value="ZALO">ZALO OA</option>
                <option value="FACEBOOK">FACEBOOK Messenger</option>
                <option value="TIKTOK">TIKTOK Channel</option>
                <option value="MANUAL_IMPORT">MANUAL IMPORT</option>
              </select>
            </div>
          </div>

          {/* Bảng Dữ Liệu */}
          <div className="table-container" style={{ marginTop: '16px' }}>
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Kênh</th>
                  <th style={{ width: '160px' }}>Tài khoản tiếp nhận</th>
                  <th style={{ width: '130px' }}>Chiều tin</th>
                  <th>Nội dung tin nhắn</th>
                  <th style={{ width: '170px' }}>Thời gian gửi</th>
                  <th style={{ width: '130px' }}>Trạng thái xử lý</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {messages.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-muted)' }}>
                      {loading ? 'Đang tải dữ liệu tin nhắn...' : 'Chưa có tin nhắn nào trong cơ sở dữ liệu. Hãy import hoặc gửi webhook để nạp dữ liệu!'}
                    </td>
                  </tr>
                ) : (
                  messages.map((msg) => (
                    <tr key={msg.id}>
                      <td>{getChannelBadge(msg.channel)}</td>
                      <td>
                        <span style={{ fontWeight: 500 }}>
                          {msg.channelAccount?.displayName || msg.channelAccount?.externalAccountId || 'Tài khoản mặc định'}
                        </span>
                      </td>
                      <td>
                        <span className="direction-pill">
                          <ArrowDownLeft size={13} />
                          {msg.direction}
                        </span>
                      </td>
                      <td>
                        <div className="message-content-cell">
                          {msg.content || <em style={{ color: 'var(--color-text-subtle)' }}>(Không có nội dung văn bản)</em>}
                        </div>
                      </td>
                      <td>
                        <span className="time-text">
                          {formatDate(msg.sentAt)}
                        </span>
                      </td>
                      <td>
                        {msg.processedAt ? (
                          <span className="status-badge status-processed">
                            <CheckCircle2 size={13} />
                            Đã xử lý
                          </span>
                        ) : (
                          <span className="status-badge status-pending">
                            <Clock size={13} />
                            Chờ Worker
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setSelectedMessage(msg)}
                          title="Xem Raw Payload"
                        >
                          <Code size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Phân Trang */}
          {totalPages > 1 && (
            <div className="crm-pagination-bar">
              <span className="pagination-info">
                Hiển thị trang <strong>{page}</strong> / <strong>{totalPages}</strong> ({total} dòng)
              </span>
              <div className="pagination-buttons">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || loading}
                  icon={<ChevronLeft size={14} />}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Trước
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  icon={<ChevronRight size={14} />}
                  iconPosition="right"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Xem Raw Payload Chi Tiết */}
      {selectedMessage && (
        <div className="crm-modal-overlay" onClick={() => setSelectedMessage(null)}>
          <div className="crm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header">
              <div className="crm-modal-title">
                Chi Tiết Bản Ghi Tin Nhắn (ID: <code>{selectedMessage.id}</code>)
              </div>
              <button
                type="button"
                className="crm-modal-close"
                onClick={() => setSelectedMessage(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="crm-modal-body">
              <div className="meta-grid">
                <div><strong>External ID:</strong> <code>{selectedMessage.externalMessageId}</code></div>
                <div><strong>Kênh:</strong> {selectedMessage.channel}</div>
                <div><strong>Thời gian gửi:</strong> {formatDate(selectedMessage.sentAt)}</div>
                <div><strong>Thời gian tạo hệ thống:</strong> {formatDate(selectedMessage.createdAt)}</div>
              </div>
              <div style={{ marginTop: '14px' }}>
                <label className="form-label">Toàn bộ Raw JSON Payload:</label>
                <pre className="crm-modal-code">
                  {JSON.stringify(selectedMessage.rawPayload, null, 2)}
                </pre>
              </div>
            </div>
            <div className="crm-modal-footer">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedMessage(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
