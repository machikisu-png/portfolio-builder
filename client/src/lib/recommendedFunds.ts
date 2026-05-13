/**
 * 優良ファンドのホワイトリスト（約50本）
 *
 * 選定基準:
 * - 大手インデックスシリーズ（eMAXIS Slim, SBI・V, 楽天・, ニッセイ, たわら, iFree, SMT, MAXIS, ifree, 等）
 * - SBI証券・楽天証券で購入可能
 * - 信託報酬が低い（概ね 0.5% 以下）
 * - 純資産規模が十分（概ね 100億円以上）
 * - 5年以上の運用実績、または同シリーズの確立されたブランド
 *
 * 各エントリは正規表現でファンド名をマッチング（細かい表記揺れに対応）
 */

export interface RecommendedFundEntry {
  /** ファンド名マッチング用の正規表現 */
  pattern: RegExp;
  /** カテゴリ（参考表示用） */
  category: string;
  /** 表示用ラベル */
  label: string;
}

export const RECOMMENDED_FUNDS: RecommendedFundEntry[] = [
  // ===== 全世界株式 =====
  { pattern: /eMAXIS\s*Slim\s*全世界株式.*オール.?カントリー/i, category: '全世界株式', label: 'eMAXIS Slim 全世界株式（オール・カントリー）' },
  { pattern: /楽天[・·]?全世界株式インデックス[・·]?ファンド/, category: '全世界株式', label: '楽天・全世界株式インデックス・ファンド' },
  { pattern: /SBI[・·]?全世界株式インデックス[・·]?ファンド|雪だるま.*全世界/, category: '全世界株式', label: 'SBI・全世界株式インデックス・ファンド' },
  { pattern: /eMAXIS\s*Slim\s*全世界株式.*除く日本/i, category: '全世界株式', label: 'eMAXIS Slim 全世界株式（除く日本）' },
  { pattern: /eMAXIS\s*Slim\s*全世界株式.*3地域均等/i, category: '全世界株式', label: 'eMAXIS Slim 全世界株式（3地域均等型）' },

  // ===== 先進国株式（米国） =====
  { pattern: /eMAXIS\s*Slim\s*米国株式.*S&?P\s*500/i, category: '先進国株式', label: 'eMAXIS Slim 米国株式（S&P500）' },
  { pattern: /SBI[・·]?V[・·]?S&?P\s*500/, category: '先進国株式', label: 'SBI・V・S&P500インデックス・ファンド' },
  { pattern: /SBI[・·]?V[・·]?全米株式/, category: '先進国株式', label: 'SBI・V・全米株式インデックス・ファンド' },
  { pattern: /楽天[・·]?全米株式インデックス/, category: '先進国株式', label: '楽天・全米株式インデックス・ファンド' },
  { pattern: /楽天[・·]?S&?P\s*500インデックス/, category: '先進国株式', label: '楽天・S&P500インデックス・ファンド' },
  { pattern: /eMAXIS\s*Slim\s*先進国株式インデックス/i, category: '先進国株式', label: 'eMAXIS Slim 先進国株式インデックス' },
  { pattern: /ニッセイ外国株式インデックス/, category: '先進国株式', label: 'ニッセイ外国株式インデックスファンド' },
  { pattern: /たわらノーロード先進国株式(?!.*ヘッジ)/, category: '先進国株式', label: 'たわらノーロード 先進国株式' },
  { pattern: /iFreeNEXT\s*FANG\+|フリーネクスト\s*FANG/i, category: '先進国株式', label: 'iFreeNEXT FANG+インデックス' },
  { pattern: /iFreeNEXT\s*NASDAQ\s*100/i, category: '先進国株式', label: 'iFreeNEXT NASDAQ100インデックス' },
  { pattern: /eMAXIS\s*NASDAQ\s*100/i, category: '先進国株式', label: 'eMAXIS NASDAQ100インデックス' },

  // ===== 先進国株式（為替ヘッジあり） =====
  { pattern: /eMAXIS\s*Slim\s*先進国株式.*ヘッジ/i, category: '先進国株式', label: 'eMAXIS Slim 先進国株式（為替ヘッジあり）' },
  { pattern: /たわらノーロード先進国株式.*ヘッジ/, category: '先進国株式', label: 'たわらノーロード 先進国株式（為替ヘッジあり）' },

  // ===== 国内株式 =====
  { pattern: /eMAXIS\s*Slim\s*国内株式.*TOPIX/i, category: '国内株式', label: 'eMAXIS Slim 国内株式（TOPIX）' },
  { pattern: /eMAXIS\s*Slim\s*国内株式.*日経平均/i, category: '国内株式', label: 'eMAXIS Slim 国内株式（日経平均）' },
  { pattern: /ニッセイ日経\s*225インデックス/, category: '国内株式', label: 'ニッセイ日経225インデックスファンド' },
  { pattern: /ニッセイTOPIXインデックス/, category: '国内株式', label: 'ニッセイTOPIXインデックスファンド' },
  { pattern: /たわらノーロード日経\s*225/, category: '国内株式', label: 'たわらノーロード 日経225' },
  { pattern: /ひふみプラス/, category: '国内株式', label: 'ひふみプラス' },

  // ===== 新興国株式 =====
  { pattern: /eMAXIS\s*Slim\s*新興国株式インデックス/i, category: '新興国株式', label: 'eMAXIS Slim 新興国株式インデックス' },
  { pattern: /ニッセイ新興国株式インデックス/, category: '新興国株式', label: 'ニッセイ新興国株式インデックスファンド' },
  { pattern: /SBI[・·]?新興国株式インデックス/, category: '新興国株式', label: 'SBI・新興国株式インデックス・ファンド' },

  // ===== 国内債券 =====
  { pattern: /eMAXIS\s*Slim\s*国内債券インデックス/i, category: '国内債券', label: 'eMAXIS Slim 国内債券インデックス' },
  { pattern: /たわらノーロード国内債券/, category: '国内債券', label: 'たわらノーロード 国内債券' },
  { pattern: /ニッセイ国内債券インデックス/, category: '国内債券', label: 'ニッセイ国内債券インデックスファンド' },

  // ===== 海外債券 =====
  { pattern: /eMAXIS\s*Slim\s*先進国債券インデックス|eMAXIS\s*Slim\s*海外債券/i, category: '海外債券', label: 'eMAXIS Slim 先進国債券インデックス' },
  { pattern: /eMAXIS\s*Slim\s*(先進国|海外)債券.*ヘッジ/i, category: '海外債券', label: 'eMAXIS Slim 先進国債券インデックス（為替ヘッジあり）' },
  { pattern: /たわらノーロード(先進国|海外)債券(?!.*ヘッジ)/, category: '海外債券', label: 'たわらノーロード 先進国債券' },
  { pattern: /たわらノーロード(先進国|海外)債券.*ヘッジ/, category: '海外債券', label: 'たわらノーロード 先進国債券（為替ヘッジあり）' },
  { pattern: /ニッセイ外国債券インデックス/, category: '海外債券', label: 'ニッセイ外国債券インデックスファンド' },

  // ===== 新興国債券 =====
  { pattern: /eMAXIS\s*Slim\s*新興国債券インデックス/i, category: '新興国債券', label: 'eMAXIS Slim 新興国債券インデックス' },
  { pattern: /SBI[・·]?新興国債券/, category: '新興国債券', label: 'SBI・新興国債券' },

  // ===== REIT =====
  { pattern: /eMAXIS\s*Slim\s*国内リート|eMAXIS\s*Slim\s*国内REIT/i, category: 'REIT', label: 'eMAXIS Slim 国内リートインデックス' },
  { pattern: /eMAXIS\s*Slim\s*先進国リート|eMAXIS\s*Slim\s*先進国REIT/i, category: 'REIT', label: 'eMAXIS Slim 先進国リートインデックス' },
  { pattern: /たわらノーロード国内リート/, category: 'REIT', label: 'たわらノーロード 国内リート' },
  { pattern: /たわらノーロード先進国リート/, category: 'REIT', label: 'たわらノーロード 先進国リート' },
  { pattern: /ニッセイJ-REITインデックス|ニッセイ.*?Jリート/, category: 'REIT', label: 'ニッセイJリートインデックスファンド' },

  // ===== コモディティ（ゴールド等） =====
  { pattern: /SMT\s*ゴールド/i, category: 'コモディティ', label: 'SMTゴールドインデックス・オープン' },
  { pattern: /iシェアーズ\s*ゴールド/, category: 'コモディティ', label: 'iシェアーズ ゴールドインデックス・ファンド' },
  { pattern: /三菱UFJ.*ピュア[・·]?ゴールド|純金/, category: 'コモディティ', label: '三菱UFJ ピュア・ゴールド・ファンド' },

  // ===== バランス型 =====
  { pattern: /eMAXIS\s*Slim\s*バランス.*8資産均等/i, category: 'バランス型', label: 'eMAXIS Slim バランス（8資産均等型）' },
  { pattern: /楽天[・·]?インデックス[・·]?バランス.*均等/, category: 'バランス型', label: '楽天・インデックス・バランス（均等型）' },
  { pattern: /セゾン[・·]?バンガード[・·]?グローバル/, category: 'バランス型', label: 'セゾン・バンガード・グローバルバランスファンド' },
  { pattern: /世界経済インデックス/, category: 'バランス型', label: '世界経済インデックスファンド' },
];

/**
 * ファンドがホワイトリストに該当するか判定
 */
export function isRecommendedFund(fundName: string): boolean {
  return RECOMMENDED_FUNDS.some(r => r.pattern.test(fundName));
}

/**
 * ファンド配列を優良ファンドのみに絞る
 */
export function filterRecommended<T extends { name: string }>(funds: T[]): T[] {
  return funds.filter(f => isRecommendedFund(f.name));
}

// ===== localStorage を介した「優良ファンドのみ」モードの永続化 =====
const KEY = 'recommendedOnly';
const EVT = 'recommendedonlychange';

export function getRecommendedOnly(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY) === '1';
}

export function setRecommendedOnly(value: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, value ? '1' : '0');
  window.dispatchEvent(new CustomEvent(EVT, { detail: value }));
}
