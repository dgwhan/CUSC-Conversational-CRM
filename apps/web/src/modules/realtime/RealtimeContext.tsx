import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { StaffPresenceStatus, ChannelType } from '../inbox/types.js';
import { playTingTingSound, isSoundEnabled, setSoundEnabled } from './audioNotification.js';
import { notify } from '../../components/feedback/toastEmitter.js';
import { apiClient } from '../../lib/api-client.js';
import { useUserRole } from '../auth/index.js';

export interface InboundMessageEventData {
  id: string;
  conversationId: string;
  channel: ChannelType;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  senderName: string;
  senderAvatar?: string;
  customerPhone?: string;
  customerEmail?: string;
  sentAt: string;
}

export interface StaffPresenceData {
  staffId: string;
  name: string;
  avatar: string;
  role: string;
  status: StaffPresenceStatus;
  updatedAt: string;
}

export interface PipelineChangeEventData {
  customerId: string;
  customerName: string;
  newStage: string;
  previousStage: string;
  updatedBy: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  channel?: ChannelType;
  channelAccountName?: string;
  estimatedValue?: number;
  interestCourses?: string[];
  tags?: string[];
  conversationId?: string;
}

export interface RealtimeContextValue {
  connectionStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  staffPresences: Record<string, StaffPresenceData>;
  myPresence: StaffPresenceStatus;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  soundActive: boolean;
  setSoundActive: (active: boolean) => void;
  updateMyPresence: (status: StaffPresenceStatus) => Promise<void>;
  simulateIncomingMessage: (channel?: 'FACEBOOK' | 'ZALO', content?: string) => Promise<void>;
  onNewMessage: (listener: (msg: InboundMessageEventData) => void) => () => void;
  onPipelineChange: (listener: (evt: PipelineChangeEventData) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { staffId, staffName, isAuthenticated } = useUserRole();
  const currentStaffId = staffId || 'staff-me';
  const currentStaffName = staffName ? `${staffName} (Bạn)` : 'Bạn';

  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [staffPresences, setStaffPresences] = useState<Record<string, StaffPresenceData>>(() => {
    if (!currentStaffId || currentStaffId === 'staff-me') return {};
    return {
      [currentStaffId]: {
        staffId: currentStaffId,
        name: currentStaffName,
        avatar: staffName ? staffName.slice(0, 2).toUpperCase() : 'ME',
        role: 'Tư vấn viên',
        status: 'ONLINE',
        updatedAt: new Date().toISOString(),
      },
    };
  });
  const [myPresence, setMyPresence] = useState<StaffPresenceStatus>('ONLINE');
  const [soundActive, setSoundActiveState] = useState<boolean>(isSoundEnabled());
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const messageListenersRef = useRef<Set<(msg: InboundMessageEventData) => void>>(new Set());
  const pipelineListenersRef = useRef<Set<(evt: PipelineChangeEventData) => void>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);

  const setSoundActive = (active: boolean) => {
    setSoundEnabled(active);
    setSoundActiveState(active);
    notify.info(
      active ? 'Đã bật chuông thông báo (Ting ting).' : 'Đã tắt chuông thông báo.',
      'Cài đặt Âm thanh'
    );
  };

  // Đăng ký listener tin nhắn mới
  const onNewMessage = useCallback((listener: (msg: InboundMessageEventData) => void) => {
    messageListenersRef.current.add(listener);
    return () => {
      messageListenersRef.current.delete(listener);
    };
  }, []);

  // Đăng ký listener cập nhật phễu Kanban
  const onPipelineChange = useCallback((listener: (evt: PipelineChangeEventData) => void) => {
    pipelineListenersRef.current.add(listener);
    return () => {
      pipelineListenersRef.current.delete(listener);
    };
  }, []);

  // Kích hoạt xử lý khi nhận tin nhắn mới
  const handleIncomingMessage = useCallback((msg: InboundMessageEventData) => {
    // 1. Phát chuông Ting ting nếu là tin nhắn đến (INBOUND)
    if (msg.direction !== 'OUTBOUND') {
      playTingTingSound();
      setUnreadCount((prev) => prev + 1);
    }

    // 2. Bắn thông báo Toast
    const title = msg.direction === 'OUTBOUND' ? '📤 Tin nhắn Page đã gửi' : '💬 Tin nhắn mới thời gian thực';
    notify.info(
      `[${msg.channel}] ${msg.senderName}: "${msg.content}"`,
      title
    );

    // 3. Gọi các listeners (UnifiedInbox / ChatWindow)
    messageListenersRef.current.forEach((listener) => {
      try {
        listener(msg);
      } catch (e) {
        console.error('Error in message listener', e);
      }
    });
  }, []);

  // Cập nhật trạng thái trực tuyến của chính mình
  const updateMyPresence = async (status: StaffPresenceStatus) => {
    setMyPresence(status);
    setStaffPresences((prev) => ({
      ...prev,
      [currentStaffId]: {
        ...(prev[currentStaffId] || {
          staffId: currentStaffId,
          name: currentStaffName,
          avatar: staffName ? staffName.slice(0, 2).toUpperCase() : 'ME',
          role: 'Tư vấn viên',
        }),
        status,
        updatedAt: new Date().toISOString(),
      },
    }));

    try {
      await apiClient.post('/realtime/presence', {
        staffId: currentStaffId,
        status,
        name: currentStaffName,
      }, { skipToast: true });
    } catch {
      // Backend offline thì duy trì cục bộ
    }

    const labelMap: Record<StaffPresenceStatus, string> = {
      ONLINE: 'Trực tuyến (Online)',
      AWAY: 'Vắng mặt (Away)',
      BUSY: 'Đang bận (Busy)',
    };
    notify.success(`Đã đổi trạng thái sang "${labelMap[status]}".`, 'Trạng thái nhân viên');
  };

  // Giả lập tin nhắn đến để kiểm tra Realtime
  const simulateIncomingMessage = async (channel: 'FACEBOOK' | 'ZALO' = 'FACEBOOK', content?: string) => {
    const text = content || 'Tin nhắn thử nghiệm từ khách hàng';
    const sender = `Khách hàng (${channel})`;
    const conversationId = `conv-${Date.now()}`;

    try {
      // Thử gọi Backend nếu có
      await apiClient.post('/realtime/simulate-inbound', {
        channel,
        conversationId,
        senderName: sender,
        content: text,
      }, { skipToast: true });
    } catch {
      // Fallback cục bộ nếu backend chưa chạy
      handleIncomingMessage({
        id: `msg-sim-${Date.now()}`,
        conversationId,
        channel,
        direction: 'INBOUND',
        content: text,
        senderName: sender,
        sentAt: 'Vừa xong',
      });
    }
  };

  // Khởi tạo kết nối WebSocket với Backend (kèm SSE fallback, chỉ khi đã đăng nhập)
  useEffect(() => {
    if (!isAuthenticated) {
      setConnectionStatus('DISCONNECTED');
      return;
    }

    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;
    let retryDelay = 5000;

    const handlePayload = (type: string, data: any) => {
      if (type === 'message:received') {
        handleIncomingMessage(data);
      } else if (type === 'presence:updated') {
        if (data?.staffId) {
          setStaffPresences((prev) => ({
            ...prev,
            [data.staffId]: data,
          }));
          if (data.staffId === currentStaffId) {
            setMyPresence(data.status);
          }
        }
      } else if (type === 'pipeline:updated') {
        pipelineListenersRef.current.forEach((l) => l(data));
      }
    };

    const connectSSE = () => {
      if (typeof window === 'undefined' || !isMounted) return;

      const baseUrl = apiClient.getBaseUrl();
      const sseUrl = `${baseUrl}/realtime/stream`;

      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isMounted) return;
          retryDelay = 5000;
          setConnectionStatus('CONNECTED');
        };

        es.addEventListener('message:received', (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data);
            handlePayload('message:received', parsed.data || parsed);
          } catch (e) {
            console.error('Failed to parse realtime message:', e);
          }
        });

        es.addEventListener('presence:updated', (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data);
            handlePayload('presence:updated', parsed.data || parsed);
          } catch (e) {
            console.error('Failed to parse presence update:', e);
          }
        });

        es.addEventListener('pipeline:updated', (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data);
            handlePayload('pipeline:updated', parsed.data || parsed);
          } catch (e) {
            console.error('Failed to parse pipeline update:', e);
          }
        });

        es.onerror = () => {
          if (!isMounted) return;
          setConnectionStatus('DISCONNECTED');
          es.close();

          retryDelay = Math.min(Math.round(retryDelay * 1.5), 30000);
          reconnectTimeout = setTimeout(() => {
            if (isMounted) {
              setConnectionStatus('CONNECTING');
              connect();
            }
          }, retryDelay);
        };
      } catch {
        setConnectionStatus('DISCONNECTED');
      }
    };

    const safeCloseWebSocket = (ws: WebSocket | null) => {
      if (!ws) return;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => {
          try { ws.close(); } catch {}
        };
      }
    };

    const connectWebSocket = () => {
      if (typeof window === 'undefined' || !isMounted) return;

      try {
        if (webSocketRef.current) {
          safeCloseWebSocket(webSocketRef.current);
          webSocketRef.current = null;
        }

        const baseUrl = apiClient.getBaseUrl();
        let wsUrl = '';
        if (baseUrl.startsWith('http')) {
          const urlObj = new URL(baseUrl);
          const proto = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${proto}//${urlObj.host}/api/realtime/ws`;
        } else {
          const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${proto}//${window.location.host}/api/realtime/ws`;
        }

        const ws = new WebSocket(wsUrl);
        webSocketRef.current = ws;
        let pingInterval: ReturnType<typeof setInterval> | null = null;

        ws.onopen = () => {
          if (!isMounted) return;
          retryDelay = 2000;
          setConnectionStatus('CONNECTED');
          // Giữ kết nối liên tục bằng heartbeat ping mỗi 15 giây
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'ping' }));
              } catch {}
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'pong' || parsed.type === 'heartbeat') return;
            handlePayload(parsed.type, parsed.data || parsed);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        const handleDisconnect = () => {
          if (pingInterval) clearInterval(pingInterval);
          if (!isMounted) return;
          setConnectionStatus('CONNECTING');
          retryDelay = Math.min(Math.round(retryDelay * 1.5), 10000);
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            if (isMounted) {
              connect();
            }
          }, retryDelay);
        };

        ws.onerror = handleDisconnect;
        ws.onclose = handleDisconnect;
      } catch {
        connectSSE();
      }
    };

    const connect = () => {
      if (typeof WebSocket !== 'undefined') {
        connectWebSocket();
      } else {
        connectSSE();
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (webSocketRef.current) {
        safeCloseWebSocket(webSocketRef.current);
        webSocketRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [handleIncomingMessage, isAuthenticated]);

  return (
    <RealtimeContext.Provider
      value={{
        connectionStatus,
        staffPresences,
        myPresence,
        unreadCount,
        setUnreadCount,
        soundActive,
        setSoundActive,
        updateMyPresence,
        simulateIncomingMessage,
        onNewMessage,
        onPipelineChange,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = (): RealtimeContextValue => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};
