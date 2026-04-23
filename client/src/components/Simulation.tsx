import { useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { PortfolioItem } from '../lib/types';
import { calcPortfolioStats, runSimulation, runSpreadsheetSimulation, type SimMode } from '../lib/optimizer';
import { useCalcMode } from '../hooks/useCalcMode';

interface SimulationProps {
  portfolioItems: PortfolioItem[];
  savedAge: number | null;
  onAgeChange: (age: number | null) => void;
  presetRisk?: number; // プリセットの目標リスク値
  presetExpectedReturn?: number; // プリセットの目標リターン値
}

function formatYen(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`;
  if (n >= 10000) return `${Math.round(n / 10000)}万円`;
  return `${n.toLocaleString()}円`;
}

// ライフイベントのマイルストーン
function getLifeEvents(currentAge: number, years: number): Array<{ age: number; label: string }> {
  const events: Array<{ age: number; label: string }> = [];
  const endAge = currentAge + years;

  const milestones = [
    { age: 30, label: '30歳' },
    { age: 35, label: '35歳' },
    { age: 40, label: '40歳' },
    { age: 45, label: '45歳' },
    { age: 50, label: '50歳' },
    { age: 55, label: '55歳' },
    { age: 60, label: '60歳 定年' },
    { age: 65, label: '65歳 年金受給' },
    { age: 70, label: '70歳' },
    { age: 75, label: '75歳' },
    { age: 80, label: '80歳' },
  ];

  for (const m of milestones) {
    if (m.age > currentAge && m.age <= endAge) {
      events.push(m);
    }
  }
  return events;
}

export default function Simulation({ portfolioItems, savedAge, onAgeChange, presetRisk, presetExpectedReturn }: SimulationProps) {
  const [calcMode] = useCalcMode();
  const [monthlyInvestment, setMonthlyInvestment] = useState(30000);
  const [years, setYears] = useState(20);
  const [simMode, setSimMode] = useState<SimMode>('spreadsheet');
  const [currentAge, setCurrentAge] = useState<number | null>(savedAge);

  // savedAgeが外部から変わったら同期
  const prevSavedAge = savedAge;
  if (prevSavedAge !== null && currentAge === null) {
    setCurrentAge(prevSavedAge);
  }

  // 入力確定時に親に通知（blurイベントで）
  const handleAgeBlur = () => {
    onAgeChange(currentAge);
  };

  const stats = useMemo(() => {
    if (portfolioItems.length === 0) return null;
    const funds = portfolioItems.map(i => i.fund);
    const weights = portfolioItems.map(i => i.weight);
    const base = calcPortfolioStats(funds, weights, calcMode);
    // プリセットの目標値があればそちらを使用（計算表と一致）
    if (presetRisk !== undefined || presetExpectedReturn !== undefined) {
      return {
        ...base,
        risk: presetRisk ?? base.risk,
        expectedReturn: presetExpectedReturn ?? base.expectedReturn,
      };
    }
    return base;
  }, [portfolioItems, presetRisk, presetExpectedReturn, calcMode]);

  const simulation = useMemo(() => {
    if (!stats) return null;
    if (simMode === 'spreadsheet') {
      return runSpreadsheetSimulation(monthlyInvestment, years, stats.expectedReturn, stats.risk);
    }
    return runSimulation(monthlyInvestment, years, stats.expectedReturn, stats.risk);
  }, [monthlyInvestment, years, stats, simMode]);

  if (portfolioItems.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500 text-lg mb-2">ポートフォリオが未設定です</p>
        <p className="text-gray-400 text-sm">「ポートフォリオ構築」タブで配分を設定してください</p>
      </div>
    );
  }

  const hasAge = currentAge !== null && currentAge > 0;

  const chartData = simulation
    ? simulation.months.filter((_, i) => i % 12 === 0 || i === simulation.months.length - 1).map((month) => {
        const idx = simulation.months.indexOf(month);
        const yearNum = Math.floor(month / 12);
        return {
          label: hasAge ? `${currentAge + yearNum}歳` : `${yearNum}年`,
          yearNum,
          age: hasAge ? currentAge + yearNum : null,
          楽観: simulation.optimistic[idx],
          標準: simulation.expected[idx],
          悲観: simulation.pessimistic[idx],
          投資元本: simulation.totalInvested[idx],
        };
      })
    : [];

  const finalExpected = simulation ? simulation.expected[simulation.expected.length - 1] : 0;
  const finalOptimistic = simulation ? simulation.optimistic[simulation.optimistic.length - 1] : 0;
  const finalPessimistic = simulation ? simulation.pessimistic[simulation.pessimistic.length - 1] : 0;
  const totalInvested = monthlyInvestment * years * 12;

  // ライフイベント
  const lifeEvents = hasAge ? getLifeEvents(currentAge, years) : [];

  // 年齢別の資産テーブル（5年刻み）
  const ageTable = hasAge && simulation ? (() => {
    const rows: Array<{ age: number; year: number; invested: number; expected: number; optimistic: number; pessimistic: number }> = [];
    for (let y = 5; y <= years; y += 5) {
      const idx = y * 12;
      if (idx < simulation.months.length) {
        rows.push({
          age: currentAge + y,
          year: y,
          invested: simulation.totalInvested[idx],
          expected: simulation.expected[idx],
          optimistic: simulation.optimistic[idx],
          pessimistic: simulation.pessimistic[idx],
        });
      }
    }
    // 最終年も追加（5年刻みに含まれない場合）
    const lastIdx = simulation.months.length - 1;
    const lastYear = Math.floor(simulation.months[lastIdx] / 12);
    if (lastYear % 5 !== 0) {
      rows.push({
        age: currentAge + lastYear,
        year: lastYear,
        invested: simulation.totalInvested[lastIdx],
        expected: simulation.expected[lastIdx],
        optimistic: simulation.optimistic[lastIdx],
        pessimistic: simulation.pessimistic[lastIdx],
      });
    }
    return rows;
  })() : [];

  return (
    <div className="space-y-4">
      {/* 計算方式の切替 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">計算方式</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSimMode('spreadsheet')}
            className={`p-2.5 rounded-lg border-2 text-left transition-all ${
              simMode === 'spreadsheet'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-sm">計算表方式</div>
            <div className="text-[10px] mt-0.5 opacity-80">FV複利計算（確定値）</div>
          </button>
          <button
            onClick={() => setSimMode('montecarlo')}
            className={`p-2.5 rounded-lg border-2 text-left transition-all ${
              simMode === 'montecarlo'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-sm">モンテカルロ方式</div>
            <div className="text-[10px] mt-0.5 opacity-80">1000回試行の確率分布</div>
          </button>
        </div>
      </div>

      {/* 入力パラメータ */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">積立条件</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 現在の年齢 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              現在の年齢
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                autoComplete="off"
                value={currentAge ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  setCurrentAge(v === '' ? null : parseInt(v));
                }}
                onBlur={handleAgeBlur}
                onFocus={e => e.target.select()}
                placeholder="35"
                style={{ fontSize: '16px' }}
                className="w-full max-w-[120px] border-2 border-gray-300 rounded-lg px-3 py-3 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-sm text-gray-500">歳</span>
            </div>
            {hasAge && (
              <div className="text-xs text-gray-400 mt-1">
                {currentAge + years}歳まで積立
              </div>
            )}
          </div>

          {/* 毎月の積立額 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              毎月の積立額
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="5000"
                max="200000"
                step="5000"
                value={monthlyInvestment}
                onChange={e => setMonthlyInvestment(parseInt(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min="1000"
                max="1000000"
                step="1000"
                value={monthlyInvestment}
                onChange={e => setMonthlyInvestment(parseInt(e.target.value) || 0)}
                className="w-28 border border-gray-300 rounded px-3 py-2 text-right text-sm"
              />
              <span className="text-sm text-gray-500">円</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              年間: {(monthlyInvestment * 12).toLocaleString()}円
            </div>
          </div>

          {/* 投資期間 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              投資期間
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="40"
                value={years}
                onChange={e => setYears(parseInt(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min="1"
                max="50"
                value={years}
                onChange={e => setYears(parseInt(e.target.value) || 1)}
                className="w-20 border border-gray-300 rounded px-3 py-2 text-right text-sm"
              />
              <span className="text-sm text-gray-500">年</span>
            </div>
          </div>
        </div>

        {stats && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            ポートフォリオ: 期待リターン {stats.expectedReturn.toFixed(1)}%/年 |
            リスク {stats.risk.toFixed(1)}%/年 |
            シャープレシオ {stats.sharpeRatio.toFixed(2)}
          </div>
        )}
      </div>

      {/* 結果サマリー */}
      {simulation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-sm text-gray-500 mb-1">投資元本</div>
            <div className="text-xl font-bold text-gray-800">{formatYen(totalInvested)}</div>
            {hasAge && <div className="text-xs text-gray-400 mt-1">{currentAge}歳→{currentAge + years}歳</div>}
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4 text-center">
            <div className="text-sm text-green-600 mb-1">楽観シナリオ</div>
            <div className="text-xl font-bold text-green-800">{formatYen(finalOptimistic)}</div>
            <div className="text-xs text-green-500">
              +{formatYen(finalOptimistic - totalInvested)}（{((finalOptimistic / totalInvested - 1) * 100).toFixed(0)}%）
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 text-center">
            <div className="text-sm text-blue-600 mb-1">標準シナリオ</div>
            <div className="text-xl font-bold text-blue-800">{formatYen(finalExpected)}</div>
            <div className="text-xs text-blue-500">
              +{formatYen(finalExpected - totalInvested)}（{((finalExpected / totalInvested - 1) * 100).toFixed(0)}%）
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg shadow p-4 text-center">
            <div className="text-sm text-orange-600 mb-1">悲観シナリオ</div>
            <div className="text-xl font-bold text-orange-800">{formatYen(finalPessimistic)}</div>
            <div className="text-xs text-orange-500">
              {finalPessimistic >= totalInvested ? '+' : ''}{formatYen(finalPessimistic - totalInvested)}（{((finalPessimistic / totalInvested - 1) * 100).toFixed(0)}%）
            </div>
          </div>
        </div>
      )}

      {/* チャート */}
      {simulation && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            資産推移シミュレーション
            {hasAge && <span className="text-sm font-normal text-gray-400 ml-2">（{currentAge}歳〜{currentAge + years}歳）</span>}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            {simMode === 'spreadsheet'
              ? 'FV複利計算（計算表方式）に基づく標準/楽観/悲観シナリオ'
              : 'モンテカルロシミュレーション（1,000回試行）に基づく25%/50%/75%パーセンタイル'}
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={hasAge && years > 20 ? 4 : years > 15 ? 2 : 1} />
              <YAxis
                tickFormatter={v => formatYen(v)}
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Tooltip
                formatter={(value: any, name: any) => [formatYen(Number(value)), String(name)]}
                labelFormatter={label => String(label)}
              />
              <Legend />
              <Area type="monotone" dataKey="楽観" stroke="#10B981" fill="#D1FAE5" strokeWidth={1.5} />
              <Area type="monotone" dataKey="標準" stroke="#3B82F6" fill="#DBEAFE" strokeWidth={2} />
              <Area type="monotone" dataKey="悲観" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={1.5} />
              <Area type="monotone" dataKey="投資元本" stroke="#9CA3AF" fill="none" strokeDasharray="5 5" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>

          {/* ライフイベントマーカー */}
          {lifeEvents.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {lifeEvents.map(e => {
                const yearIdx = e.age - currentAge!;
                const monthIdx = yearIdx * 12;
                const amount = monthIdx < simulation.expected.length ? simulation.expected[monthIdx] : finalExpected;
                return (
                  <div key={e.age} className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs">
                    <span className="font-bold text-indigo-700">{e.label}</span>
                    <span className="text-gray-500 ml-2">標準: {formatYen(amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 年齢別資産テーブル */}
      {hasAge && ageTable.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">年齢別の資産予測</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-4 py-2 text-left">年齢</th>
                  <th className="px-4 py-2 text-left">経過年数</th>
                  <th className="px-4 py-2 text-right">投資元本</th>
                  <th className="px-4 py-2 text-right">悲観</th>
                  <th className="px-4 py-2 text-right">標準</th>
                  <th className="px-4 py-2 text-right">楽観</th>
                  <th className="px-4 py-2 text-right">標準の損益</th>
                </tr>
              </thead>
              <tbody>
                {ageTable.map(row => {
                  const gain = row.expected - row.invested;
                  const gainPct = row.invested > 0 ? ((gain / row.invested) * 100).toFixed(0) : '0';
                  return (
                    <tr key={row.age} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-bold text-gray-800">
                        {row.age}歳
                        {row.age === 60 && <span className="text-[10px] text-orange-500 ml-1">定年</span>}
                        {row.age === 65 && <span className="text-[10px] text-blue-500 ml-1">年金</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{row.year}年目</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatYen(row.invested)}</td>
                      <td className="px-4 py-2.5 text-right text-orange-600">{formatYen(row.pessimistic)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-blue-700">{formatYen(row.expected)}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{formatYen(row.optimistic)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${gain >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {gain >= 0 ? '+' : ''}{formatYen(gain)}（{gain >= 0 ? '+' : ''}{gainPct}%）
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
