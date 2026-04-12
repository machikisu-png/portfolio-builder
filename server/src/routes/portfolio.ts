import { Router, Response } from 'express';
import { getDB } from '../db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { encryptJSON, decryptJSON } from '../crypto';

const router = Router();
router.use(authMiddleware);

// 安全な復号ヘルパー（復号失敗時は空を返す）
function safeDecrypt(encrypted: string, fallback: any = null): any {
  try {
    return decryptJSON(encrypted);
  } catch {
    // 暗号化前の旧データ（JSON文字列）への後方互換
    try { return JSON.parse(encrypted); } catch { return fallback; }
  }
}

// GET /api/portfolio
router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDB();
  const row = db.prepare('SELECT items_json FROM portfolios WHERE user_id = ?').get(req.userId) as any;
  res.json({ items: row ? safeDecrypt(row.items_json, []) : [] });
});

// PUT /api/portfolio
router.put('/', (req: AuthRequest, res: Response) => {
  const { items } = req.body;
  const db = getDB();
  const encrypted = encryptJSON(items || []);
  const existing = db.prepare('SELECT id FROM portfolios WHERE user_id = ?').get(req.userId);

  if (existing) {
    db.prepare("UPDATE portfolios SET items_json = ?, updated_at = datetime('now') WHERE user_id = ?").run(encrypted, req.userId);
  } else {
    db.prepare('INSERT INTO portfolios (user_id, items_json) VALUES (?, ?)').run(req.userId, encrypted);
  }
  res.json({ ok: true });
});

// GET /api/portfolio/config
router.get('/config', (req: AuthRequest, res: Response) => {
  const db = getDB();
  const row = db.prepare('SELECT config_json FROM monitor_configs WHERE user_id = ?').get(req.userId) as any;
  res.json({ config: row ? safeDecrypt(row.config_json, null) : null });
});

// PUT /api/portfolio/config
router.put('/config', (req: AuthRequest, res: Response) => {
  const { config } = req.body;
  const db = getDB();
  const encrypted = encryptJSON(config);
  db.prepare(`INSERT INTO monitor_configs (user_id, config_json) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET config_json = excluded.config_json`).run(req.userId, encrypted);
  res.json({ ok: true });
});

// GET /api/portfolio/alerts
router.get('/alerts', (req: AuthRequest, res: Response) => {
  const db = getDB();
  const rows = db.prepare('SELECT id, alert_json, read, created_at FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.userId) as any[];
  const alerts = rows.map(r => ({ ...safeDecrypt(r.alert_json, {}), id: String(r.id), read: !!r.read }));
  res.json({ alerts });
});

// POST /api/portfolio/alerts
router.post('/alerts', (req: AuthRequest, res: Response) => {
  const { alerts } = req.body;
  const db = getDB();
  const stmt = db.prepare('INSERT INTO alerts (user_id, alert_json) VALUES (?, ?)');
  const insertMany = db.transaction((items: any[]) => {
    for (const a of items) stmt.run(req.userId, encryptJSON(a));
  });
  insertMany(alerts || []);
  res.json({ ok: true });
});

// PUT /api/portfolio/alerts/read
router.put('/alerts/read', (req: AuthRequest, res: Response) => {
  const { alertIds } = req.body;
  const db = getDB();
  if (alertIds === 'all') {
    db.prepare('UPDATE alerts SET read = 1 WHERE user_id = ?').run(req.userId);
  } else if (Array.isArray(alertIds)) {
    const stmt = db.prepare('UPDATE alerts SET read = 1 WHERE id = ? AND user_id = ?');
    for (const id of alertIds) stmt.run(id, req.userId);
  }
  res.json({ ok: true });
});

// GET /api/portfolio/snapshots
router.get('/snapshots', (req: AuthRequest, res: Response) => {
  const db = getDB();
  const row = db.prepare('SELECT snapshots_json FROM snapshots WHERE user_id = ?').get(req.userId) as any;
  res.json({ snapshots: row ? safeDecrypt(row.snapshots_json, []) : [] });
});

// PUT /api/portfolio/snapshots
router.put('/snapshots', (req: AuthRequest, res: Response) => {
  const { snapshots } = req.body;
  const db = getDB();
  const encrypted = encryptJSON(snapshots || []);
  db.prepare(`INSERT INTO snapshots (user_id, snapshots_json) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET snapshots_json = excluded.snapshots_json, updated_at = datetime('now')`).run(req.userId, encrypted);
  res.json({ ok: true });
});

export default router;
