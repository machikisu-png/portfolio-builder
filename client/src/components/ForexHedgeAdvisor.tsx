import { useState } from 'react';

interface ForexHedgeAdvisorProps {
  hedgeSelection: 'none' | 'hedged' | 'both';
  investmentYears: number;
}

interface MarketFactor {
  name: string;
  description: string;
  impact: 'hedge' | 'no-hedge' | 'neutral';
  weight: number; // 重要度 1-3
  detail: string;
}

// 2026年4月時点の市場環境に基づくファクター
const currentFactors: MarketFactor[] = [
  {
    name: '日米金利差',
    description: '日本の低金利 vs 米国の高金利が継続',
    impact: 'no-hedge',
    weight: 3,
    detail: '金利差がある限り、ヘッジコスト（年率3-5%程度）が発生。ヘッジコストがリターンを大きく削る可能性があります。日銀の利上げペースが緩やかなら、当面このコストは高止まりします。',
  },
  {
    name: 'ヘッジコスト',
    description: '現在のヘッジコストは年率3-5%と高水準',
    impact: 'no-hedge',
    weight: 3,
    detail: '海外債券のリターンが年2-3%の場合、ヘッジコストでリターンがほぼゼロまたはマイナスになります。株式ファンドでもリターンが大幅に削られます。',
  },
  {
    name: '円安トレンド',
    description: '構造的な円安要因（貿易赤字・経常収支悪化）',
    impact: 'no-hedge',
    weight: 2,
    detail: '日本の貿易赤字の定着、デジタル赤字の拡大により、円安基調が続く可能性があります。ヘッジなしなら円安時に為替差益が得られます。',
  },
  {
    name: '円高リスク',
    description: '急激な円高への巻き戻しリスク',
    impact: 'hedge',
    weight: 2,
    detail: 'リスクオフ局面（世界的な景気後退、地政学リスク）では急激な円高が発生しやすく、為替差損でリターンが大きく減少する可能性があります。',
  },
  {
    name: '投資期間',
    description: '長期投資では為替の影響が平準化',
    impact: 'neutral',
    weight: 2,
    detail: '10年以上の長期投資では、為替の影響は年率1-2%程度に平準化する傾向があります。短期（1-3年）では為替変動の影響が大きいため、ヘッジの意味が増します。',
  },
  {
    name: '日銀の金融政策',
    description: '利上げ方向だが緩やかなペース',
    impact: 'neutral',
    weight: 2,
    detail: '日銀が利上げを続ければ金利差は縮小し、ヘッジコストは低下します。ただしペースが遅ければ、ヘッジコスト高止まりが数年続く可能性も。',
  },
  {
    name: '資産クラス別の影響',
    description: '債券はヘッジ影響大、株式は相対的に小',
    impact: 'neutral',
    weight: 1,
    detail: '債券ファンド（リターン2-5%）はヘッジコストの影響が甚大。株式ファンド（リターン10%以上）では、ヘッジコストの相対的な影響は小さくなります。',
  },
];

function getAdvice(hedgeSelection: string, years: number): { summary: string; recommendation: string; reasoning: string[] } {
  const isLongTerm = years >= 10;
  const isMediumTerm = years >= 5 && years < 10;

  if (isLongTerm) {
    return {
      summary: '長期投資（10年以上）では「ヘッジなし」が有利な可能性が高い',
      recommendation: 'no-hedge',
      reasoning: [
        '長期では為替変動が平準化され、年率1-2%程度の影響に収まる傾向',
        '現在のヘッジコスト（年率3-5%）は長期で複利的にリターンを大きく削る',
        '円安トレンドが構造的に続く場合、ヘッジなしの方がリターンが上回る可能性',
        '過去20年のデータでは、ヘッジなしの方が最終リターンが高いケースが多い',
      ],
    };
  }

  if (isMediumTerm) {
    return {
      summary: '中期投資（5-10年）では「ヘッジなし」を基本に、一部ヘッジも選択肢',
      recommendation: 'both',
      reasoning: [
        '5-10年では為替変動の影響がまだ大きいが、ヘッジコストも無視できない',
        '株式ファンドはヘッジなし、債券ファンドはヘッジありの「混合」が合理的',
        '急激な円高局面に備え、資産の20-30%にヘッジを適用する方法も',
        'ヘッジコストが低下する（金利差が縮小する）局面を見極めてから切り替える手も',
      ],
    };
  }

  // 短期（5年未満）
  return {
    summary: '短期投資（5年未満）では為替リスクの管理が重要',
    recommendation: 'hedged',
    reasoning: [
      '短期では為替変動の影響がリターンの大半を占める可能性がある',
      '取り崩し時期が近い場合、急激な円高で大きな損失リスク',
      'ただし現在のヘッジコスト（3-5%）は高く、特に債券ではリターンを相殺',
      'リスク許容度が低い場合はヘッジあり、許容できるならヘッジなしも検討',
    ],
  };
}

export default function ForexHedgeAdvisor({ hedgeSelection, investmentYears }: ForexHedgeAdvisorProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFactors, setShowFactors] = useState(false);
  const advice = getAdvice(hedgeSelection, investmentYears);

  const impactIcon = (impact: string) => {
    if (impact === 'hedge') return { label: 'ヘッジ有利', color: 'text-purple-600 bg-purple-50' };
    if (impact === 'no-hedge') return { label: 'ヘッジなし有利', color: 'text-blue-600 bg-blue-50' };
    return { label: '状況次第', color: 'text-gray-600 bg-gray-50' };
  };

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
            <span className="text-base">&#x1f4ca;</span> 為替ヘッジ アドバイス
          </h4>
          <p className="text-sm text-indigo-700 mt-1 font-medium">{advice.summary}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-indigo-500 hover:text-indigo-700 shrink-0 ml-2 mt-1"
        >
          {expanded ? '閉じる' : '詳しく見る'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* 推奨理由 */}
          <div className="bg-white/70 rounded-lg p-3">
            <h5 className="text-xs font-semibold text-gray-700 mb-2">
              投資期間{investmentYears}年の場合の判断ポイント
            </h5>
            <ul className="space-y-1.5">
              {advice.reasoning.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="text-indigo-400 mt-0.5 shrink-0">&#x25B8;</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 市場環境ファクター */}
          <div>
            <button
              onClick={() => setShowFactors(!showFactors)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {showFactors ? '市場環境ファクターを閉じる' : '現在の市場環境ファクターを見る（7項目）'}
            </button>

            {showFactors && (
              <div className="mt-2 space-y-2">
                {currentFactors.map(factor => {
                  const icon = impactIcon(factor.impact);
                  return (
                    <details key={factor.name} className="bg-white/70 rounded-lg overflow-hidden">
                      <summary className="px-3 py-2 cursor-pointer hover:bg-white/90 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${icon.color}`}>{icon.label}</span>
                          <span className="text-xs font-medium text-gray-800">{factor.name}</span>
                          <span className="text-[10px] text-gray-400">{'*'.repeat(factor.weight)}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">&#x25BE;</span>
                      </summary>
                      <div className="px-3 pb-2">
                        <p className="text-xs text-gray-600 mb-1">{factor.description}</p>
                        <p className="text-[11px] text-gray-500 leading-relaxed">{factor.detail}</p>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>

          {/* 選択状況に対するコメント */}
          <div className={`rounded-lg p-3 text-xs ${
            hedgeSelection === 'none' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
            hedgeSelection === 'hedged' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
            'bg-green-50 text-green-800 border border-green-200'
          }`}>
            <span className="font-semibold">現在の選択「{hedgeSelection === 'none' ? 'ヘッジなし' : hedgeSelection === 'hedged' ? 'ヘッジあり' : '混合'}」について: </span>
            {hedgeSelection === 'none' && (
              <span>
                長期投資ではヘッジコストを避けられるため合理的です。ただし、短期的な円高局面（10-20%の変動）に耐えられるメンタルと投資期間が必要です。
                リスク許容度が低い場合や、近い将来に取り崩す予定がある場合は「混合」も検討してください。
              </span>
            )}
            {hedgeSelection === 'hedged' && (
              <span>
                為替リスクを排除できますが、現在のヘッジコスト（年率3-5%）はリターンを大きく圧迫します。
                特に債券ファンドではリターンがほぼゼロになる可能性も。投資期間が5年以上なら「ヘッジなし」や「混合」の方がリターンが高くなる可能性があります。
              </span>
            )}
            {hedgeSelection === 'both' && (
              <span>
                バランスの取れた選択です。株式ファンドはヘッジなし（為替変動を許容）、債券ファンドはヘッジあり（低リターンをコストで削られないよう注意）という使い分けが効果的です。
                ポートフォリオ全体の30%程度をヘッジ付きにするのが一般的な目安です。
              </span>
            )}
          </div>

          {/* 注意事項 */}
          <p className="text-[10px] text-gray-400 leading-relaxed">
            ※上記は一般的な情報提供であり、投資助言ではありません。為替市場は予測困難であり、
            実際の投資判断は個人のリスク許容度・投資目的・資産状況を踏まえてご自身で行ってください。
          </p>
        </div>
      )}
    </div>
  );
}
