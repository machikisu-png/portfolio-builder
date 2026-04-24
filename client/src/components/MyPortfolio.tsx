import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { PortfolioItem } from '../lib/types';
import { portfolioPresets } from '../lib/presets';
import { scoreFund, scoreLabel } from '../lib/fundScorer';
import { useMonthlyInvestment } from '../hooks/useMonthlyInvestment';
import { exportPortfolioToExcel } from '../lib/excelExport';
import Simulation from './Simulation';

interface MyPortfolioProps {
  items: PortfolioItem[];
  presetId: string | null;
  confirmed: boolean;
  onConfirm: () => void;
  onUnlock: () => void;
  onGoToBuilder: () => void;
  savedAge: number | null;
  onAgeChange: (age: number | null) => void;
}

const COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

export default function MyPortfolio({ items, presetId, confirmed, onConfirm, onUnlock, onGoToBuilder, savedAge, onAgeChange }: MyPortfolioProps) {
  const [subTab, setSubTab] = useState<'overview' | 'simulation'>('overview');
  const [exportYears, setExportYears] = useState(20);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [monthlyInvestment] = useMonthlyInvestment();
  const preset = presetId ? portfolioPresets.find(p => p.id === presetId) : null;

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportPortfolioToExcel(items, monthlyInvestment, exportYears, preset?.name);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'エクセル出力に失敗しました');
    } finally {
      setExporting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500 text-lg mb-2">ポートフォリオが未設定です</p>
        <p className="text-gray-400 text-sm mb-4">「ポートフォリオ構築」タブでタイプを選択し、配分を設定してください</p>
        <button
          onClick={onGoToBuilder}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          ポートフォリオを構築する
        </button>
      </div>
    );
  }

  const pieData = items.filter(i => i.weight > 0).map(i => ({
    name: i.fund.name.length > 20 ? i.fund.name.substring(0, 20) + '...' : i.fund.name,
    category: i.fund.category,
    value: Math.round(i.weight * 100),
  }));

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);

  return (
    <div className="space-y-4">
      {/* 確定ステータス */}
      <div className={`rounded-lg border-2 p-4 ${confirmed ? 'border-green-400 bg-green-50' : 'border-yellow-400 bg-yellow-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{confirmed ? '\u2705' : '\u270f\ufe0f'}</span>
            <div>
              <div className={`font-semibold ${confirmed ? 'text-green-800' : 'text-yellow-800'}`}>
                {confirmed ? 'ポートフォリオ確定済み' : 'ポートフォリオ未確定'}
              </div>
              <div className="text-xs text-gray-500">
                {confirmed
                  ? '変更するには「ロック解除」してから「ポートフォリオ構築」タブで編集してください'
                  : '内容を確認し、問題なければ「確定する」ボタンを押してください'}
              </div>
            </div>
          </div>
          {confirmed ? (
            <button onClick={onUnlock} className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              ロック解除
            </button>
          ) : (
            <button onClick={onConfirm} className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors">
              確定する
            </button>
          )}
        </div>
      </div>

      {/* サブタブ */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setSubTab('overview')}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              subTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ポートフォリオ概要
          </button>
          <button
            onClick={() => setSubTab('simulation')}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              subTab === 'simulation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            積立シミュレーション
          </button>
        </div>
      </div>

      {subTab === 'overview' && (
        <>
          {/* ポートフォリオタイプ */}
          {preset && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm text-gray-500 mb-1">選択中のポートフォリオタイプ</h3>
              <div className="text-lg font-bold text-gray-900">{preset.name}</div>
              <div className="text-sm text-gray-500 mt-0.5">{preset.subtitle}</div>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-blue-600">目標リターン: {preset.expectedReturn}%</span>
                <span className="text-orange-600">目標リスク: {preset.risk}%</span>
              </div>
            </div>
          )}

          {/* エクセル出力 */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">エクセル計算表に出力</h3>
            <p className="text-xs text-gray-500 mb-3">
              「ポートフォリオ計算表.xlsx」のフォーマットに合わせて、選定ファンドの投資額・利回り・標準偏差・ファンド名を埋めてダウンロードします。
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">積立年数</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={exportYears}
                  onChange={e => setExportYears(Math.max(1, Math.min(50, parseInt(e.target.value) || 20)))}
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-right text-sm"
                />
                <span className="text-xs text-gray-500">年</span>
              </div>
              <div className="text-xs text-gray-500">
                月額 <span className="font-semibold text-gray-700">{monthlyInvestment.toLocaleString()}円</span>
                → 総投資額 <span className="font-semibold text-gray-700">{(monthlyInvestment * 12 * exportYears).toLocaleString()}円</span>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="ml-auto px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:bg-gray-300 transition-colors"
              >
                {exporting ? '出力中...' : '📊 エクセル出力'}
              </button>
            </div>
            {exportError && (
              <div className="mt-2 text-xs text-red-600">エラー: {exportError}</div>
            )}
          </div>


          {/* 配分一覧 */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">配分設定</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="px-3 py-2 text-left">カテゴリ</th>
                      <th className="px-3 py-2 text-left">ファンド名</th>
                      <th className="px-3 py-2 text-right">配分</th>
                      <th className="px-3 py-2 text-right">スコア</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const s = scoreFund(item.fund);
                      const label = scoreLabel(s.total);
                      return (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-3 py-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              item.fund.category.includes('株式') ? 'bg-red-100 text-red-700' :
                              item.fund.category.includes('債券') ? 'bg-blue-100 text-blue-700' :
                              item.fund.category.includes('REIT') ? 'bg-pink-100 text-pink-700' :
                              item.fund.category.includes('コモディティ') ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{item.fund.category}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-900 text-xs max-w-[200px] truncate">{item.fund.name}</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-800">{Math.round(item.weight * 100)}%</td>
                          <td className="px-3 py-2 text-right">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${label.color}`}>{s.total}</span>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td colSpan={2} className="px-3 py-2 font-semibold text-gray-700">合計</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{Math.round(totalWeight * 100)}%</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={95} dataKey="value"
                      label={({ value }) => `${value}%`} labelLine={false}>
                      {pieData.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ファンド詳細カード */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">選定ファンド詳細</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.fund.category.includes('株式') ? 'bg-red-100 text-red-700' :
                      item.fund.category.includes('債券') ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{item.fund.category}</span>
                    <span className="font-bold text-lg text-gray-800">{Math.round(item.weight * 100)}%</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900 mb-1">{item.fund.name}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500">
                    <span>基準価額: <span className="text-gray-700">{item.fund.nav.toLocaleString()}円</span></span>
                    <span>信託報酬: <span className="text-gray-700">{item.fund.expenseRatio > 0 ? `${item.fund.expenseRatio.toFixed(3)}%` : '-'}</span></span>
                    <span>1年リターン: <span className={`${(item.fund.return1y ?? 0) >= 0 ? 'text-red-600' : 'text-blue-600'}`}>{item.fund.return1y?.toFixed(1) ?? '-'}%</span></span>
                    <span>5年リターン: <span className="text-gray-700">{item.fund.return5y?.toFixed(1) ?? '-'}%</span></span>
                    <span>シャープレシオ: <span className="text-gray-700">{item.fund.sharpeRatio?.toFixed(2) ?? '-'}</span></span>
                    <span>標準偏差: <span className="text-gray-700">{item.fund.stdDev?.toFixed(1) ?? '-'}%</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {subTab === 'simulation' && (
        <>
          {!confirmed && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm text-yellow-800">
              ポートフォリオを確定するとシミュレーション結果が保証されます。未確定でもプレビューは可能です。
            </div>
          )}
          <Simulation portfolioItems={items} savedAge={savedAge} onAgeChange={onAgeChange} presetRisk={preset?.risk} presetExpectedReturn={preset?.expectedReturn} />
        </>
      )}
    </div>
  );
}
