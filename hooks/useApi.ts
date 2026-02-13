import { useState, useCallback } from 'react';
import { API_URL } from '@/constants/config';

export function useApi() {
  const [loading, setLoading] = useState(false);

  const get = useCallback(async <T = any>(path: string): Promise<T> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}${path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const post = useCallback(async <T = any>(path: string, body: any): Promise<T> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      setLoading(false);
    }
  }, []);

  return { get, post, loading };
}
