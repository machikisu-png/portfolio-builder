export interface AlertRule {
  id: string;
  type: 'return_change' | 'sharpe_decline' | 'risk_change';
  enabled: boolean;
  threshold: number; // %
  description: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  fundId: string;
  fundName: string;
  category: string;
  type: 'return_change' | 'sharpe_decline' | 'risk_change';
  severity: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  suggestion: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  timestamp: number;
  read: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  frequency: 'monthly' | 'semiannual' | 'annual';
  rules: AlertRule[];
  lastChecked: number | null;
}

/**
 * FP標準の「買い替え/リバランス検討」トリガー閾値
 *
 * 更新方針:
 *   この値は世界情勢・金利環境・ボラティリティ水準に応じて
 *   ユーザーが Claude に「推奨値を最新に更新して」と依頼することで
 *   随時改訂する想定。RECOMMENDED_META に最終更新日と当時の前提を記載。
 *
 * 参考: Vanguard / Bogleheads / 金融庁つみたて投資推奨基準
 */

export interface RecommendedMeta {
  lastUpdated: string;     // YYYY-MM-DD
  marketContext: string;   // 当時の市場前提（1-3行）
  rationale: string[];     // 値設定の根拠（箇条書き）
}

/**
 * 推奨値の改訂履歴メタ情報
 * Claude が更新時にこのオブジェクトと defaultRules を同時に書き換える
 */
export const RECOMMENDED_META: RecommendedMeta = {
  lastUpdated: '2026-05-15',
  marketContext:
    '米FRBは利下げ局面、日銀は利上げ局面。AI関連で米国株P/Eが歴史的高水準。' +
    '円相場ボラティリティ高め、地政学リスク継続。グローバル株は5年で年率8-12%圏。',
  rationale: [
    'return_drop=5pt: 平常な月次変動は±3-4pt、5pt超は劣化兆候（標準維持）',
    'return_surge=12pt: AI関連の過熱を踏まえ標準15ptから前倒し警戒（バブル警戒）',
    'sharpe_decline=0.3: 統計的に有意な効率悪化（標準維持）',
    'risk_high=22%: 米国株σは年16-19%、新興国σ22-25%。22%超は新興・成長偏重の警戒',
    'risk_low=3%（無効）: 株式系商品が債券化する異常値検知用、平時は不要',
  ],
};
export const defaultRules: AlertRule[] = [
  {
    id: 'return_drop',
    type: 'return_change',
    enabled: true,
    threshold: 5,
    description: '1年リターンが前回比で5pt以上低下 → ファンド劣化の兆候。同カテゴリ平均と比較し劣後ならファンド入替を検討',
  },
  {
    id: 'return_surge',
    type: 'return_change',
    enabled: true,
    threshold: 12,
    description: '1年リターンが前回比で12pt以上上昇 → 過熱/バブルの可能性（AI関連過熱を踏まえ警戒水準前倒し）。リバランス（利確して配分を戻す）を検討',
  },
  {
    id: 'sharpe_decline',
    type: 'sharpe_decline',
    enabled: true,
    threshold: 0.3,
    description: 'シャープレシオが前回比で0.3以上低下 → 運用効率の有意な悪化。3回連続で低下したらファンド入替を検討',
  },
  {
    id: 'risk_high',
    type: 'risk_change',
    enabled: true,
    threshold: 22,
    description: '標準偏差が22%超 → 個別株式ファンドの平常上限を逸脱。比率を下げるか、より低リスクなファンドへ入替を検討',
  },
  {
    id: 'risk_low',
    type: 'risk_change',
    enabled: false,
    threshold: 3,
    description: '標準偏差が3%未満 → 株式系のはずが債券並みに鈍化。市場異常または商品性変化の可能性、運用報告書を確認',
  },
];

export const defaultConfig: MonitoringConfig = {
  enabled: true,
  frequency: 'monthly',
  rules: defaultRules,
  lastChecked: null,
};
