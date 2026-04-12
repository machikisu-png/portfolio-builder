import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDB } from '../db';
import { signAccessToken, signRefreshToken, verifyRefreshToken, authMiddleware, type AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/init — デバイスIDで自動認証（登録不要）
router.post('/init', (req: Request, res: Response) => {
  let { deviceId } = req.body;

  // deviceIdがなければ新規発行
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 10) {
    deviceId = crypto.randomUUID();
  }

  const db = getDB();
  let user = db.prepare('SELECT id, device_id, name FROM users WHERE device_id = ?').get(deviceId) as any;

  if (!user) {
    // 新規ユーザー自動作成
    const name = `ユーザー${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const result = db.prepare('INSERT INTO users (device_id, name) VALUES (?, ?)').run(deviceId, name);
    const userId = result.lastInsertRowid as number;
    db.prepare('INSERT INTO portfolios (user_id, items_json) VALUES (?, ?)').run(userId, '[]');
    user = { id: userId, device_id: deviceId, name };
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  res.json({
    accessToken,
    refreshToken,
    deviceId: user.device_id,
    user: { id: user.id, name: user.name },
  });
});

// PUT /api/auth/name — 名前変更
router.put('/name', authMiddleware, (req: AuthRequest, res: Response) => {
  const name = (req.body.name || '').trim().slice(0, 100);
  if (!name) {
    res.status(400).json({ error: '名前を入力してください' });
    return;
  }
  const db = getDB();
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.userId);
  res.json({ ok: true, name });
});

// POST /api/auth/refresh
router.post('/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'リフレッシュトークンが必要です' });
    return;
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    res.status(401).json({ error: 'トークンが無効または期限切れです' });
    return;
  }

  const db = getDB();
  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(payload.userId) as any;
  if (!user) {
    res.status(401).json({ error: 'ユーザーが存在しません' });
    return;
  }

  const newAccessToken = signAccessToken(user.id);
  res.json({ accessToken: newAccessToken });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDB();
  const user = db.prepare('SELECT id, name, created_at FROM users WHERE id = ?').get(req.userId) as any;
  if (!user) {
    res.status(404).json({ error: 'ユーザーが見つかりません' });
    return;
  }
  res.json({ user });
});

export default router;
