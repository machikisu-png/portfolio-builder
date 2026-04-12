import type { Fund } from './types';

/**
 * ファンド自動選定スコアリング
 *
 * 9つの条件に基づいてスコア（0-100）を算出:
 * 1. 決算は年1回           (10点)
 * 2. 分配金なし             (10点)
 * 3. 規模30億円以上         (10点)
 * 4. 標準偏差15-20%         (10点)
 * 5. シャープレシオ1.0-1.5  (15点)
 * 6. 手数料が低い           (15点)
 * 7. 純資産総額が右肩上がり (10点)
 * 8. 5-10年の運用実績       (10点)
 * 9. 楽天/SBIで購入可能     (10点)
 */

export interface ScoreBreakdown {
  total: number;
  settlement: number;      // 決算回数
  distribution: number;    // 分配金
  fundSize: number;        // 規模
  stdDevRange: number;     // 標準偏差
  sharpeRange: number;     // シャープレシオ
  lowCost: number;         // 手数料
  assetGrowth: number;     // 純資産推移
  trackRecord: number;     // 運用実績
  sellerMatch: number;     // 販売会社
}

const currentYear = new Date().getFullYear();

export function scoreFund(fund: Fund): ScoreBreakdown {
  const scores: ScoreBreakdown = {
    total: 0,
    settlement: 0,
    distribution: 0,
    fundSize: 0,
    stdDevRange: 0,
    sharpeRange: 0,
    lowCost: 0,
    assetGrowth: 0,
    trackRecord: 0,
    sellerMatch: 0,
  };

  // 1. 決算は年1回 (10点)
  if (fund.settlementFrequency !== null) {
    if (fund.settlementFrequency === 1) {
      scores.settlement = 10;
    } else if (fund.settlementFrequency === 2) {
      scores.settlement = 5;
    } else {
      scores.settlement = 0;
    }
  } else {
    // 不明な場合、ファンド名に「毎月」が含まれなければ年1回と推定
    scores.settlement = fund.name.includes('毎月') ? 0 : 7;
  }

  // 2. 分配金なし (10点)
  if (fund.distributionAmount !== null) {
    if (fund.distributionAmount === 0) {
      scores.distribution = 10;
    } else if (fund.distributionAmount <= 10) {
      scores.distribution = 5;
    } else {
      scores.distribution = 0;
    }
  } else {
    // 名前にインデックス/Slimが含まれれば分配金なしの可能性が高い
    const likelyNoDist = fund.name.includes('インデックス') || fund.name.includes('Slim') || fund.name.includes('iFree');
    scores.distribution = likelyNoDist ? 7 : 4;
  }

  // 3. 規模30億円以上 (10点) = 3000百万円以上
  const size = fund.fundSizeMillions ?? fund.totalAssets;
  if (size >= 3000) {
    scores.fundSize = 10;
  } else if (size >= 1000) {
    scores.fundSize = 5;
  } else if (size > 0) {
    scores.fundSize = 2;
  } else {
    scores.fundSize = 3; // 不明
  }

  // 4. 標準偏差15-20% (10点)
  if (fund.stdDev !== null) {
    if (fund.stdDev >= 15 && fund.stdDev <= 20) {
      scores.stdDevRange = 10;
    } else if (fund.stdDev >= 12 && fund.stdDev <= 22) {
      scores.stdDevRange = 6;
    } else if (fund.stdDev >= 10 && fund.stdDev <= 25) {
      scores.stdDevRange = 3;
    } else {
      scores.stdDevRange = 0;
    }
  } else {
    scores.stdDevRange = 3; // 不明
  }

  // 5. シャープレシオ1.0-1.5 (15点)
  if (fund.sharpeRatio !== null) {
    if (fund.sharpeRatio >= 1.0 && fund.sharpeRatio <= 1.5) {
      scores.sharpeRange = 15;
    } else if (fund.sharpeRatio >= 0.8 && fund.sharpeRatio <= 1.8) {
      scores.sharpeRange = 10;
    } else if (fund.sharpeRatio >= 0.5) {
      scores.sharpeRange = 5;
    } else {
      scores.sharpeRange = 0;
    }
  } else {
    scores.sharpeRange = 3; // 不明
  }

  // 6. 手数料が低い (15点)
  if (fund.expenseRatio > 0) {
    if (fund.expenseRatio <= 0.1) {
      scores.lowCost = 15;
    } else if (fund.expenseRatio <= 0.2) {
      scores.lowCost = 12;
    } else if (fund.expenseRatio <= 0.3) {
      scores.lowCost = 9;
    } else if (fund.expenseRatio <= 0.5) {
      scores.lowCost = 6;
    } else if (fund.expenseRatio <= 1.0) {
      scores.lowCost = 3;
    } else {
      scores.lowCost = 0;
    }
  } else {
    scores.lowCost = 5; // 不明
  }

  // 7. 純資産総額が右肩上がり (10点)
  if (fund.assetTrend !== null) {
    if (fund.assetTrend === 'up') {
      scores.assetGrowth = 10;
    } else if (fund.assetTrend === 'flat') {
      scores.assetGrowth = 5;
    } else {
      scores.assetGrowth = 0;
    }
  } else {
    // 純資産総額が大きいファンドは成長している可能性が高い
    if (size >= 10000) scores.assetGrowth = 8;
    else if (size >= 3000) scores.assetGrowth = 6;
    else scores.assetGrowth = 4;
  }

  // 8. 5-10年の運用実績 (10点)
  if (fund.inceptionYear !== null) {
    const years = currentYear - fund.inceptionYear;
    if (years >= 5 && years <= 10) {
      scores.trackRecord = 10;
    } else if (years > 10) {
      scores.trackRecord = 8; // 長期実績あり
    } else if (years >= 3) {
      scores.trackRecord = 5;
    } else {
      scores.trackRecord = 2;
    }
  } else {
    // return5y/return10yがあれば実績ありと推定
    if (fund.return10y !== null) scores.trackRecord = 8;
    else if (fund.return5y !== null) scores.trackRecord = 10;
    else if (fund.return3y !== null) scores.trackRecord = 5;
    else scores.trackRecord = 3;
  }

  // 9. 楽天/SBIで購入可能 (10点)
  if (fund.sellers.length > 0) {
    const hasRakuten = fund.sellers.some(s => s.includes('楽天'));
    const hasSBI = fund.sellers.some(s => s.includes('SBI'));
    if (hasRakuten && hasSBI) {
      scores.sellerMatch = 10;
    } else if (hasRakuten || hasSBI) {
      scores.sellerMatch = 7;
    } else {
      scores.sellerMatch = 0;
    }
  } else {
    // 有名インデックスファンドは楽天・SBIで取扱が多い
    const likelySold = fund.name.includes('eMAXIS') || fund.name.includes('SBI') ||
                       fund.name.includes('楽天') || fund.name.includes('ニッセイ') ||
                       fund.name.includes('iFree') || fund.name.includes('たわら');
    scores.sellerMatch = likelySold ? 8 : 4;
  }

  scores.total = scores.settlement + scores.distribution + scores.fundSize +
                 scores.stdDevRange + scores.sharpeRange + scores.lowCost +
                 scores.assetGrowth + scores.trackRecord + scores.sellerMatch;

  return scores;
}

// スコア付きファンドリストを返す
export function rankFunds(funds: Fund[]): Array<{ fund: Fund; score: ScoreBreakdown }> {
  return funds
    .map(fund => ({ fund, score: scoreFund(fund) }))
    .sort((a, b) => b.score.total - a.score.total);
}

// カテゴリのフォールバックマップ（見つからない場合に試すカテゴリ）
const categoryFallbacks: Record<string, string[][]> = {
  '国内株式':   [['国内株式'], ['全世界株式']],
  '先進国株式': [['先進国株式'], ['全世界株式']],
  '海外株式':   [['先進国株式'], ['全世界株式']],
  '新興国株式': [['新興国株式'], ['全世界株式']],
  '全世界株式': [['全世界株式'], ['先進国株式']],
  '国内債券':   [['国内債券'], ['バランス型']],
  '海外債券': [['海外債券', '海外債券'], ['国内債券'], ['バランス型']],
  '海外債券':   [['海外債券', '海外債券'], ['国内債券']],
  '新興国債券': [['新興国債券'], ['海外債券', '海外債券']],
  'REIT':       [['REIT'], ['バランス型']],
  'コモディティ': [['コモディティ'], ['バランス型']],
  'バランス型': [['バランス型']],
};

// カテゴリ内で最適なファンドを選定（フォールバック付き）
export function pickBestFundByScore(funds: Fund[], category: string): { fund: Fund; score: ScoreBreakdown } | null {
  const fallbackChain = categoryFallbacks[category] || [[category]];

  for (const matchCategories of fallbackChain) {
    const candidates = funds.filter(f => matchCategories.includes(f.category));
    if (candidates.length > 0) {
      const ranked = rankFunds(candidates);
      return ranked[0];
    }
  }

  // 最終フォールバック：全ファンドからスコア最高を返す
  if (funds.length > 0) {
    const ranked = rankFunds(funds);
    return ranked[0];
  }

  return null;
}

// カテゴリ別の基準リターン/リスク
const categoryReturnBenchmark: Record<string, number> = {
  '国内株式': 8, '先進国株式': 10, '新興国株式': 7, '全世界株式': 9,
  '国内債券': 1, '海外債券': 3, '新興国債券': 5,
  'REIT': 5, 'コモディティ': 6, 'バランス型': 5,
};
const categoryRiskBenchmark: Record<string, number> = {
  '国内株式': 16, '先進国株式': 17, '新興国株式': 20, '全世界株式': 15,
  '国内債券': 2, '海外債券': 8, '新興国債券': 12,
  'REIT': 17, 'コモディティ': 16, 'バランス型': 10,
};

/**
 * ファンドの長期年率リターンを取得（10年→5年→3年→1年の優先順）
 * プリセット目標値は長期年率平均なので、最も長期のデータを使う。
 * スクレイピングデータの3年リターンが年率でなく累積値の場合があるため、
 * 3年リターンが3%未満かつ1年リターンが10%以上の場合は3年値を無視する。
 */
function getLongTermReturn(fund: Fund): number {
  // 複数期間の加重平均で安定したリターン推定値を出す
  // 10年(長期安定)と5年(近年実績)を組み合わせる
  const values: Array<{ ret: number; weight: number }> = [];

  if (fund.return10y !== null) values.push({ ret: fund.return10y, weight: 3 });
  if (fund.return5y !== null) values.push({ ret: fund.return5y, weight: 5 });

  // 3年リターンの妥当性チェック（累積値の可能性を除外）
  if (fund.return3y !== null) {
    const r1 = fund.return1y ?? 0;
    if (!(fund.return3y < 3 && r1 > 10)) {
      values.push({ ret: fund.return3y, weight: 2 });
    }
  }

  if (values.length > 0) {
    const totalWeight = values.reduce((s, v) => s + v.weight, 0);
    return values.reduce((s, v) => s + v.ret * v.weight, 0) / totalWeight;
  }

  if (fund.return1y !== null) return fund.return1y;
  return 0;
}

// カテゴリ間の相関係数（分散効果の計算用）
const categoryCorrelation: Record<string, Record<string, number>> = {
  '国内株式':   { '国内株式': 1.0, '先進国株式': 0.6, '新興国株式': 0.5, '全世界株式': 0.65, '国内債券': -0.2, '海外債券': 0.1, '新興国債券': 0.3, 'REIT': 0.4, 'コモディティ': 0.1, 'バランス型': 0.5 },
  '先進国株式': { '先進国株式': 1.0, '新興国株式': 0.7, '全世界株式': 0.95, '国内債券': -0.1, '海外債券': 0.2, '新興国債券': 0.4, 'REIT': 0.5, 'コモディティ': 0.15, 'バランス型': 0.6 },
  '新興国株式': { '新興国株式': 1.0, '全世界株式': 0.8, '国内債券': -0.1, '海外債券': 0.3, '新興国債券': 0.5, 'REIT': 0.4, 'コモディティ': 0.2, 'バランス型': 0.5 },
  '国内債券':   { '国内債券': 1.0, '海外債券': 0.3, '新興国債券': 0.2, 'REIT': 0.05, 'コモディティ': 0.0, 'バランス型': 0.3 },
  '海外債券':   { '海外債券': 1.0, '新興国債券': 0.6, 'REIT': 0.2, 'コモディティ': 0.1, 'バランス型': 0.4 },
  'REIT':       { 'REIT': 1.0, 'コモディティ': 0.15, 'バランス型': 0.4 },
  'コモディティ': { 'コモディティ': 1.0, 'バランス型': 0.15 },
  'バランス型': { 'バランス型': 1.0 },
};

function getCorrelation(cat1: string, cat2: string): number {
  return categoryCorrelation[cat1]?.[cat2] ?? categoryCorrelation[cat2]?.[cat1] ?? 0.3;
}

/**
 * ポートフォリオ全体の加重リターン/リスクを計算（相関考慮）
 */
function calcPortfolioMetrics(items: Array<{ fund: Fund; weight: number }>): { ret: number; risk: number } {
  let ret = 0;
  for (const item of items) {
    ret += item.weight * getLongTermReturn(item.fund);
  }

  // σ² = ΣΣ wi*wj*σi*σj*ρij （分散効果を反映）
  let variance = 0;
  for (const a of items) {
    for (const b of items) {
      const sa = a.fund.stdDev ?? categoryRiskBenchmark[a.fund.category] ?? 15;
      const sb = b.fund.stdDev ?? categoryRiskBenchmark[b.fund.category] ?? 15;
      const corr = getCorrelation(a.fund.category, b.fund.category);
      variance += a.weight * b.weight * sa * sb * corr;
    }
  }

  return { ret, risk: Math.sqrt(Math.max(variance, 0)) };
}

/**
 * カテゴリ内の候補ファンドを、目標リターン/リスクへの貢献度でスコアリング
 *
 * 配点: フィット200点（最優先） + 品質30点（副次的）= 最大230点
 */
function scoreCandidateForTarget(
  fund: Fund,
  idealReturn: number,
  idealRisk: number,
): { qualityScore: ScoreBreakdown; fitScore: number; totalScore: number } {
  const qualityScore = scoreFund(fund);
  const fundReturn = getLongTermReturn(fund);
  const fundRisk = fund.stdDev ?? 15;

  // リターンフィット (0-100): 目標に近いほど高得点
  const returnDiff = Math.abs(fundReturn - idealReturn);
  const returnFit = Math.max(0, 100 - returnDiff * 5);

  // リスクフィット (0-100): 目標に近いほど高得点
  const riskDiff = Math.abs(fundRisk - idealRisk);
  const riskFit = Math.max(0, 100 - riskDiff * 8);

  let fitScore = Math.round(returnFit + riskFit);

  // 長期実績データがあるファンドに大幅ボーナス（信頼性が高い）
  if (fund.return10y !== null) fitScore += 80;
  else if (fund.return5y !== null) fitScore += 60;
  else if (fund.return3y !== null && fund.return3y > 3) fitScore += 20;
  else fitScore -= 50; // 1年データしかないファンドはペナルティ

  // stdDevの実データがあるファンドにボーナス
  if (fund.stdDev !== null) fitScore += 30;

  // 品質スコアは0-100を0-30に圧縮（副次的な評価）
  const qualityWeight = Math.round(qualityScore.total * 0.3);

  return { qualityScore, fitScore, totalScore: fitScore + qualityWeight };
}

/**
 * プリセット全体を最適化
 *
 * 目標リターン/リスクへの一致を最優先とし、品質スコアは副次評価。
 * 全枠を繰り返し差替えてポートフォリオ全体が目標に最も近い組合せを探索。
 */
// 自動選定から除外すべきファンドのフィルタ
const EXCLUDED_KEYWORDS = [
  'ブル', 'ベア', 'レバレッジ', '2倍', '3倍', '4倍', '4.3倍',
  '毎月分配', '毎月決算', 'ダブル・ブル', 'ダブル・ベア',
  'トリプル', 'インバース',
  'トルコリラ', 'ブラジルレアル', 'メキシコペソ', '通貨選択',
  'ハイイールド', 'ハイ・イールド',
];

function isEligibleForPreset(fund: Fund): boolean {
  const name = fund.name;
  for (const kw of EXCLUDED_KEYWORDS) {
    if (name.includes(kw)) return false;
  }
  // 1年リターンが極端（50%超 or -30%未満）は除外
  if (fund.return1y !== null && (fund.return1y > 50 || fund.return1y < -30)) return false;
  return true;
}

export function optimizeFundsForPreset(
  allFunds: Fund[],
  allocations: Array<{ category: string; weight: number }>,
  targetReturn: number,
  targetRisk: number,
): Array<{ fund: Fund; weight: number; score: ScoreBreakdown; fitScore: number }> {
  const usedFundIds = new Set<string>();

  // レバレッジ・毎月分配等を除外
  const eligibleFunds = allFunds.filter(isEligibleForPreset);

  // 第1パス: 各カテゴリで目標に最も近いファンドを初期選定
  const result: Array<{ fund: Fund; weight: number; score: ScoreBreakdown; fitScore: number }> = [];

  for (const alloc of allocations) {
    const available = eligibleFunds.filter(f => !usedFundIds.has(f.id));
    const fallbackChain = categoryFallbacks[alloc.category] || [[alloc.category]];
    let candidates: Fund[] = [];
    for (const matchCats of fallbackChain) {
      candidates = available.filter(f => matchCats.includes(f.category));
      if (candidates.length > 0) break;
    }
    if (candidates.length === 0) candidates = available;

    const idealReturn = categoryReturnBenchmark[alloc.category] ?? targetReturn;
    const idealRisk = categoryRiskBenchmark[alloc.category] ?? targetRisk;

    let bestFund = candidates[0];
    let bestInfo = scoreCandidateForTarget(bestFund, idealReturn, idealRisk);

    for (const c of candidates) {
      const info = scoreCandidateForTarget(c, idealReturn, idealRisk);
      if (info.totalScore > bestInfo.totalScore) {
        bestFund = c;
        bestInfo = info;
      }
    }

    result.push({ fund: bestFund, weight: alloc.weight, score: bestInfo.qualityScore, fitScore: bestInfo.fitScore });
    usedFundIds.add(bestFund.id);
  }

  // 第2パス: 全枠を順に見直し、ポートフォリオ全体の目標ズレを最小化
  // 最大3周回して収束させる
  for (let round = 0; round < 3; round++) {
    const current = calcPortfolioMetrics(result);
    const currentError = Math.abs(current.ret - targetReturn) + Math.abs(current.risk - targetRisk) * 2;

    if (currentError < 1.0) break; // 十分近い

    let improved = false;

    for (let i = 0; i < result.length; i++) {
      const slot = result[i];
      const alloc = allocations[i];
      const fallbackChain = categoryFallbacks[alloc.category] || [[alloc.category]];
      let candidates: Fund[] = [];
      for (const matchCats of fallbackChain) {
        candidates = eligibleFunds.filter(f =>
          matchCats.includes(f.category) && (f.id === slot.fund.id || !usedFundIds.has(f.id))
        );
        if (candidates.length > 0) break;
      }
      if (candidates.length <= 1) continue;

      // このスロットの理想リターン: 目標ギャップを考慮
      const othersRet = result.reduce((s, r, j) => j === i ? s : s + r.weight * getLongTermReturn(r.fund), 0);
      const neededReturn = (targetReturn - othersRet) / slot.weight;
      const othersRisk = result.reduce((s, r, j) => j === i ? s : s + r.weight * (r.fund.stdDev ?? 15), 0);
      const neededRisk = (targetRisk - othersRisk) / slot.weight;

      let bestCandidate = slot.fund;
      let bestError = Infinity;

      for (const c of candidates) {
        const cReturn = getLongTermReturn(c);
        const cRisk = c.stdDev ?? 15;
        // ポートフォリオ全体のリターン/リスクが目標にどれだけ近づくか
        const newPortRet = othersRet + slot.weight * cReturn;
        const newPortRisk = othersRisk + slot.weight * cRisk;
        const err = Math.abs(newPortRet - targetReturn) + Math.abs(newPortRisk - targetRisk) * 2;

        // 品質スコアが最低30以上のファンドのみ許可
        const qs = scoreFund(c);
        if (qs.total >= 30 && err < bestError) {
          bestError = err;
          bestCandidate = c;
        }
      }

      if (bestCandidate.id !== slot.fund.id) {
        usedFundIds.delete(slot.fund.id);
        usedFundIds.add(bestCandidate.id);
        const info = scoreCandidateForTarget(bestCandidate, neededReturn, neededRisk);
        result[i] = { fund: bestCandidate, weight: slot.weight, score: info.qualityScore, fitScore: info.fitScore };
        improved = true;
      }
    }

    if (!improved) break;
  }

  return result;
}

// スコアのラベル
export function scoreLabel(total: number): { text: string; color: string } {
  if (total >= 80) return { text: '最適', color: 'text-green-700 bg-green-100' };
  if (total >= 60) return { text: '良好', color: 'text-blue-700 bg-blue-100' };
  if (total >= 40) return { text: '普通', color: 'text-yellow-700 bg-yellow-100' };
  return { text: '要検討', color: 'text-red-700 bg-red-100' };
}

// スコア項目の日本語名
export const scoreLabels: Record<keyof Omit<ScoreBreakdown, 'total'>, { name: string; max: number }> = {
  settlement: { name: '決算年1回', max: 10 },
  distribution: { name: '分配金なし', max: 10 },
  fundSize: { name: '規模30億↑', max: 10 },
  stdDevRange: { name: '標準偏差', max: 10 },
  sharpeRange: { name: 'シャープ', max: 15 },
  lowCost: { name: '低コスト', max: 15 },
  assetGrowth: { name: '資産↑', max: 10 },
  trackRecord: { name: '運用実績', max: 10 },
  sellerMatch: { name: '楽天/SBI', max: 10 },
};
