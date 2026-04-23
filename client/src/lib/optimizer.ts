import type { Fund, OptimizationResult, RiskTolerance } from './types';

// 平均分散最適化（マーコビッツモデル簡易版）
// 効率的フロンティア上の最適ポートフォリオを計算

function getExpectedReturn(fund: Fund): number {
  // 利用可能な最長期間のリターンを使用
  if (fund.return5y !== null) return fund.return5y;
  if (fund.return3y !== null) return fund.return3y;
  if (fund.return1y !== null) return fund.return1y;
  return 0;
}

function getRisk(fund: Fund): number {
  if (fund.stdDev !== null) return fund.stdDev;
  // 標準偏差がない場合はリターンから推定
  const ret = getExpectedReturn(fund);
  return Math.abs(ret) * 0.8 + 5; // 簡易推定
}

// 相関係数の簡易推定（同カテゴリは高相関、異カテゴリは低相関）
function estimateCorrelation(fund1: Fund, fund2: Fund): number {
  if (fund1.id === fund2.id) return 1;
  if (fund1.category === fund2.category) return 0.85;

  const stockCategories = ['国内株式', '先進国株式', '新興国株式', '全世界株式'];
  const bondCategories = ['国内債券', '海外債券', '新興国債券'];

  const isStock1 = stockCategories.includes(fund1.category);
  const isStock2 = stockCategories.includes(fund2.category);
  const isBond1 = bondCategories.includes(fund1.category);
  const isBond2 = bondCategories.includes(fund2.category);

  if (isStock1 && isStock2) return 0.7;
  if (isBond1 && isBond2) return 0.6;
  if ((isStock1 && isBond2) || (isBond1 && isStock2)) return -0.1;
  if (fund1.category === 'REIT' || fund2.category === 'REIT') return 0.4;
  return 0.3;
}

// ポートフォリオのリターンとリスクを計算
// [Excel計算表モード] リスクは相関を無視した単純加重和（ポートフォリオ計算表.xlsx L19=C8%*2 と同じ前提）
export function calcPortfolioStats(
  funds: Fund[],
  weights: number[]
): { expectedReturn: number; risk: number; sharpeRatio: number } {
  const n = funds.length;
  let expectedReturn = 0;
  let risk = 0;

  for (let i = 0; i < n; i++) {
    expectedReturn += weights[i] * getExpectedReturn(funds[i]);
    // Excel式: 相関を考慮せず、σを単純加重合計（= 相関係数1と同等）
    risk += weights[i] * getRisk(funds[i]);
  }

  const riskFreeRate = 0.1; // 無リスク金利
  const sharpeRatio = risk > 0 ? (expectedReturn - riskFreeRate) / risk : 0;

  return { expectedReturn, risk, sharpeRatio };
}

// ランダムポートフォリオ生成（ディリクレ分布的）
function randomWeights(n: number): number[] {
  const raw = Array.from({ length: n }, () => -Math.log(Math.random()));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(v => v / sum);
}

// モンテカルロ法による効率的フロンティア近似
export function optimizePortfolio(
  funds: Fund[],
  riskTolerance: RiskTolerance,
  iterations: number = 10000
): OptimizationResult {
  const n = funds.length;
  if (n === 0) {
    return { weights: [], expectedReturn: 0, risk: 0, sharpeRatio: 0 };
  }
  if (n === 1) {
    const stats = calcPortfolioStats(funds, [1]);
    return { weights: [1], ...stats };
  }

  // リスク許容度に応じた目標関数の重み
  const riskAversion: Record<RiskTolerance, number> = {
    low: 3.0,    // リスク回避的
    medium: 1.0, // バランス
    high: 0.3,   // リスク選好的
  };
  const lambda = riskAversion[riskTolerance];

  let bestScore = -Infinity;
  let bestWeights = Array(n).fill(1 / n);
  let bestStats = calcPortfolioStats(funds, bestWeights);

  for (let i = 0; i < iterations; i++) {
    const w = randomWeights(n);
    const stats = calcPortfolioStats(funds, w);
    // 効用関数: リターン - λ * リスク^2
    const score = stats.expectedReturn - lambda * stats.risk * stats.risk / 100;

    if (score > bestScore) {
      bestScore = score;
      bestWeights = w;
      bestStats = stats;
    }
  }

  // 重みを小数点2桁に丸めて合計1にする
  const rounded = bestWeights.map(w => Math.round(w * 100) / 100);
  const diff = 1 - rounded.reduce((a, b) => a + b, 0);
  const maxIdx = rounded.indexOf(Math.max(...rounded));
  rounded[maxIdx] = Math.round((rounded[maxIdx] + diff) * 100) / 100;

  return {
    weights: rounded,
    ...bestStats,
  };
}

// 効率的フロンティア上のポイントを複数生成
export function generateEfficientFrontier(
  funds: Fund[],
  points: number = 50,
  iterations: number = 5000
): Array<{ risk: number; return_: number; weights: number[] }> {
  const n = funds.length;
  if (n < 2) return [];

  const frontier: Array<{ risk: number; return_: number; weights: number[] }> = [];

  // 異なるリスク許容度で最適化
  for (let p = 0; p < points; p++) {
    const lambda = 0.01 + (p / points) * 5; // リスク回避度を変化

    let bestScore = -Infinity;
    let bestWeights = Array(n).fill(1 / n);
    let bestStats = calcPortfolioStats(funds, bestWeights);

    for (let i = 0; i < iterations; i++) {
      const w = randomWeights(n);
      const stats = calcPortfolioStats(funds, w);
      const score = stats.expectedReturn - lambda * stats.risk * stats.risk / 100;

      if (score > bestScore) {
        bestScore = score;
        bestWeights = w;
        bestStats = stats;
      }
    }

    frontier.push({
      risk: bestStats.risk,
      return_: bestStats.expectedReturn,
      weights: bestWeights,
    });
  }

  return frontier.sort((a, b) => a.risk - b.risk);
}

export type SimMode = 'spreadsheet' | 'montecarlo';

// 計算表方式: FV関数（利回り÷10で月次複利）
export function runSpreadsheetSimulation(
  monthlyInvestment: number,
  years: number,
  expectedReturn: number, // 年率%
  stdDevPercent: number,  // 年率標準偏差%
): { months: number[]; optimistic: number[]; expected: number[]; pessimistic: number[]; totalInvested: number[] } {
  const totalMonths = years * 12;
  const monthlyRate = expectedReturn / 100 / 10; // 計算表と同じ ÷10
  const months = Array.from({ length: totalMonths + 1 }, (_, i) => i);
  const expected: number[] = [0];
  const optimistic: number[] = [0];
  const pessimistic: number[] = [0];
  const totalInvested: number[] = [0];

  let balanceExp = 0;
  // 楽観: 利回り + 標準偏差分
  let balanceOpt = 0;
  const monthlyRateOpt = (expectedReturn + stdDevPercent) / 100 / 10;
  // 悲観: 利回り - 標準偏差分（最低0）
  let balancePes = 0;
  const monthlyRatePes = Math.max(0, (expectedReturn - stdDevPercent)) / 100 / 10;

  for (let m = 1; m <= totalMonths; m++) {
    balanceExp = (balanceExp + monthlyInvestment) * (1 + monthlyRate);
    balanceOpt = (balanceOpt + monthlyInvestment) * (1 + monthlyRateOpt);
    balancePes = (balancePes + monthlyInvestment) * (1 + monthlyRatePes);

    expected.push(Math.round(balanceExp));
    optimistic.push(Math.round(balanceOpt));
    pessimistic.push(Math.round(balancePes));
    totalInvested.push(monthlyInvestment * m);
  }

  return { months, optimistic, expected, pessimistic, totalInvested };
}

// モンテカルロ積立シミュレーション
export function runSimulation(
  monthlyInvestment: number,
  years: number,
  expectedReturn: number, // 年率%
  risk: number, // 年率標準偏差%
  simulations: number = 1000
): { months: number[]; optimistic: number[]; expected: number[]; pessimistic: number[]; totalInvested: number[] } {
  const totalMonths = years * 12;
  const monthlyReturn = expectedReturn / 100 / 12;
  const monthlyStdDev = (risk / 100) / Math.sqrt(12);

  const allPaths: number[][] = [];

  for (let s = 0; s < simulations; s++) {
    const path: number[] = [0];
    let balance = 0;

    for (let m = 1; m <= totalMonths; m++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const r = monthlyReturn + monthlyStdDev * z;

      balance = (balance + monthlyInvestment) * (1 + r);
      path.push(Math.max(balance, 0));
    }
    allPaths.push(path);
  }

  const months = Array.from({ length: totalMonths + 1 }, (_, i) => i);
  const optimistic: number[] = [];
  const expected: number[] = [];
  const pessimistic: number[] = [];
  const totalInvested: number[] = [];

  for (let m = 0; m <= totalMonths; m++) {
    const values = allPaths.map(p => p[m]).sort((a, b) => a - b);
    pessimistic.push(Math.round(values[Math.floor(simulations * 0.25)]));
    expected.push(Math.round(values[Math.floor(simulations * 0.5)]));
    optimistic.push(Math.round(values[Math.floor(simulations * 0.75)]));
    totalInvested.push(monthlyInvestment * m);
  }

  return { months, optimistic, expected, pessimistic, totalInvested };
}
