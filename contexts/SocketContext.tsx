import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '@/constants/config';
import { useAuth } from './AuthContext';
import {
  configureNotificationHandler,
  setupNotificationChannels,
  registerForPushNotificationsAsync,
  registerTokenWithServer,
  clearAllNotifications,
} from '@/utils/notifications';

interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: Notification[];
  clearNotification: (id: string) => void;
  pushToken: string | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  notifications: [],
  clearNotification: () => {},
  pushToken: null,
});

export const useSocket = () => useContext(SocketContext);

// Configure the notification handler (must be called outside component)
configureNotificationHandler();

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pushToken, setPushToken] = useState<string | null>(null);
  // Force re-render when socket connects
  const [, setSocketReady] = useState(0);
  const pushTokenRegistered = useRef(false);

  // ── Set up notification channels on mount ──
  useEffect(() => {
    setupNotificationChannels();
  }, []);

  // ── Register for push notifications when user is available ──
  useEffect(() => {
    if (!user?.id || pushTokenRegistered.current) return;

    const registerPush = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          setPushToken(token);
          const success = await registerTokenWithServer(user.id, token);
          if (success) {
            pushTokenRegistered.current = true;
            console.log('📱 Push token registered with server');
          }
        }
      } catch (e) {
        console.error('Failed to register push notifications:', e);
      }
    };

    registerPush();
  }, [user?.id]);

  // ── Clear badge when app comes to foreground ──
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        clearAllNotifications();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  // ── Socket connection ──
  useEffect(() => {
    const s = io(WS_URL, {
      // Use polling first — it works through the Metro proxy.
      // Socket.IO will try to upgrade to websocket automatically when possible.
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = s;

    s.on('connect', () => {
      console.log('🔌 Socket connected:', s.id);
      setIsConnected(true);
      setSocketReady((n) => n + 1);
      if (user?.id && user?.role) {
        s.emit('join', { userId: user.id, role: user.role });
      }
    });

    s.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
    });

    s.on('notification', (data: { title: string; body: string }) => {
      setNotifications((prev) => [
        { id: Date.now().toString() + Math.random(), title: data.title, body: data.body, timestamp: Date.now() },
        ...prev,
      ]);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Re-join rooms when user changes (login/logout)
  useEffect(() => {
    if (user?.id && user?.role && socketRef.current?.connected) {
      socketRef.current.emit('join', { userId: user.id, role: user.role });
    }
  }, [user?.id, user?.role, isConnected]);

  // Re-register push token when user changes (e.g., different account)
  useEffect(() => {
    if (user?.id && pushToken && !pushTokenRegistered.current) {
      registerTokenWithServer(user.id, pushToken).then((success) => {
        if (success) pushTokenRegistered.current = true;
      });
    }
    if (!user) {
      pushTokenRegistered.current = false;
    }
  }, [user?.id, pushToken]);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, notifications, clearNotification, pushToken }}>
      {children}
    </SocketContext.Provider>
  );
}
