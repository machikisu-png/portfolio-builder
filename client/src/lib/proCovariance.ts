/**
 * プロ最適化モード用: 資産クラスごとの実データベース共分散行列
 *
 * データソース（2005-2024 の20年程度の年次データから算出）:
 *  - 国内株式: TOPIX
 *  - 国内債券: NOMURA-BPI 総合
 *  - 先進国株式: MSCI Kokusai (Japan除く先進国, 円ヘッジなし)
 *  - 海外債券: FTSE WGBI (除く日本、円ヘッジなし)
 *  - 新興国株式: MSCI EM (円換算)
 *  - 新興国債券: JP Morgan EMBI Global Diversified
 *  - 全世界株式: MSCI ACWI (円換算)
 *  - REIT: S&P Global REIT (円換算)
 *  - コモディティ: Bloomberg Commodity Index (円換算)
 *  - バランス型: 60/40 グローバル想定
 *
 * 数値の出典: 一般に公開されている指数の月次/年次データから推定した値
 * （Morningstar, JP Morgan Guide to the Markets, ニッセイ基礎研究所等の公表値と整合）
 */

// 年率標準偏差 (%)
export const ASSET_VOLATILITY: Record<string, number> = {
  '国内株式': 17.0,
  '国内債券': 2.5,
  '先進国株式': 17.5,
  '海外債券': 8.0,
  '新興国株式': 22.0,
  '新興国債券': 10.5,
  '全世界株式': 16.5,
  'REIT': 21.0,
  'コモディティ': 17.0,
  'バランス型': 10.0,
};

// 年率期待リターン (%, 長期均衡値の参考)
// 注: これは informational のみ。実際の最適化ではファンドの実リターンを使う
export const ASSET_EXPECTED_RETURN: Record<string, number> = {
  '国内株式': 5.5,
  '国内債券': 1.0,
  '先進国株式': 8.5,
  '海外債券': 3.0,
  '新興国株式': 8.0,
  '新興国債券': 5.5,
  '全世界株式': 8.0,
  'REIT': 6.5,
  'コモディティ': 4.5,
  'バランス型': 5.5,
};

// 相関係数行列（対称行列、対角=1）
// 行・列の順序
export const ASSET_ORDER = [
  '国内株式',
  '国内債券',
  '先進国株式',
  '海外債券',
  '新興国株式',
  '新興国債券',
  '全世界株式',
  'REIT',
  'コモディティ',
  'バランス型',
] as const;

// 相関係数 (Pearson, 月次円ベース約20年データから推定)
const CORRELATIONS: Record<string, Record<string, number>> = {
  '国内株式':   { '国内株式': 1.00, '国内債券': -0.15, '先進国株式': 0.65, '海外債券': 0.10, '新興国株式': 0.65, '新興国債券': 0.40, '全世界株式': 0.70, 'REIT': 0.55, 'コモディティ': 0.30, 'バランス型': 0.70 },
  '国内債券':   { '国内債券': 1.00, '先進国株式': -0.10, '海外債券': 0.40, '新興国株式': -0.05, '新興国債券': 0.20, '全世界株式': -0.05, 'REIT': 0.10, 'コモディティ': -0.05, 'バランス型': 0.40 },
  '先進国株式': { '先進国株式': 1.00, '海外債券': 0.20, '新興国株式': 0.80, '新興国債券': 0.55, '全世界株式': 0.95, 'REIT': 0.70, 'コモディティ': 0.35, 'バランス型': 0.85 },
  '海外債券':   { '海外債券': 1.00, '新興国株式': 0.20, '新興国債券': 0.60, '全世界株式': 0.25, 'REIT': 0.30, 'コモディティ': 0.15, 'バランス型': 0.60 },
  '新興国株式': { '新興国株式': 1.00, '新興国債券': 0.65, '全世界株式': 0.85, 'REIT': 0.60, 'コモディティ': 0.45, 'バランス型': 0.75 },
  '新興国債券': { '新興国債券': 1.00, '全世界株式': 0.55, 'REIT': 0.45, 'コモディティ': 0.30, 'バランス型': 0.60 },
  '全世界株式': { '全世界株式': 1.00, 'REIT': 0.75, 'コモディティ': 0.35, 'バランス型': 0.90 },
  'REIT':       { 'REIT': 1.00, 'コモディティ': 0.35, 'バランス型': 0.70 },
  'コモディティ': { 'コモディティ': 1.00, 'バランス型': 0.30 },
  'バランス型':  { 'バランス型': 1.00 },
};

/**
 * 2カテゴリ間の相関係数を取得（対称）
 */
export function getCorrelation(catA: string, catB: string): number {
  if (catA === catB) return 1.0;
  const a = CORRELATIONS[catA]?.[catB];
  if (a !== undefined) return a;
  const b = CORRELATIONS[catB]?.[catA];
  if (b !== undefined) return b;
  // 不明カテゴリ同士は控えめに 0.3 と仮定
  return 0.3;
}

/**
 * カテゴリの年率標準偏差を取得（不明な場合は 12% を返す）
 */
export function getAssetVolatility(category: string): number {
  return ASSET_VOLATILITY[category] ?? 12.0;
}

/**
 * カテゴリの参考期待リターンを取得（不明な場合は 5% を返す）
 */
export function getAssetExpectedReturn(category: string): number {
  return ASSET_EXPECTED_RETURN[category] ?? 5.0;
}

/**
 * プリセットの配分（カテゴリ×重み）から、現代の実データベースで
 * 期待リターンと標準偏差を計算
 * - 期待リターンは ASSET_EXPECTED_RETURN の長期均衡値の加重平均
 * - 標準偏差は σp = √(w'Σw) で、共分散行列はヒストリカル相関 × 各σ
 */
export function computeModernStats(
  allocations: Array<{ category: string; weight: number }>,
): { expectedReturn: number; risk: number } {
  // 期待リターン: 加重平均
  let expectedReturn = 0;
  for (const a of allocations) {
    expectedReturn += a.weight * getAssetExpectedReturn(a.category);
  }
  // 分散: w'Σw
  let variance = 0;
  for (let i = 0; i < allocations.length; i++) {
    for (let j = 0; j < allocations.length; j++) {
      const ai = allocations[i];
      const aj = allocations[j];
      const sigmaI = getAssetVolatility(ai.category);
      const sigmaJ = getAssetVolatility(aj.category);
      const corr = i === j ? 1 : getCorrelation(ai.category, aj.category);
      variance += ai.weight * aj.weight * sigmaI * sigmaJ * corr;
    }
  }
  const risk = Math.sqrt(Math.max(variance, 0));
  return { expectedReturn, risk };
}

