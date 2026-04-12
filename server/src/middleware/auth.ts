import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'fallback-dev-only-secret';
}

function getRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || 'fallback-dev-only-refresh';
}

export interface AuthRequest extends Request {
  userId?: number;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  try {
    const token = header.substring(7);
    const payload = jwt.verify(token, getJwtSecret()) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'トークンの有効期限が切れています', code: 'TOKEN_EXPIRED' });
    } else {
      res.status(401).json({ error: 'トークンが無効です' });
    }
  }
}

// アクセストークン（短期: 1時間）
export function signAccessToken(userId: number): string {
  return jwt.sign({ userId, type: 'access' }, getJwtSecret(), { expiresIn: '1h' });
}

// リフレッシュトークン（長期: 30日）
export function signRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: 'refresh' }, getRefreshSecret(), { expiresIn: '30d' });
}

// リフレッシュトークン検証
export function verifyRefreshToken(token: string): { userId: number } | null {
  try {
    const payload = jwt.verify(token, getRefreshSecret()) as { userId: number; type: string };
    if (payload.type !== 'refresh') return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
