import { useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Fund } from '../lib/types';
import { scoreFund, scoreLabel, scoreLabels, type ScoreBreakdown } from '../lib/fundScorer';

interface FundDetailModalProps {
  fund: Fund;
  isSelected: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function formatAssets(n: number | null): string {
  if (n === null || n === 0) return '-';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}兆円`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}億円`;
  if (n >= 100) return `${(n / 100).toFixed(0)}億円`;
  return `${n}百万円`;
}

function trendLabel(t: string | null): { text: string; color: string } {
  if (t === 'up') return { text: '上昇傾向', color: 'text-green-600' };
  if (t === 'flat') return { text: '横ばい', color: 'text-yellow-600' };
  if (t === 'down') return { text: '下降傾向', color: 'text-red-600' };
  return { text: '不明', color: 'text-gray-400' };
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-700 w-10 text-right">{value}/{max}</span>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{children}</span>
    </div>
  );
}

export default function FundDetailModal({ fund, isSelected, onToggle, onClose }: FundDetailModalProps) {
  // ESCキーで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const score = scoreFund(fund);
  const label = scoreLabel(score.total);
  const trend = trendLabel(fund.assetTrend);

  // リターンチャートデータ
  const returnData = [
    { period: '1年', value: fund.return1y },
    { period: '3年', value: fund.return3y },
    { period: '5年', value: fund.return5y },
    { period: '10年', value: fund.return10y },
  ].filter(d => d.value !== null) as Array<{ period: string; value: number }>;

  const scoreItems = Object.entries(scoreLabels) as Array<[keyof Omit<ScoreBreakdown, 'total'>, { name: string; max: number }]>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between rounded-t-xl z-10">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{fund.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{fund.category}</span>
              {fund.nisaEligible && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-bold">NISA対応</span>
              )}
              {fund.forexHedge !== null && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${fund.forexHedge ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                  為替ヘッジ{fund.forexHedge ? 'あり' : 'なし'}
                </span>
              )}
              <span className={`px-2 py-0.5 text-xs rounded-full ${fund.source === 'wealthadvisor' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                {fund.source === 'wealthadvisor' ? 'ウェルスアドバイザー' : 'MINKABU'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-1">
            &times;
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* 基本情報 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">基本情報</h3>
            <div className="bg-gray-50 rounded-lg p-3">
              <InfoRow label="基準価額">
                {fund.nav.toLocaleString()}円
                <span className={`ml-2 text-xs ${fund.navChange >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  ({fund.navChange >= 0 ? '+' : ''}{fund.navChange})
                </span>
              </InfoRow>
              <InfoRow label="純資産総額">{formatAssets(fund.totalAssets)}</InfoRow>
              <InfoRow label="ファンド規模">{formatAssets(fund.fundSizeMillions)}</InfoRow>
              <InfoRow label="純資産推移">
                <span className={trend.color}>{trend.text}</span>
              </InfoRow>
              <InfoRow label="設定年">
                {fund.inceptionYear ? `${fund.inceptionYear}年（${new Date().getFullYear() - fund.inceptionYear}年目）` : '-'}
              </InfoRow>
            </div>
          </section>

          {/* コスト */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">コスト</h3>
            <div className="bg-gray-50 rounded-lg p-3">
              <InfoRow label="信託報酬（税込）">
                <span className={fund.expenseRatio <= 0.2 ? 'text-green-700 font-bold' : ''}>{fund.expenseRatio > 0 ? `${fund.expenseRatio.toFixed(4)}%` : '-'}</span>
              </InfoRow>
              <InfoRow label="決算頻度">{fund.settlementFrequency !== null ? `年${fund.settlementFrequency}回` : '-'}</InfoRow>
              <InfoRow label="分配金">
                {fund.distributionAmount !== null
                  ? (fund.distributionAmount === 0 ? <span className="text-green-700 font-bold">なし（再投資）</span> : `${fund.distributionAmount}円`)
                  : '-'}
              </InfoRow>
            </div>
          </section>

          {/* パフォーマンス */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">パフォーマンス</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-blue-500 mb-0.5">シャープレシオ</div>
                <div className="text-xl font-bold text-blue-800">{fund.sharpeRatio?.toFixed(2) ?? '-'}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-orange-500 mb-0.5">標準偏差</div>
                <div className="text-xl font-bold text-orange-800">{fund.stdDev?.toFixed(1) ?? '-'}%</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-green-500 mb-0.5">1年リターン</div>
                <div className={`text-xl font-bold ${(fund.return1y ?? 0) >= 0 ? 'text-red-700' : 'text-blue-700'}`}>
                  {fund.return1y?.toFixed(1) ?? '-'}%
                </div>
              </div>
            </div>

            {returnData.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={returnData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'リターン']} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {returnData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.value >= 0 ? '#3B82F6' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* 選定スコア */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
              <span>選定スコア</span>
              <span className={`text-base font-bold px-2 py-0.5 rounded ${label.color}`}>{score.total}/100 {label.text}</span>
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              {scoreItems.map(([key, { name, max }]) => (
                <ScoreBar key={key} label={name} value={score[key]} max={max} />
              ))}
            </div>
          </section>

          {/* 販売会社 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">販売会社</h3>
            <div className="flex flex-wrap gap-2">
              {fund.sellers.length > 0 ? fund.sellers.map(s => (
                <span key={s} className={`px-2.5 py-1 text-xs rounded-full ${
                  s.includes('楽天') ? 'bg-red-50 text-red-700 border border-red-200' :
                  s.includes('SBI') ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  'bg-gray-100 text-gray-700 border border-gray-200'
                }`}>
                  {s}
                </span>
              )) : (
                <span className="text-xs text-gray-400">情報なし</span>
              )}
            </div>
          </section>
        </div>

        {/* フッター */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            閉じる
          </button>
          <button
            onClick={onToggle}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSelected ? 'ポートフォリオから外す' : 'ポートフォリオに追加'}
          </button>
        </div>
      </div>
    </div>
  );
}
