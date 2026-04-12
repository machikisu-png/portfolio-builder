import { useState, useEffect, useCallback } from 'react';
import { api, setTokens, clearTokens } from '../lib/api';

export interface User {
  id: number;
  name: string;
}

const DEVICE_ID_KEY = 'device_id';

function getDeviceId(): string | null {
  return localStorage.getItem(DEVICE_ID_KEY);
}

function saveDeviceId(id: string): void {
  localStorage.setItem(DEVICE_ID_KEY, id);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 自動認証: デバイスIDで初期化
  useEffect(() => {
    (async () => {
      try {
        const deviceId = getDeviceId();
        const data = await api.post('/auth/init', { deviceId });
        setTokens(data.accessToken, data.refreshToken);
        saveDeviceId(data.deviceId);
        setUser(data.user);
      } catch {
        // リトライ: トークンクリアして再試行
        clearTokens();
        try {
          const data = await api.post('/auth/init', {});
          setTokens(data.accessToken, data.refreshToken);
          saveDeviceId(data.deviceId);
          setUser(data.user);
        } catch {
          // サーバー接続失敗
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // トークン期限切れ時に再認証
  useEffect(() => {
    const handler = async () => {
      const deviceId = getDeviceId();
      if (deviceId) {
        try {
          const data = await api.post('/auth/init', { deviceId });
          setTokens(data.accessToken, data.refreshToken);
          setUser(data.user);
        } catch {
          setUser(null);
        }
      }
    };
    window.addEventListener('auth_expired', handler);
    return () => window.removeEventListener('auth_expired', handler);
  }, []);

  const updateName = useCallback(async (name: string) => {
    const data = await api.put('/auth/name', { name });
    setUser(prev => prev ? { ...prev, name: data.name } : null);
  }, []);

  // データリセット（別ユーザーとして使いたい場合）
  const resetDevice = useCallback(async () => {
    clearTokens();
    localStorage.removeItem(DEVICE_ID_KEY);
    const data = await api.post('/auth/init', {});
    setTokens(data.accessToken, data.refreshToken);
    saveDeviceId(data.deviceId);
    setUser(data.user);
  }, []);

  return { user, loading, updateName, resetDevice };
}
