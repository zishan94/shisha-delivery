import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '@/constants/config';
import { useAuth } from './AuthContext';

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
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  notifications: [],
  clearNotification: () => {},
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Force re-render when socket connects
  const [, setSocketReady] = useState(0);

  useEffect(() => {
    const s = io(WS_URL, {
      transports: ['websocket', 'polling'],
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

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, notifications, clearNotification }}>
      {children}
    </SocketContext.Provider>
  );
}
