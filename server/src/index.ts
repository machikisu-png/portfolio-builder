// 環境変数を最初に読み込む
import path from 'path';
import fs from 'fs';
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import zlib from 'zlib';
import { initDB } from './db';
import fundsRouter, { startBackgroundScrape } from './routes/funds';
import authRouter from './routes/auth';
import portfolioRouter from './routes/portfolio';

// DB初期化
initDB();

// 起動後に全ファンドスクレイピング（非同期・非ブロッキング）
setTimeout(() => startBackgroundScrape(), 1000);

const app = express();
const PORT = process.env.PORT || 3001;

// セキュリティヘッダー
app.use(helmet({
  contentSecurityPolicy: false, // SPAなので無効
  crossOriginEmbedderPolicy: false,
}));

// CORS（開発時はlocalhost許可、本番は環境変数 + *.vercel.app 全許可）
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];

// Vercel のプレビュー/本番デプロイをすべて許可するための正規表現
const vercelPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin) || vercelPattern.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// レート制限
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
  max: 100, // 一般APIは1分に100回まで
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '1mb' })); // ボディサイズ制限

// gzip圧縮（1KB超のレスポンスのみ）
app.use((req, res, next) => {
  const accept = req.headers['accept-encoding'] || '';
  if (typeof accept !== 'string' || !accept.includes('gzip')) return next();
  const origJson = res.json.bind(res);
  res.json = (body: unknown) => {
    const str = JSON.stringify(body);
    if (str.length < 1024) return origJson(body);
    try {
      const buf = zlib.gzipSync(str);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', String(buf.length));
      res.end(buf);
      return res;
    } catch {
      return origJson(body);
    }
  };
  next();
});

// ルーティング
app.use('/api/auth', apiLimiter, authRouter);
app.use('/api/funds', apiLimiter, fundsRouter);
app.use('/api/portfolio', apiLimiter, portfolioRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
