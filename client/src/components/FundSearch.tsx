import type { SearchFilters, FundCategory } from '../lib/types';

interface FundSearchProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
}

const categories: Array<{ value: FundCategory | ''; label: string }> = [
  { value: '', label: 'すべて' },
  { value: '国内株式', label: '国内株式' },
  { value: '先進国株式', label: '先進国株式' },
  { value: '新興国株式', label: '新興国株式' },
  { value: '全世界株式', label: '全世界株式' },
  { value: '国内債券', label: '国内債券' },
  { value: '海外債券', label: '海外債券' },
  { value: '新興国債券', label: '新興国債券' },
  { value: 'バランス型', label: 'バランス型' },
  { value: 'REIT', label: 'REIT' },
  { value: 'コモディティ', label: 'コモディティ' },
];

export default function FundSearch({ filters, onFiltersChange }: FundSearchProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">検索条件</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* カテゴリ */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">カテゴリ</label>
          <select
            value={filters.category}
            onChange={e => onFiltersChange({ ...filters, category: e.target.value as FundCategory | '' })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* データソース */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">データソース</label>
          <select
            value={filters.source}
            onChange={e => onFiltersChange({ ...filters, source: e.target.value as 'all' | 'wealthadvisor' | 'minkabu' })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">すべて</option>
            <option value="wealthadvisor">ウェルスアドバイザー</option>
            <option value="minkabu">MINKABU</option>
          </select>
        </div>

        {/* 最低リターン */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">最低リターン（1年, %）</label>
          <input
            type="number"
            value={filters.minReturn ?? ''}
            onChange={e => onFiltersChange({ ...filters, minReturn: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="例: 10"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 信託報酬上限 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">信託報酬上限（%）</label>
          <input
            type="number"
            step="0.01"
            value={filters.maxExpenseRatio ?? ''}
            onChange={e => onFiltersChange({ ...filters, maxExpenseRatio: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="例: 0.5"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* NISA */}
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.nisaOnly}
              onChange={e => onFiltersChange({ ...filters, nisaOnly: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">NISA対応のみ</span>
          </label>
        </div>

        {/* ソート */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">ソート</label>
          <div className="flex gap-2">
            <select
              value={filters.sortBy}
              onChange={e => onFiltersChange({ ...filters, sortBy: e.target.value as SearchFilters['sortBy'] })}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="score">おすすめスコア</option>
              <option value="return1y">1年リターン</option>
              <option value="return3y">3年リターン</option>
              <option value="return5y">5年リターン</option>
              <option value="return10y">10年リターン</option>
              <option value="sharpeRatio">シャープレシオ</option>
              <option value="expenseRatio">信託報酬</option>
              <option value="totalAssets">純資産総額</option>
            </select>
            <button
              onClick={() => onFiltersChange({ ...filters, sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              title={filters.sortOrder === 'desc' ? '降順' : '昇順'}
            >
              {filters.sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
