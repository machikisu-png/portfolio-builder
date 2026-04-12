const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

function getAccessToken(): string | null {
  return sessionStorage.getItem('access_token');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token');
}

export function setTokens(accessToken: string, refreshToken: string): void {
  sessionStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

export function clearTokens(): void {
  sessionStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export function hasToken(): boolean {
  return !!getAccessToken() || !!getRefreshToken();
}

// トークン自動更新
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      window.dispatchEvent(new Event('auth_expired'));
      return null;
    }
    const data = await res.json();
    sessionStorage.setItem('access_token', data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

async function request(method: string, path: string, body?: any, retry = true): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let token = getAccessToken();

  // アクセストークンがない場合はリフレッシュ試行
  if (!token) {
    token = await refreshAccessToken();
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // トークン期限切れ → リフレッシュして1回リトライ
  if (res.status === 401 && retry) {
    const data = await res.json().catch(() => ({}));
    if (data.code === 'TOKEN_EXPIRED') {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return request(method, path, body, false);
      }
    }
    clearTokens();
    window.dispatchEvent(new Event('auth_expired'));
    throw new Error(data.error || '認証エラー');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: any) => request('POST', path, body),
  put: (path: string, body: any) => request('PUT', path, body),
};
