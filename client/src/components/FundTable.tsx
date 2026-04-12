import type { Fund, PortfolioItem } from '../lib/types';
import { scoreFund, scoreLabel } from '../lib/fundScorer';

interface FundTableProps {
  funds: Fund[];
  loading: boolean;
  error: string | null;
  selectedFunds: PortfolioItem[];
  onToggleFund: (fund: Fund) => void;
  onShowDetail: (fund: Fund) => void;
}

function formatNumber(n: number | null, decimals: number = 1): string {
  if (n === null || n === undefined) return '-';
  return n.toFixed(decimals);
}

function returnColor(n: number | null): string {
  if (n === null) return 'text-gray-400';
  if (n > 0) return 'text-red-600';
  if (n < 0) return 'text-blue-600';
  return 'text-gray-600';
}

// スマホ用カードビュー
function FundCard({ fund, selected, onToggle, onDetail }: { fund: Fund; selected: boolean; onToggle: () => void; onDetail: () => void }) {
  const s = scoreFund(fund);
  const label = scoreLabel(s.total);
  return (
    <div
      className={`p-3 border rounded-lg transition-colors ${selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 mt-1 text-blue-600 rounded flex-shrink-0"
          onClick={e => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">{fund.category}</span>
            {fund.nisaEligible && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">NISA</span>}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${label.color}`}>{s.total}点</span>
          </div>
          <div className="text-sm font-medium text-gray-900 leading-tight">{fund.name}</div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 mt-1.5 text-[11px]">
            <span className="text-gray-500">基準価額 <span className="text-gray-800 font-mono">{fund.nav.toLocaleString()}</span></span>
            <span className="text-gray-500">手数料 <span className="text-gray-800 font-mono">{formatNumber(fund.expenseRatio, 3)}%</span></span>
            <span className="text-gray-500">SR <span className="text-gray-800 font-mono">{formatNumber(fund.sharpeRatio, 2)}</span></span>
            <span className={returnColor(fund.return1y)}>1年 {formatNumber(fund.return1y)}%</span>
            <span className={returnColor(fund.return5y)}>5年 {formatNumber(fund.return5y)}%</span>
            <span className={returnColor(fund.return10y)}>10年 {formatNumber(fund.return10y)}%</span>
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDetail(); }}
          className="shrink-0 w-7 h-7 rounded-full bg-gray-100 hover:bg-blue-500 hover:text-white text-gray-500 text-xs font-bold flex items-center justify-center transition-colors"
        >
          i
        </button>
      </div>
    </div>
  );
}

export default function FundTable({ funds, loading, error, selectedFunds, onToggleFund, onShowDetail }: FundTableProps) {
  const isSelected = (fund: Fund) => selectedFunds.some(sf => sf.fund.id === fund.id);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-gray-500">ファンドデータを取得中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-red-500">エラー: {error}</p>
        <p className="text-sm text-gray-500 mt-2">サーバーが起動しているか確認してください</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-lg shadow px-3 sm:px-4 py-2 mb-2 flex justify-between items-center">
        <span className="text-xs sm:text-sm text-gray-600">{funds.length}件のファンド</span>
        <span className="text-xs sm:text-sm text-gray-500">{selectedFunds.length}件選択中</span>
      </div>

      {/* スマホ: カードビュー */}
      <div className="sm:hidden space-y-2">
        {funds.map(fund => (
          <FundCard
            key={fund.id}
            fund={fund}
            selected={isSelected(fund)}
            onToggle={() => onToggleFund(fund)}
            onDetail={() => onShowDetail(fund)}
          />
        ))}
      </div>

      {/* PC: テーブルビュー */}
      <div className="hidden sm:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2 min-w-[200px]">ファンド名</th>
                <th className="px-3 py-2">カテゴリ</th>
                <th className="px-3 py-2 text-right">基準価額</th>
                <th className="px-3 py-2 text-right">信託報酬</th>
                <th className="px-3 py-2 text-right">1年</th>
                <th className="px-3 py-2 text-right">3年</th>
                <th className="px-3 py-2 text-right">5年</th>
                <th className="px-3 py-2 text-right">10年</th>
                <th className="px-3 py-2 text-right">シャープ</th>
                <th className="px-3 py-2 text-center">NISA</th>
                <th className="px-3 py-2 text-center">スコア</th>
                <th className="px-3 py-2">ソース</th>
              </tr>
            </thead>
            <tbody>
              {funds.map(fund => (
                <tr
                  key={fund.id}
                  className={`border-t border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors ${isSelected(fund) ? 'bg-blue-50' : ''}`}
                  onClick={() => onToggleFund(fund)}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={isSelected(fund)} onChange={() => onToggleFund(fund)} className="w-4 h-4 text-blue-600 rounded" onClick={e => e.stopPropagation()} />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[300px]">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{fund.name}</span>
                      <button onClick={e => { e.stopPropagation(); onShowDetail(fund); }} className="shrink-0 w-5 h-5 rounded-full bg-gray-200 hover:bg-blue-500 hover:text-white text-gray-500 text-[10px] font-bold flex items-center justify-center transition-colors" title="詳細を見る">i</button>
                    </div>
                  </td>
                  <td className="px-3 py-2"><span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{fund.category}</span></td>
                  <td className="px-3 py-2 text-right font-mono">{fund.nav.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatNumber(fund.expenseRatio, 3)}%</td>
                  <td className={`px-3 py-2 text-right font-mono ${returnColor(fund.return1y)}`}>{formatNumber(fund.return1y)}%</td>
                  <td className={`px-3 py-2 text-right font-mono ${returnColor(fund.return3y)}`}>{formatNumber(fund.return3y)}%</td>
                  <td className={`px-3 py-2 text-right font-mono ${returnColor(fund.return5y)}`}>{formatNumber(fund.return5y)}%</td>
                  <td className={`px-3 py-2 text-right font-mono ${returnColor(fund.return10y)}`}>{formatNumber(fund.return10y)}%</td>
                  <td className="px-3 py-2 text-right font-mono">{formatNumber(fund.sharpeRatio, 2)}</td>
                  <td className="px-3 py-2 text-center">{fund.nisaEligible ? <span className="text-green-600 font-bold text-xs">NISA</span> : <span className="text-gray-300">-</span>}</td>
                  <td className="px-3 py-2 text-center">{(() => { const s = scoreFund(fund); const l = scoreLabel(s.total); return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${l.color}`}>{s.total}</span>; })()}</td>
                  <td className="px-3 py-2"><span className={`text-xs ${fund.source === 'wealthadvisor' ? 'text-purple-600' : 'text-orange-600'}`}>{fund.source === 'wealthadvisor' ? 'WA' : 'MK'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {funds.length === 0 && (
        <div className="p-8 text-center text-gray-500">条件に合うファンドが見つかりません</div>
      )}
    </div>
  );
}
