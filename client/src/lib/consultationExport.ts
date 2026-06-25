/**
 * 相談シート生成
 *
 * ユーザープロフィール + 現在のポートフォリオ状態を Markdown 形式に整形。
 * Claude（チャット）にそのまま貼り付けて相談できる形式。
 */
import type { PortfolioItem, PortfolioPreset } from './types';
import { calcPortfolioStats } from './optimizer';
import { computeModernStats } from './proCovariance';
import { buildRegimeAdvice } from './regimeAdvice';
import {
  type UserProfile,
  OCCUPATION_LABELS,
  MARITAL_LABELS,
  RISK_LABELS,
  RETIREMENT_LABELS,
} from './userProfile';

export interface ConsultationInput {
  profile: UserProfile;
  items: PortfolioItem[];
  preset: PortfolioPreset | null;
  scenarios: string[];   // 定型相談シナリオの選択
  freeText: string;      // 自由記述
}

const SCENARIO_TEXT: Record<string, string> = {
  annual_review:   '年1回の定期レビュー（配分ズレ・ファンド劣化・重複の有無を診断してほしい）',
  crash:           '相場が大きく下落して不安。狼狽売りすべきか、買い増しチャンスか判断してほしい',
  rally:           '相場が大きく上昇。利確すべきか、そのまま持ち続けるべきか判断してほしい',
  forex:           '為替が大きく動いた。ヘッジあり/なしの切替を検討すべきか',
  rate_change:     '金利環境が変わった。債券比率を見直すべきか',
  life_change:     '家族構成・収入・支出など生活環境が変化した。リスク許容度を見直したい',
  rebalance:       '配分比率が目標から大きくズレている。リバランスの具体的手順を教えてほしい',
  fund_review:     'より低コストのファンドが出ていないか、ファンド入れ替えを検討したい',
  goal_check:      '目標額に向けて積立額・期間が適切か診断してほしい',
  tax:             'NISA/iDeCo の枠の使い方が今の状況で最適か確認したい',
};

export function buildConsultationText(input: ConsultationInput): string {
  const { profile, items, preset, scenarios, freeText } = input;
  const lines: string[] = [];

  lines.push('【投資信託ポートフォリオ相談】');
  lines.push('');

  // ===== プロフィール =====
  lines.push('## 1. プロフィール');
  if (profile.age) lines.push(`- 年齢: ${profile.age}歳`);
  if (profile.occupation) lines.push(`- 職業: ${OCCUPATION_LABELS[profile.occupation] ?? profile.occupation}`);
  if (profile.maritalStatus) lines.push(`- 世帯: ${MARITAL_LABELS[profile.maritalStatus] ?? profile.maritalStatus}`);
  if (profile.dependents) lines.push(`- 扶養家族: ${profile.dependents}`);
  if (profile.annualIncome !== undefined) lines.push(`- 年収: ${profile.annualIncome}万円`);
  if (profile.savings !== undefined) lines.push(`- 貯金（投資以外）: ${profile.savings}万円`);
  if (profile.monthlyExpenses !== undefined) lines.push(`- 月の生活費: ${profile.monthlyExpenses}万円`);
  if (profile.monthlyFixedOut !== undefined) lines.push(`- 月の固定支出（養育費・ローン等）: ${profile.monthlyFixedOut}万円`);
  if (profile.retirementBenefit) lines.push(`- 退職金/企業年金: ${RETIREMENT_LABELS[profile.retirementBenefit] ?? profile.retirementBenefit}`);
  if (profile.riskTolerance) lines.push(`- リスク許容度: ${RISK_LABELS[profile.riskTolerance] ?? profile.riskTolerance}`);
  if (profile.investGoalAge) lines.push(`- 資産形成の目標年齢: ${profile.investGoalAge}歳`);
  if (profile.investGoalAmount) lines.push(`- 目標資産額: ${profile.investGoalAmount}万円`);
  if (profile.monthlyInvestment !== undefined) lines.push(`- 月の積立額: ${profile.monthlyInvestment}万円`);
  if (profile.notes) lines.push(`- メモ: ${profile.notes}`);
  if (lines[lines.length - 1] === '## 1. プロフィール') {
    lines.push('（未入力）');
  }
  lines.push('');

  // ===== ポートフォリオ =====
  lines.push('## 2. 現在のポートフォリオ');
  if (preset) {
    lines.push(`- プリセット: ${preset.name}（${preset.subtitle}）`);
    lines.push(`- プリセット目標: リターン ${preset.expectedReturn}% / リスク ${preset.risk}%`);
    const modern = computeModernStats(preset.allocations);
    lines.push(`- 最新値（20年実データ推定）: リターン ${modern.expectedReturn.toFixed(1)}% / リスク ${modern.risk.toFixed(1)}%`);
  } else {
    lines.push('- プリセット: 未選択');
  }

  if (items.length > 0) {
    const funds = items.map(it => it.fund);
    const weights = items.map(it => it.weight);
    const mpt = calcPortfolioStats(funds, weights, 'mpt');
    const sheet = calcPortfolioStats(funds, weights, 'spreadsheet');
    const pro = calcPortfolioStats(funds, weights, 'pro');

    lines.push('');
    lines.push('### 計算結果（現在のファンド構成）');
    lines.push(`- MPT:     リターン ${mpt.expectedReturn.toFixed(2)}% / リスク ${mpt.risk.toFixed(2)}% / シャープ ${mpt.sharpeRatio.toFixed(2)}`);
    lines.push(`- 計算表:  リターン ${sheet.expectedReturn.toFixed(2)}% / リスク ${sheet.risk.toFixed(2)}% / シャープ ${sheet.sharpeRatio.toFixed(2)}`);
    lines.push(`- プロ:    リターン ${pro.expectedReturn.toFixed(2)}% / リスク ${pro.risk.toFixed(2)}% / シャープ ${pro.sharpeRatio.toFixed(2)}`);

    lines.push('');
    lines.push('### ファンド一覧');
    items.forEach((it, i) => {
      const w = (it.weight * 100).toFixed(1);
      const f = it.fund;
      const monthly = profile.monthlyInvestment
        ? `（月 ${(profile.monthlyInvestment * it.weight).toFixed(2)}万円）`
        : '';
      lines.push(`${i + 1}. [${f.category}] ${f.name} — ${w}%${monthly}`);
      const meta: string[] = [];
      if (f.expenseRatio !== undefined && f.expenseRatio !== null) meta.push(`信託報酬 ${f.expenseRatio}%`);
      if (f.return1y !== undefined && f.return1y !== null) meta.push(`1年 ${f.return1y}%`);
      if (f.return5y !== undefined && f.return5y !== null) meta.push(`5年 ${f.return5y}%`);
      if (f.totalAssets) meta.push(`純資産 ${Math.round(f.totalAssets / 100)}億円`);
      if (meta.length) lines.push(`   ${meta.join(' / ')}`);
    });
  } else {
    lines.push('- ファンド未選択');
  }
  lines.push('');

  // ===== 相談内容 =====
  // ===== 制度活用ガイド（自動診断） =====
  const advice = buildRegimeAdvice(profile);
  lines.push('## 3. 制度活用ガイド（自動診断）');
  lines.push(`- 推奨ステージ: ${advice.stageLabel}（${advice.currentStage}/4）`);
  lines.push(`- 推奨アクション: ${advice.stageAction}`);
  lines.push(`- 生活防衛資金: ${profile.savings ?? 0} / ${advice.defenseFundTarget}万円（達成率 ${Math.round(advice.defenseFundRatio * 100)}%）`);
  lines.push(`- iDeCo月額上限: ${advice.iDeCoMonthlyLimit > 0 ? `${advice.iDeCoMonthlyLimit.toLocaleString()}円/月` : '対象外'}`);
  if (advice.taxSavingPerYear !== null) {
    lines.push(`- iDeCo上限時の節税効果: 約${Math.round(advice.taxSavingPerYear / 1000) / 10}万円/年（20年累計 約${Math.round(advice.taxSavingPerYear * 20 / 10000)}万円）`);
  }
  if (advice.warnings.length > 0) {
    lines.push('- 注意点:');
    advice.warnings.forEach(w => lines.push(`  - ${w}`));
  }
  lines.push('');

  lines.push('## 4. 相談内容');
  if (scenarios.length > 0) {
    lines.push('### 確認したいこと');
    scenarios.forEach(s => {
      const t = SCENARIO_TEXT[s] ?? s;
      lines.push(`- ${t}`);
    });
    lines.push('');
  }
  if (freeText.trim()) {
    lines.push('### 自由記述');
    lines.push(freeText.trim());
    lines.push('');
  }
  if (scenarios.length === 0 && !freeText.trim()) {
    lines.push('（相談内容未記入 — 総合診断をお願いします）');
    lines.push('');
  }

  lines.push('---');
  lines.push('上記の前提のもと、世界一のファイナンシャルプランナーの視点で診断・アドバイスをお願いします。');

  return lines.join('\n');
}

export { SCENARIO_TEXT };
