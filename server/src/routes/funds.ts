import { Router, Request, Response } from 'express';
import { scrapeWealthAdvisor } from '../scrapers/wealthadvisor';
import { scrapeMinkabu, scrapeMinkabuSharpe, scrapeMinkabuByCategory } from '../scrapers/minkabu';

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

// キャッシュ（メモリ内）
let cachedFunds: Fund[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30分

// サンプルデータ（全カテゴリ網羅 + 選定条件フィールド付き）
// settlementFrequency: 決算回数/年, distributionAmount: 分配金(円), fundSizeMillions: 規模(百万), assetTrend, inceptionYear, sellers
const sampleFunds: Fund[] = [
  // 全世界株式
  { id: 'sample_1', name: 'eMAXIS Slim 全世界株式（オール・カントリー）', category: '全世界株式', nav: 24521, navChange: 125, totalAssets: 4200000, expenseRatio: 0.0578, return1y: 32.5, return3y: 18.2, return5y: 16.8, return10y: null, sharpeRatio: 1.25, stdDev: 14.2, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 4200000, assetTrend: 'up', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券', 'マネックス証券'], forexHedge: false },
  { id: 'sample_12', name: '楽天・全世界株式インデックス・ファンド', category: '全世界株式', nav: 21456, navChange: 98, totalAssets: 485000, expenseRatio: 0.192, return1y: 31.2, return3y: 17.5, return5y: 15.8, return10y: null, sharpeRatio: 1.18, stdDev: 14.5, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 485000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  // 先進国株式
  { id: 'sample_2', name: 'eMAXIS Slim 米国株式（S&P500）', category: '先進国株式', nav: 29834, navChange: 198, totalAssets: 5100000, expenseRatio: 0.0937, return1y: 38.2, return3y: 22.1, return5y: 20.5, return10y: null, sharpeRatio: 1.42, stdDev: 15.8, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 5100000, assetTrend: 'up', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券', 'マネックス証券'], forexHedge: false },
  { id: 'sample_3', name: 'eMAXIS Slim 先進国株式インデックス', category: '先進国株式', nav: 28456, navChange: 156, totalAssets: 780000, expenseRatio: 0.0989, return1y: 35.1, return3y: 20.3, return5y: 18.9, return10y: 12.5, sharpeRatio: 1.35, stdDev: 15.1, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 780000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_10', name: 'ニッセイ外国株式インデックスファンド', category: '先進国株式', nav: 35678, navChange: 189, totalAssets: 720000, expenseRatio: 0.0989, return1y: 34.8, return3y: 19.8, return5y: 18.2, return10y: 12.1, sharpeRatio: 1.32, stdDev: 15.3, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 720000, assetTrend: 'up', inceptionYear: 2013, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_11', name: 'SBI・V・S&P500インデックス・ファンド', category: '先進国株式', nav: 25123, navChange: 165, totalAssets: 1850000, expenseRatio: 0.0638, return1y: 37.8, return3y: 21.8, return5y: null, return10y: null, sharpeRatio: 1.40, stdDev: 15.9, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 1850000, assetTrend: 'up', inceptionYear: 2021, sellers: ['SBI証券'], forexHedge: false },
  { id: 'sample_16', name: 'SBI・V・全米株式インデックス・ファンド', category: '先進国株式', nav: 18234, navChange: 132, totalAssets: 320000, expenseRatio: 0.0638, return1y: 36.5, return3y: 20.8, return5y: null, return10y: null, sharpeRatio: 1.38, stdDev: 16.1, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 320000, assetTrend: 'up', inceptionYear: 2021, sellers: ['SBI証券'], forexHedge: false },
  { id: 'sample_14', name: 'iFreeNEXT FANG+インデックス', category: '先進国株式', nav: 52341, navChange: 425, totalAssets: 285000, expenseRatio: 0.7755, return1y: 65.2, return3y: 35.8, return5y: 32.1, return10y: null, sharpeRatio: 1.85, stdDev: 25.8, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 285000, assetTrend: 'up', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  // 先進国株式（為替ヘッジあり）
  { id: 'sample_h1', name: 'eMAXIS Slim 先進国株式インデックス（為替ヘッジあり）', category: '先進国株式', nav: 15234, navChange: 45, totalAssets: 52000, expenseRatio: 0.1023, return1y: 18.5, return3y: 12.8, return5y: 11.2, return10y: 7.5, sharpeRatio: 0.95, stdDev: 14.2, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 52000, assetTrend: 'up', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  { id: 'sample_h2', name: 'たわらノーロード先進国株式（為替ヘッジあり）', category: '先進国株式', nav: 16789, navChange: 52, totalAssets: 28000, expenseRatio: 0.22, return1y: 17.8, return3y: 12.2, return5y: 10.8, return10y: null, sharpeRatio: 0.88, stdDev: 13.8, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 28000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  // 全世界株式（為替ヘッジあり）
  { id: 'sample_h3', name: 'eMAXIS Slim 全世界株式（オール・カントリー）（為替ヘッジあり）', category: '全世界株式', nav: 13456, navChange: 38, totalAssets: 18000, expenseRatio: 0.0578, return1y: 16.2, return3y: 11.5, return5y: 10.1, return10y: null, sharpeRatio: 0.85, stdDev: 13.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 18000, assetTrend: 'up', inceptionYear: 2022, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  // 海外債券（為替ヘッジあり）
  { id: 'sample_h4', name: 'eMAXIS Slim 海外債券インデックス（為替ヘッジあり）', category: '海外債券', nav: 9876, navChange: 3, totalAssets: 15000, expenseRatio: 0.176, return1y: 1.2, return3y: -0.5, return5y: -0.2, return10y: 0.8, sharpeRatio: 0.05, stdDev: 4.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 15000, assetTrend: 'flat', inceptionYear: 2019, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  { id: 'sample_h5', name: 'たわらノーロード海外債券（為替ヘッジあり）', category: '海外債券', nav: 10123, navChange: 2, totalAssets: 12000, expenseRatio: 0.22, return1y: 0.8, return3y: -0.8, return5y: -0.5, return10y: 0.5, sharpeRatio: 0.02, stdDev: 4.8, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 12000, assetTrend: 'flat', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  // 新興国株式（為替ヘッジあり）
  { id: 'sample_h6', name: 'iFree 新興国株式インデックス（為替ヘッジあり）', category: '新興国株式', nav: 12345, navChange: -20, totalAssets: 8000, expenseRatio: 0.374, return1y: 8.5, return3y: 4.2, return5y: 3.8, return10y: null, sharpeRatio: 0.32, stdDev: 16.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 8000, assetTrend: 'flat', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  // REIT（為替ヘッジあり）
  { id: 'sample_h7', name: 'たわらノーロード先進国REIT（為替ヘッジあり）', category: 'REIT', nav: 11234, navChange: 10, totalAssets: 6500, expenseRatio: 0.33, return1y: 5.5, return3y: 1.2, return5y: 0.8, return10y: null, sharpeRatio: 0.15, stdDev: 16.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 6500, assetTrend: 'flat', inceptionYear: 2019, sellers: ['楽天証券', 'SBI証券'], forexHedge: true },
  // 国内株式
  { id: 'sample_4', name: 'ニッセイ日経225インデックスファンド', category: '国内株式', nav: 42156, navChange: 230, totalAssets: 310000, expenseRatio: 0.275, return1y: 28.4, return3y: 15.6, return5y: 14.2, return10y: 10.8, sharpeRatio: 1.08, stdDev: 16.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 310000, assetTrend: 'up', inceptionYear: 2004, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_5', name: 'eMAXIS Slim 国内株式（TOPIX）', category: '国内株式', nav: 18923, navChange: 89, totalAssets: 195000, expenseRatio: 0.143, return1y: 25.8, return3y: 14.2, return5y: 13.1, return10y: 9.5, sharpeRatio: 0.98, stdDev: 15.2, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 195000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_17', name: 'ひふみプラス', category: '国内株式', nav: 52340, navChange: 180, totalAssets: 480000, expenseRatio: 1.078, return1y: 18.5, return3y: 8.2, return5y: 7.5, return10y: 11.2, sharpeRatio: 0.68, stdDev: 14.8, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 480000, assetTrend: 'flat', inceptionYear: 2012, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  // 新興国株式
  { id: 'sample_6', name: 'eMAXIS Slim 新興国株式インデックス', category: '新興国株式', nav: 14523, navChange: -45, totalAssets: 185000, expenseRatio: 0.1518, return1y: 15.2, return3y: 8.5, return5y: 7.8, return10y: null, sharpeRatio: 0.52, stdDev: 18.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 185000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  // 国内債券
  { id: 'sample_7', name: 'eMAXIS Slim 国内債券インデックス', category: '国内債券', nav: 10234, navChange: 5, totalAssets: 120000, expenseRatio: 0.132, return1y: -1.2, return3y: -0.8, return5y: -0.3, return10y: 0.5, sharpeRatio: -0.15, stdDev: 2.1, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 120000, assetTrend: 'flat', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_21', name: 'たわらノーロード国内債券', category: '国内債券', nav: 10456, navChange: 3, totalAssets: 85000, expenseRatio: 0.154, return1y: -0.8, return3y: -0.5, return5y: -0.1, return10y: 0.8, sharpeRatio: -0.10, stdDev: 2.0, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 85000, assetTrend: 'flat', inceptionYear: 2015, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  // 海外債券
  { id: 'sample_8', name: 'eMAXIS Slim 海外債券インデックス', category: '海外債券', nav: 12456, navChange: 12, totalAssets: 95000, expenseRatio: 0.154, return1y: 8.5, return3y: 3.2, return5y: 2.8, return10y: 2.1, sharpeRatio: 0.45, stdDev: 8.2, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 95000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_22', name: 'たわらノーロード海外債券', category: '海外債券', nav: 13567, navChange: 8, totalAssets: 72000, expenseRatio: 0.187, return1y: 7.8, return3y: 2.9, return5y: 2.5, return10y: 1.8, sharpeRatio: 0.38, stdDev: 8.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 72000, assetTrend: 'up', inceptionYear: 2015, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  // 新興国債券
  { id: 'sample_18', name: 'eMAXIS Slim 新興国債券インデックス', category: '新興国債券', nav: 11234, navChange: -8, totalAssets: 18000, expenseRatio: 0.22, return1y: 10.2, return3y: 4.5, return5y: 3.2, return10y: null, sharpeRatio: 0.38, stdDev: 12.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 18000, assetTrend: 'flat', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  // REIT
  { id: 'sample_13', name: 'たわらノーロード先進国REIT', category: 'REIT', nav: 13456, navChange: 23, totalAssets: 42000, expenseRatio: 0.297, return1y: 12.5, return3y: 5.8, return5y: 4.2, return10y: null, sharpeRatio: 0.55, stdDev: 18.2, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 42000, assetTrend: 'up', inceptionYear: 2015, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_15', name: 'eMAXIS Slim 国内リートインデックス', category: 'REIT', nav: 9856, navChange: -12, totalAssets: 35000, expenseRatio: 0.187, return1y: 5.2, return3y: 2.1, return5y: 1.8, return10y: 3.5, sharpeRatio: 0.22, stdDev: 14.8, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 35000, assetTrend: 'flat', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  // コモディティ
  { id: 'sample_19', name: 'SMTゴールドインデックス・オープン', category: 'コモディティ', nav: 18567, navChange: 78, totalAssets: 25000, expenseRatio: 0.275, return1y: 22.8, return3y: 12.5, return5y: 10.2, return10y: 7.8, sharpeRatio: 0.85, stdDev: 15.5, nisaEligible: false, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 25000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_23', name: 'iシェアーズ ゴールドインデックス・ファンド', category: 'コモディティ', nav: 15234, navChange: 65, totalAssets: 18000, expenseRatio: 0.509, return1y: 21.5, return3y: 11.8, return5y: 9.5, return10y: null, sharpeRatio: 0.78, stdDev: 15.8, nisaEligible: false, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 18000, assetTrend: 'up', inceptionYear: 2019, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  // バランス型
  { id: 'sample_9', name: 'eMAXIS Slim バランス（8資産均等型）', category: 'バランス型', nav: 15678, navChange: 45, totalAssets: 285000, expenseRatio: 0.143, return1y: 16.5, return3y: 9.8, return5y: 8.5, return10y: null, sharpeRatio: 0.82, stdDev: 10.5, nisaEligible: true, source: 'wealthadvisor', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 285000, assetTrend: 'up', inceptionYear: 2017, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
  { id: 'sample_20', name: '楽天・インデックス・バランス（均等型）', category: 'バランス型', nav: 14567, navChange: 35, totalAssets: 95000, expenseRatio: 0.223, return1y: 14.2, return3y: 8.5, return5y: 7.2, return10y: null, sharpeRatio: 0.75, stdDev: 9.8, nisaEligible: true, source: 'minkabu', settlementFrequency: 1, distributionAmount: 0, fundSizeMillions: 95000, assetTrend: 'up', inceptionYear: 2018, sellers: ['楽天証券', 'SBI証券'], forexHedge: false },
];

async function fetchAllFunds(): Promise<Fund[]> {
  const now = Date.now();
  if (cachedFunds.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedFunds;
  }

  console.log('Fetching fund data from sources...');
  const allFunds: Fund[] = [];
  const defaultExtras = { settlementFrequency: null, distributionAmount: null, fundSizeMillions: null, assetTrend: null as 'up' | 'flat' | 'down' | null, inceptionYear: null, sellers: [] as string[], forexHedge: null as boolean | null };
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  try {
    // バッチ1: WealthAdvisor 3ページ + Minkabuリターン 3ページ
    const waResults = await Promise.allSettled([
      scrapeWealthAdvisor(1),
      scrapeWealthAdvisor(2),
      scrapeWealthAdvisor(3),
    ]);
    const mkResults = await Promise.allSettled([
      scrapeMinkabu(1),
      scrapeMinkabu(2),
      scrapeMinkabu(3),
    ]);

    // WealthAdvisor結果をマージ
    for (const result of waResults) {
      if (result.status === 'fulfilled') {
        for (const f of result.value) {
          if (!allFunds.some(af => af.name === f.name)) {
            allFunds.push({ ...f, return10y: f.return10y ?? null, source: 'wealthadvisor', ...defaultExtras, fundSizeMillions: f.totalAssets || null });
          }
        }
      }
    }

    // Minkabuリターン結果をマージ
    for (const result of mkResults) {
      if (result.status === 'fulfilled') {
        for (const f of result.value) {
          if (!allFunds.some(af => af.name === f.name)) {
            allFunds.push({ ...f, return10y: null, stdDev: null, source: 'minkabu', ...defaultExtras });
          }
        }
      }
    }

    console.log(`  バッチ1完了: WA+MK リターン ${allFunds.length}件`);
    await delay(1500);

    // バッチ2: シャープレシオ 3ページ + カテゴリ別（債券）
    const batch2 = await Promise.allSettled([
      scrapeMinkabuSharpe(1),
      scrapeMinkabuSharpe(2),
      scrapeMinkabuSharpe(3),
      scrapeMinkabuByCategory('jp_bond', '国内債券', 1),
      scrapeMinkabuByCategory('jp_bond', '国内債券', 2),
      scrapeMinkabuByCategory('intl_bond', '海外債券', 1),
      scrapeMinkabuByCategory('intl_bond', '海外債券', 2),
    ]);

    // シャープレシオデータをマージ
    for (let i = 0; i < 3; i++) {
      const result = batch2[i];
      if (result.status === 'fulfilled') {
        for (const sf of result.value) {
          const existing = allFunds.find(f => f.name === sf.name);
          if (existing) {
            existing.sharpeRatio = sf.sharpeRatio;
          } else {
            allFunds.push({ ...sf, return10y: null, stdDev: null, source: 'minkabu', ...defaultExtras });
          }
        }
      }
    }

    // カテゴリ別債券データをマージ
    for (let i = 3; i < 7; i++) {
      const result = batch2[i];
      if (result.status === 'fulfilled') {
        const label = i < 5 ? '国内債券' : '国際債券';
        console.log(`  ${label} p${i < 5 ? i - 2 : i - 4}: ${result.value.length}件取得`);
        for (const f of result.value) {
          if (!allFunds.some(af => af.name === f.name)) {
            allFunds.push({ ...f, return10y: null, stdDev: null, source: 'minkabu', ...defaultExtras });
          }
        }
      }
    }

    console.log(`  バッチ2完了: シャープ+債券 合計${allFunds.length}件`);
    await delay(1500);

    // バッチ3: 追加カテゴリ（REIT、新興国株式、国内株式、先進国株式）
    const batch3 = await Promise.allSettled([
      scrapeMinkabuByCategory('reit', 'REIT', 1),
      scrapeMinkabuByCategory('reit', 'REIT', 2),
      scrapeMinkabuByCategory('emerging', '新興国株式', 1),
      scrapeMinkabuByCategory('emerging', '新興国株式', 2),
      scrapeMinkabuByCategory('jp_stock', '国内株式', 1),
      scrapeMinkabuByCategory('jp_stock', '国内株式', 2),
      scrapeMinkabuByCategory('intl_stock', '先進国株式', 1),
      scrapeMinkabuByCategory('intl_stock', '先進国株式', 2),
    ]);

    for (const result of batch3) {
      if (result.status === 'fulfilled') {
        for (const f of result.value) {
          if (!allFunds.some(af => af.name === f.name)) {
            allFunds.push({ ...f, return10y: null, stdDev: null, source: 'minkabu', ...defaultExtras });
          }
        }
      }
    }

    console.log(`  バッチ3完了: REIT+新興国+国内株+先進国株 合計${allFunds.length}件`);
    await delay(1500);

    // バッチ4: バランス型、コモディティ、WealthAdvisor追加ページ
    const batch4 = await Promise.allSettled([
      scrapeMinkabuByCategory('balance', 'バランス型', 1),
      scrapeMinkabuByCategory('balance', 'バランス型', 2),
      scrapeMinkabuByCategory('commodity', 'コモディティ', 1),
      scrapeWealthAdvisor(4),
      scrapeWealthAdvisor(5),
    ]);

    for (const result of batch4) {
      if (result.status === 'fulfilled') {
        for (const f of result.value) {
          if (!allFunds.some(af => af.name === f.name)) {
            const isWA = 'return10y' in f;
            if (isWA) {
              allFunds.push({ ...f, return10y: (f as any).return10y ?? null, source: 'wealthadvisor', ...defaultExtras, fundSizeMillions: f.totalAssets || null });
            } else {
              allFunds.push({ ...f, return10y: null, stdDev: null, source: 'minkabu', ...defaultExtras });
            }
          }
        }
      }
    }

    console.log(`  バッチ4完了: バランス+コモディティ+WA追加 合計${allFunds.length}件`);
  } catch (error) {
    console.error('Fund fetch error:', error);
  }

  // サンプルデータを常にマージ（全カテゴリの網羅を保証）
  // スクレイピングで取得済みのカテゴリは除外しない（ユーザーに選択肢を増やす）
  const existingIds = new Set(allFunds.map(f => f.id));
  for (const sample of sampleFunds) {
    if (!existingIds.has(sample.id)) {
      allFunds.push(sample);
    }
  }
  cachedFunds = allFunds;

  lastFetchTime = now;
  return cachedFunds;
}

// GET /api/funds - ファンド一覧
router.get('/', async (_req: Request, res: Response) => {
  try {
    const funds = await fetchAllFunds();
    const { category, nisaOnly, source, sortBy, sortOrder, minReturn, maxExpenseRatio, q } = _req.query;

    let filtered = [...funds];

    if (q && typeof q === 'string') {
      const query = q.toLowerCase();
      filtered = filtered.filter(f => f.name.toLowerCase().includes(query));
    }

    if (category && category !== '') {
      filtered = filtered.filter(f => f.category === category);
    }

    if (nisaOnly === 'true') {
      filtered = filtered.filter(f => f.nisaEligible);
    }

    if (source && source !== 'all') {
      filtered = filtered.filter(f => f.source === source);
    }

    if (minReturn) {
      const min = parseFloat(minReturn as string);
      filtered = filtered.filter(f => (f.return1y ?? 0) >= min);
    }

    if (maxExpenseRatio) {
      const max = parseFloat(maxExpenseRatio as string);
      filtered = filtered.filter(f => f.expenseRatio <= max);
    }

    // ソート
    const sort = (sortBy as string) || 'return1y';
    const order = sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a: any, b: any) => {
      const va = a[sort] ?? -Infinity;
      const vb = b[sort] ?? -Infinity;
      return (va - vb) * order;
    });

    res.json({ funds: filtered, total: filtered.length });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Failed to fetch funds' });
  }
});

// GET /api/funds/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const funds = await fetchAllFunds();
    const fund = funds.find(f => f.id === req.params.id);
    if (!fund) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }
    res.json(fund);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fund' });
  }
});

export default router;
