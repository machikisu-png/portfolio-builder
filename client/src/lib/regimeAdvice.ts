/**
 * 制度活用ガイド（NISA / iDeCo）
 *
 * プロフィール（年齢・職業・年収・貯金・生活費）から、
 * 「いま何をすべきか」をFP標準ロジックで段階別に提示する。
 *
 * 基本順序:
 *   1. 生活防衛資金（自営業は生活費12ヶ月、会社員は6ヶ月）が最優先
 *   2. NISA つみたて枠（流動性確保しつつ非課税運用）
 *   3. iDeCo（節税効果大、ただし60歳まで引き出し不可）
 *   4. NISA成長枠 / iDeCo上限まで段階的に増額
 */
import type { UserProfile } from './userProfile';

export interface RegimeAdvice {
  iDeCoMonthlyLimit: number;          // 円/月
  defenseFundTarget: number;          // 万円（生活防衛資金の目標額）
  defenseFundRatio: number;           // 0-1（現在の達成率）
  currentStage: 1 | 2 | 3 | 4;        // 推奨フェーズ
  stageLabel: string;
  stageAction: string;
  taxSavingPerYear: number | null;    // 円/年（iDeCo 節税額の推定）
  recommendations: string[];          // 箇条書きアドバイス
  warnings: string[];                 // 注意点
}

/** 職業別 iDeCo 月額上限（円） */
const IDECO_LIMIT_BY_OCCUPATION: Record<string, number> = {
  self_employed: 68000,  // 自営業（第1号被保険者）
  employee: 23000,       // 会社員（企業年金なし、標準値）
  public: 20000,         // 公務員
  part_time: 23000,      // パート（第3号 or 1号）
  pensioner: 0,          // 年金生活（60歳以降は基本不可）
  other: 23000,
};

/** 生活防衛資金の月数（職業別） */
const DEFENSE_MONTHS_BY_OCCUPATION: Record<string, number> = {
  self_employed: 12,
  employee: 6,
  public: 3,
  part_time: 12,
  pensioner: 24,
  other: 6,
};

/** 所得税率の概算（年収ベース・自営業/会社員問わず簡易判定） */
function estimateMarginalTaxRate(annualIncome: number): number {
  // 課税所得ベースの概算（控除込み）
  if (annualIncome < 200) return 0.10;   // 所得税5%+住民税10%相当だが低所得帯は5%
  if (annualIncome < 350) return 0.15;
  if (annualIncome < 700) return 0.20;
  if (annualIncome < 900) return 0.23;
  if (annualIncome < 1800) return 0.33;
  return 0.43;
}

export function buildRegimeAdvice(profile: UserProfile): RegimeAdvice {
  const occupation = profile.occupation || 'employee';
  const iDeCoMonthlyLimit = IDECO_LIMIT_BY_OCCUPATION[occupation] ?? 23000;
  const defenseMonths = DEFENSE_MONTHS_BY_OCCUPATION[occupation] ?? 6;

  // 生活費の推定: 入力があればそれ、なければ年収÷12×0.6
  const monthlyExpense =
    profile.monthlyExpenses !== undefined
      ? profile.monthlyExpenses + (profile.monthlyFixedOut ?? 0)
      : profile.annualIncome
      ? Math.round((profile.annualIncome / 12) * 0.6 * 10) / 10
      : 20; // デフォルト月20万

  const defenseFundTarget = Math.round(monthlyExpense * defenseMonths);
  const savings = profile.savings ?? 0;
  const defenseFundRatio = defenseFundTarget > 0 ? Math.min(savings / defenseFundTarget, 1) : 1;

  // ステージ判定
  let currentStage: 1 | 2 | 3 | 4 = 1;
  let stageLabel = '';
  let stageAction = '';
  const monthlyInvest = profile.monthlyInvestment ?? 0;

  if (defenseFundRatio < 1) {
    currentStage = 1;
    stageLabel = '🛡 第1段階: 生活防衛資金の確保';
    stageAction =
      `生活防衛資金 ${defenseFundTarget}万円（生活費×${defenseMonths}ヶ月）に到達するまでは、` +
      `投資は月3万円程度に抑え、残りは普通預金で現金クッションを優先的に貯めましょう。`;
  } else if (monthlyInvest < 3) {
    currentStage = 2;
    stageLabel = '🌱 第2段階: 新NISAつみたて枠で開始';
    stageAction =
      `防衛資金は達成済みです。新NISAつみたて枠（年120万・月10万まで）で、` +
      `全世界株式またはS&P500のインデックスを月2〜5万円から開始しましょう。流動性を確保しつつ非課税運用できます。`;
  } else if (occupation !== 'pensioner' && (profile.age ?? 0) < 60) {
    currentStage = 3;
    stageLabel = '💎 第3段階: iDeCoで節税スタート';
    stageAction =
      `NISA積立が軌道に乗ったので、iDeCo月1〜2万円で「節税効果」を取りに行きましょう。` +
      `自営業/公務員は所得控除のインパクトが大きく、長期で大きな差が生まれます。` +
      `※iDeCoは60歳まで引き出せない点に注意。`;
  } else {
    currentStage = 4;
    stageLabel = '🎯 第4段階: 上限まで段階的に増額';
    stageAction =
      `基礎は整っています。NISA成長枠の活用、iDeCo月額の上限到達（自営業なら月6.8万）を` +
      `目指して段階的に増額しましょう。`;
  }

  // 節税額の推定（iDeCo を上限まで掛けた場合の年間節税額）
  let taxSavingPerYear: number | null = null;
  if (profile.annualIncome && iDeCoMonthlyLimit > 0) {
    const rate = estimateMarginalTaxRate(profile.annualIncome);
    taxSavingPerYear = Math.round(iDeCoMonthlyLimit * 12 * rate);
  }

  // 推奨事項
  const recommendations: string[] = [];
  if (occupation === 'self_employed') {
    recommendations.push(
      '自営業のiDeCo上限は月6.8万円（年81.6万円）。会社員より3倍枠が大きく、所得控除メリット最大です'
    );
    recommendations.push(
      '退職金がない自営業者は、iDeCoが事実上の「退職金代わり」になります'
    );
    recommendations.push(
      '小規模企業共済（月最大7万円、全額所得控除）も併用すると節税効果がさらに大きくなります'
    );
  }
  if (occupation === 'employee' || occupation === 'public') {
    recommendations.push(
      '会社員/公務員は退職金や厚生年金があるので、まずは新NISAを満額活用→iDeCoの順がセオリーです'
    );
  }
  if ((profile.age ?? 0) >= 50) {
    recommendations.push(
      '50代以降はiDeCoの加入可能期間が短くなる（最長65歳まで）ため、早めの開始が有利です'
    );
  }
  recommendations.push(
    'NISAとiDeCoは併用可能。同じ「全世界株式インデックス」を両方の口座で買って構いません'
  );

  // 警告事項
  const warnings: string[] = [];
  if (defenseFundRatio < 0.5) {
    warnings.push(
      '⚠️ 生活防衛資金が目標の半分未満です。投資を増やすより現金クッションを優先しましょう'
    );
  }
  if (profile.monthlyFixedOut && profile.monthlyFixedOut >= 10) {
    warnings.push(
      `⚠️ 固定支出（養育費等）が月${profile.monthlyFixedOut}万円と大きいため、iDeCoは「無理のない範囲」で。流動性確保のためNISAを厚めに`
    );
  }
  if (occupation === 'self_employed' && !profile.retirementBenefit) {
    warnings.push(
      '⚠️ 退職金情報が未入力。自営業で退職金なしの場合、老後資金は完全に自助努力です'
    );
  }
  if ((profile.age ?? 0) >= 55) {
    warnings.push(
      '⚠️ iDeCoは加入から最低5年は受給開始できないルールあり（60歳超で加入の場合）'
    );
  }

  return {
    iDeCoMonthlyLimit,
    defenseFundTarget,
    defenseFundRatio,
    currentStage,
    stageLabel,
    stageAction,
    taxSavingPerYear,
    recommendations,
    warnings,
  };
}
