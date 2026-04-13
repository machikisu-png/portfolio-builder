import { useState, useMemo } from 'react';
import type { Fund, PortfolioItem, PortfolioPreset, RiskTolerance } from '../lib/types';
import { optimizePortfolio, generateEfficientFrontier } from '../lib/optimizer';
import { scoreFund, optimizeFundsForPreset, scoreLabel, scoreLabels, type ScoreBreakdown } from '../lib/fundScorer';
import PresetSelector from './PresetSelector';
import { portfolioPresets } from '../lib/presets';
import PortfolioChart from './PortfolioChart';
import ForexHedgeAdvisor from './ForexHedgeAdvisor';

interface PortfolioBuilderProps {
  selectedFunds: PortfolioItem[];
  allFunds: Fund[];
  onUpdateWeights: (items: PortfolioItem[]) => void;
  onGoToSimulation: () => void;
  disabled?: boolean;
  onPresetChange?: (presetId: string | null) => void;
}

// スコアバー（ミニ表示）
function MiniScoreBar({ score }: { score: ScoreBreakdown }) {
  const label = scoreLabel(score.total);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-20 bg-gray-200 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all bg-blue-500"
          style={{ width: `${score.total}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${label.color}`}>
        {score.total}点 {label.text}
      </span>
    </div>
  );
}

// スコア詳細ポップアップ
function ScoreDetail({ score }: { score: ScoreBreakdown }) {
  const items = Object.entries(scoreLabels) as Array<[keyof Omit<ScoreBreakdown, 'total'>, { name: string; max: number }]>;
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px] mt-1">
      {items.map(([key, { name, max }]) => {
        const val = score[key];
        const pct = (val / max) * 100;
        return (
          <div key={key} className="flex items-center gap-1">
            <span className="text-gray-500 w-14 truncate">{name}</span>
            <div className="w-10 bg-gray-200 rounded-full h-1">
              <div
                className={`h-1 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-gray-600 w-6 text-right">{val}/{max}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PortfolioBuilder({ selectedFunds, allFunds, onUpdateWeights, onGoToSimulation, disabled, onPresetChange }: PortfolioBuilderProps) {
  const [riskTolerance] = useState<RiskTolerance>('medium');
  const [showFrontier, setShowFrontier] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [forexHedge, setForexHedge] = useState<'none' | 'hedged' | 'both'>('none');
  const [expandedScore, setExpandedScore] = useState<string | null>(null);

  const handlePresetSelect = (preset: PortfolioPreset) => {
    if (disabled) return;
    setSelectedPreset(preset.id);
    onPresetChange?.(preset.id);

    // プリセットの目標リターン/リスクに合うようにファンドを最適選定（ヘッジ設定反映）
    const optimized = optimizeFundsForPreset(
      allFunds,
      preset.allocations,
      preset.expectedReturn,
      preset.risk,
      forexHedge,
    );

    const items: PortfolioItem[] = optimized.map(o => ({
      fund: o.fund,
      weight: o.weight,
    }));

    // 合計が100%にならない場合は正���化
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (items.length > 0 && Math.abs(totalWeight - 1) > 0.001) {
      onUpdateWeights(items.map(item => ({ ...item, weight: item.weight / totalWeight })));
    } else {
      onUpdateWeights(items);
    }
  };

  const handleWeightChange = (index: number, value: number) => {
    if (disabled) return;
    setSelectedPreset(null);
    onPresetChange?.(null);
    const updated = [...selectedFunds];
    updated[index] = { ...updated[index], weight: value / 100 };
    onUpdateWeights(updated);
  };

  const handleEqualWeight = () => {
    setSelectedPreset(null);
    const weight = 1 / selectedFunds.length;
    const updated = selectedFunds.map(item => ({ ...item, weight }));
    onUpdateWeights(updated);
  };

  const handleOptimize = () => {
    setSelectedPreset(null);
    const funds = selectedFunds.map(item => item.fund);
    const result = optimizePortfolio(funds, riskTolerance);
    const updated = selectedFunds.map((item, i) => ({
      ...item,
      weight: result.weights[i] || 0,
    }));
    onUpdateWeights(updated);
  };

  const handleRemoveFund = (index: number) => {
    setSelectedPreset(null);
    const updated = selectedFunds.filter((_, i) => i !== index);
    onUpdateWeights(updated);
  };

  const handleSwapFund = (index: number, newFund: Fund) => {
    const updated = [...selectedFunds];
    updated[index] = { ...updated[index], fund: newFund };
    onUpdateWeights(updated);
  };

  const totalWeight = selectedFunds.reduce((sum, item) => sum + item.weight, 0);
  const isValid = Math.abs(totalWeight - 1) < 0.02;

  // 各ファンドのスコア計算
  const fundScores = useMemo(() => {
    const map = new Map<string, ScoreBreakdown>();
    for (const item of selectedFunds) {
      map.set(item.fund.id, scoreFund(item.fund));
    }
    return map;
  }, [selectedFunds]);

  const frontierData = useMemo(() => {
    if (!showFrontier || selectedFunds.length < 2) return [];
    const funds = selectedFunds.map(i => i.fund);
    return generateEfficientFrontier(funds);
  }, [showFrontier, selectedFunds]);

  // 代替ファンド（スコア順）
  const alternativeFunds = useMemo(() => {
    const map = new Map<string, Array<{ fund: Fund; score: ScoreBreakdown }>>();
    for (const item of selectedFunds) {
      const cat = item.fund.category;
      if (!map.has(cat)) {
        const categoryAliases: Record<string, string[]> = {
          '海外債券': ['海外債券', '海外債券'],
        };
        const matchCats = categoryAliases[cat] || [cat];
        const candidates = allFunds
          .filter(f => matchCats.includes(f.category) && f.id !== item.fund.id)
          .map(f => ({ fund: f, score: scoreFund(f) }))
          .sort((a, b) => b.score.total - a.score.total)
          .slice(0, 8);
        map.set(cat, candidates);
      }
    }
    return map;
  }, [selectedFunds, allFunds]);

  // ポートフォリオ全体の平均スコア
  const avgScore = useMemo(() => {
    if (selectedFunds.length === 0) return 0;
    let total = 0;
    for (const item of selectedFunds) {
      const s = fundScores.get(item.fund.id);
      total += s ? s.total : 0;
    }
    return Math.round(total / selectedFunds.length);
  }, [selectedFunds, fundScores]);

  return (
    <div className="space-y-4">
      {/* プリセット選択 */}
      <PresetSelector selectedPreset={selectedPreset} onSelectPreset={handlePresetSelect} />

      {selectedFunds.length > 0 && (
        <>
          {/* 為替ヘッジ選択 */}
          <div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">為替ヘッジ</h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'none' as const, label: 'なし', desc: '為替変動の影響を受ける' },
                  { value: 'hedged' as const, label: 'あり', desc: '為替リスクを軽減' },
                  { value: 'both' as const, label: '混合', desc: '一部ヘッジあり・なし' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setForexHedge(opt.value);
                      // ヘッジ変更時にプリセットが選択済みなら再選定
                      if (selectedPreset) {
                        const preset = portfolioPresets.find(p => p.id === selectedPreset);
                        if (preset) {
                          const optimized = optimizeFundsForPreset(allFunds, preset.allocations, preset.expectedReturn, preset.risk, opt.value);
                          onUpdateWeights(optimized.map(o => ({ fund: o.fund, weight: o.weight })));
                        }
                      }
                    }}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      forexHedge === opt.value
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-[10px] mt-1 opacity-80">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 為替ヘッジアドバイス */}
          <ForexHedgeAdvisor hedgeSelection={forexHedge} investmentYears={10} />

          {/* 目標との比較（プリセット選択時） */}
          {selectedPreset && (() => {
            const preset = portfolioPresets.find(p => p.id === selectedPreset);
            if (!preset || selectedFunds.length === 0) return null;
            const actualReturn = selectedFunds.reduce((sum, item) => {
              const ret = item.fund.return10y ?? item.fund.return5y ?? item.fund.return3y ?? item.fund.return1y ?? 0;
              return sum + item.weight * ret;
            }, 0);
            // 計算表方式: 各資産の標準偏差×2の加重合算
            const actualRisk = (() => {
              const catRiskDefault: Record<string, number> = { '国内株式': 16, '先進国株式': 17, '新興国株式': 20, '全世界株式': 15, '国内債券': 2, '海外債券': 8, '新興国債券': 12, 'REIT': 17, 'コモディティ': 16, 'バランス型': 10 };
              let totalRisk = 0;
              for (const item of selectedFunds) {
                const sd = item.fund.stdDev ?? catRiskDefault[item.fund.category] ?? 15;
                totalRisk += item.weight * sd * 2; // 標準偏差×2（2σ）
              }
              return totalRisk;
            })();
            const returnDiff = actualReturn - preset.expectedReturn;
            const riskDiff = actualRisk - preset.risk;
            const returnMatch = Math.abs(returnDiff) < 2;
            const riskMatch = Math.abs(riskDiff) < 2;

            return (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">目標との比較</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-lg p-3 border-2 ${returnMatch ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'}`}>
                    <div className="text-xs text-gray-500 mb-1">期待リターン</div>
                    <div className="flex items-end gap-2">
                      <div>
                        <span className="text-xs text-gray-400">目標 </span>
                        <span className="text-lg font-bold text-gray-700">{preset.expectedReturn}%</span>
                      </div>
                      <span className="text-gray-300 text-lg">→</span>
                      <div>
                        <span className="text-xs text-gray-400">実際 </span>
                        <span className={`text-lg font-bold ${returnMatch ? 'text-green-700' : 'text-yellow-700'}`}>
                          {actualReturn.toFixed(1)}%
                        </span>
                      </div>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        returnMatch ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {returnDiff >= 0 ? '+' : ''}{returnDiff.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 border-2 ${riskMatch ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'}`}>
                    <div className="text-xs text-gray-500 mb-1">リスク（標準偏差）</div>
                    <div className="flex items-end gap-2">
                      <div>
                        <span className="text-xs text-gray-400">目標 </span>
                        <span className="text-lg font-bold text-gray-700">{preset.risk}%</span>
                      </div>
                      <span className="text-gray-300 text-lg">→</span>
                      <div>
                        <span className="text-xs text-gray-400">実際 </span>
                        <span className={`text-lg font-bold ${riskMatch ? 'text-green-700' : 'text-yellow-700'}`}>
                          {actualRisk.toFixed(1)}%
                        </span>
                      </div>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        riskMatch ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {riskDiff >= 0 ? '+' : ''}{riskDiff.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                {(!returnMatch || !riskMatch) && (
                  <div className="col-span-2 mt-1 bg-gray-50 rounded-lg p-2.5 text-[11px] text-gray-500 leading-relaxed">
                    {!returnMatch && Math.abs(returnDiff) > 3 && (
                      <p>* 積極運用型の目標リターンは過去の好況期データに基づく理論値です。年1回決算・分配金なし・低コスト等の優先条件を満たす実在ファンドでは、長期年率平均で差が出る場合があります。</p>
                    )}
                    {!riskMatch && (
                      <p>* リスクは資産間の相関（分散効果）を考慮した推定値です。実際のファンド標準偏差と理論値には差が生じます。</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 選定スコアサマリー */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-800">自動選定スコア</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">ポートフォリオ平均:</span>
                <span className={`text-lg font-bold px-2 py-0.5 rounded ${scoreLabel(avgScore).color}`}>
                  {avgScore}/100
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              年1回決算 / 分配金なし / 規模30億↑ / 標準偏差15-20% / シャープレシオ1.0-1.5 / 低コスト / 純資産↑ / 5-10年実績 / 楽天・SBI
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedFunds.map(item => {
                const s = fundScores.get(item.fund.id);
                const label = s ? scoreLabel(s.total) : { text: '-', color: 'text-gray-400 bg-gray-100' };
                return (
                  <div key={item.fund.id} className="text-[10px] flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                    <span className="truncate max-w-[120px]">{item.fund.name}</span>
                    <span className={`font-bold px-1 rounded ${label.color}`}>{s?.total ?? '-'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 配分設定 */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                配分設定
                <span className="text-xs font-normal text-gray-400 ml-2">（%は手動で変更可能）</span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleEqualWeight}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  均等配分
                </button>
                <button
                  onClick={handleOptimize}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  自動最適化
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {selectedFunds.map((item, index) => {
                const alternatives = alternativeFunds.get(item.fund.category) || [];
                const score = fundScores.get(item.fund.id);
                const isExpanded = expandedScore === item.fund.id;

                return (
                  <div key={`${item.fund.id}-${index}`} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        {/* カテゴリラベル */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            item.fund.category.includes('株式') ? 'bg-red-100 text-red-700' :
                            item.fund.category.includes('債券') ? 'bg-blue-100 text-blue-700' :
                            item.fund.category.includes('REIT') ? 'bg-pink-100 text-pink-700' :
                            item.fund.category.includes('コモディティ') ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.fund.category}
                          </span>
                          {item.fund.forexHedge !== null && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.fund.forexHedge ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                              {item.fund.forexHedge ? 'ヘッジあり' : 'ヘッジなし'}
                            </span>
                          )}
                        </div>
                        {/* ファンド名 */}
                        <div className="font-medium text-sm text-gray-900 truncate">{item.fund.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.fund.expenseRatio > 0 && `手数料: ${item.fund.expenseRatio.toFixed(3)}%`}
                          {item.fund.return5y !== null && ` | 5年: ${item.fund.return5y.toFixed(1)}%`}
                          {item.fund.sharpeRatio !== null && ` | SR: ${item.fund.sharpeRatio.toFixed(2)}`}
                          {item.fund.stdDev !== null && ` | SD: ${item.fund.stdDev.toFixed(1)}%`}
                        </div>
                        {/* スコア表示 */}
                        {score && (
                          <div className="mt-1">
                            <button
                              onClick={() => setExpandedScore(isExpanded ? null : item.fund.id)}
                              className="hover:opacity-80"
                            >
                              <MiniScoreBar score={score} />
                            </button>
                            {isExpanded && <ScoreDetail score={score} />}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round(item.weight * 100)}
                          onChange={e => handleWeightChange(index, parseInt(e.target.value))}
                          className="w-24"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.25"
                          value={Math.round(item.weight * 10000) / 100}
                          onChange={e => handleWeightChange(index, parseFloat(e.target.value) || 0)}
                          className="w-20 text-right border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <span className="text-sm text-gray-500 w-4">%</span>
                        <button
                          onClick={() => handleRemoveFund(index)}
                          className="text-red-400 hover:text-red-600 text-lg ml-1"
                          title="削除"
                        >
                          x
                        </button>
                      </div>
                    </div>
                    {/* ファンド差替え（スコア付き） */}
                    {alternatives.length > 0 && (
                      <div className="mt-2">
                        <select
                          value=""
                          onChange={e => {
                            const fund = allFunds.find(f => f.id === e.target.value);
                            if (fund) handleSwapFund(index, fund);
                          }}
                          className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 bg-white w-full max-w-md"
                        >
                          <option value="">ファンドを変更...</option>
                          {alternatives.map(a => (
                            <option key={a.fund.id} value={a.fund.id}>
                              [{a.score.total}点] {a.fund.name.length > 35 ? a.fund.name.substring(0, 35) + '...' : a.fund.name}
                              （SR:{a.fund.sharpeRatio?.toFixed(2) ?? '-'} / 手数料:{a.fund.expenseRatio.toFixed(3)}%）
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 合計 */}
            <div className={`mt-3 p-3 rounded-lg flex justify-between items-center ${
              isValid ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <span className={`text-sm font-medium ${isValid ? 'text-green-700' : 'text-red-700'}`}>
                合計: {(Math.round(totalWeight * 10000) / 100).toFixed(2)}%
              </span>
              {!isValid && (
                <span className="text-xs text-red-500">合計が100%になるよう調整してください</span>
              )}
            </div>
          </div>

          {/* チャート */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">ポートフォリオ分析</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showFrontier}
                  onChange={e => setShowFrontier(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                効率的フロンティア表示
              </label>
            </div>
            <PortfolioChart
              items={selectedFunds}
              showFrontier={showFrontier}
              frontierData={frontierData}
            />
          </div>

          {/* シミュレーションへ */}
          <div className="text-center">
            <button
              onClick={onGoToSimulation}
              disabled={!isValid}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              このポートフォリオでシミュレーション →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
