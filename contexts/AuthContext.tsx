import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/config';

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
        const res = await fetch(`${API_URL}/api/auth/user/${parsed.id}`);
        if (res.ok) {
          const fresh = await res.json();
          setUser(fresh);
          await storage.setItem('user', JSON.stringify(fresh));
        } else {
          setUser(parsed);
        }
      }
    } catch (e) {
      console.log('Failed to load user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const requestCode = async (phone: string): Promise<boolean> => {
    const res = await fetch(`${API_URL}/api/auth/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return res.ok;
  };

  const verifyCode = async (phone: string, code: string) => {
    const res = await fetch(`${API_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    if (!res.ok) throw new Error('Verification failed');
    const data = await res.json();
    setUser(data.user);
    await storage.setItem('user', JSON.stringify(data.user));
    return data;
  };

  const staffLogin = async (username: string, password: string): Promise<User> => {
    const res = await fetch(`${API_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
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
    const res = await fetch(`${API_URL}/api/auth/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name, role }),
    });
    if (!res.ok) throw new Error('Failed to set profile');
    const data = await res.json();
    setUser(data.user);
    await storage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = async () => {
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
