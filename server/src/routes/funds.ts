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

// サンプルデータ（全カテゴリ網羅のフォールバック）
const sampleFunds: Fund[] = [
  { id: 'sample_1', name: 'eMAXIS Slim 全世界株式（オール・カントリー）', category: '全世界株式', nav: 24521, navChange: 125, totalAssets: 4200000, expenseRatio: 0.0578, return1y: 32.5, return3y: 18.2, return5y: 16.8, return10y: null, sharpeRatio: 1.25, stdDev: 14.2, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 4200000, assetTrend: 'up', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券', 'マネックス証券'], forexHedge: false },
  { id: 'sample_12', name: '楽天・全世界株式インデックス・ファンド', category: '全世界株式', nav: 21456, navChange: 98, totalAssets: 485000, expenseRatio: 0.192, return1y: 31.2, return3y: 17.5, return5y: 15.8, return10y: null, sharpeRatio: 1.18, stdDev: 14.5, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 485000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_2', name: 'eMAXIS Slim 米国株式（S&P500）', category: '先進国株式', nav: 29834, navChange: 198, totalAssets: 5100000, expenseRatio: 0.0937, return1y: 38.2, return3y: 22.1, return5y: 20.5, return10y: null, sharpeRatio: 1.42, stdDev: 15.8, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 5100000, assetTrend: 'up', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券', 'マネックス証券'], forexHedge: false },
  { id: 'sample_3', name: 'eMAXIS Slim 先進国株式インデックス', category: '先進国株式', nav: 28456, navChange: 156, totalAssets: 780000, expenseRatio: 0.0989, return1y: 35.1, return3y: 20.3, return5y: 18.9, return10y: 12.5, sharpeRatio: 1.35, stdDev: 15.1, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 780000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_10', name: 'ニッセイ外国株式インデックスファンド', category: '先進国株式', nav: 35678, navChange: 189, totalAssets: 720000, expenseRatio: 0.0989, return1y: 34.8, return3y: 19.8, return5y: 18.2, return10y: 12.1, sharpeRatio: 1.32, stdDev: 15.3, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 720000, assetTrend: 'up', inceptionYear: 2013, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_11', name: 'SBI・V・S&P500インデックス・ファンド', category: '先進国株式', nav: 25123, navChange: 165, totalAssets: 1850000, expenseRatio: 0.0638, return1y: 37.8, return3y: 21.8, return5y: null, return10y: null, sharpeRatio: 1.40, stdDev: 15.9, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 1850000, assetTrend: 'up', inceptionYear: 2021, sellers: ['SBI証券'], forexHedge: false },
  { id: 'sample_h1', name: 'eMAXIS Slim 先進国株式インデックス（為替ヘッジあり）', category: '先進国株式', nav: 15234, navChange: 45, totalAssets: 52000, expenseRatio: 0.1023, return1y: 18.5, return3y: 12.8, return5y: 11.2, return10y: 7.5, sharpeRatio: 0.95, stdDev: 14.2, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 52000, assetTrend: 'up', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  { id: 'sample_h3', name: 'eMAXIS Slim 全世界株式（オール・カントリー）（為替ヘッジあり）', category: '全世界株式', nav: 13456, navChange: 38, totalAssets: 18000, expenseRatio: 0.0578, return1y: 16.2, return3y: 11.5, return5y: 10.1, return10y: null, sharpeRatio: 0.85, stdDev: 13.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 18000, assetTrend: 'up', inceptionYear: 2022, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  { id: 'sample_h4', name: 'eMAXIS Slim 海外債券インデックス（為替ヘッジあり）', category: '海外債券', nav: 9876, navChange: 3, totalAssets: 15000, expenseRatio: 0.176, return1y: 1.2, return3y: -0.5, return5y: -0.2, return10y: 0.8, sharpeRatio: 0.05, stdDev: 4.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 15000, assetTrend: 'flat', inceptionYear: 2019, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  { id: 'sample_h6', name: 'iFree 新興国株式インデックス（為替ヘッジあり）', category: '新興国株式', nav: 12345, navChange: -20, totalAssets: 8000, expenseRatio: 0.374, return1y: 8.5, return3y: 4.2, return5y: 3.8, return10y: null, sharpeRatio: 0.32, stdDev: 16.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 8000, assetTrend: 'flat', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  { id: 'sample_h7', name: 'たわらノーロード先進国REIT（為替ヘッジあり）', category: 'REIT', nav: 11234, navChange: 10, totalAssets: 6500, expenseRatio: 0.33, return1y: 5.5, return3y: 1.2, return5y: 0.8, return10y: null, sharpeRatio: 0.15, stdDev: 16.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 6500, assetTrend: 'flat', inceptionYear: 2019, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  { id: 'sample_4', name: 'ニッセイ日経225インデックスファンド', category: '国内株式', nav: 42156, navChange: 230, totalAssets: 310000, expenseRatio: 0.275, return1y: 28.4, return3y: 15.6, return5y: 14.2, return10y: 10.8, sharpeRatio: 1.08, stdDev: 16.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 310000, assetTrend: 'up', inceptionYear: 2004, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_5', name: 'eMAXIS Slim 国内株式（TOPIX）', category: '国内株式', nav: 18923, navChange: 89, totalAssets: 195000, expenseRatio: 0.143, return1y: 25.8, return3y: 14.2, return5y: 13.1, return10y: 9.5, sharpeRatio: 0.98, stdDev: 15.2, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 195000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_6', name: 'eMAXIS Slim 新興国株式インデックス', category: '新興国株式', nav: 14523, navChange: -45, totalAssets: 185000, expenseRatio: 0.1518, return1y: 15.2, return3y: 8.5, return5y: 7.8, return10y: null, sharpeRatio: 0.52, stdDev: 18.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 185000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_7', name: 'eMAXIS Slim 国内債券インデックス', category: '国内債券', nav: 10234, navChange: 5, totalAssets: 120000, expenseRatio: 0.132, return1y: -1.2, return3y: -0.8, return5y: -0.3, return10y: 0.5, sharpeRatio: -0.15, stdDev: 2.1, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 120000, assetTrend: 'flat', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_21', name: 'たわらノーロード国内債券', category: '国内債券', nav: 10456, navChange: 3, totalAssets: 85000, expenseRatio: 0.154, return1y: -0.8, return3y: -0.5, return5y: -0.1, return10y: 0.8, sharpeRatio: -0.10, stdDev: 2.0, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 85000, assetTrend: 'flat', inceptionYear: 2015, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_8', name: 'eMAXIS Slim 海外債券インデックス', category: '海外債券', nav: 12456, navChange: 12, totalAssets: 95000, expenseRatio: 0.154, return1y: 8.5, return3y: 3.2, return5y: 2.8, return10y: 2.1, sharpeRatio: 0.45, stdDev: 8.2, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 95000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_22', name: 'たわらノーロード海外債券', category: '海外債券', nav: 13567, navChange: 8, totalAssets: 72000, expenseRatio: 0.187, return1y: 7.8, return3y: 2.9, return5y: 2.5, return10y: 1.8, sharpeRatio: 0.38, stdDev: 8.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 72000, assetTrend: 'up', inceptionYear: 2015, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_18', name: 'eMAXIS Slim 新興国債券インデックス', category: '新興国債券', nav: 11234, navChange: -8, totalAssets: 18000, expenseRatio: 0.22, return1y: 10.2, return3y: 4.5, return5y: 3.2, return10y: null, sharpeRatio: 0.38, stdDev: 12.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 18000, assetTrend: 'flat', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_13', name: 'たわらノーロード先進国REIT', category: 'REIT', nav: 13456, navChange: 23, totalAssets: 42000, expenseRatio: 0.297, return1y: 12.5, return3y: 5.8, return5y: 4.2, return10y: null, sharpeRatio: 0.55, stdDev: 18.2, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 42000, assetTrend: 'up', inceptionYear: 2015, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_15', name: 'eMAXIS Slim 国内リートインデックス', category: 'REIT', nav: 9856, navChange: -12, totalAssets: 35000, expenseRatio: 0.187, return1y: 5.2, return3y: 2.1, return5y: 1.8, return10y: 3.5, sharpeRatio: 0.22, stdDev: 14.8, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 35000, assetTrend: 'flat', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_19', name: 'SMTゴールドインデックス・オープン', category: 'コモディティ', nav: 18567, navChange: 78, totalAssets: 25000, expenseRatio: 0.275, return1y: 22.8, return3y: 12.5, return5y: 10.2, return10y: 7.8, sharpeRatio: 0.85, stdDev: 15.5, nisaEligible: false, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 25000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_23', name: 'iシェアーズ ゴールドインデックス・ファンド', category: 'コモディティ', nav: 15234, navChange: 65, totalAssets: 18000, expenseRatio: 0.509, return1y: 21.5, return3y: 11.8, return5y: 9.5, return10y: null, sharpeRatio: 0.78, stdDev: 15.8, nisaEligible: false, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 18000, assetTrend: 'up', inceptionYear: 2019, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_9', name: 'eMAXIS Slim バランス（8資産均等型）', category: 'バランス型', nav: 15678, navChange: 45, totalAssets: 285000, expenseRatio: 0.143, return1y: 16.5, return3y: 9.8, return5y: 8.5, return10y: null, sharpeRatio: 0.82, stdDev: 10.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 285000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_20', name: '楽天・インデックス・バランス（均等型）', category: 'バランス型', nav: 14567, navChange: 35, totalAssets: 95000, expenseRatio: 0.223, return1y: 14.2, return3y: 8.5, return5y: 7.2, return10y: null, sharpeRatio: 0.75, stdDev: 9.8, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 95000, assetTrend: 'up', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
];

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

  // 明らかに除外すべきファンドのみフィルタ（SBI/楽天で取扱不可が確実なもの）
  // スクレイピング結果を最大限活用する方針
  const excluded: RegExp[] = [
    /毎月分配/,
    /毎月決算/,
    /通貨選択型/,
    /ブル3倍|ベア3倍|ブル4倍|ベア4倍|4\.3倍/,
    /トルコリラ|ブラジルレアル|メキシコペソ/,
  ];
  const filtered: Fund[] = [];
  for (const f of map.values()) {
    if (excluded.some(re => re.test(f.name))) continue;
    // SBI/楽天の大手ファミリーはsellersに自動タグ付け（選定優先順位に寄与）
    f.sellers = inferSellers(f.name, f.sellers ?? []);
    filtered.push(f);
  }

  // サンプルデータ（ハードコード済みの全カテゴリ網羅ファンド）をマージ
  // スクレイピングが失敗したカテゴリの穴埋めとして機能
  const existingNames = new Set(filtered.map(f => f.name));
  for (const s of sampleFunds) {
    if (!existingNames.has(s.name)) filtered.push(s);
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

// GET /api/funds - ファンド一覧（DB即応、空ならサンプル）
router.get('/', async (_req: Request, res: Response) => {
  try {
    const dbFunds = loadFundsFromDB();
    // DB が空（スクレイピング未完了 or Render再起動でリセット）の場合はサンプルをフォールバック
    const funds = dbFunds.length > 0 ? dbFunds : sampleFunds;
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
