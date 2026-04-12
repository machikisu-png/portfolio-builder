export interface Fund {
  id: string;
  name: string;
  category: string;
  nav: number; // 基準価額
  navChange: number; // 前日比
  totalAssets: number; // 純資産総額（百万円）
  expenseRatio: number; // 信託報酬（%）
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
  return10y: number | null;
  sharpeRatio: number | null;
  stdDev: number | null; // 標準偏差
  nisaEligible: boolean;
  source: 'wealthadvisor' | 'minkabu';
  // 選定条件用フィールド
  settlementFrequency: number | null; // 決算回数（年）
  distributionAmount: number | null;  // 直近分配金（円）0=分配金なし
  fundSizeMillions: number | null;    // ファンド規模（百万円）
  assetTrend: 'up' | 'flat' | 'down' | null; // 純資産総額の推移
  inceptionYear: number | null;       // 設定年
  sellers: string[];                  // 販売会社
  selectionScore: number | null;      // 自動選定スコア（0-100）
  forexHedge: boolean | null;         // 為替ヘッジあり/なし
}

export interface PortfolioItem {
  fund: Fund;
  weight: number; // 0-1
}

export type RiskTolerance = 'low' | 'medium' | 'high';

export interface SimulationParams {
  monthlyInvestment: number;
  years: number;
  portfolioItems: PortfolioItem[];
}

export interface SimulationResult {
  months: number[];
  optimistic: number[]; // 75th percentile
  expected: number[];   // 50th percentile
  pessimistic: number[]; // 25th percentile
  totalInvested: number[];
}

export interface OptimizationResult {
  weights: number[];
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
}

export type FundCategory =
  | '国内株式'
  | '先進国株式'
  | '新興国株式'
  | '全世界株式'
  | '国内債券'
  | '海外債券'
  | '新興国債券'
  | 'バランス型'
  | 'REIT'
  | 'コモディティ'
  | 'その他';

export interface PresetAllocation {
  category: string;
  weight: number; // 0-1
}

export interface PortfolioPreset {
  id: string;
  name: string;
  subtitle: string;
  allocations: PresetAllocation[];
  expectedReturn: number; // %
  risk: number; // %
  color: string;
}

export interface SearchFilters {
  category: FundCategory | '';
  minReturn: number | null;
  maxExpenseRatio: number | null;
  nisaOnly: boolean;
  sortBy: 'score' | 'return1y' | 'return3y' | 'return5y' | 'return10y' | 'sharpeRatio' | 'expenseRatio' | 'totalAssets';
  sortOrder: 'asc' | 'desc';
  source: 'all' | 'wealthadvisor' | 'minkabu';
}
