import { Router, Request, Response } from 'express';
import { scrapeWealthAdvisor, scrapeWealthAdvisorAllPages } from '../scrapers/wealthadvisor';
import { scrapeMinkabuAllPages } from '../scrapers/minkabu';
import { getDB } from '../db';

const router = Router();

interface Fund {
  id: string;
  name: string;
  category: string;
  nav: number;
  navChange: number;
  totalAssets: number;
  expenseRatio: number;
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
  return10y: number | null;
  sharpeRatio: number | null;
  stdDev: number | null;
  nisaEligible: boolean;
  source: 'wealthadvisor' | 'minkabu';
  settlementFrequency: number | null;
  distributionAmount: number | null;
  fundSizeMillions: number | null;
  assetTrend: 'up' | 'flat' | 'down' | null;
  inceptionYear: number | null;
  sellers: string[];
  forexHedge: boolean | null;
}

// SBI・楽天の取扱ファンド判定（名前ベースのヒューリスティック）
// 大手インデックス系ファミリは両社で取扱われているのが通例
const MAJOR_FAMILIES_RAKUTEN_SBI: RegExp[] = [
  /eMAXIS\s*Slim/i,
  /eMAXIS/i,
  /SBI[・·]?V[・·]/i,
  /SBI[・·]/i,
  /楽天[・·]/i,
  /ニッセイ/,
  /たわらノーロード/,
  /iFree(NEXT)?/i,
  /iシェアーズ/,
  /ひふみ/,
  /東京海上/,
  /Smart[・·]?i/i,
  /野村/,
  /三井住友/,
  /大和/,
  /りそな/,
  /インベスコ/,
  /フィデリティ/,
  /ピクテ/,
  /アライアンス[・·]バーンスタイン/,
  /グローバル[・·]?X/i,
  /SMT/,
];

function isLikelyAtSbiOrRakuten(name: string): boolean {
  return MAJOR_FAMILIES_RAKUTEN_SBI.some(p => p.test(name));
}

function inferSellers(name: string, existing: string[]): string[] {
  const sellers = new Set(existing);
  if (isLikelyAtSbiOrRakuten(name)) {
    sellers.add('SBI証券');
    sellers.add('楽天証券');
  }
  // 特定社名プレフィックスからさらに推定
  if (/SBI[・·]?V[・·]/i.test(name) || /^SBI[・·]/i.test(name)) sellers.add('SBI証券');
  if (/^楽天[・·]/i.test(name)) sellers.add('楽天証券');
  return Array.from(sellers);
}

function guessCategory(name: string): string {
  if (name.includes('日経') || name.includes('TOPIX') || name.includes('日本株')) return '国内株式';
  if (name.includes('S&P') || name.includes('先進国') || name.includes('米国') || name.includes('ナスダック') || name.includes('NASDAQ')) return '先進国株式';
  if (name.includes('新興国') || name.includes('エマージング')) return '新興国株式';
  if (name.includes('全世界') || name.includes('オールカントリー') || name.includes('オール・カントリー') || name.includes('グローバル株')) return '全世界株式';
  if (name.includes('国内債券') || name.includes('日本債')) return '国内債券';
  if (name.includes('新興国債')) return '新興国債券';
  if (name.includes('先進国債') || name.includes('外国債') || name.includes('米国債') || name.includes('欧州債') || name.includes('グローバル債')) return '海外債券';
  if (name.includes('バランス') || name.includes('8資産')) return 'バランス型';
  if (name.includes('REIT') || name.includes('リート') || name.includes('不動産')) return 'REIT';
  if (name.includes('ゴールド') || name.includes('金') || name.includes('コモディティ') || name.includes('原油')) return 'コモディティ';
  return 'その他';
}

function isHedged(name: string): boolean {
  return /為替ヘッジ|ヘッジあり|ヘッジ付|（ヘッジあり）|\(ヘッジあり\)/.test(name);
}

// ---- DBアクセス ----
function saveFundsToDB(funds: Fund[]): void {
  const db = getDB();
  const upsert = db.prepare(
    `INSERT INTO funds_cache (id, name, fund_json, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, fund_json=excluded.fund_json, updated_at=datetime('now')`
  );
  const tx = db.transaction((rows: Fund[]) => {
    for (const f of rows) upsert.run(f.id, f.name, JSON.stringify(f));
  });
  tx(funds);

  db.prepare(
    `INSERT INTO scrape_meta (key, value, updated_at) VALUES ('last_scrape', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`
  ).run(String(Date.now()));
}

function loadFundsFromDB(): Fund[] {
  const db = getDB();
  const rows = db.prepare('SELECT fund_json FROM funds_cache').all() as Array<{ fund_json: string }>;
  const funds: Fund[] = [];
  for (const r of rows) {
    try {
      funds.push(JSON.parse(r.fund_json));
    } catch {}
  }
  return funds;
}

function getLastScrapeTime(): number {
  try {
    const db = getDB();
    const row = db.prepare(`SELECT value FROM scrape_meta WHERE key = 'last_scrape'`).get() as { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

// ---- スクレイピング統合 ----
const SCRAPE_INTERVAL = 24 * 60 * 60 * 1000; // 24時間
const defaultExtras = {
  settlementFrequency: null,
  distributionAmount: null,
  fundSizeMillions: null as number | null,
  assetTrend: null as 'up' | 'flat' | 'down' | null,
  inceptionYear: null,
  sellers: [] as string[],
  forexHedge: null as boolean | null,
};

const MINKABU_CATEGORIES: Array<{ fundType: string; label: string }> = [
  { fundType: 'jp_stock', label: '国内株式' },
  { fundType: 'intl_stock', label: '先進国株式' },
  { fundType: 'emerging', label: '新興国株式' },
  { fundType: 'jp_bond', label: '国内債券' },
  { fundType: 'intl_bond', label: '海外債券' },
  { fundType: 'reit', label: 'REIT' },
  { fundType: 'commodity', label: 'コモディティ' },
  { fundType: 'balance', label: 'バランス型' },
];

// 内部: スクレイピングして統合 → SBI/楽天取扱分のみに絞り込み → DB保存
let scrapingInProgress = false;
export async function runFullScrape(): Promise<{ count: number; durationMs: number }> {
  if (scrapingInProgress) return { count: 0, durationMs: 0 };
  scrapingInProgress = true;
  const start = Date.now();
  const map = new Map<string, Fund>(); // name → fund（同一ファンドの重複回避）

  const mergeByName = (f: Fund) => {
    const key = f.name;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, f);
      return;
    }
    // マージ: null を埋める方向
    const merged: Fund = { ...existing };
    for (const k of Object.keys(f) as Array<keyof Fund>) {
      const v = (f as any)[k];
      if (v !== null && v !== undefined && ((existing as any)[k] === null || (existing as any)[k] === 0 || (existing as any)[k] === '')) {
        (merged as any)[k] = v;
      }
    }
    // sellers は配列マージ
    merged.sellers = Array.from(new Set([...(existing.sellers ?? []), ...(f.sellers ?? [])]));
    map.set(key, merged);
  };

  try {
    console.log('[scrape] WealthAdvisor 全ページ取得開始');
    const wa = await scrapeWealthAdvisorAllPages({ maxPages: 50, delayMs: 300 });
    console.log(`[scrape] WA: ${wa.length}件`);
    for (const f of wa) {
      const fund: Fund = {
        id: f.id,
        name: f.name,
        category: f.category || guessCategory(f.name),
        nav: f.nav,
        navChange: f.navChange,
        totalAssets: f.totalAssets,
        expenseRatio: f.expenseRatio,
        return1y: f.return1y,
        return3y: f.return3y,
        return5y: f.return5y,
        return10y: f.return10y,
        sharpeRatio: f.sharpeRatio,
        stdDev: f.stdDev,
        nisaEligible: f.nisaEligible,
        source: 'wealthadvisor',
        ...defaultExtras,
        fundSizeMillions: f.totalAssets || null,
        forexHedge: isHedged(f.name) ? true : null,
      };
      mergeByName(fund);
    }

    // MINKABU: 総合リターン + シャープ + 全カテゴリ
    console.log('[scrape] MINKABU return 全ページ');
    const mkReturn = await scrapeMinkabuAllPages('return', { maxPages: 30, delayMs: 400 });
    console.log(`[scrape] MK return: ${mkReturn.length}件`);
    for (const f of mkReturn) {
      mergeByName({
        id: f.id,
        name: f.name,
        category: f.category,
        nav: f.nav,
        navChange: f.navChange,
        totalAssets: f.totalAssets,
        expenseRatio: f.expenseRatio,
        return1y: f.return1y,
        return3y: f.return3y,
        return5y: f.return5y,
        return10y: null,
        sharpeRatio: f.sharpeRatio,
        stdDev: null,
        nisaEligible: f.nisaEligible,
        source: 'minkabu',
        ...defaultExtras,
        forexHedge: isHedged(f.name) ? true : null,
      });
    }

    console.log('[scrape] MINKABU sharpe 全ページ');
    const mkSharpe = await scrapeMinkabuAllPages('sharpe', { maxPages: 30, delayMs: 400 });
    console.log(`[scrape] MK sharpe: ${mkSharpe.length}件`);
    for (const f of mkSharpe) {
      mergeByName({
        id: f.id,
        name: f.name,
        category: f.category,
        nav: f.nav,
        navChange: f.navChange,
        totalAssets: f.totalAssets,
        expenseRatio: f.expenseRatio,
        return1y: f.return1y,
        return3y: f.return3y,
        return5y: f.return5y,
        return10y: null,
        sharpeRatio: f.sharpeRatio,
        stdDev: null,
        nisaEligible: f.nisaEligible,
        source: 'minkabu',
        ...defaultExtras,
        forexHedge: isHedged(f.name) ? true : null,
      });
    }

    for (const cat of MINKABU_CATEGORIES) {
      console.log(`[scrape] MINKABU category=${cat.label}`);
      const list = await scrapeMinkabuAllPages('category', { fundType: cat.fundType, categoryOverride: cat.label, maxPages: 20, delayMs: 400 });
      console.log(`[scrape] MK ${cat.label}: ${list.length}件`);
      for (const f of list) {
        mergeByName({
          id: f.id,
          name: f.name,
          category: f.category || cat.label,
          nav: f.nav,
          navChange: f.navChange,
          totalAssets: f.totalAssets,
          expenseRatio: f.expenseRatio,
          return1y: f.return1y,
          return3y: f.return3y,
          return5y: f.return5y,
          return10y: null,
          sharpeRatio: f.sharpeRatio,
          stdDev: null,
          nisaEligible: f.nisaEligible,
          source: 'minkabu',
          ...defaultExtras,
          forexHedge: isHedged(f.name) ? true : null,
        });
      }
    }
  } catch (e) {
    console.error('[scrape] error:', e);
  }

  // SBI/楽天で取扱の可能性が高いもののみに絞る + sellersを付与
  const filtered: Fund[] = [];
  for (const f of map.values()) {
    if (!isLikelyAtSbiOrRakuten(f.name)) continue;
    f.sellers = inferSellers(f.name, f.sellers ?? []);
    filtered.push(f);
  }

  try {
    saveFundsToDB(filtered);
  } catch (e) {
    console.error('[scrape] DB save error:', e);
  }

  scrapingInProgress = false;
  const durationMs = Date.now() - start;
  console.log(`[scrape] 完了: ${filtered.length}件 / ${Math.round(durationMs / 1000)}s`);
  return { count: filtered.length, durationMs };
}

// 起動時: DBが空なら即スクレイピング、あれば24時間超なら非同期更新
export function startBackgroundScrape(): void {
  try {
    const funds = loadFundsFromDB();
    const last = getLastScrapeTime();
    const age = Date.now() - last;
    if (funds.length === 0) {
      console.log('[scrape] DB 空。初回スクレイピング開始（バックグラウンド）');
      runFullScrape().catch(e => console.error(e));
    } else if (age > SCRAPE_INTERVAL) {
      console.log(`[scrape] DB は ${Math.round(age / 3600000)}時間前。再スクレイピング開始`);
      runFullScrape().catch(e => console.error(e));
    } else {
      console.log(`[scrape] DB キャッシュ有効（${funds.length}件, ${Math.round(age / 3600000)}時間前）`);
    }
  } catch (e) {
    console.error('[scrape] 起動時チェックエラー:', e);
  }
}

// GET /api/funds - ファンド一覧（DB即応）
router.get('/', async (_req: Request, res: Response) => {
  try {
    const funds = loadFundsFromDB();
    const { category, nisaOnly, source, sortBy, sortOrder, minReturn, maxExpenseRatio, q, limit } = _req.query;

    let filtered = [...funds];

    if (q && typeof q === 'string') {
      const query = q.toLowerCase();
      filtered = filtered.filter(f => f.name.toLowerCase().includes(query));
    }
    if (category && category !== '') filtered = filtered.filter(f => f.category === category);
    if (nisaOnly === 'true') filtered = filtered.filter(f => f.nisaEligible);
    if (source && source !== 'all') filtered = filtered.filter(f => f.source === source);
    if (minReturn) {
      const min = parseFloat(minReturn as string);
      filtered = filtered.filter(f => (f.return1y ?? 0) >= min);
    }
    if (maxExpenseRatio) {
      const max = parseFloat(maxExpenseRatio as string);
      filtered = filtered.filter(f => f.expenseRatio <= max);
    }

    const sort = (sortBy as string) || 'return1y';
    const order = sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a: any, b: any) => {
      const va = a[sort] ?? -Infinity;
      const vb = b[sort] ?? -Infinity;
      return (va - vb) * order;
    });

    const lim = limit ? parseInt(limit as string, 10) : 0;
    const out = lim > 0 ? filtered.slice(0, lim) : filtered;
    res.json({ funds: out, total: filtered.length });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Failed to fetch funds' });
  }
});

// GET /api/funds/meta - スクレイピング状態
router.get('/meta', (_req: Request, res: Response) => {
  try {
    const db = getDB();
    const countRow = db.prepare('SELECT COUNT(*) as c FROM funds_cache').get() as { c: number };
    const last = getLastScrapeTime();
    res.json({ count: countRow.c, lastScrape: last, inProgress: scrapingInProgress });
  } catch (e) {
    res.status(500).json({ error: 'meta failed' });
  }
});

// POST /api/funds/refresh - 手動再取得（デバッグ用）
router.post('/refresh', async (_req: Request, res: Response) => {
  if (scrapingInProgress) {
    res.json({ started: false, reason: 'already running' });
    return;
  }
  runFullScrape().catch(e => console.error(e));
  res.json({ started: true });
});

// GET /api/funds/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDB();
    const row = db.prepare('SELECT fund_json FROM funds_cache WHERE id = ?').get(req.params.id) as { fund_json: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }
    res.json(JSON.parse(row.fund_json));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fund' });
  }
});

// 使わなくなった関数（過去との互換用にエクスポート維持）
export { scrapeWealthAdvisor };

export default router;
