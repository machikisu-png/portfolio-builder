/**
 * ユーザープロフィール（相談シート生成用）
 *
 * - localStorage に保存（ブラウザごとに独立。誰が使ってもその人のデータが残る）
 * - 全項目オプション。空欄のまま相談シート生成も可能
 */

export interface UserProfile {
  age?: number;
  occupation?: 'employee' | 'self_employed' | 'public' | 'part_time' | 'pensioner' | 'other' | '';
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | '';
  annualIncome?: number;     // 万円
  savings?: number;          // 万円
  dependents?: string;       // 例: "長男8歳/長女12歳" — 自由記述
  monthlyExpenses?: number;  // 万円 — 月の生活費
  monthlyFixedOut?: number;  // 万円 — 養育費/ローン等の固定支出
  retirementBenefit?: 'yes' | 'no' | 'unknown' | '';
  investGoalAge?: number;    // 何歳までに資産を形成したいか
  investGoalAmount?: number; // 万円 — 目標資産額
  monthlyInvestment?: number;// 万円 — 月の積立額
  riskTolerance?: 'low' | 'medium' | 'high' | '';
  notes?: string;            // 自由メモ
}

const KEY = 'userProfile';

export function getUserProfile(): UserProfile {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(profile));
}

export function clearUserProfile(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

// ===== 表示用ラベル =====

export const OCCUPATION_LABELS: Record<string, string> = {
  employee: '会社員',
  self_employed: '自営業/フリーランス',
  public: '公務員',
  part_time: 'パート/アルバイト',
  pensioner: '年金生活',
  other: 'その他',
};

export const MARITAL_LABELS: Record<string, string> = {
  single: '独身',
  married: '既婚',
  divorced: '離別',
  widowed: '死別',
};

export const RISK_LABELS: Record<string, string> = {
  low: '低（元本割れは避けたい）',
  medium: '中（多少の変動は許容）',
  high: '高（長期で成長狙い）',
};

export const RETIREMENT_LABELS: Record<string, string> = {
  yes: 'あり',
  no: 'なし',
  unknown: '不明',
};
