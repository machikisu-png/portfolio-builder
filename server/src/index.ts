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
import { initDB } from './db';
import fundsRouter from './routes/funds';
import authRouter from './routes/auth';
import portfolioRouter from './routes/portfolio';

// DB初期化
initDB();

const app = express();
const PORT = process.env.PORT || 3001;

// セキュリティヘッダー
app.use(helmet({
  contentSecurityPolicy: false, // SPAなので無効
  crossOriginEmbedderPolicy: false,
}));

// CORS（開発時はlocalhost許可、本番は環境変数で制御）
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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
