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
  '海外債券':   [['海外債券'], ['国内債券'], ['バランス型']],
  '新興国債券': [['新興国債券'], ['海外債券']],
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

  if (fund.return10y != null && Number.isFinite(fund.return10y)) values.push({ ret: fund.return10y, weight: 3 });
  if (fund.return5y != null && Number.isFinite(fund.return5y)) values.push({ ret: fund.return5y, weight: 5 });

  // 3年リターンの妥当性チェック（累積値の可能性を除外）
  if (fund.return3y != null && Number.isFinite(fund.return3y)) {
    const r1 = (fund.return1y != null && Number.isFinite(fund.return1y)) ? fund.return1y : 0;
    if (!(fund.return3y < 3 && r1 > 10)) {
      values.push({ ret: fund.return3y, weight: 2 });
    }
  }

  if (values.length > 0) {
    const totalWeight = values.reduce((s, v) => s + v.weight, 0);
    return values.reduce((s, v) => s + v.ret * v.weight, 0) / totalWeight;
  }

  // 1年データのみの場合、長期期待値として過大評価を避けるため保守的にキャップ
  // 短期の急騰（例: 26%）を長期年率期待として採用するのは危険
  if (fund.return1y != null && Number.isFinite(fund.return1y)) {
    return Math.min(fund.return1y, 8);
  }
  return 0;
}

/**
 * ポートフォリオ全体の加重リターンを計算
 * リスクはプリセット目標値を使用するため、ここではリターンのみ正確に計算
 */
function calcPortfolioMetrics(items: Array<{ fund: Fund; weight: number }>): { ret: number; risk: number } {
  let ret = 0;
  for (const item of items) {
    ret += item.weight * getLongTermReturn(item.fund);
  }
  // リスクはプリセット目標値を使うため、ここでは参考値
  // ファンド選定の比較用にカテゴリベンチマークで概算
  let risk = 0;
  for (const item of items) {
    const sd = categoryRiskBenchmark[item.fund.category] ?? 10;
    risk += item.weight * sd;
  }
  return { ret, risk };
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
  hedgePreference: 'none' | 'hedged' | 'both' = 'none',
  category: string = '',
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

  // 為替ヘッジ適合ボーナス/ペナルティ
  const hedged = isHedgedFund(fund);
  const overseas = isOverseasCategory(category);
  if (overseas) {
    if (hedgePreference === 'hedged') {
      // ヘッジあり希望: ヘッジ付きファンドに大幅ボーナス
      fitScore += hedged ? 50 : -30;
    } else if (hedgePreference === 'none') {
      // ヘッジなし希望: ヘッジなしファンドにボーナス
      fitScore += hedged ? -20 : 10;
    } else if (hedgePreference === 'both') {
      // 混合: どちらでもOKだが、ヘッジ付きに軽いボーナス
      fitScore += hedged ? 15 : 0;
    }
  }

  // リターン/リスクフィットが十分高い場合（目標に近い）、品質スコアの重みを上げる
  // フィットが低い場合はフィット優先のまま
  const fitRatio = fitScore / 200; // 0-1 (1=完全一致)
  const qualityMultiplier = fitRatio > 0.5 ? 0.8 : 0.3; // フィット良好なら品質重視
  const qualityWeight = Math.round(qualityScore.total * qualityMultiplier);

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

// 為替ヘッジの判定
const HEDGE_KEYWORDS = ['為替ヘッジ', 'ヘッジあり', 'ヘッジ付', 'ヘッジ型', '（ヘッジあり）', '(ヘッジあり)', 'hedged'];
const OVERSEAS_CATEGORIES = ['先進国株式', '全世界株式', '海外債券', '新興国株式', '新興国債券', 'REIT', 'コモディティ'];

function isHedgedFund(fund: Fund): boolean {
  if (fund.forexHedge === true) return true;
  for (const kw of HEDGE_KEYWORDS) {
    if (fund.name.toLowerCase().includes(kw.toLowerCase())) return true;
  }
  return false;
}

function isOverseasCategory(category: string): boolean {
  return OVERSEAS_CATEGORIES.includes(category);
}

export function optimizeFundsForPreset(
  allFunds: Fund[],
  allocations: Array<{ category: string; weight: number }>,
  targetReturn: number,
  targetRisk: number,
  hedgePreference: 'none' | 'hedged' | 'both' = 'none',
  calcMode: 'mpt' | 'spreadsheet' = 'spreadsheet',
): Array<{ fund: Fund; weight: number; score: ScoreBreakdown; fitScore: number }> {
  // calcMode='mpt' は相関考慮で実リスクが目標より小さく出る傾向のため、
  // 候補評価時のリスクを実効値(0.75倍)に補正してファンド選定を調整
  const riskEffMultiplier = calcMode === 'mpt' ? 0.75 : 1.0;
  const usedFundIds = new Set<string>();

  // プリセットの目標値に応じて、カテゴリリターンをスケーリング
  // 積極型プリセット（高リターン目標）では各カテゴリの ideal リターンも高く、
  // 安定型プリセット（低リターン目標）では ideal リターンを低く取る
  // 基準: 標準プリセット(target=6.5%) を 1.0 倍とし、それ以外は targetReturn/6.5 倍
  // リスクはスケーリングしない: カテゴリリスクは個別ファンドのリスクで、
  // プリセットのリスク値は分散効果を含むポートフォリオ値のため性質が異なる
  const baselineReturn = 6.5;
  const returnScale = targetReturn / baselineReturn;

  // レバレッジ・毎月分配等を除外
  const eligibleFunds = allFunds.filter(isEligibleForPreset);

  // 第1パス: 各カテゴリで目標に最も近いファンドを初期選定
  // 各エントリは allocIndex で対応する allocation を保持
  const result: Array<{ fund: Fund; weight: number; score: ScoreBreakdown; fitScore: number; allocIndex: number }> = [];

  for (let allocIdx = 0; allocIdx < allocations.length; allocIdx++) {
    const alloc = allocations[allocIdx];
    const available = eligibleFunds.filter(f => !usedFundIds.has(f.id));
    const fallbackChain = categoryFallbacks[alloc.category] || [[alloc.category]];
    let candidates: Fund[] = [];
    for (const matchCats of fallbackChain) {
      candidates = available.filter(f => matchCats.includes(f.category));
      if (candidates.length > 0) break;
    }
    if (candidates.length === 0) candidates = available;
    // 候補ゼロ（対象カテゴリのファンドが未取得等）の場合は、このスロットをスキップ
    if (candidates.length === 0) continue;

    // カテゴリ基準リターンを preset の目標値でスケール（積極型なら高く、安定型なら低く）
    // リスクはカテゴリ固有のため未スケール
    const catReturnBase = categoryReturnBenchmark[alloc.category] ?? targetReturn;
    const idealReturn = catReturnBase * returnScale;
    const idealRisk = categoryRiskBenchmark[alloc.category] ?? targetRisk;

    let bestFund = candidates[0];
    let bestInfo = scoreCandidateForTarget(bestFund, idealReturn, idealRisk, hedgePreference, alloc.category);

    for (const c of candidates) {
      const info = scoreCandidateForTarget(c, idealReturn, idealRisk, hedgePreference, alloc.category);
      if (info.totalScore > bestInfo.totalScore) {
        bestFund = c;
        bestInfo = info;
      }
    }

    result.push({ fund: bestFund, weight: alloc.weight, score: bestInfo.qualityScore, fitScore: bestInfo.fitScore, allocIndex: allocIdx });
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
      const alloc = allocations[slot.allocIndex];
      if (!alloc) continue;
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
      const othersRisk = result.reduce((s, r, j) => j === i ? s : s + r.weight * (r.fund.stdDev ?? 15) * riskEffMultiplier, 0);
      const neededRisk = (targetRisk - othersRisk) / slot.weight;

      let bestCandidate = slot.fund;
      let bestError = Infinity;

      for (const c of candidates) {
        // 為替ヘッジフィルタ: 海外カテゴリでヘッジ設定に合わないファンドをスキップ
        const overseas = isOverseasCategory(alloc.category);
        if (overseas) {
          const hedged = isHedgedFund(c);
          if (hedgePreference === 'hedged' && !hedged) continue;
          if (hedgePreference === 'none' && hedged) continue;
        }

        const cReturn = getLongTermReturn(c);
        const cRisk = (c.stdDev ?? 15) * riskEffMultiplier;
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
        const info = scoreCandidateForTarget(bestCandidate, neededReturn, neededRisk, hedgePreference, alloc.category);
        result[i] = { fund: bestCandidate, weight: slot.weight, score: info.qualityScore, fitScore: info.fitScore, allocIndex: slot.allocIndex };
        improved = true;
      }
    }

    if (!improved) break;
  }

  return result;
}

/**
 * 計算表モード用: 加重和のリターン/リスクを目標に近づけるよう重みを微調整
 * 各ファンドの重みが maxDeviation 以内で動き、合計=1を維持。
 * ペア交換で |returnErr| + |riskErr|*2 を最小化する貪欲法。
 */
export function adjustWeightsToTargetSpreadsheet(
  items: Array<{ fund: Fund; weight: number }>,
  targetReturn: number,
  targetRisk: number,
  maxDeviation: number = 0.15, // 元の重みから±15pt以内で動かす
  step: number = 0.005, // 0.5%単位で調整
  maxIterations: number = 500,
): Array<{ fund: Fund; weight: number }> {
  if (items.length < 2) return items;
  const base = items.map(i => i.weight);
  const weights = [...base];
  const rets = items.map(i => getLongTermReturn(i.fund));
  const risks = items.map(i => i.fund.stdDev ?? 15);

  const calc = (w: number[]) => {
    let r = 0, s = 0;
    for (let i = 0; i < w.length; i++) {
      r += w[i] * rets[i];
      s += w[i] * risks[i];
    }
    return { r, s };
  };
  const error = (w: number[]) => {
    const { r, s } = calc(w);
    return Math.abs(r - targetReturn) + Math.abs(s - targetRisk) * 2;
  };

  let bestErr = error(weights);
  if (bestErr < 0.1) return items; // 既に十分近い

  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;
    // 全ペア (i,j) で i→j へ step 移動
    for (let i = 0; i < weights.length; i++) {
      for (let j = 0; j < weights.length; j++) {
        if (i === j) continue;
        const newWi = weights[i] - step;
        const newWj = weights[j] + step;
        // 範囲制約
        if (newWi < Math.max(0, base[i] - maxDeviation)) continue;
        if (newWj > Math.min(1, base[j] + maxDeviation)) continue;
        weights[i] = newWi;
        weights[j] = newWj;
        const e = error(weights);
        if (e < bestErr - 1e-6) {
          bestErr = e;
          improved = true;
        } else {
          // 戻す
          weights[i] = newWi + step;
          weights[j] = newWj - step;
        }
        if (bestErr < 0.1) break;
      }
      if (bestErr < 0.1) break;
    }
    if (!improved) break;
  }

  // 0.25%単位に丸め、合計=1を保証
  const rounded = weights.map(w => Math.round(w * 400) / 400);
  const diff = 1 - rounded.reduce((a, b) => a + b, 0);
  const maxIdx = rounded.indexOf(Math.max(...rounded));
  rounded[maxIdx] = Math.round((rounded[maxIdx] + diff) * 400) / 400;

  return items.map((it, i) => ({ fund: it.fund, weight: rounded[i] }));
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
