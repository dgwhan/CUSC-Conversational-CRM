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
  direction: 'INBOUND';
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
}

export interface RealtimeContextValue {
  connectionStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  staffPresences: Record<string, StaffPresenceData>;
  myPresence: StaffPresenceStatus;
  soundActive: boolean;
  setSoundActive: (active: boolean) => void;
  updateMyPresence: (status: StaffPresenceStatus) => Promise<void>;
  simulateIncomingMessage: (channel?: 'FACEBOOK' | 'ZALO', content?: string) => Promise<void>;
  onNewMessage: (listener: (msg: InboundMessageEventData) => void) => () => void;
  onPipelineChange: (listener: (evt: PipelineChangeEventData) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const DEFAULT_STAFF_PRESENCES: Record<string, StaffPresenceData> = {
  'staff-2': {
    staffId: 'staff-2',
    name: 'Lê Thị Thu Lan',
    avatar: 'TL',
    role: 'Tư vấn viên Aptech',
    status: 'AWAY',
    updatedAt: new Date().toISOString(),
  },
  'staff-3': {
    staffId: 'staff-3',
    name: 'Trần Hoàng Nam',
    avatar: 'HN',
    role: 'Quản lý tuyển sinh',
    status: 'BUSY',
    updatedAt: new Date().toISOString(),
  },
};

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { staffId, staffName } = useUserRole();
  const currentStaffId = staffId || 'staff-me';
  const currentStaffName = staffName ? `${staffName} (Bạn)` : 'Bạn';

  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [staffPresences, setStaffPresences] = useState<Record<string, StaffPresenceData>>(() => ({
    ...DEFAULT_STAFF_PRESENCES,
    [currentStaffId]: {
      staffId: currentStaffId,
      name: currentStaffName,
      avatar: staffName ? staffName.slice(0, 2).toUpperCase() : 'ME',
      role: 'Tư vấn viên',
      status: 'ONLINE',
      updatedAt: new Date().toISOString(),
    },
  }));
  const [myPresence, setMyPresence] = useState<StaffPresenceStatus>('ONLINE');
  const [soundActive, setSoundActiveState] = useState<boolean>(isSoundEnabled());

  const messageListenersRef = useRef<Set<(msg: InboundMessageEventData) => void>>(new Set());
  const pipelineListenersRef = useRef<Set<(evt: PipelineChangeEventData) => void>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

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
    // 1. Phát chuông Ting ting
    playTingTingSound();

    // 2. Bắn thông báo Toast
    notify.info(
      `[${msg.channel}] ${msg.senderName}: "${msg.content}"`,
      '💬 Tin nhắn mới thời gian thực'
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
    const defaultTexts: Record<string, string> = {
      FACEBOOK: 'Dạ thầy cô cho em hỏi hồ sơ xét học bạ ngành Lập trình Web CUSC cần những giấy tờ gì ạ?',
      ZALO: 'Em chào trung tâm! Khóa Aptech ADSE khai giảng vào ngày nào ạ, em muốn đăng ký học buổi tối.',
    };

    const text = content || defaultTexts[channel] || 'Dạ em cần tư vấn khóa học ạ.';
    const sender = channel === 'FACEBOOK' ? 'Nguyễn Quốc Bảo (Messenger)' : 'Phan Thu Hà (Zalo OA)';

    try {
      // Thử gọi Backend nếu có
      await apiClient.post('/realtime/simulate-inbound', {
        channel,
        senderName: sender,
        content: text,
      }, { skipToast: true });
    } catch {
      // Fallback cục bộ nếu backend chưa chạy
      handleIncomingMessage({
        id: `msg-sim-${Date.now()}`,
        conversationId: 'conv-1',
        channel,
        direction: 'INBOUND',
        content: text,
        senderName: sender,
        sentAt: 'Vừa xong',
      });
    }
  };

  // Khởi tạo kết nối SSE với Backend
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;
    let retryDelay = 5000;

    const connectSSE = () => {
      if (typeof window === 'undefined') return;

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
            handleIncomingMessage(parsed.data || parsed);
          } catch (e) {
            console.error('Failed to parse realtime message:', e);
          }
        });

        es.addEventListener('presence:updated', (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data);
            const data: StaffPresenceData = parsed.data || parsed;
            if (data?.staffId) {
              setStaffPresences((prev) => ({
                ...prev,
                [data.staffId]: data,
              }));
              if (data.staffId === 'staff-1') {
                setMyPresence(data.status);
              }
            }
          } catch (e) {
            console.error('Failed to parse presence update:', e);
          }
        });

        es.addEventListener('pipeline:updated', (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data);
            const data: PipelineChangeEventData = parsed.data || parsed;
            pipelineListenersRef.current.forEach((l) => l(data));
          } catch (e) {
            console.error('Failed to parse pipeline update:', e);
          }
        });

        es.onerror = () => {
          if (!isMounted) return;
          setConnectionStatus('DISCONNECTED');
          es.close();

          // Tăng dần thời gian thử lại (Exponential backoff 5s -> 10s -> 20s -> tối đa 30s)
          // để tránh spam kết nối khi máy chủ Backend chưa được khởi động
          retryDelay = Math.min(Math.round(retryDelay * 1.5), 30000);
          reconnectTimeout = setTimeout(() => {
            if (isMounted) {
              setConnectionStatus('CONNECTING');
              connectSSE();
            }
          }, retryDelay);
        };
      } catch {
        setConnectionStatus('DISCONNECTED');
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [handleIncomingMessage]);

  return (
    <RealtimeContext.Provider
      value={{
        connectionStatus,
        staffPresences,
        myPresence,
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
