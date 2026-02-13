import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/config';
import { unregisterUserTokensFromServer } from '@/utils/notifications';

interface User {
  id: number;
  phone: string;
  name: string | null;
  role: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  requestCode: (phone: string) => Promise<boolean>;
  verifyCode: (phone: string, code: string) => Promise<{ user: User; isNew: boolean }>;
  staffLogin: (username: string, password: string) => Promise<User>;
  setProfile: (name: string, role: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

const storage = {
  getItem: async (key: string) => {
    try { return await AsyncStorage.getItem(key); } catch { return null; }
  },
  setItem: async (key: string, value: string) => {
    try { await AsyncStorage.setItem(key, value); } catch {}
  },
  removeItem: async (key: string) => {
    try { await AsyncStorage.removeItem(key); } catch {}
  },
};

/** fetch with a hard timeout so the app never hangs */
function fetchWithTimeout(url: string, opts?: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const stored = await storage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Immediately set the cached user so the app is usable right away
        setUser(parsed);
        try {
          const res = await fetchWithTimeout(`${API_URL}/api/auth/user/${parsed.id}`);
          if (res.ok) {
            const fresh = await res.json();
            setUser(fresh);
            await storage.setItem('user', JSON.stringify(fresh));
          }
        } catch {
          // Server unreachable — use cached user, that's fine
        }
      }
    } catch (e) {
      console.log('Failed to load user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const requestCode = async (phone: string): Promise<boolean> => {
    const res = await fetchWithTimeout(`${API_URL}/api/auth/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }, 8000);
    return res.ok;
  };

  const verifyCode = async (phone: string, code: string) => {
    const res = await fetchWithTimeout(`${API_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    }, 8000);
    if (!res.ok) throw new Error('Verification failed');
    const data = await res.json();
    setUser(data.user);
    await storage.setItem('user', JSON.stringify(data.user));
    return data;
  };

  const staffLogin = async (username: string, password: string): Promise<User> => {
    const res = await fetchWithTimeout(`${API_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }, 8000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    setUser(data.user);
    await storage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const setProfile = async (name: string, role: string): Promise<User> => {
    if (!user) throw new Error('Not logged in');
    const res = await fetchWithTimeout(`${API_URL}/api/auth/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name, role }),
    }, 8000);
    if (!res.ok) throw new Error('Failed to set profile');
    const data = await res.json();
    setUser(data.user);
    await storage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = async () => {
    // Unregister push tokens before clearing user
    if (user?.id) {
      unregisterUserTokensFromServer(user.id).catch(() => {});
    }
    setUser(null);
    await storage.removeItem('user');
  };

  const updateUser = (u: User) => {
    setUser(u);
    storage.setItem('user', JSON.stringify(u));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, requestCode, verifyCode, staffLogin, setProfile, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
